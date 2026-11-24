# Public Linux release

Goal: make the monitor work on anyone's Linux machine, GNOME first, tested per
distro in containers and CI. Inspired by agentglance.app (macOS, Claude only).
Full research and distro matrix: `docs/research/agentglance.md`.

## Owner decisions
- 2026-11-23: Linux only. Most distros, GNOME first; non GNOME desktops later via a tray app.
- 2026-11-23: Do NOT build these agentglance features: phone connectivity, model and token tracking, display templates, inline diffs.
- 2026-11-23: Builds and tests via Docker and CI; the agent owns the CI design.
- 2026-11-23: GNOME only for now, common and newest versions (46 to 51) plus terminals; non GNOME tray app deferred. Work starts from `active-task.md` phase 2.
- 2026-11-23: KDE and other non GNOME desktops: ignore until the GNOME version is finished and published. Then the tray app (reusing adapters and `lib/core`) is the NEXT workstream, so KDE, Mint, XFCE, COSMIC and Hyprland users get a real product, not a half port. A native Plasma widget only later, on demand.
- Sound effects and more features: discuss after the fixes, not before.
- 2026-11-23: License GPL-2.0-or-later for the whole repo, owner let the agent choose (D18). Logos excluded from it.
- 2026-11-23: Name GlanceAgent, UUID `glanceagent@mehfooj.dev`, schema `org.gnome.shell.extensions.glanceagent` (D17). Flagged to owner: the name is AgentGlance reversed, a confusion and trademark risk; free to change until published.
- 2026-11-24: Keep the real Claude and OpenCode logos, unaltered, in the extension and in promo material; site footer says not affiliated (D21, PR #8). Replaces the logo replacement question.
- 2026-11-24: Landing site and social kit merged (PR #10): Astro page whose hero is an interactive demo running `lib/core`, launch posts, Pages workflow. Owner wants a demo to play with, not a text page. Details and go live steps in `landing-site.md`.

## Known blockers (from research, verify before acting)
- `metadata.json`: shell-version only 46, UUID `@local`, `version` field, localhost url block extensions.gnome.org.
- St `vertical` property removed in GNOME 51 (panel.js, preview.js, indicators.js).
- Tab switching only for gnome-terminal; Ptyxis is the default on Fedora and Ubuntu 26.04.
- `dev-nested.sh` uses `--mode=ubuntu` and `--nested` (removed in GNOME 49).
- No LICENSE (now fixed, D18). Logos: owner keeps them (D21).

## Open questions for the owner
- extensions.gnome.org account, renaming internal spool and hook folders, site domain.
