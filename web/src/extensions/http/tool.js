import { copyItem, openItem, historyItems } from '../../core/extensions/host.js'
import { parseHttpCommand, lookupStatus, statusClass, lookupHeader, lookupMime, statusUrl, headerUrl, httpFill } from './engine.js'

const ICON = 'iconify:fa6-solid:book'

// HTTP reference: "http 404" / "status not found" / "status 4xx" for status codes, "header content-type" / "headers cache" for
// headers, "mime png" / "mime image/png" / "mime font" for media types. Enter copies a row; the MDN rows open the reference page.
export default {
  items(q) {
    if (!q.trim()) return historyItems('http', 'HTTP', ICON)
    const cmd = parseHttpCommand(q)
    if (!cmd) return []
    const { word, text } = cmd
    const fill = httpFill(word === 'status' ? 'http' : word, text)
    const hist = (title, subtitle) => ({ kind: 'http', key: `http:${word}:${text.toLowerCase()}`, title, subtitle, fill })
    const note = (title, subtitle) => [{ key: `http:none:${q}`, title, subtitle, kind: 'Info', icon: ICON, run() {} }]

    if (word === 'status') {
      const found = lookupStatus(text)
      if (!found.length) return note(`No status code matches “${text}”`, 'Try a number (404), a class (4xx) or words (not found, redirect)')
      const out = found.map((s) =>
        copyItem({
          key: `http:s:${s.code}`,
          title: `${s.code} ${s.name}`,
          subtitle: `${s.meaning} · ${s.spec}${s.source && s.unofficial ? ' (not in the HTTP standard)' : ''}`,
          icon: ICON,
          history: hist(`${s.code} ${s.name}`, s.meaning.slice(0, 60)),
        }),
      )
      if (found.length === 1) {
        const s = found[0]
        out.push({ key: `http:class:${s.code}`, title: statusClass(s.code), kind: 'Info', icon: ICON, run() {} })
        if (!s.unofficial) out.push(openItem({ key: `http:mdn:${s.code}`, title: `MDN: ${s.code} ${s.name}`, subtitle: statusUrl(s.code), icon: ICON }))
      } else if (/^[1-5](xx)?$/i.test(text)) out.unshift({ key: `http:class:${text}`, title: statusClass(Number(text[0]) * 100), kind: 'Info', icon: ICON, run() {} })
      return out
    }

    if (word === 'header') {
      if (!text) return note('Type a header name or a word', 'For example: header content-type, headers cache, header cors')
      const found = lookupHeader(text)
      if (!found.length) return note(`No header matches “${text}”`, 'Try part of the name (cache, accept) or a word from what it does')
      const out = found.map((h) =>
        copyItem({
          key: `http:h:${h.name}`,
          title: `${h.name}: ${h.example}`,
          subtitle: `${h.description} · ${h.kind === 'both' ? 'request and response' : h.kind}`,
          icon: ICON,
          mono: true,
          history: hist(h.name, h.description.slice(0, 60)),
        }),
      )
      if (found.length === 1) out.push(openItem({ key: `http:mdn:${found[0].name}`, title: `MDN: ${found[0].name}`, subtitle: headerUrl(found[0].name), icon: ICON }))
      return out
    }

    // mime
    if (!text) return note('Type a file extension, a media type or a word', 'For example: mime png, mime application/json, mime font')
    const found = lookupMime(text)
    if (!found.length) return note(`No media type matches “${text}”`, 'Try an extension (png), a type (image/png) or a word (font)')
    return found.map((m) =>
      copyItem({
        key: `http:m:${m.type}:${m.exts[0] || ''}`,
        title: m.type,
        subtitle: `${m.description}${m.exts.length ? ` · ${m.exts.map((e) => '.' + e).join(' ')}` : ''}`,
        icon: ICON,
        mono: true,
        history: hist(m.type, m.description),
      }),
    )
  },
}
