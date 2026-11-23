# Active task: layered GNOME compatibility build
Goal: GlanceAgent installs and passes the headless e2e check on the common and newest GNOME versions (46 to 51) across major distros and terminals, proven in Docker locally and in GitHub Actions.
Started: 2026-11-23. Nothing of the layered build exists yet; start at phase 2.

## Layers (owner's map)
1. Desktop: GNOME only. Non GNOME (KDE, Mint, Hyprland) is out of scope for now.
2. GNOME version, set by the distro: 46 works today; widen to 47 to 51.
3. Terminal: gnome-terminal works (tab switch and presence); Ptyxis, Kitty, Konsole need adding.

## Phases
- [x] 0. Research (`docs/research/agentglance.md`): distro matrix, blockers, CI plan
- [x] 1. Owner decisions: name GlanceAgent, UUID `glanceagent@mehfooj.dev`, license GPL-2.0-or-later
- [ ] 2. Container harness: one Docker image (Fedora 43, GNOME 49) runs gnome-shell headless, installs the extension, runs `tests/e2e/presence_e2e.py`  <- START HERE
- [ ] 3. Version layer: support GNOME 46 to 51 (metadata shell-version, St `vertical` removal in 51, harness `--mode=ubuntu` and `--nested` flags); matrix Ubuntu 24.04 (46), Debian 13 (48), Fedora 43 (49), Ubuntu 26.04 (50), Fedora 45 or Arch (51), all green
- [ ] 4. Terminal layer: Ptyxis first, then Kitty, Konsole: window title equals active tab title check, tab switching, e2e per terminal in containers
- [ ] 5. CI: GitHub Actions for unit, lint, zip build, distro matrix, release on tag; nightly on rolling images
- [ ] 6. Packaging: extensions.gnome.org zip, adapter installer, AUR and COPR

## Tried and failed
- (none yet)

## Notes
- Candidate base images: `ddterm/gnome-shell-image` (see research doc; registry path unverified).
- e2e fake windows must get the nested Wayland display explicitly, never `wayland-0` (the host).
- Optional quick check before phase 2: presence fix on the real desktop (agent-desktop screenshots while the owner switches tabs).
- `git push` is blocked by auto mode in Claude Code; the owner pushes (`git push origin main`).
