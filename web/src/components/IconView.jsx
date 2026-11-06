// Renders a tile icon: `iconify:<prefix>:<name>` or `upload:<id>`.
// Monochrome Iconify sets are drawn as a CSS mask so they follow the theme's text colour;
// multi-colour sets are shown as plain images.
const COLOUR_SETS = new Set(['logos', 'flat-color-icons', 'skill-icons', 'devicon', 'vscode-icons', 'twemoji', 'noto', 'emojione', 'fxemoji', 'openmoji', 'token-branded', 'cryptocurrency-color', 'streamline-emojis'])

export function iconUrl(icon) {
  if (!icon) return null
  const [kind, a, b] = icon.split(':')
  if (kind === 'upload') return { src: `/api/icons/${a}`, mask: false }
  if (kind === 'iconify' && a && b) return { src: `https://api.iconify.design/${a}/${b}.svg`, mask: !COLOUR_SETS.has(a) }
  return null
}

export function IconView({ icon, size = 20, class: cls = '' }) {
  const u = iconUrl(icon)
  if (!u) return null
  const s = { width: size, height: size }
  if (u.mask) {
    return (
      <span
        class={`inline-block shrink-0 bg-current ${cls}`}
        style={{ ...s, mask: `url(${u.src}) center/contain no-repeat`, WebkitMask: `url(${u.src}) center/contain no-repeat` }}
      />
    )
  }
  return <img src={u.src} class={`shrink-0 object-contain ${cls}`} style={s} alt="" loading="lazy" />
}
