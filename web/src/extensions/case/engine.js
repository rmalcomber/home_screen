// Text case, slugs and counts for the launcher. Pure; unit tested in engine.test.js.
//
//   camel | pascal | snake | kebab | screaming | title | sentence | upper | lower | slug <text>   that form first, then the rest
//   case <text>                                                                                  every form
//   count | wc <text>                                                                            words, characters, lines...

const WORDS = ['camel', 'pascal', 'snake', 'kebab', 'screaming', 'title', 'sentence', 'upper', 'lower', 'slug', 'slugify', 'case', 'count', 'wc']

/** { word, text } for "snake hello world", "case …", "wc …", or null. */
export function parseCaseCommand(q) {
  const m = new RegExp(`^\\s*(${WORDS.join('|')})(?:[ \\t]+|\\r?\\n)([\\s\\S]+)$`, 'i').exec(q || '')
  if (!m) return null
  const word = m[1].toLowerCase()
  return { word: word === 'slugify' ? 'slug' : word === 'wc' ? 'count' : word, text: m[2].replace(/\s+$/, '') }
}

/** Splits identifiers and phrases into words: "HTMLParser_v2-beta" -> HTML, Parser, v2, beta. */
export function splitWords(text) {
  return String(text)
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
const lower = (w) => w.toLowerCase()

export const toCamel = (text) => splitWords(text).map((w, i) => (i ? cap(w) : lower(w))).join('')
export const toPascal = (text) => splitWords(text).map(cap).join('')
export const toSnake = (text) => splitWords(text).map(lower).join('_')
export const toScreaming = (text) => splitWords(text).map((w) => w.toUpperCase()).join('_')
export const toKebab = (text) => splitWords(text).map(lower).join('-')
export const toDot = (text) => splitWords(text).map(lower).join('.')
export const toPath = (text) => splitWords(text).map(lower).join('/')

const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'via', 'vs'])

/** Title Case: every word capitalised except short joining words in the middle. Spacing is kept. */
export function toTitle(text) {
  const parts = String(text).split(/(\s+)/)
  const idx = parts.map((p, i) => (/\S/.test(p) ? i : -1)).filter((i) => i >= 0)
  const first = idx[0]
  const last = idx[idx.length - 1]
  return parts.map((p, i) => (/\S/.test(p) ? (i !== first && i !== last && SMALL.has(p.toLowerCase()) ? p.toLowerCase() : p.replace(/^(\P{L}*)(\p{L})(.*)$/su, (_, a, b, c) => a + b.toUpperCase() + c.toLowerCase())) : p)).join('')
}

/** Sentence case: lower case, then a capital after each . ! ? and at the start. */
export function toSentence(text) {
  return String(text)
    .toLowerCase()
    .replace(/(^|[.!?]\s+|\n)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
}

/** URL-friendly text: accents removed, lower case, anything else becomes a single separator. */
export function slugify(text, sep = '-') {
  return String(text)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, sep)
    .replace(new RegExp(`^${sep}+|${sep}+$`, 'g'), '')
}

/** Every form of the text, in the order they are listed. `first` moves one to the top. */
export function conversions(text, first) {
  const all = [
    { id: 'camel', label: 'camelCase', value: toCamel(text) },
    { id: 'pascal', label: 'PascalCase', value: toPascal(text) },
    { id: 'snake', label: 'snake_case', value: toSnake(text) },
    { id: 'screaming', label: 'SCREAMING_SNAKE_CASE', value: toScreaming(text) },
    { id: 'kebab', label: 'kebab-case', value: toKebab(text) },
    { id: 'dot', label: 'dot.case', value: toDot(text) },
    { id: 'path', label: 'path/case', value: toPath(text) },
    { id: 'title', label: 'Title Case', value: toTitle(text) },
    { id: 'sentence', label: 'Sentence case', value: toSentence(text) },
    { id: 'upper', label: 'UPPER CASE', value: text.toUpperCase() },
    { id: 'lower', label: 'lower case', value: text.toLowerCase() },
    { id: 'slug', label: 'URL slug', value: slugify(text) },
  ].filter((r) => r.value)
  const i = all.findIndex((r) => r.id === first)
  return i > 0 ? [all[i], ...all.slice(0, i), ...all.slice(i + 1)] : all
}

/** Counts for a piece of text. Reading time assumes 200 words a minute, speaking 130. */
export function textStats(text) {
  const t = String(text)
  const words = (t.match(/\S+/g) || []).length
  const sentences = (t.match(/[^.!?]*[\p{L}\p{N}][^.!?]*(?:[.!?]+|$)/gu) || []).length
  const paragraphs = t.split(/\n\s*\n/).filter((p) => p.trim()).length
  const mins = (n) => (words === 0 ? '0 min' : words / n < 1 ? 'under a minute' : `${Math.round(words / n)} min`)
  return [
    { id: 'words', label: 'Words', value: String(words) },
    { id: 'chars', label: 'Characters', value: String([...t].length) },
    { id: 'nospace', label: 'Characters without spaces', value: String([...t.replace(/\s/g, '')].length) },
    { id: 'lines', label: 'Lines', value: String(t ? t.split(/\r?\n/).length : 0) },
    { id: 'sentences', label: 'Sentences', value: String(sentences) },
    { id: 'paragraphs', label: 'Paragraphs', value: String(paragraphs) },
    { id: 'bytes', label: 'Bytes (UTF-8)', value: String(new TextEncoder().encode(t).length) },
    { id: 'read', label: 'Reading time', value: mins(200) },
    { id: 'speak', label: 'Speaking time', value: mins(130) },
  ]
}
