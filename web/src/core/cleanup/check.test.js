import { describe, it, expect } from 'vitest'
import { classify, checkUrl, checkRequest, redirectTarget, runPool } from './check.js'

const res = (status, location) => ({ status, headers: location ? [['Location', location]] : [] })

describe('classify', () => {
  it('2xx is fine', () => {
    expect(classify('https://a.com', res(200))).toEqual({ status: 'ok', code: 200 })
    expect(classify('https://a.com', res(204)).status).toBe('ok')
  })
  it('a permanent redirect is a move, a temporary one is not', () => {
    expect(classify('https://a.com/x', res(301, 'https://b.com/x'))).toMatchObject({ status: 'moved', to: 'https://b.com/x' })
    expect(classify('https://a.com/x', res(308, '/y'))).toMatchObject({ status: 'moved', to: 'https://a.com/y' })
    expect(classify('https://a.com/x', res(302, 'https://b.com/x'))).toMatchObject({ status: 'temp', to: 'https://b.com/x' })
    expect(classify('https://a.com/x', res(307, '/y'))).toMatchObject({ status: 'temp' })
  })
  it('a redirect to the same place is fine, except http turning into https', () => {
    expect(classify('https://a.com/x', res(301, 'https://a.com/x/'))).toEqual({ status: 'ok', code: 301 })
    expect(classify('https://a.com/x', res(302, 'https://www.a.com/x'))).toEqual({ status: 'ok', code: 302 })
    expect(classify('http://a.com/x', res(301, 'https://a.com/x'))).toMatchObject({ status: 'moved', to: 'https://a.com/x', note: 'Now served over https' })
  })
  it('warns when a deep link is sent to the front page or a sign-in page', () => {
    expect(classify('https://a.com/docs/page', res(301, 'https://a.com/'))).toMatchObject({ status: 'moved', warn: true })
    expect(classify('https://a.com/private', res(302, 'https://a.com/login?next=/private'))).toMatchObject({ warn: true, note: 'Redirects to a sign-in page' })
    expect(classify('https://a.com', res(301, 'https://b.com/'))).toMatchObject({ warn: false })
  })
  it('a redirect with no destination is not treated as a move', () => {
    expect(classify('https://a.com', res(301)).status).toBe('ok')
  })
  it('404 and 410 are dead; refusals and rate limits are only "blocked"', () => {
    expect(classify('https://a.com', res(404))).toMatchObject({ status: 'dead', retry: true })
    expect(classify('https://a.com', res(410))).toMatchObject({ status: 'dead', note: 'Gone' })
    for (const c of [401, 403, 429, 999]) expect(classify('https://a.com', res(c)).status, String(c)).toBe('blocked')
    expect(classify('https://a.com', res(403)).retry).toBe(true)
    expect(classify('https://a.com', res(503)).status).toBe('error')
    expect(classify('https://a.com', res(405)).retry).toBe(true)
  })
  it('reads network errors', () => {
    expect(classify('https://a.com', { error: 'Could not find the host (dns lookup failed)' }).status).toBe('dead')
    expect(classify('https://a.com', { error: 'timed out after 15s' }).status).toBe('timeout')
    expect(classify('https://a.com', { error: 'connection refused' }).status).toBe('dead')
    expect(classify('https://a.com', { error: 'invalid certificate' }).status).toBe('dead')
    expect(classify('https://a.com', { error: 'something odd' }).status).toBe('error')
  })
  it('finds redirect targets', () => {
    expect(redirectTarget('https://a.com/x/y', { headers: [['location', '../z']] })).toBe('https://a.com/z')
    expect(redirectTarget('https://a.com', { headers: [] })).toBe('')
  })
})

describe('checkUrl', () => {
  const server = (table) => {
    const calls = []
    const send = async (p) => {
      calls.push(`${p.method} ${p.url}`)
      return table[`${p.method} ${p.url}`] || { error: 'unexpected request' }
    }
    return { send, calls }
  }
  it('asks with HEAD and stops when that is enough', async () => {
    const s = server({ 'HEAD https://a.com/': res(200) })
    expect(await checkUrl('https://a.com/', s.send)).toEqual({ status: 'ok', code: 200 })
    expect(s.calls).toEqual(['HEAD https://a.com/'])
  })
  it('tries GET when HEAD says not found or is refused, and believes GET', async () => {
    const s = server({ 'HEAD https://a.com/': res(404), 'GET https://a.com/': res(200) })
    expect((await checkUrl('https://a.com/', s.send)).status).toBe('ok')
    expect(s.calls).toEqual(['HEAD https://a.com/', 'GET https://a.com/'])
    const t = server({ 'HEAD https://a.com/': res(405), 'GET https://a.com/': res(404) })
    expect((await checkUrl('https://a.com/', t.send)).status).toBe('dead')
  })
  it('does not retry timeouts or DNS failures', async () => {
    const s = server({ 'HEAD https://a.com/': { error: 'timed out' } })
    expect((await checkUrl('https://a.com/', s.send)).status).toBe('timeout')
    expect(s.calls).toHaveLength(1)
  })
  it('sends nothing for local or non-web addresses', async () => {
    const s = server({})
    expect((await checkUrl('http://192.168.1.2/', s.send)).status).toBe('local')
    expect((await checkUrl('http://nas.local/', s.send)).status).toBe('local')
    expect((await checkUrl('ftp://a.com/', s.send)).status).toBe('error')
    expect(s.calls).toEqual([])
  })
  it('builds a request that does not follow redirects or skip certificate checks', () => {
    expect(checkRequest('https://a.com', 'HEAD')).toMatchObject({ method: 'HEAD', follow: false, insecure: false, body: null })
  })
})

describe('runPool', () => {
  it('runs everything with at most `limit` at a time', async () => {
    let running = 0
    let peak = 0
    const seen = []
    await runPool([1, 2, 3, 4, 5, 6, 7], async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return { status: 'ok', n }
    }, { limit: 3, onResult: (i, r, done, total) => seen.push([i, done, total]) })
    expect(peak).toBe(3)
    expect(seen.map((s) => s[0]).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(seen.at(-1)).toEqual([expect.any(Number), 7, 7])
  })
  it('stops starting new work when asked, and survives a worker that throws', async () => {
    let stop = false
    const results = []
    const done = await runPool([1, 2, 3, 4, 5], async (n) => {
      if (n === 2) throw new Error('boom')
      if (n === 3) stop = true
      return { status: 'ok' }
    }, { limit: 1, shouldStop: () => stop, onResult: (i, r) => results.push([i, r.status]) })
    expect(done).toBe(3)
    expect(results).toEqual([[1, 'ok'], [2, 'error'], [3, 'ok']])
  })
  it('handles an empty list', async () => {
    expect(await runPool([], async () => ({}))).toBe(0)
  })
})
