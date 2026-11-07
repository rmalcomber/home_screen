// One place for the facts that appear all over the site. Markdown pages use the {{tokens}} below
// (see src/plugins/tokens.mjs), so changing the GitHub link or the version is a one-line edit here.

const repoUrl = 'https://github.com/rmalcomber/home_screen'

export const site = {
  name: 'Home Screen',
  tagline: 'Your links, tools and widgets on one fast, private start page. One small binary, no accounts.',
  // GitHub Pages project site; override with DOCS_BASE=/ for a root deployment (Docker, custom domain).
  site: process.env.DOCS_SITE ?? 'https://rmalcomber.github.io',
  base: process.env.DOCS_BASE ?? '/home_screen',
  repoUrl,
  releasesUrl: `${repoUrl}/releases`,
  version: '0.2.1-beta',
  beta: 'Beta: Home Screen is under active development. Expect rough edges and changing features.',
}

/** Values for {{repo}}, {{releases}}, {{version}} and {{name}} in Markdown. */
export const tokenValues = {
  repo: site.repoUrl,
  releases: site.releasesUrl,
  version: site.version,
  name: site.name,
}
