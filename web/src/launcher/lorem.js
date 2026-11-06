// Lorem ipsum generator for the launcher. Pure (random source injectable); unit tested in lorem.test.js.

const WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit ' +
  'voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt ' +
  'mollit anim id est laborum at vero eos accusamus iusto odio dignissimos ducimus blanditiis praesentium voluptatum deleniti atque ' +
  'corrupti quos dolores quas molestias excepturi occaecati cupiditate provident similique mollitia animi dolorum fuga harum quidem ' +
  'rerum facilis expedita distinctio nam libero tempore cum soluta nobis eligendi optio cumque nihil impedit quo minus quod maxime ' +
  'placeat facere possimus omnis voluptas assumenda repellendus temporibus autem quibusdam officiis debitis saepe eveniet voluptates ' +
  'repudiandae recusandae itaque earum hic tenetur sapiente delectus reiciendis voluptatibus maiores alias perferendis doloribus asperiores repellat').split(' ')

const OPENER = 'lorem ipsum dolor sit amet consectetur adipiscing elit'.split(' ')
export const CLASSIC_SENTENCE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'

export const LIMITS = { words: 5000, sentences: 500, paragraphs: 100, chars: 20000 }

const int = (rand, min, max) => min + Math.floor(rand() * (max - min + 1))
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function randomWords(rand, n, avoid = '') {
  const out = []
  let prev = avoid
  while (out.length < n) {
    const w = WORDS[int(rand, 0, WORDS.length - 1)]
    if (w === prev) continue
    out.push(w)
    prev = w
  }
  return out
}

function sentence(rand) {
  const n = int(rand, 6, 15)
  const w = randomWords(rand, n)
  if (n >= 8) {
    for (let k = 0; k < 2; k++) {
      if (rand() < 0.6) {
        const at = int(rand, 2, n - 3)
        if (!w[at].endsWith(',')) w[at] += ','
      }
    }
  }
  return cap(w.join(' ')) + '.'
}

function paragraph(rand, classicFirst) {
  const n = int(rand, 3, 7)
  const s = Array.from({ length: n }, () => sentence(rand))
  if (classicFirst) s[0] = CLASSIC_SENTENCE
  return s.join(' ')
}

/**
 * generate({ count, unit }, { rand, classic }) → text. unit: words | sentences | paragraphs | chars.
 * classic = start with the traditional "Lorem ipsum dolor sit amet…". Paragraphs are separated by a blank line.
 */
export function generate({ count, unit }, { rand = Math.random, classic = true } = {}) {
  const n = Math.max(1, Math.min(LIMITS[unit], count))
  if (unit === 'words') {
    const w = classic ? OPENER.slice(0, n) : []
    w.push(...randomWords(rand, n - w.length, w[w.length - 1]))
    return cap(w.join(' '))
  }
  if (unit === 'sentences') {
    return Array.from({ length: n }, (_, i) => (classic && i === 0 ? CLASSIC_SENTENCE : sentence(rand))).join(' ')
  }
  if (unit === 'paragraphs') {
    return Array.from({ length: n }, (_, i) => paragraph(rand, classic && i === 0)).join('\n\n')
  }
  // chars: whole paragraphs until long enough, cut to the exact length
  let text = ''
  for (let i = 0; text.length < n; i++) text += (i ? '\n\n' : '') + paragraph(rand, classic && i === 0)
  text = text.slice(0, n)
  return /[\s,]$/.test(text) && n > 1 ? text.slice(0, -1) + '.' : text
}

/** Wrap each paragraph in <p>…</p> (words/sentences/chars become a single paragraph). */
export const toHtml = (text) => text.split(/\n\n+/).map((p) => `<p>${p}</p>`).join('\n')

const UNITS = { '': 'words', w: 'words', word: 'words', words: 'words', s: 'sentences', sentence: 'sentences', sentences: 'sentences', p: 'paragraphs', para: 'paragraphs', paragraph: 'paragraphs', paragraphs: 'paragraphs', c: 'chars', char: 'chars', chars: 'chars', character: 'chars', characters: 'chars' }

/** "lorem", "lorem 50" (words, like Emmet), "lorem 3p", "lorem 2 sentences", "lorem 200 chars" → { menu } | { count, unit } | null */
export function parseLoremCommand(q) {
  const m = /^\s*(?:lorem(?:\s+ipsum)?|ipsum)(?:\s+(\d+)\s*([a-z]*))?\s*$/i.exec(q || '')
  if (!m) return null
  if (m[1] === undefined) return { menu: true }
  const unit = UNITS[m[2].toLowerCase()]
  if (!unit) return null
  const count = parseInt(m[1], 10)
  if (!count) return null
  return { count: Math.min(count, LIMITS[unit]), unit }
}

export const unitLabel = (count, unit) => `${count} ${count === 1 ? unit.replace(/s$/, '').replace('char', 'character') : unit.replace('chars', 'characters')}`
