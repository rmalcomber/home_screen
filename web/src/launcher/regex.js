// Regex tester helpers for the launcher. Pure; unit tested in regex.test.js.
// Matching runs in a throwaway Web Worker with a timeout so a catastrophic pattern can't freeze the page.

export const FLAGS = [
  ['g', 'global'],
  ['i', 'ignore case'],
  ['m', 'multiline: ^ and $ match at line breaks'],
  ['s', 'dotAll: . matches newlines'],
  ['u', 'unicode'],
  ['y', 'sticky'],
]

/**
 * Run the pattern against the text. SELF-CONTAINED on purpose: its source is shipped to the worker.
 * Returns { matches, truncated, replaced } or { error }.
 */
export function execute({ pattern, flags, text, replacement, max }) {
  let re
  try {
    re = new RegExp(pattern, flags)
  } catch (e) {
    return { error: e.message }
  }
  const matches = []
  let truncated = false
  const push = (m) => {
    if (matches.length >= max) { truncated = true; return false }
    matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null })
    return true
  }
  if (re.global) {
    for (const m of text.matchAll(re)) if (!push(m)) break
  } else {
    const m = re.exec(text)
    if (m) push(m)
  }
  let replaced = null
  if (replacement !== null && replacement !== undefined) {
    try { replaced = text.replace(new RegExp(pattern, flags), replacement) } catch { replaced = null }
  }
  return { matches, truncated, replaced }
}

/** Run execute() in a worker; resolves { timeout:true } if it takes longer than `ms`. */
export function runInWorker(req, ms = 1500) {
  return new Promise((resolve) => {
    let worker
    let url
    const done = (v) => { clearTimeout(timer); worker?.terminate(); url && URL.revokeObjectURL(url); resolve(v) }
    const timer = setTimeout(() => done({ timeout: true }), ms)
    try {
      url = URL.createObjectURL(new Blob([`const execute = ${execute.toString()}; onmessage = (e) => postMessage(execute(e.data))`], { type: 'text/javascript' }))
      worker = new Worker(url)
      worker.onmessage = (e) => done(e.data)
      worker.onerror = (e) => done({ error: e.message || 'Worker failed' })
      worker.postMessage(req)
    } catch (e) {
      done({ error: String(e.message || e) })
    }
  })
}

/** Cancellable wrapper: a newer call supersedes (and terminates) the previous one's result. */
export function createRunner() {
  let seq = 0
  return async (req, ms) => {
    const my = ++seq
    const r = await runInWorker(req, ms)
    return my === seq ? r : null
  }
}

/** Pieces of `text` split at match boundaries: [{ text, match: index|null }] (zero-length matches are skipped). */
export function segments(text, matches) {
  const out = []
  let pos = 0
  matches.forEach((m, i) => {
    if (!m.text.length || m.index < pos) return
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: null })
    out.push({ text: m.text, match: i })
    pos = m.index + m.text.length
  })
  if (pos < text.length) out.push({ text: text.slice(pos), match: null })
  return out
}

/** Escape `/` so the pattern can sit inside /…/ (leaves escaped slashes and slashes inside [...] alone). */
export function toLiteral(pattern) {
  let out = ''
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\') { out += c + (pattern[i + 1] ?? ''); i++; continue }
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    out += c === '/' && !inClass ? '\\/' : c
  }
  return out
}

const VALID_FLAGS = /^[dgimsuvy]*$/

/** "regex …" / "re …" → { pattern, flags, text } or null. Accepts `/pattern/flags text` or `pattern⏎text`. */
export function parseRegexCommand(q) {
  const m = /^\s*regexp?(?:\s+([\s\S]*))?$/i.exec(q || '') || /^\s*re\s+([\s\S]*)$/i.exec(q || '')
  if (!m) return null
  const rest = m[1] ?? ''
  if (rest[0] === '/') {
    let inClass = false
    for (let i = 1; i < rest.length; i++) {
      const c = rest[i]
      if (c === '\\') { i++; continue }
      if (c === '[') inClass = true
      else if (c === ']') inClass = false
      else if (c === '/' && !inClass) {
        const flags = /^[a-z]*/.exec(rest.slice(i + 1))[0]
        if (!VALID_FLAGS.test(flags)) break
        return { pattern: rest.slice(1, i), flags, text: rest.slice(i + 1 + flags.length).replace(/^\s/, '') }
      }
    }
  }
  const nl = rest.indexOf('\n')
  return { pattern: (nl < 0 ? rest : rest.slice(0, nl)).trimEnd(), flags: 'g', text: nl < 0 ? '' : rest.slice(nl + 1) }
}
