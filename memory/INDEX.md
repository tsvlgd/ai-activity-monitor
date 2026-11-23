# AI Activity Monitor

GNOME Shell extension plus Claude Code and OpenCode adapters that show agent
session state as top bar icons, desktop tiles and notifications. Architecture
in `docs/ARCHITECTURE.md`, decisions in `docs/DECISIONS.md`, rules in `AGENTS.md`.

## Where we are (2026-11-23)
- On main: presence fix 6baf87f (D15, D16), rename to GlanceAgent `glanceagent@mehfooj.dev` 773e916 (D17), license GPL-2.0-or-later (D18).
- Live desktop installed as `glanceagent@mehfooj.dev` (old UUID migrated); loads after the next login; not yet checked on screen.
- Layered GNOME compatibility build (versions 46 to 51, distros, terminals, Docker and CI) agreed, NOT started.
- Promo video v3 rendered and backed up in `media/promo-video/` (0d7bc8c); name GlanceAgent used in the video only.

## Next
- Start the layered build: `memory/active-task.md` phase 2 (Fedora 43 container running the e2e check).
- Owner pushes main (4 commits ahead of origin on 2026-11-23; push blocked for the agent).
- Video: owner to review v3; optional fixes listed in `memory/promo-video.md`.

## Map
- `active-task.md`: layered GNOME compatibility build, phases and next step
- `public-release.md`: scope, owner decisions and constraints for the public version
- `promo-video.md`: promo video location, decisions, known issues
- `log.md`: dated journal
- `docs/research/agentglance.md`: competitor research, gap list, distro matrix, CI plan
- `tests/e2e/presence_e2e.py`: nested shell end to end check (18 scenarios), seed of the CI smoke test
