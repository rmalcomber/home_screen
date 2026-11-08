// Reading a picked or dropped file in the browser (nothing is uploaded). Pure apart from the File API; unit tested.

export const MAX_TEXT_BYTES = 1_000_000
export const MAX_BYTES = 20_000_000

export const formatBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : `${(n / 1048576).toFixed(1)} MB`)

const tooBig = (file, max) => `${file.name} is too large (${formatBytes(file.size)}). The limit here is ${formatBytes(max)}.`

/** Read a file as UTF-8 text. → { ok:true, text, name, size } | { ok:false, error } */
export async function readTextFile(file, { max = MAX_TEXT_BYTES } = {}) {
  if (!file) return { ok: false, error: 'No file.' }
  if (file.size > max) return { ok: false, error: tooBig(file, max) }
  let buf
  try {
    buf = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, error: `Could not read ${file.name}.` }
  }
  if (buf.includes(0)) return { ok: false, error: `${file.name} does not look like a text file.` }
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return { ok: false, error: `${file.name} is not UTF-8 text.` }
  }
  return { ok: true, text: text.replace(/^﻿/, ''), name: file.name, size: file.size }
}

/** Read a file as raw bytes. → { ok:true, bytes, name, size } | { ok:false, error } */
export async function readBytesFile(file, { max = MAX_BYTES } = {}) {
  if (!file) return { ok: false, error: 'No file.' }
  if (file.size > max) return { ok: false, error: tooBig(file, max) }
  try {
    return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()), name: file.name, size: file.size }
  } catch {
    return { ok: false, error: `Could not read ${file.name}.` }
  }
}
