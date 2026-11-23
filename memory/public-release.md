# Public Linux release

Goal: make the monitor work on anyone's Linux machine, GNOME first, tested per
distro in containers and CI. Inspired by agentglance.app (macOS, Claude only).
Full research and distro matrix: `docs/research/agentglance.md`.

## Owner decisions
- 2026-11-23: Linux only. Most distros, GNOME first; non GNOME desktops later via a tray app.
- 2026-11-23: Do NOT build these agentglance features: phone connectivity, model and token tracking, display templates, inline diffs.
- 2026-11-23: Builds and tests via Docker and CI; the agent owns the CI design.
- Sound effects and more features: discuss after the fixes, not before.

## Known blockers (from research, verify before acting)
- `metadata.json`: shell-version only 46, UUID `@local`, `version` field, localhost url block extensions.gnome.org.
- St `vertical` property removed in GNOME 51 (panel.js, preview.js, indicators.js).
- Tab switching only for gnome-terminal; Ptyxis is the default on Fedora and Ubuntu 26.04.
- `dev-nested.sh` uses `--mode=ubuntu` and `--nested` (removed in GNOME 49).
- No LICENSE; Claude and OpenCode logos shipped without permission (D13).

## Open questions for the owner
- License, public name and UUID, extensions.gnome.org account, logo replacement.
