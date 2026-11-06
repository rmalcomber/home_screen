// Tiny safe expression evaluator for the launcher calculator (no eval).
// Supports + - * / % ^ **, parentheses, unary minus, decimals, 1e3, constants (pi, e)
// and functions (sqrt, abs, round, floor, ceil, sin, cos, tan, log, ln, exp, min, max, pow).

const FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, exp: Math.exp,
  min: Math.min, max: Math.max, pow: Math.pow,
}
const CONSTS = { pi: Math.PI, e: Math.E }

function tokenize(src) {
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z]+)|(\*\*|[-+*/%^(),×÷]))/iy
  const out = []
  let pos = 0
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m) throw new Error('bad token')
    pos = re.lastIndex
    if (m[1] !== undefined) out.push({ t: 'num', v: parseFloat(m[1]) })
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2].toLowerCase() })
    else out.push({ t: 'op', v: m[3] === '×' ? '*' : m[3] === '÷' ? '/' : m[3] })
  }
  return out
}

function parse(tokens) {
  let i = 0
  const peek = () => tokens[i]
  const eat = (v) => (peek()?.t === 'op' && peek().v === v ? (i++, true) : false)
  const need = (v) => { if (!eat(v)) throw new Error(`expected ${v}`) }

  const expr = () => {
    let a = term()
    for (;;) {
      if (eat('+')) a += term()
      else if (eat('-')) a -= term()
      else return a
    }
  }
  const term = () => {
    let a = power()
    for (;;) {
      if (eat('*')) a *= power()
      else if (eat('/')) a /= power()
      else if (eat('%')) a %= power()
      else return a
    }
  }
  const power = () => {
    const base = unary()
    if (eat('^') || eat('**')) return Math.pow(base, power())
    return base
  }
  const unary = () => {
    if (eat('-')) return -unary()
    if (eat('+')) return unary()
    return primary()
  }
  const primary = () => {
    const tk = tokens[i++]
    if (!tk) throw new Error('unexpected end')
    if (tk.t === 'num') return tk.v
    if (tk.t === 'id') {
      if (eat('(')) {
        const args = []
        if (!eat(')')) {
          do args.push(expr()); while (eat(','))
          need(')')
        }
        const f = FUNCS[tk.v]
        if (!f) throw new Error('unknown function')
        return f(...args)
      }
      if (tk.v in CONSTS) return CONSTS[tk.v]
      throw new Error('unknown name')
    }
    if (tk.t === 'op' && tk.v === '(') { const v = expr(); need(')'); return v }
    throw new Error('unexpected token')
  }

  const v = expr()
  if (i !== tokens.length) throw new Error('trailing input')
  return v
}

/** Returns { value, text } for a math expression, or null if the input isn't one. */
export function calculate(input) {
  let src = (input || '').trim().replace(/^=/, '').trim()
  if (!src || src.length > 200) return null
  try {
    const tokens = tokenize(src)
    // Must look like maths: an operator, or a function call / constant (not just "5" or "pi" words in titles).
    const hasOp = tokens.some((t) => t.t === 'op' && t.v !== '(' && t.v !== ')' && t.v !== ',')
    const hasFn = tokens.some((t, k) => t.t === 'id' && tokens[k + 1]?.v === '(')
    if (!hasOp && !hasFn) return null
    const value = parse(tokens)
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return { value, text: format(value) }
  } catch {
    return null
  }
}

export function format(v) {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v)
  const s = Number(v.toPrecision(12))
  const str = String(s)
  return /e/.test(str) ? s.toExponential() : str
}
