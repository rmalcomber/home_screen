use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tile {
    #[serde(default, deserialize_with = "null_as_zero")]
    pub id: i64,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub x: i64,
    #[serde(default)]
    pub y: i64,
    #[serde(default = "d_w")]
    pub w: i64,
    #[serde(default = "d_h")]
    pub h: i64,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default)]
    pub config: Value,
    /// Accent colour name from the palette (None = default).
    #[serde(default)]
    pub color: Option<String>,
    /// The group tile this tile sits in (None = directly on the page).
    #[serde(default)]
    pub parent_id: Option<i64>,
    /// The page the tile lives on (0 = the first page).
    #[serde(default)]
    pub page_id: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Page {
    #[serde(default, deserialize_with = "null_as_zero")]
    pub id: i64,
    pub name: String,
    /// "free" (drag anywhere) or "columns" (fixed equal-width columns).
    #[serde(default = "d_mode")]
    pub mode: String,
    #[serde(default = "d_cols")]
    pub cols: i64,
    #[serde(default)]
    pub position: i64,
}
fn d_mode() -> String {
    "free".into()
}
fn d_cols() -> i64 {
    3
}
fn null_as_zero<'de, D: serde::Deserializer<'de>>(d: D) -> Result<i64, D::Error> {
    Ok(Option::<i64>::deserialize(d)?.unwrap_or(0))
}
fn d_w() -> i64 {
    4
}
fn d_h() -> i64 {
    6
}

#[derive(Deserialize)]
pub struct LayoutItem {
    pub id: i64,
    pub x: i64,
    pub y: i64,
    pub w: i64,
    pub h: i64,
    pub collapsed: bool,
    #[serde(default)]
    pub parent_id: Option<i64>,
    /// 0 = leave the page unchanged.
    #[serde(default)]
    pub page_id: i64,
}

#[derive(Serialize)]
pub struct IconInfo {
    pub id: i64,
    pub name: String,
}

