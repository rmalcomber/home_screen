import { CopyButton } from '../../core/extensions/host.js'

const Table = ({ title, rows }) => (
  <div>
    <div class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{title}</div>
    <table class="table table-xs">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} class="hover">
            <td class="font-mono font-semibold w-1/4 align-top whitespace-nowrap">{k}</td>
            <td class="font-mono break-all">{v === '' ? <span class="opacity-40">(empty)</span> : v}</td>
            <td class="w-12 text-right align-top"><CopyButton text={v} class="btn btn-ghost btn-xs" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

/** A URL or query string taken apart: the parts, then every parameter decoded. */
export function UrlPanel({ item }) {
  const d = item.data
  if (!d.ok) return <div class="p-4 text-sm text-error">{d.error}</div>
  const dup = new Set(d.params.map((p) => p.key).filter((k, i, a) => a.indexOf(k) !== i))
  return (
    <div class="p-3 grid gap-3 max-h-[70vh] overflow-auto">
      {d.isUrl && <Table title="Parts" rows={d.parts} />}
      {d.params.length > 0 ? (
        <Table title={`Parameters (${d.params.length})`} rows={d.params.map((p) => [dup.has(p.key) ? `${p.key} ×` : p.key, p.value])} />
      ) : (
        <p class="text-sm opacity-60">No query parameters.</p>
      )}
      {dup.size > 0 && <p class="text-xs opacity-60">Keys marked × appear more than once.</p>}
    </div>
  )
}
