# Active task: layered GNOME compatibility build
Goal: GlanceAgent installs and passes the headless e2e check on the common and newest GNOME versions (46 to 51) across major distros and terminals, proven in Docker locally and in GitHub Actions.
Started: 2026-11-23. Nothing of the layered build exists yet; start at phase 2.

## Layers (owner's map)
1. Desktop: GNOME only. Non GNOME (KDE, Mint, Hyprland) is out of scope until GNOME ships; then the tray app is the next workstream (`public-release.md`).
2. GNOME version, set by the distro: 46 works today; widen to 47 to 51.
3. Terminal: gnome-terminal works (tab switch and presence); Ptyxis, Kitty, Konsole need adding.

## Phases
- [x] 0. Research (`docs/research/agentglance.md`): distro matrix, blockers, CI plan
- [x] 1. Owner decisions: name GlanceAgent, UUID `glanceagent@mehfooj.dev`, license GPL-2.0-or-later
- [x] 2. Container harness: `scripts/container-test.sh fedora-43` passes all 18 e2e checks on GNOME 49.10 in Docker (about 40 s cached)
- [ ] 3. Version layer: GNOME 46 to 51 on Ubuntu 24.04 (46), Debian 13 (48), Fedora 43 (49), Ubuntu 26.04 (50), Fedora 45 (51), Arch (newest), all green with version validation ON  <- next: rebase and merge `feat/gnome-46-51` (worktree ../ai-activity-monitor-gnome-46-51: St vertical compat, metadata 46 to 51, AIMON_VERSION_CHECK); fix the ubuntu-24.04 container FAIL; run fedora-45. Last run on that branch: fedora-43, debian-13, ubuntu-26.04, arch PASS; ubuntu-24.04 FAIL; fedora-45 not run
- [ ] 4. Terminal layer: Ptyxis first, then Kitty, Konsole: window title equals active tab title check, tab switching, e2e per terminal in containers
- [ ] 5. CI: GitHub Actions for unit, lint, zip build, distro matrix, release on tag; nightly on rolling images
- [ ] 6. Packaging: extensions.gnome.org zip, adapter installer, AUR and COPR

## Tried and failed
- Plain container without a system bus: GNOME 49 crashes calling logind. Fixed by `dbus-daemon --system` as root plus removing the stale `/run/systemd/seats` (package leftover that makes GNOME think logind runs).
- Focusing a test window right after spawning it: a later window steals focus as it maps. The e2e `focus()` now waits for the shell to confirm.

## Notes
- Disk (D20): run containers only through `scripts/container-test.sh` or `container-matrix.sh` (guard, cache cap 3 GB, image removed after each run). Docker is rootless, its data is on /home. Never `volume prune`: the named volumes (pgdata_local, cf-*, flyrank) belong to other projects.
- Local main is reset to origin/main by any session that syncs: never leave a commit only on local main (f140711 fell off once and survived only on branches).
- Images: official distro images plus `ci/containers/<distro>/Dockerfile` (D19); ddterm images not needed.
- Containers still run with extension version validation OFF (dev-nested sets it); phase 3 must test with it ON.
- Two sessions on this machine share `$XDG_RUNTIME_DIR/aimon-dev/control`; a host nested test can hit the other session's shell. Containers are isolated.
- e2e fake windows must get the nested Wayland display explicitly, never `wayland-0` (the host).
- Optional quick check before phase 2: presence fix on the real desktop (agent-desktop screenshots while the owner switches tabs).
- `git push` is blocked by auto mode in Claude Code; the owner pushes (`git push origin main`).
