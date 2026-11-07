// Renders the Body or Options of a widget from its extension, loading the extension's code on first use.
// Launcher tools shown as widgets (a manifest `host` block) need no widget code of their own: ToolHost covers them.
import { useExtension, loadExtension } from './loader.js'
import { ToolHost, ToolOptions } from './ToolHost.jsx'

const Note = ({ children, error }) => <p class={`text-sm p-2 ${error ? 'text-error' : 'opacity-60'}`}>{children}</p>

function Part({ meta, part, props }) {
  const ext = useExtension(meta.extension)
  if (ext.status === 'loading') return <Note>Loading…</Note>
  if (ext.status === 'error') {
    return (
      <Note error>
        Couldn’t load this widget (the app may have been updated: reload the page).{' '}
        <button type="button" class="link" onClick={ext.retry}>Try again</button>
      </Note>
    )
  }
  const C = ext.mod.widgets?.[meta.kind]?.[part]
  return C ? <C {...props} /> : <Note error>This widget has no {part}.</Note>
}

/** The tile body. `meta` is an entry of WIDGETS_META. */
export function WidgetBody({ meta, tile }) {
  if (meta.host) return <ToolHost extension={meta.extension} def={meta.host} />
  return <Part meta={meta} part="Body" props={{ tile }} />
}

/** The widget's settings form in the tile editor. */
export function WidgetOptions({ meta, config, set }) {
  if (meta.host) return <ToolOptions def={meta.host} />
  return <Part meta={meta} part="Options" props={{ config, set }} />
}

/** Lets a widget finish its config before saving (e.g. weather looks up coordinates). Returns the config to save. */
export async function prepareWidget(meta, config) {
  if (!meta || meta.host) return config
  const mod = await loadExtension(meta.extension)
  return (await mod.widgets?.[meta.kind]?.prepare?.(config)) || config
}
