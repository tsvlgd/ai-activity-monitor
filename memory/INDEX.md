# AI Activity Monitor

GNOME Shell extension plus Claude Code and OpenCode adapters that show agent
session state as top bar icons, desktop tiles and notifications. Architecture
in `docs/ARCHITECTURE.md`, decisions in `docs/DECISIONS.md`, rules in `AGENTS.md`.

## Where we are (2026-11-23)
- Workflow: agents open, review and merge their own PRs and keep local main equal to origin/main (PR #2, AGENTS.md). PRs #1 to #3 merged.
- Presence fix for detached sessions and the held icon crash fix are on main; the live install has only the presence files; log out and in to load; neither seen on screen yet. See `presence-and-panel.md`.
- On main: presence fix 6baf87f (D15, D16), rename to GlanceAgent `glanceagent@mehfooj.dev` 773e916 (D17), license GPL-2.0-or-later (D18).
- Live desktop installed as `glanceagent@mehfooj.dev` (old UUID migrated); loads after the next login; not yet checked on screen.
- Layered GNOME compatibility build (versions 46 to 51, distros, terminals, Docker and CI) agreed, NOT started.
- Promo video v3 rendered and backed up in `media/promo-video/` (0d7bc8c); name GlanceAgent used in the video only.

## Next
- Start the layered build: `memory/active-task.md` phase 2 (Fedora 43 container running the e2e check).
- Install the panel fix into the live extension, then verify both fixes on screen after a login.
- `ci/distro-matrix` (f140711, Fedora container e2e) is the other session's branch, not on main: open its PR when it is ready.
- Video: owner to review v3; optional fixes listed in `memory/promo-video.md`.

## Map
- `active-task.md`: layered GNOME compatibility build, phases and next step
- `public-release.md`: scope, owner decisions and constraints for the public version
- `presence-and-panel.md`: presence rule bug, blank top bar investigation, incident
- `promo-video.md`: promo video location, decisions, known issues
- `log.md`: dated journal
- `docs/research/agentglance.md`: competitor research, gap list, distro matrix, CI plan
- `tests/e2e/presence_e2e.py`: nested shell end to end check (18 scenarios), seed of the CI smoke test
