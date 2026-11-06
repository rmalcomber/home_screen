// Remark plugin: replaces {{repo}}, {{releases}}, {{version}}, {{name}} and {{metric.key}} in Markdown text and URLs,
// and prefixes root-relative links with the site's base path (Astro doesn't do that for Markdown links).
//
// Note the dot in {{metric.key}}: Starlight turns ":name" into a directive, so "{{metric:key}}" would be split apart.
import { readFileSync } from 'node:fs'
import { tokenValues } from '../site.config.mjs'

const metricsFile = new URL('../data/metrics.json', import.meta.url)

function loadMetrics() {
  try { return JSON.parse(readFileSync(metricsFile, 'utf8')) } catch { return {} }
}

export function tokens({ base = '' } = {}) {
  const prefix = base && base !== '/' ? base.replace(/\/$/, '') : ''
  return (tree) => {
    const metrics = loadMetrics()
    const sub = (s) =>
      s.replace(/\{\{\s*(metric\.)?([\w-]+)\s*\}\}/g, (m, isMetric, key) => {
        const v = isMetric ? metrics[key] : tokenValues[key]
        if (v === undefined) throw new Error(`Unknown token ${m} (run "npm run metrics" if it is a metric)`)
        return String(v)
      })
    const fixUrl = (u) => {
      u = sub(u)
      return prefix && u.startsWith('/') && !u.startsWith('//') && !u.startsWith(prefix + '/') ? prefix + u : u
    }
    const walk = (node) => {
      if ((node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') && typeof node.value === 'string') node.value = sub(node.value)
      if ((node.type === 'link' || node.type === 'definition') && node.url) node.url = fixUrl(node.url)
      if (node.type === 'image' && node.url) node.url = sub(node.url)
      for (const c of node.children || []) walk(c)
    }
    walk(tree)
  }
}
