# Promo video

Motion graphics walkthrough of the product, about 48 s, 1080p, 30 fps.

## Where it lives
- Working copy: `~/Dev/workspace/aimon-video` (Remotion project, outside the repo, has node_modules and .venv).
- In repo: only the final `media/promo-video/out/glanceagent-promo-v3.mp4` (owner choice, 2026-11-23); the rest of `media/promo-video/` is git ignored. Source, voice, assets and v1 to v3 renders live in the working copy and in git history (cce27ff, 0261226, 0d7bc8c).
- Latest renders: `out/glanceagent-promo-v3.mp4` (owner wallpaper) and `out/glanceagent-promo-v3-neutral.mp4` (safe to post).
- Script and storyboard: `~/Dev/workspace/aimon-video/SCRIPT.md`.

## Decisions (owner)
- Name in the video only: GlanceAgent. "aimon" is taken by AIMon (AI monitoring company: npm `aimon`, PyPI `aimon`, GitHub org aimonlabs). Repo, extension id and docs still say AI Activity Monitor; renaming them is a separate change.
- GlanceAgent is close to AgentGlance, an existing macOS tool for the same job; keep the names clearly apart.
- Voice: edge-tts `en-US-AndrewNeural`, rate +4% (script text goes to Microsoft servers). One clip per scene, word timings drive actions and captions.
- Codex is shown working like the other agents although no Codex adapter exists (owner choice).
- Logos: Claude from claude.com, OpenCode from opencode.ai/brand, Codex is the OpenAI blossom (no official Codex mark found). Sources in `~/Dev/workspace/aimon-video/assets/logos/SOURCES.md`.
- Owner wallpaper is third party art: use the neutral render for anything public.

## Cut (v3)
hook, problem, intro, top bar (video and blog in Chrome, icons stay visible), 3 s silent desktop interlude (tiles bump, say hi), what matters (approval, question, done over a playing video), click on a top bar icon (card, Open in Terminal to the permission prompt, Dismiss stops the bounce), outro.

## Final
- v3 is final (owner). A v4 polish pass was started and stopped on request; the three issues below stay.

## Known small issues
- Zoomed video time counter clipped at the right edge; blog to video tab jump hidden by the interlude; video title peeks behind captions.
- Rendering needs network (Google Fonts). Rerender: `npx remotion render src/index.ts Promo out/x.mp4 --codec=h264 --crf=18 --concurrency=3`.
