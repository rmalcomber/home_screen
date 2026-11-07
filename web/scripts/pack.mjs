// Runs after `vite build`: writes a gzip copy (level 9) of every file in dist/ next to it as <name>.gz.
// The Rust build embeds only the .gz files and serves them with `Content-Encoding: gzip`, so the program needs no
// decompressor of its own (every browser accepts gzip).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, constants } from 'node:zlib'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p] })

let raw = 0
let packed = 0
for (const file of walk(dist).filter((f) => !f.endsWith('.gz'))) {
  const data = readFileSync(file)
  const gz = gzipSync(data, { level: 9, memLevel: 9, strategy: constants.Z_DEFAULT_STRATEGY })
  writeFileSync(`${file}.gz`, gz)
  raw += data.length
  packed += gz.length
}
console.log(`packed ${walk(dist).filter((f) => f.endsWith('.gz')).length} files: ${raw} -> ${packed} bytes`)