pub fn open(path: &str) -> rusqlite::Result<Connection> {
    let c = Connection::open(path)?;
    c.execute_batch(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
         CREATE TABLE IF NOT EXISTS tiles(
            id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL,
            icon TEXT, x INTEGER NOT NULL DEFAULT 0, y INTEGER NOT NULL DEFAULT 0,
            w INTEGER NOT NULL DEFAULT 4, h INTEGER NOT NULL DEFAULT 6,
            collapsed INTEGER NOT NULL DEFAULT 0, config TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE IF NOT EXISTS icons(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, svg TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS images(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mime TEXT NOT NULL, data BLOB NOT NULL);
         CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS pages(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'free', cols INTEGER NOT NULL DEFAULT 3,
            position INTEGER NOT NULL DEFAULT 0);",
    )?;
    // Upgrades from older databases: add the newer columns in place; existing tiles keep their layout.
    add_column(&c, "tiles", "color", "TEXT")?;
    add_column(&c, "tiles", "parent_id", "INTEGER")?;
    add_column(&c, "tiles", "page_id", "INTEGER NOT NULL DEFAULT 1")?;
    c.execute("INSERT INTO pages(id,name) SELECT 1,'Home' WHERE NOT EXISTS (SELECT 1 FROM pages)", [])?;
    Ok(c)
}

fn add_column(c: &Connection, table: &str, col: &str, def: &str) -> rusqlite::Result<()> {
    let mut s = c.prepare(&format!("PRAGMA table_info({table})"))?;
    let have = s.query_map([], |r| r.get::<_, String>(1))?.filter_map(|x| x.ok()).any(|n| n == col);
    if !have {
        c.execute(&format!("ALTER TABLE {table} ADD COLUMN {col} {def}"), [])?;
    }
    Ok(())
}

fn row_to_tile(r: &rusqlite::Row) -> rusqlite::Result<Tile> {
    let cfg: String = r.get(9)?;
    Ok(Tile {
        id: r.get(0)?,
        kind: r.get(1)?,
        title: r.get(2)?,
        icon: r.get(3)?,
        x: r.get(4)?,
        y: r.get(5)?,
        w: r.get(6)?,
        h: r.get(7)?,
        collapsed: r.get::<_, i64>(8)? != 0,
        config: serde_json::from_str(&cfg).unwrap_or(Value::Null),
        color: r.get(10)?,
        parent_id: r.get(11)?,
        page_id: r.get(12)?,
    })
}

const COLS: &str = "id,type,title,icon,x,y,w,h,collapsed,config,color,parent_id,page_id";

pub fn list_tiles(c: &Connection) -> rusqlite::Result<Vec<Tile>> {
    let mut s = c.prepare(&format!("SELECT {COLS} FROM tiles ORDER BY page_id, parent_id, y, x, id"))?;
    let v = s.query_map([], row_to_tile)?.collect();
    v
}

pub fn get_tile(c: &Connection, id: i64) -> rusqlite::Result<Option<Tile>> {
    c.query_row(&format!("SELECT {COLS} FROM tiles WHERE id=?"), [id], row_to_tile)
        .optional()
}

/// The page to use: the requested one if it exists, otherwise the first page.
fn resolve_page(c: &Connection, id: i64) -> rusqlite::Result<i64> {
    let exists: Option<i64> = c.query_row("SELECT id FROM pages WHERE id=?", [id], |r| r.get(0)).optional()?;
    match exists {
        Some(id) => Ok(id),
        None => c.query_row("SELECT id FROM pages ORDER BY position, id LIMIT 1", [], |r| r.get(0)),
    }
}

pub fn create_tile(c: &Connection, t: &Tile) -> rusqlite::Result<Tile> {
    let page = resolve_page(c, t.page_id)?;
    // Place new tiles below everything else in their page/group unless told otherwise.
    let y: i64 = if t.y > 0 {
        t.y
    } else {
        c.query_row(
            "SELECT COALESCE(MAX(y+h),0) FROM tiles WHERE page_id=? AND parent_id IS ?",
            params![page, t.parent_id],
            |r| r.get(0),
        )?
    };
    c.execute(
        "INSERT INTO tiles(type,title,icon,x,y,w,h,collapsed,config,color,parent_id,page_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        params![t.kind, t.title, t.icon, t.x, y, t.w, t.h, t.collapsed as i64, t.config.to_string(), t.color, t.parent_id, page],
    )?;
    Ok(get_tile(c, c.last_insert_rowid())?.unwrap())
}

pub fn update_tile(c: &Connection, id: i64, t: &Tile) -> rusqlite::Result<Option<Tile>> {
    let page = resolve_page(c, t.page_id)?;
    let n = c.execute(
        "UPDATE tiles SET type=?,title=?,icon=?,x=?,y=?,w=?,h=?,collapsed=?,config=?,color=?,parent_id=?,page_id=? WHERE id=?",
        params![t.kind, t.title, t.icon, t.x, t.y, t.w, t.h, t.collapsed as i64, t.config.to_string(), t.color, t.parent_id, page, id],
    )?;
    if n == 0 {
        return Ok(None);
    }
    get_tile(c, id)
}

/// Deletes a tile; deleting a group deletes the tiles inside it.
pub fn delete_tile(c: &Connection, id: i64) -> rusqlite::Result<bool> {
    Ok(c.execute("DELETE FROM tiles WHERE id=? OR parent_id=?", params![id, id])? > 0)
}

pub fn save_layout(c: &mut Connection, items: &[LayoutItem]) -> rusqlite::Result<()> {
    let tx = c.transaction()?;
    for i in items {
        tx.execute(
            "UPDATE tiles SET x=?,y=?,w=?,h=?,collapsed=?,parent_id=?,page_id=CASE WHEN ?=0 THEN page_id ELSE ? END WHERE id=?",
            params![i.x, i.y, i.w, i.h, i.collapsed as i64, i.parent_id, i.page_id, i.page_id, i.id],
        )?;
    }
    tx.commit()
}

pub fn list_pages(c: &Connection) -> rusqlite::Result<Vec<Page>> {
    let mut s = c.prepare("SELECT id,name,mode,cols,position FROM pages ORDER BY position, id")?;
    let v = s
        .query_map([], |r| Ok(Page { id: r.get(0)?, name: r.get(1)?, mode: r.get(2)?, cols: r.get(3)?, position: r.get(4)? }))?
        .collect();
    v
}

fn clean_page(p: &Page) -> (String, String, i64) {
    let name = p.name.trim();
    let name = if name.is_empty() { "Page" } else { name };
    let mode = if p.mode == "columns" { "columns" } else { "free" };
    (name.chars().take(60).collect(), mode.to_string(), p.cols.clamp(2, 6))
}

pub fn get_page(c: &Connection, id: i64) -> rusqlite::Result<Option<Page>> {
    c.query_row("SELECT id,name,mode,cols,position FROM pages WHERE id=?", [id], |r| {
        Ok(Page { id: r.get(0)?, name: r.get(1)?, mode: r.get(2)?, cols: r.get(3)?, position: r.get(4)? })
    })
    .optional()
}

pub fn create_page(c: &Connection, p: &Page) -> rusqlite::Result<Page> {
    let (name, mode, cols) = clean_page(p);
    let pos: i64 = c.query_row("SELECT COALESCE(MAX(position)+1,0) FROM pages", [], |r| r.get(0))?;
    c.execute("INSERT INTO pages(name,mode,cols,position) VALUES(?,?,?,?)", params![name, mode, cols, pos])?;
    Ok(get_page(c, c.last_insert_rowid())?.unwrap())
}

pub fn update_page(c: &Connection, id: i64, p: &Page) -> rusqlite::Result<Option<Page>> {
    let (name, mode, cols) = clean_page(p);
    let n = c.execute(
        "UPDATE pages SET name=?,mode=?,cols=?,position=? WHERE id=?",
        params![name, mode, cols, p.position, id],
    )?;
    if n == 0 {
        return Ok(None);
    }
    get_page(c, id)
}

/// Deletes a page and everything on it. The last remaining page cannot be deleted (returns false).
pub fn delete_page(c: &Connection, id: i64) -> rusqlite::Result<bool> {
    let count: i64 = c.query_row("SELECT COUNT(*) FROM pages", [], |r| r.get(0))?;
    if count <= 1 {
        return Ok(false);
    }
    c.execute("DELETE FROM tiles WHERE page_id=?", [id])?;
    Ok(c.execute("DELETE FROM pages WHERE id=?", [id])? > 0)
}

pub fn list_icons(c: &Connection) -> rusqlite::Result<Vec<IconInfo>> {
    let mut s = c.prepare("SELECT id,name FROM icons ORDER BY id DESC")?;
    let v = s
        .query_map([], |r| Ok(IconInfo { id: r.get(0)?, name: r.get(1)? }))?
        .collect();
    v
}

pub fn add_icon(c: &Connection, name: &str, svg: &str) -> rusqlite::Result<i64> {
    c.execute("INSERT INTO icons(name,svg) VALUES(?,?)", params![name, svg])?;
    Ok(c.last_insert_rowid())
}

pub fn get_icon(c: &Connection, id: i64) -> rusqlite::Result<Option<String>> {
    c.query_row("SELECT svg FROM icons WHERE id=?", [id], |r| r.get(0))
        .optional()
}

pub fn delete_icon(c: &Connection, id: i64) -> rusqlite::Result<bool> {
    Ok(c.execute("DELETE FROM icons WHERE id=?", [id])? > 0)
}

pub fn add_image(c: &Connection, name: &str, mime: &str, data: &[u8]) -> rusqlite::Result<i64> {
    c.execute("INSERT INTO images(name,mime,data) VALUES(?,?,?)", params![name, mime, data])?;
    Ok(c.last_insert_rowid())
}

pub fn get_image(c: &Connection, id: i64) -> rusqlite::Result<Option<(String, Vec<u8>)>> {
    c.query_row("SELECT mime,data FROM images WHERE id=?", [id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()
}

pub fn delete_image(c: &Connection, id: i64) -> rusqlite::Result<bool> {
    Ok(c.execute("DELETE FROM images WHERE id=?", [id])? > 0)
}

pub fn get_settings(c: &Connection) -> rusqlite::Result<Value> {
    let mut s = c.prepare("SELECT key,value FROM settings")?;
    let mut m = serde_json::Map::new();
    for r in s.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))? {
        let (k, v) = r?;
        m.insert(k, serde_json::from_str(&v).unwrap_or(Value::String(v)));
    }
    Ok(Value::Object(m))
}

pub fn put_settings(c: &Connection, v: &Value) -> rusqlite::Result<()> {
    if let Some(o) = v.as_object() {
        for (k, val) in o {
            c.execute(
                "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                params![k, val.to_string()],
            )?;
        }
    }
    Ok(())
}

/// Strip active content from an uploaded SVG. Icons are served as <img> (where scripts
/// never run) with a locked-down CSP, but sanitising keeps the stored data safe too.
pub fn sanitize_svg(svg: &str) -> Option<String> {
    let lower = svg.to_ascii_lowercase();
    if !lower.contains("<svg") {
        return None;
    }
    // 1. Drop dangerous elements entirely.
    let blocked = ["script", "foreignobject", "iframe", "object", "embed"];
    let mut out = String::with_capacity(svg.len());
    let mut i = 0;
    while i < svg.len() {
        if svg.as_bytes()[i] == b'<' {
            let rest = &lower[i + 1..];
            if let Some(tag) = blocked.iter().find(|t| rest.starts_with(**t)) {
                let close = format!("</{tag}>");
                let end = match lower[i..].find(&close) {
                    Some(p) => p + close.len(),
                    None => lower[i..].find('>').map(|p| p + 1).unwrap_or(svg.len() - i),
                };
                i += end;
                continue;
            }
        }
        let ch = svg[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    // 2. Remove on*="..." event handler attributes.
    let mut cleaned = String::with_capacity(out.len());
    let mut rest = out.as_str();
    while let Some(p) = find_handler(rest) {
        cleaned.push_str(&rest[..p]);
        let after = &rest[p..];
        let eq = after.find('=').unwrap();
        let v = after[eq + 1..].trim_start();
        let lead = after.len() - v.len();
        let skip = match v.chars().next() {
            Some(q @ ('"' | '\'')) => lead + 1 + v[1..].find(q).map(|e| e + 1).unwrap_or(v.len() - 1),
            _ => lead + v.find(|c: char| c.is_whitespace() || c == '>' || c == '/').unwrap_or(v.len()),
        };
        rest = &after[skip.min(after.len())..];
    }
    cleaned.push_str(rest);
    // 3. Neutralise javascript: URLs.
    Some(cleaned.replace("javascript:", ""))
}

/// Byte offset of the next ` on<name>=` attribute (offset points at the "on").
fn find_handler(s: &str) -> Option<usize> {
    let l = s.to_ascii_lowercase();
    let b = l.as_bytes();
    for i in 1..b.len().saturating_sub(2) {
        if b[i] == b'o' && b[i + 1] == b'n' && b[i - 1].is_ascii_whitespace() {
            let mut j = i + 2;
            while j < b.len() && b[j].is_ascii_alphabetic() {
                j += 1;
            }
            if j == i + 2 {
                continue;
            }
            while j < b.len() && b[j].is_ascii_whitespace() {
                j += 1;
            }
            if j < b.len() && b[j] == b'=' {
                return Some(i);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_svg() {
        let s = sanitize_svg("<svg onload=\"x()\"><script>alert(1)</script><path d=\"M0\" onclick='a()'/></svg>").unwrap();
        assert!(!s.contains("script") && !s.contains("onload") && !s.contains("onclick"), "{s}");
        assert!(s.contains("<path d=\"M0\""), "{s}");
        assert!(sanitize_svg("hello").is_none());
    }

    #[test]
    fn accepts_null_id() {
        let t: Tile = serde_json::from_str(r#"{"id":null,"type":"dev","title":"x","config":{}}"#).unwrap();
        assert_eq!(t.id, 0);
    }

    #[test]
    fn tile_crud_and_layout() {
        let mut c = open(":memory:").unwrap();
        let t = Tile {
            id: 0,
            kind: "bookmarks".into(),
            title: "A".into(),
            icon: None,
            x: 0,
            y: 0,
            w: 4,
            h: 6,
            collapsed: false,
            config: serde_json::json!({"links":[]}),
            color: None,
            parent_id: None,
            page_id: 0,
        };
        let a = create_tile(&c, &t).unwrap();
        let b = create_tile(&c, &t).unwrap();
        assert_eq!(b.y, 6);
        save_layout(&mut c, &[LayoutItem { id: a.id, x: 2, y: 3, w: 5, h: 7, collapsed: true, parent_id: None, page_id: 0 }]).unwrap();
        let a2 = get_tile(&c, a.id).unwrap().unwrap();
        assert_eq!((a2.x, a2.y, a2.w, a2.h, a2.collapsed), (2, 3, 5, 7, true));
        assert!(delete_tile(&c, b.id).unwrap());
        assert_eq!(list_tiles(&c).unwrap().len(), 1);
    }

    fn tile(kind: &str, title: &str) -> Tile {
        serde_json::from_value(serde_json::json!({"type": kind, "title": title})).unwrap()
    }

    #[test]
    fn groups_hold_tiles_and_delete_with_them() {
        let mut c = open(":memory:").unwrap();
        let g = create_tile(&c, &Tile { color: Some("blue".into()), ..tile("group", "Env") }).unwrap();
        assert_eq!(g.color.as_deref(), Some("blue"));
        let a = create_tile(&c, &Tile { parent_id: Some(g.id), ..tile("bookmarks", "A") }).unwrap();
        let b = create_tile(&c, &Tile { parent_id: Some(g.id), ..tile("bookmarks", "B") }).unwrap();
        let top = create_tile(&c, &tile("bookmarks", "Top")).unwrap();
        // children stack below each other inside their group, independent of the page
        assert_eq!((a.y, b.y), (0, 6));
        assert_eq!(top.y, 6, "page-level tiles ignore the group's children");
        // move B out of the group
        save_layout(&mut c, &[LayoutItem { id: b.id, x: 0, y: 0, w: 4, h: 6, collapsed: false, parent_id: None, page_id: 0 }]).unwrap();
        assert_eq!(get_tile(&c, b.id).unwrap().unwrap().parent_id, None);
        assert!(delete_tile(&c, g.id).unwrap());
        let left: Vec<String> = list_tiles(&c).unwrap().into_iter().map(|t| t.title).collect();
        assert!(left.contains(&"B".to_string()) && left.contains(&"Top".to_string()) && !left.contains(&"A".to_string()), "{left:?}");
    }

    #[test]
    fn pages_isolate_tiles_and_last_page_stays() {
        let c = open(":memory:").unwrap();
        let pages = list_pages(&c).unwrap();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].name, "Home");
        let p2 = create_page(&c, &Page { id: 0, name: " Work ".into(), mode: "columns".into(), cols: 99, position: 0 }).unwrap();
        assert_eq!((p2.name.as_str(), p2.mode.as_str(), p2.cols), ("Work", "columns", 6));
        let on_home = create_tile(&c, &tile("bookmarks", "H")).unwrap();
        let on_work = create_tile(&c, &Tile { page_id: p2.id, ..tile("bookmarks", "W") }).unwrap();
        assert_eq!((on_home.page_id, on_work.page_id), (pages[0].id, p2.id));
        assert_eq!(on_work.y, 0, "each page starts at the top");
        assert!(delete_page(&c, p2.id).unwrap());
        assert_eq!(list_tiles(&c).unwrap().len(), 1);
        assert!(!delete_page(&c, pages[0].id).unwrap(), "the last page cannot be deleted");
        // unknown page ids fall back to the first page
        let t = create_tile(&c, &Tile { page_id: 999, ..tile("bookmarks", "X") }).unwrap();
        assert_eq!(t.page_id, pages[0].id);
    }

    #[test]
    fn upgrades_an_old_database_in_place() {
        let path = std::env::temp_dir().join(format!("hs_migrate_{}.db", std::process::id()));
        let p = path.to_string_lossy().to_string();
        {
            let old = Connection::open(&p).unwrap();
            old.execute_batch(
                "CREATE TABLE tiles(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, icon TEXT,
                   x INTEGER NOT NULL DEFAULT 0, y INTEGER NOT NULL DEFAULT 0, w INTEGER NOT NULL DEFAULT 4, h INTEGER NOT NULL DEFAULT 6,
                   collapsed INTEGER NOT NULL DEFAULT 0, config TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
                 INSERT INTO tiles(type,title,x,y,w,h) VALUES('bookmarks','Old',3,2,5,7);",
            )
            .unwrap();
        }
        let c = open(&p).unwrap();
        let t = list_tiles(&c).unwrap();
        assert_eq!(t.len(), 1);
        assert_eq!((t[0].x, t[0].y, t[0].w, t[0].h, t[0].page_id, t[0].parent_id, t[0].color.clone()), (3, 2, 5, 7, 1, None, None));
        assert_eq!(list_pages(&c).unwrap().len(), 1);
        drop(c);
        // opening twice is harmless
        assert!(open(&p).is_ok());
        for ext in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{p}{ext}"));
        }
    }
}
