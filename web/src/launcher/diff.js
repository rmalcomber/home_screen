// Text diff for the launcher: Myers line diff, intra-line word diff, unified-diff output. Pure; unit tested in diff.test.js.

/** Myers O(ND) shortest edit script over integer sequences. Returns ops or null if the edit distance exceeds maxD. */
function myers(a, b, maxD) {
  const N = a.length
  const M = b.length
  if (!N) return b.map((_, j) => ({ t: 'add', b: j }))
  if (!M) return a.map((_, i) => ({ t: 'del', a: i }))
  const limit = Math.min(N + M, maxD)
  const off = limit + 1
  const V = new Int32Array(2 * off + 2)
  const trace = []
  for (let d = 0; d <= limit; d++) {
    trace.push(V.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? V[off + k + 1] : V[off + k - 1] + 1
      let y = x - k
      while (x < N && y < M && a[x] === b[y]) { x++; y++ }
      V[off + k] = x
      if (x >= N && y >= M) return backtrack(trace, off, N, M)
    }
  }
  return null
}

function backtrack(trace, off, N, M) {
  let x = N
  let y = M
  const ops = []
  for (let d = trace.length - 1; d >= 0; d--) {
    const V = trace[d]
    const k = x - y
    const prevK = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? k + 1 : k - 1
    const prevX = V[off + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { ops.push({ t: 'eq', a: x - 1, b: y - 1 }); x--; y-- }
    if (d > 0) ops.push(x === prevX ? { t: 'add', b: y - 1 } : { t: 'del', a: x - 1 })
    x = prevX
    y = prevY
  }
  return ops.reverse()
}

/** Diff two key arrays (strings): trims the common head/tail, then Myers. { ops, tooDifferent } */
export function diffSeq(aKeys, bKeys, maxD = 2000) {
  const ids = new Map()
  const id = (s) => { let v = ids.get(s); if (v === undefined) { v = ids.size; ids.set(s, v) } return v }
  const a = aKeys.map(id)
  const b = bKeys.map(id)
  const N = a.length
  const M = b.length
  let s = 0
  while (s < N && s < M && a[s] === b[s]) s++
  let e = 0
  while (e < N - s && e < M - s && a[N - 1 - e] === b[M - 1 - e]) e++
  let mid = myers(a.slice(s, N - e), b.slice(s, M - e), maxD)
  let tooDifferent = false
  if (!mid) {
    tooDifferent = true
    mid = [...Array.from({ length: N - s - e }, (_, i) => ({ t: 'del', a: i })), ...Array.from({ length: M - s - e }, (_, j) => ({ t: 'add', b: j }))]
  }
  const ops = [
    ...Array.from({ length: s }, (_, i) => ({ t: 'eq', a: i, b: i })),
    ...mid.map((o) => ({ ...o, ...(o.a !== undefined ? { a: o.a + s } : {}), ...(o.b !== undefined ? { b: o.b + s } : {}) })),
    ...Array.from({ length: e }, (_, i) => ({ t: 'eq', a: N - e + i, b: M - e + i })),
  ]
  return { ops, tooDifferent }
}

export const splitLines = (text) => {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

const TOKEN = /\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g

/** Word-level diff of two lines → { aParts, bParts } as [{ text, changed }]. */
export function intraLine(a, b) {
  if (a.length > 2000 || b.length > 2000) return { aParts: [{ text: a, changed: true }], bParts: [{ text: b, changed: true }] }
  const at = a.match(TOKEN) || []
  const bt = b.match(TOKEN) || []
  const { ops, tooDifferent } = diffSeq(at, bt, 400)
  if (tooDifferent) return { aParts: [{ text: a, changed: true }], bParts: [{ text: b, changed: true }] }
  const aCh = new Array(at.length).fill(true)
  const bCh = new Array(bt.length).fill(true)
  for (const o of ops) if (o.t === 'eq') { aCh[o.a] = false; bCh[o.b] = false }
  const merge = (tokens, flags) => {
    const out = []
    tokens.forEach((t, i) => {
      const last = out[out.length - 1]
      if (last && last.changed === flags[i]) last.text += t
      else out.push({ text: t, changed: flags[i] })
    })
    return out
  }
  return { aParts: merge(at, aCh), bParts: merge(bt, bCh) }
}

/**
 * Line diff of two texts. Rows are:
 *   { kind:'eq', an, bn, text } | { kind:'del', an, text } | { kind:'add', bn, text }
 *   | { kind:'mod', an, bn, aText, bText, aParts, bParts }   (a removed line paired with an added one)
 * Returns { rows, stats:{ added, removed, changed, identical }, tooDifferent }.
 */
export function computeDiff(aText, bText, { ignoreWs = false, ignoreCase = false, maxD = 2000 } = {}) {
  const A = splitLines(aText)
  const B = splitLines(bText)
  const norm = (l) => {
    let s = l
    if (ignoreCase) s = s.toLowerCase()
    if (ignoreWs) s = s.replace(/\s+/g, ' ').trim()
    return s
  }
  const { ops, tooDifferent } = diffSeq(A.map(norm), B.map(norm), maxD)

  const rows = []
  let dels = []
  let adds = []
  const flush = () => {
    const n = Math.min(dels.length, adds.length)
    for (let i = 0; i < n; i++) {
      const a = dels[i]
      const b = adds[i]
      rows.push({ kind: 'mod', an: a + 1, bn: b + 1, aText: A[a], bText: B[b], ...intraLine(A[a], B[b]) })
    }
    for (let i = n; i < dels.length; i++) rows.push({ kind: 'del', an: dels[i] + 1, text: A[dels[i]] })
    for (let i = n; i < adds.length; i++) rows.push({ kind: 'add', bn: adds[i] + 1, text: B[adds[i]] })
    dels = []
    adds = []
  }
  for (const o of ops) {
    if (o.t === 'eq') { flush(); rows.push({ kind: 'eq', an: o.a + 1, bn: o.b + 1, text: B[o.b] }) }
    else if (o.t === 'del') dels.push(o.a)
    else adds.push(o.b)
  }
  flush()

  const count = (k) => rows.filter((r) => r.kind === k).length
  const mods = count('mod')
  const stats = { added: count('add') + mods, removed: count('del') + mods, changed: mods, identical: rows.every((r) => r.kind === 'eq') }
  return { rows, stats, tooDifferent }
}

/** Standard unified diff text (3 lines of context). */
export function toUnifiedDiff(rows, aName = 'a', bName = 'b', context = 3) {
  // flatten, grouping each change run as all '-' lines then all '+' lines
  const flat = []
  let ai = 0
  let bi = 0
  let run = []
  const flushRun = () => {
    for (const r of run) if (r.kind !== 'add') flat.push({ op: '-', text: r.kind === 'mod' ? r.aText : r.text, aPos: ai++, bPos: bi })
    for (const r of run) if (r.kind !== 'del') flat.push({ op: '+', text: r.kind === 'mod' ? r.bText : r.text, aPos: ai, bPos: bi++ })
    run = []
  }
  for (const r of rows) {
    if (r.kind === 'eq') { flushRun(); flat.push({ op: ' ', text: r.text, aPos: ai++, bPos: bi++ }) }
    else run.push(r)
  }
  flushRun()

  const changed = flat.map((l, i) => (l.op === ' ' ? -1 : i)).filter((i) => i >= 0)
  if (!changed.length) return ''
  const hunks = []
  for (const i of changed) {
    const from = Math.max(0, i - context)
    const to = Math.min(flat.length - 1, i + context)
    const last = hunks[hunks.length - 1]
    if (last && from <= last.to + 1) last.to = to
    else hunks.push({ from, to })
  }
  const out = [`--- ${aName}`, `+++ ${bName}`]
  for (const h of hunks) {
    const lines = flat.slice(h.from, h.to + 1)
    const aCount = lines.filter((l) => l.op !== '+').length
    const bCount = lines.filter((l) => l.op !== '-').length
    const aStart = aCount ? lines.find((l) => l.op !== '+').aPos + 1 : lines[0].aPos
    const bStart = bCount ? lines.find((l) => l.op !== '-').bPos + 1 : lines[0].bPos
    out.push(`@@ -${aStart}${aCount === 1 ? '' : ',' + aCount} +${bStart}${bCount === 1 ? '' : ',' + bCount} @@`)
    for (const l of lines) out.push(l.op + l.text)
  }
  return out.join('\n') + '\n'
}

/** "diff", "diff <text>", or "diff <old>\n=======\n<new>" (a line of exactly 7 equals signs, like a git conflict). */
export function parseDiffCommand(q) {
  const m = /^\s*diff(?:[ \t]+|\r?\n|$)([\s\S]*)$/i.exec(q || '')
  if (!m) return null
  const rest = m[1]
  const sep = /^={7}[ \t]*$/m.exec(rest)
  if (!sep) return { a: rest.replace(/\r?\n$/, ''), b: '' }
  const strip = (s) => s.replace(/^\r?\n/, '').replace(/\r?\n$/, '')
  return { a: strip(rest.slice(0, sep.index)), b: strip(rest.slice(sep.index + sep[0].length)) }
}

/** The launcher text that reopens a comparison (inverse of parseDiffCommand). */
export const diffFill = (a, b) => `diff ${a}\n=======\n${b}`

export const shortHash = (s) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
