# Landing site and social kit

Public promotion for GlanceAgent: an Astro landing page with a live demo in
the hero, plus social images. Branch `feat/landing-site` (worktree
`../ai-activity-monitor-landing-site`), 2026-11-24. Not deployed.

## Owner decisions
- Owner, 2026-11-24: use the real Claude and OpenCode logos in promo material (resolves D13 for the site). Shown as compatibility marks and on the product's own icons, never as the page's palette or type. The footer says GlanceAgent is independent, not affiliated with Anthropic or OpenCode, and the trademarks belong to their owners.
- Owner, 2026-11-24: the hero is an interactive demo ("live preview and taste", not "a newspaper").
- Copy rules: no project status words, no implementation leaks, nothing untrue. Claims are taken from README, the code and DECISIONS. Tested on GNOME Shell 46 only; 46 to 51 is not claimed. Calls to action: install from source, view on GitHub.

## Stack
- Astro 7 static output, plain CSS, one React 19 island (`@astrojs/react`). Builds to `site/dist/`, deploys with no config on GitHub Pages, Cloudflare Pages, Netlify or Vercel.
- Fonts self hosted with Fontsource: Inter Variable (the base of GNOME's Adwaita Sans) and JetBrains Mono (the preview card's log font). No third party requests.
- Island JS: about 77 KB gzip in total (React runtime about 69 KB, demo plus lib/core about 9 KB). Server rendered first, so no layout shift; without JS the page shows a still desktop.

## Direction and why
- Chosen: "The top bar" grew into "the desktop you can touch". The page's world is the extension's own UI: state colours, tile, card and bubble values come from `stylesheet.css`; everything else is quiet cool grey paper (light) or charcoal (dark). The one bold move is the live desktop in the hero.
- Why it fits: a glance tool should be calm. The page explains itself by behaving like the product: the icon bobs, hops four times and rests, and the visitor can make it do so.
- Alternates kept as mockups and shots: `site/design/alternates/` (a-topbar, b-desktop, c-sentence HTML). Run shoot.mjs on them to regenerate screenshots.
- Peer to stay distinct from: agentglance.app (macOS, centered SaaS hero on a pastel gradient).

## Demo island design
- Files: `src/components/demo/GlanceDemo.jsx` (UI), `engine.js` (drives the store), `demo.css`.
- Fidelity: `engine.js` imports `@glance-core/store.js`, `model.js` and `roaming.js` (Vite alias to `extension/glanceagent@mehfooj.dev/lib/core`, set in `astro.config.mjs`). Every action is written as a spool line in the EVENTS.md shape and read back through `SessionStore.ingestLine()`, so states, details, recent log, acknowledgement and notification policy (15 s rule, 30 s dedupe) are the product's own.
- Mirrored, because the source imports gi:// modules: motion timings and sayings (`lib/ui/motion.js`: 380 ms bob, hop 170 ms up plus 460 ms bounce, 120 ms rest, 4 hops), notification titles (`lib/notifier.js`), panel amplitude 3 px and tile 4 px. Update these if the extension changes them.
- The demo shows idle sessions (as with hide-idle off) so icons never vanish.
- First frame: events replayed at a fixed epoch `T0`, identical on server and client. Claude Code waits for approval, OpenCode works.
- Tour: a list of timed steps (open card, Open in Terminal, approve, ask, dismiss, start, error, reset), one timer at a time. Any pointer or key inside the demo pauses it; "Replay the tour" restarts. Paused while off screen (IntersectionObserver) and in background tabs.
- Visitor controls per agent: Start a task, Ask for approval or a question, Approve or Answer, Finish, Throw an error. The fake terminal takes typed prompts. Clicking a top bar icon or tile opens the preview card; Open in Terminal raises the window (also after Minimize) and switches tab; Dismiss acknowledges.
- Not built (cut for time): roaming and dragging tiles (tiles are static, under the window), the multi session pill switcher.
- Accessibility: every control is a button, Escape closes the card, a polite live region announces state changes, reduced motion stops all bobbing and hops while states still change. Phone layout below 640 px: window in the lower half, tiles above.

## File map
- `site/site.config.mjs`: site URL (placeholder `https://glanceagent.example`, override `SITE_URL`), base path (`BASE_PATH`), repo URL, video source.
- `site/src/styles/tokens.css`: colour, type and shape tokens; `global.css` imports it.
- `site/src/layouts/Base.astro`: head, OG and Twitter tags (image `og.png`).
- `site/src/pages/index.astro`: hero with the demo, five states, how it works, video (only when `video.src` is set), install, FAQ, footer.
- `site/src/components/TopBar.astro`: page header.
- `site/public/logos/`: logos copied unchanged from the extension, sources in `SOURCES.md`. `favicon.svg`: GlanceAgent mark, light and dark.
- `site/social/template.html` and `render.mjs`: social images; `social/out/*.png`.
- `site/social/posts.md`, `site/README.md`, `.github/workflows/pages.yml`: written by the coordinating session.

## Regenerate the social images
```bash
cd site && npm install && npm run social   # CHROME=/path/to/chrome to override
```
Writes og 1200x630, github-social 1280x640, landscape 1200x675, square 1080x1080 and portrait 1080x1350 to `social/out/`, checks each size, and copies the OG image to `public/og.png`.

## Build, preview, deploy
```bash
cd site && npm install
npm run dev        # http://localhost:4321
npm run build      # site/dist
npm run preview    # serves dist
```
GitHub Pages: the workflow builds `site/` on pushes to main; set `SITE_URL` and `BASE_PATH` (for a project page, `/ai-activity-monitor/`). See `site/README.md`.

## Verification done
- Headless Chrome (own temp profile) at 320, 375, 768, 1280 and 1920, light and dark: no horizontal overflow. Phone and desktop interactions checked: icon click opens the card, Approve resolves, tile click opens the card beside it.
- Root `npm test` (60 Node plus 31 Python) and `npm run lint` pass; ESLint already excludes `site/`.

## Open for the owner
- Domain (placeholder URL in config), final GitHub URL if the repo is renamed.
- Promo video: `media/promo-video/out/glanceagent-promo-v3.mp4` shows a Codex agent (no adapter exists) and third party wallpaper art, so the video section stays off until a clean cut exists. Set `video.src` (or `VIDEO_SRC`) to enable it.
- Hero headline is three lines at phone width (accepted).
