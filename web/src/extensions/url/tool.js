import { copyItem, preview, historyItems } from '../../core/extensions/host.js'
import { parseUrlCommand, encodeComponent, encodeFull, decodeComponent, htmlEncode, htmlEncodeAll, htmlDecode, parseUrl, parseable, urlFill } from './engine.js'
import { UrlPanel } from './Panel.jsx'

const ICON = 'iconify:fa6-solid:link'

// URL and HTML encoding: "url <text>", "urlencode", "urldecode", "html <text>", "htmlencode", "htmldecode", "qs <url or query string>".
// A URL or key=value text also gets a table of its parts. Enter copies a row.
export default {
  items(q) {
    if (!q.trim()) return historyItems('url', 'URL', ICON)
    const cmd = parseUrlCommand(q)
    if (!cmd || !cmd.text) return []
    const { word, text } = cmd
    const fill = urlFill(word, text.slice(0, 300))
    const row = (id, label, value, note) =>
      copyItem({ key: `url:${id}:${text}`, title: preview(value, 100), subtitle: note ? `${label} · ${note}` : label, icon: ICON, text: value, mono: true, history: { kind: 'url', key: `url:${word}:${text.slice(0, 200)}`, title: `${word} ${preview(text, 50)}`, subtitle: label, fill } })
    const out = []

    if (word === 'qs' || (word === 'url' && parseable(text))) {
      const data = parseUrl(text)
      out.push({ key: `url:parse:${text}`, title: 'Parse URL', kind: 'url', icon: ICON, panel: UrlPanel, hint: 'Click a value to copy it', data, fill })
    }
    if (word === 'qs') return out

    if (word === 'url' || word === 'urlencode') {
      out.push(row('enc', 'URL-encoded (component)', encodeComponent(text), 'encodeURIComponent'))
      const full = encodeFull(text)
      if (full && full !== encodeComponent(text)) out.push(row('encfull', 'URL-encoded (whole URL, keeps : / ? & =)', full, 'encodeURI'))
    }
    if (word === 'url' || word === 'urldecode') {
      const dec = decodeComponent(text)
      if (dec !== null && dec !== text) out.push(row('dec', 'URL-decoded', dec))
      const form = decodeComponent(text, { form: true })
      if (form !== null && form !== dec && form !== text) out.push(row('decform', 'URL-decoded (+ as space, form style)', form))
      if (dec === null && word === 'urldecode') out.push({ key: `url:bad:${text}`, title: 'Not valid percent-encoding', subtitle: 'A % must be followed by two hex digits', kind: 'Error', icon: ICON, run() {} })
    }
    if (word === 'html' || word === 'htmlencode') {
      out.push(row('henc', 'HTML-escaped', htmlEncode(text), '& < > " \''))
      const all = htmlEncodeAll(text)
      if (all !== htmlEncode(text)) out.push(row('hencall', 'HTML-escaped, non-ASCII as numeric entities', all))
    }
    if (word === 'html' || word === 'htmldecode') {
      const dec = htmlDecode(text)
      if (dec !== text) out.push(row('hdec', 'HTML-decoded', dec))
      else if (word === 'htmldecode') out.push({ key: `url:noent:${text}`, title: 'No HTML entities found', subtitle: 'Looks like &amp; &lt; &#65; &#x41;', kind: 'Info', icon: ICON, run() {} })
    }
    return out
  },
}
