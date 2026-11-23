# Active task: public Linux release
Goal: one extension build that installs and passes the headless smoke test on GNOME 46 to 51 across Ubuntu, Debian, Fedora, Arch and openSUSE, in Docker locally and in GitHub Actions.
Started: 2026-11-23

## Phases
- [x] 0. Research agentglance and the distro landscape (`docs/research/agentglance.md`)
- [x] 1. Owner decisions: name and UUID (13ecf65), license GPL-2.0-or-later (D18). Logos still open
- [ ] 2a. After the owner logs back in: verify GlanceAgent on the real desktop (agent-desktop screenshots)  <- next
- [ ] 2. Container smoke test locally: one distro image runs gnome-shell headless with the extension and `tests/e2e/presence_e2e.py`
- [ ] 3. Widen GNOME support 46 to 51 (metadata, St API changes, harness flags), matrix green
- [ ] 4. Terminal coverage beyond gnome-terminal (Ptyxis first)
- [ ] 5. GitHub Actions: unit, lint, zip build, distro matrix, release on tag
- [ ] 6. Packaging: extensions.gnome.org zip, installer for the adapters, AUR and COPR

## Tried and failed
- (none yet)

## Notes
- Docker 29.2.1 is installed and the daemon answers (2026-11-23).
- The e2e fake windows must get the nested Wayland display explicitly; never `wayland-0` (the host).
