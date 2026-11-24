# GlanceAgent site

The landing page and social images for GlanceAgent. Astro builds it to plain
static files. The interactive demo is a single React island that runs the
extension's own reducer from `extension/glanceagent@mehfooj.dev/lib/core`, so
the demo behaves like the real extension.

## Commands

Run from `site/`.

```bash
npm install          # once
npm run dev          # local dev server with hot reload
npm run build        # static output in dist/
npm run preview      # serve dist/ to check the production build
npm run social       # rerender the social images (needs Chrome or Chromium)
```

`npm run social` writes `social/out/*.png` and copies the OG image to
`public/og.png`. Set `CHROME=/path/to/chrome` if Chrome is not found
automatically.

## Configuration

Every value that changes between deployments lives in `site.config.mjs`.

| Value | Default | Override |
| --- | --- | --- |
| Site URL (canonical and OG links) | placeholder | `SITE_URL` |
| Base path (subfolder hosting) | `/` | `BASE_PATH` |
| Promo video | none | `VIDEO_SRC`, `VIDEO_POSTER` |
| Repository link | `site.repoUrl` | edit the file |

## Deploy

The output in `dist/` is plain files, so any static host works.

**GitHub Pages** (workflow included): in the repository settings, open Pages and
set Source to GitHub Actions. Every push to `main` that touches `site/` or
`lib/core` then builds and publishes the site. Run it by hand from the Actions
tab with "Deploy site to GitHub Pages". Pages on a private repository needs a
paid GitHub plan.

**Cloudflare Pages, Netlify or Vercel**: import the repository and set

| Setting | Value |
| --- | --- |
| Root directory | `site` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment | `SITE_URL=https://your.domain` |

**Custom domain**: point the domain at the host, set `SITE_URL` to it and
leave `BASE_PATH` as `/`.

## Layout

```
site/
  site.config.mjs     deployment values
  astro.config.mjs    Astro setup
  src/                page, styles, demo island
  public/             files served as they are (favicon, og.png, logos)
  social/             social image template, render script, posts.md
  design/alternates/  alternate hero directions, kept for reference
```

## Trademarks

Claude and Claude Code are trademarks of Anthropic. OpenCode belongs to its
owners. GlanceAgent is an independent project and is not affiliated with
either.
