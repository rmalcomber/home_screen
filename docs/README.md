# Home Screen documentation site

The public documentation for Home Screen, built with [Astro](https://astro.build) and its [Starlight](https://starlight.astro.build) theme. **All content is Markdown** in `src/content/docs/`.

```powershell
cd docs
npm ci
npm run dev        # http://localhost:4321/home_screen/
npm run build      # static site in dist/ (also fails on broken internal links)
npm run preview    # serve the built site
```

## Where things are

| Path | What |
|---|---|
| `src/content/docs/` | Every page, as `.md`. The folder structure is the URL structure |
| `src/assets/screenshots/` | Screenshots, all WebP |
| `src/site.config.mjs` | Name, version, beta text, **GitHub and releases links** and base path |
| `src/plugins/tokens.mjs` | Replaces `{{repo}}`, `{{releases}}`, `{{version}}`, `{{metric.key}}` in Markdown |
| `src/components/Banner.astro` | The beta banner shown on every page |
| `src/styles/theme.css` | Maps Starlight onto the app's dim theme |
| `src/data/metrics.json` | Generated numbers used by `{{metric.key}}` |
| `scripts/` | Screenshot and metrics generators |

## Tokens in Markdown

| Token | Value |
|---|---|
| `{{repo}}` | the GitHub repository URL (see `site.config.mjs`) |
| `{{releases}}` | the GitHub releases URL |
| `{{version}}` | the current version |
| `{{metric.exe_size}}` | any key in `src/data/metrics.json` (unknown tokens fail the build) |

Links that start with `/` get the site's base path added automatically, so write `[Install](/getting-started/install/)`.

## Updating the numbers

```powershell
npm run metrics                       # sizes, counts and the test suite (needs target/release and web/dist built first)
npm run metrics -- --runtime --build  # also start-up time, idle memory and a clean build time
```

## Updating the screenshots

The images are generated from a fictional "Acme" workspace so no real data appears anywhere.

```powershell
..\build.ps1            # the screenshots use the release exe
npm run screenshots     # starts it on a temp port and database, drives Chrome, writes WebP files
```

It needs Chrome (set `CHROME_PATH` if it is not in the usual place), ImageMagick (`magick`) and internet access (icons, favicons, weather and currency rates are fetched live). The workspace is defined in `scripts/screenshots/demo.mjs`; the shots in `scripts/screenshots/run.mjs`. Pages refer to images as `@img`-style relative paths to `src/assets/screenshots/<name>.webp`.

## Provisional pages

Locked mode is documented ahead of the feature landing (the Docker page mentions it too). Each place carries a `:::caution[Provisional]` note: search for `Provisional` to find and remove them when it ships. The flag and variable names (`--locked`, `HOME_SCREEN_LOCKED`) are placeholders.

## Publishing

`.github/workflows/docs.yml` builds and deploys to GitHub Pages on pushes to `main` that touch `docs/`. For a root deployment (custom domain, container) build with `DOCS_BASE=/ DOCS_SITE=https://example.com npm run build`.
