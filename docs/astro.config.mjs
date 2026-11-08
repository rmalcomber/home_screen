import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightLinksValidator from 'starlight-links-validator'
import { unified } from '@astrojs/markdown-remark'
import { site as S } from './src/site.config.mjs'
import { tokens } from './src/plugins/tokens.mjs'

export default defineConfig({
  site: S.site,
  base: S.base,
  markdown: { processor: unified({ remarkPlugins: [[tokens, { base: S.base }]] }) },
  integrations: [
    starlight({
      title: S.name,
      description: S.tagline,
      logo: { src: './src/assets/logo.svg', alt: S.name },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: S.repoUrl }],
      editLink: { baseUrl: `${S.repoUrl}/edit/main/docs/` },
      customCss: ['./src/styles/theme.css'],
      components: { Banner: './src/components/Banner.astro' },
      // Dark is the default (the app's "dim" theme); visitors can still switch.
      head: [
        { tag: 'script', content: "try{if(!localStorage.getItem('starlight-theme')){localStorage.setItem('starlight-theme','dark');document.documentElement.dataset.theme='dark'}}catch(e){}" },
        { tag: 'meta', attrs: { property: 'og:image', content: `${S.site}${S.base.replace(/\/$/, '')}/og.jpg` } },
      ],
      plugins: [starlightLinksValidator({ errorOnRelativeLinks: false, errorOnLocalLinks: false })],
      sidebar: [
        { label: 'Welcome', items: ['about', 'features'] },
        { label: 'Getting started', items: [{ autogenerate: { directory: 'getting-started' } }] },
        { label: 'Using the dashboard', items: [{ autogenerate: { directory: 'guides' } }] },
        {
          label: 'The launcher',
          items: [
            'launcher',
            {
              label: 'Search and commands',
              items: ['launcher/search', 'launcher/commands'],
            },
            {
              label: 'Calculators and converters',
              items: ['launcher/calculator', 'launcher/units', 'launcher/currency', 'launcher/timestamp', 'launcher/bases'],
            },
            {
              label: 'Developer tools',
              items: ['launcher/curl', 'launcher/json', 'launcher/yaml', 'launcher/csv', 'launcher/regex', 'launcher/diff', 'launcher/cron', 'launcher/markdown', 'launcher/chmod', 'launcher/text-case'],
            },
            {
              label: 'Web and network',
              items: ['launcher/url', 'launcher/cidr', 'launcher/http-reference', 'launcher/open-graph', 'launcher/web-search', 'launcher/caniuse', 'launcher/network'],
            },
            {
              label: 'Security and encoding',
              items: ['launcher/password', 'launcher/hash', 'launcher/base64', 'launcher/uuid', 'launcher/jwt'],
            },
            {
              label: 'Media and design',
              items: ['launcher/qr', 'launcher/colour', 'launcher/lorem'],
            },
          ],
        },
        { label: 'Widgets', items: [{ autogenerate: { directory: 'widgets' } }] },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
        { label: 'Roadmap', items: ['roadmap'] },
        { label: 'Releases', items: [{ autogenerate: { directory: 'releases' } }] },
      ],
    }),
  ],
})
