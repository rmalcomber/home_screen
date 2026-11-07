// Web search shortcuts for the launcher. Pure; unit tested in engine.test.js.
//
//   google rust lifetimes      open that search in a new tab
//   search rust lifetimes      list every engine to choose from

// [id, name, words that select it, URL with %s where the search text goes]
export const ENGINES = [
  ['google', 'Google', ['google', 'g'], 'https://www.google.com/search?q=%s'],
  ['bing', 'Bing', ['bing'], 'https://www.bing.com/search?q=%s'],
  ['ddg', 'DuckDuckGo', ['duckduckgo', 'ddg'], 'https://duckduckgo.com/?q=%s'],
  ['brave', 'Brave Search', ['brave'], 'https://search.brave.com/search?q=%s'],
  ['ecosia', 'Ecosia', ['ecosia'], 'https://www.ecosia.org/search?q=%s'],
  ['startpage', 'Startpage', ['startpage'], 'https://www.startpage.com/sp/search?query=%s'],
  ['yahoo', 'Yahoo', ['yahoo'], 'https://search.yahoo.com/search?p=%s'],
  ['kagi', 'Kagi', ['kagi'], 'https://kagi.com/search?q=%s'],
  ['images', 'Google Images', ['images', 'gimages'], 'https://www.google.com/search?tbm=isch&q=%s'],
  ['maps', 'Google Maps', ['maps', 'gmaps'], 'https://www.google.com/maps/search/%s'],
  ['translate', 'Google Translate', ['translate'], 'https://translate.google.com/?sl=auto&tl=en&text=%s&op=translate'],
  ['youtube', 'YouTube', ['youtube', 'yt'], 'https://www.youtube.com/results?search_query=%s'],
  ['wikipedia', 'Wikipedia', ['wikipedia', 'wiki'], 'https://en.wikipedia.org/w/index.php?search=%s'],
  ['github', 'GitHub', ['github', 'gh'], 'https://github.com/search?q=%s'],
  ['stackoverflow', 'Stack Overflow', ['stackoverflow', 'so'], 'https://stackoverflow.com/search?q=%s'],
  ['mdn', 'MDN Web Docs', ['mdn'], 'https://developer.mozilla.org/en-US/search?q=%s'],
  ['npm', 'npm', ['npm'], 'https://www.npmjs.com/search?q=%s'],
  ['crates', 'crates.io', ['crates', 'cratesio'], 'https://crates.io/search?q=%s'],
  ['docsrs', 'docs.rs', ['docsrs'], 'https://docs.rs/releases/search?query=%s'],
  ['pypi', 'PyPI', ['pypi'], 'https://pypi.org/search/?q=%s'],
  ['reddit', 'Reddit', ['reddit'], 'https://www.reddit.com/search/?q=%s'],
  ['hn', 'Hacker News', ['hn', 'hackernews'], 'https://hn.algolia.com/?q=%s'],
  ['amazon', 'Amazon', ['amazon'], 'https://www.amazon.com/s?k=%s'],
  ['imdb', 'IMDb', ['imdb'], 'https://www.imdb.com/find/?q=%s'],
  ['wolfram', 'Wolfram Alpha', ['wolfram', 'wa'], 'https://www.wolframalpha.com/input?i=%s'],
].map(([id, name, words, url]) => ({ id, name, words, url }))

const BY_WORD = new Map(ENGINES.flatMap((e) => e.words.map((w) => [w, e])))

/** The URL that searches an engine for some text. */
export const searchUrl = (engine, text) => engine.url.replace('%s', encodeURIComponent(text.trim()))

/** { engine, term } for "google rust", { engine: null, term } for "search rust" (all engines), or null. The term cannot be empty. */
export function parseWebCommand(q) {
  const m = /^\s*([a-z0-9]+)[ \t]+([\s\S]*\S)\s*$/i.exec(q || '')
  if (!m) return null
  const word = m[1].toLowerCase()
  if (word === 'search') return { engine: null, term: m[2].trim() }
  const engine = BY_WORD.get(word)
  return engine ? { engine, term: m[2].trim() } : null
}

/** The launcher text that reopens a search. */
export const webFill = (engine, term) => `${engine ? engine.words[0] : 'search'} ${term}`
