# AI Activity Monitor

GNOME Shell extension plus Claude Code and OpenCode adapters that show agent
session state as top bar icons, desktop tiles and notifications. Architecture
in `docs/ARCHITECTURE.md`, decisions in `docs/DECISIONS.md`, rules in `AGENTS.md`.

## Where we are (2026-11-24)
- Logos: owner keeps the real Claude and OpenCode logos everywhere (D21, PR #8).
- Landing site and social kit on main (Astro plus a React demo island running `lib/core`), owner approved; branch `feat/landing-site` kept. See `landing-site.md`.
- Workflow: agents open, review and merge their own PRs and keep local main equal to origin/main (PR #2, AGENTS.md). PRs #1 to #3 merged.
- Presence fix for detached sessions and the held icon crash fix are on main; the live install has only the presence files; log out and in to load; neither seen on screen yet. See `presence-and-panel.md`.
- On main: presence fix 6baf87f (D15, D16), rename to GlanceAgent `glanceagent@mehfooj.dev` 773e916 (D17), license GPL-2.0-or-later (D18).
- Live desktop installed as `glanceagent@mehfooj.dev` (old UUID migrated); loads after the next login; not yet checked on screen.
- Layered GNOME build: phases 0 to 2 and disk safety on main (PR #5); phase 3 about 80 percent on branch `feat/gnome-46-51`; phases 4 to 6 not started.
- Promo video v3 rendered and backed up in `media/promo-video/` (0d7bc8c); name GlanceAgent used in the video only.

## Next
- Landing site: owner enables GitHub Pages (Settings, Pages, Source: GitHub Actions) and picks a domain; promo video stays off until a clean cut without Codex.
- Sunday 2026-11-29: follow "Sunday checklist" in `memory/active-task.md` (finish phase 3, then start phase 4).
- Install the panel fix into the live extension, then verify both fixes on screen after a login.
- Video: owner to review v3; optional fixes listed in `memory/promo-video.md`.

## Map
- `active-task.md`: layered GNOME compatibility build, phases and next step
- `public-release.md`: scope, owner decisions and constraints for the public version
- `presence-and-panel.md`: presence rule bug, blank top bar investigation, incident
- `landing-site.md`: landing page, demo island, social kit, deploy, owner decisions
- `promo-video.md`: promo video location, decisions, known issues
- `log.md`: dated journal
- `docs/research/agentglance.md`: competitor research, gap list, distro matrix, CI plan
- `tests/e2e/presence_e2e.py`: nested shell end to end check (18 scenarios), seed of the CI smoke test
