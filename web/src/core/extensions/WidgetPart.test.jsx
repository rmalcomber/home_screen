import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { WidgetBody, WidgetOptions, prepareWidget } from './WidgetPart.jsx'
import { WIDGETS_META } from './registry.js'
import { _reset } from './loader.js'

// The first import of an extension is transformed on demand, which can be slow on a busy machine: wait for the result.
const until = async (ok, ms = 8000) => {
  const end = Date.now() + ms
  while (!ok() && Date.now() < end) await act(() => new Promise((r) => setTimeout(r, 25)))
}

describe('widget parts', () => {
  beforeEach(_reset)

  it('show a loading note, then the widget, once its extension has loaded', async () => {
    const el = document.createElement('div')
    await act(async () => render(<WidgetBody meta={WIDGETS_META.notes} tile={{ id: 1, config: { kind: 'notes', text: 'hello' } }} />, el))
    await until(() => el.querySelector('textarea'))
    expect(el.querySelector('textarea')?.value).toBe('hello')
  })

  it('show the options form of a widget', async () => {
    const el = document.createElement('div')
    await act(async () => render(<WidgetOptions meta={WIDGETS_META.tabata} config={WIDGETS_META.tabata.defaults} set={() => {}} />, el))
    await until(() => el.textContent.includes('Get-ready'))
    expect(el.textContent).toContain('Get-ready (s)')
  })

  it('explain a tool widget without loading any code of its own', async () => {
    const el = document.createElement('div')
    await act(async () => render(<WidgetOptions meta={WIDGETS_META['tool-hash']} config={{}} set={() => {}} />, el))
    expect(el.textContent).toContain('Use the text box inside the tile')
  })

  it('say so, and offer a retry, when the extension cannot be loaded', async () => {
    const el = document.createElement('div')
    const meta = { kind: 'ghost', extension: 'ghost', host: null }
    await act(async () => render(<WidgetBody meta={meta} tile={{ id: 2, config: { kind: 'ghost' } }} />, el))
    await until(() => el.textContent.includes('Couldn’t load'))
    expect(el.textContent).toContain('Couldn’t load this widget')
    expect(el.querySelector('button')?.textContent).toBe('Try again')
  })

  it('prepare returns the config unchanged for widgets without a prepare step', async () => {
    const cfg = { kind: 'notes', text: 'x' }
    expect(await prepareWidget(WIDGETS_META.notes, cfg)).toBe(cfg)
    expect(await prepareWidget(WIDGETS_META['tool-hash'], cfg)).toBe(cfg)
  })
})
