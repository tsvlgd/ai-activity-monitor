# Active task: layered GNOME compatibility build
Goal: GlanceAgent installs and passes the headless e2e check (18 scenarios) on GNOME 46 to 51 across major distros and terminals, proven in Docker locally and in GitHub Actions, then ships publicly.
Started: 2026-11-23. Next session: Sunday 2026-11-29 (owner). Start at "Sunday checklist".

## Layers (owner's map)
1. Desktop: GNOME only. KDE, Mint, XFCE, COSMIC, Hyprland wait until GNOME ships; then the tray app is the next workstream (`public-release.md`).
2. GNOME version, set by the distro: 46 to 51.
3. Terminal: gnome-terminal works (tab switch and presence); Ptyxis, Kitty, Konsole need adding.

## Status (2026-11-23)
- [x] 0. Research: `docs/research/agentglance.md`
- [x] 1. Decisions: name GlanceAgent, UUID `glanceagent@mehfooj.dev`, license GPL-2.0-or-later
- [x] 2. Container harness on main (PR #5): `scripts/container-test.sh <distro>`, `scripts/container-matrix.sh`, images in `ci/containers/` (fedora-43, fedora-45, debian-13, ubuntu-24.04, ubuntu-26.04, arch)
- [x] Detour: disk safety on main (PR #5, D20): guard, 3 GB cache cap, image removed after each run, `scripts/cleanup-ci.sh`
- [ ] 3. Version layer, about 80 percent. Code on branch `feat/gnome-46-51` (db61188, worktree `../ai-activity-monitor-gnome-46-51`, NOT rebased, NOT merged): `lib/ui/compat.js` (St vertical vs orientation), metadata 46 to 51, `AIMON_VERSION_CHECK=1` in containers, devcontrol backend lookup, `--devkit`. Last results with it: fedora-43 (49), debian-13 (48), ubuntu-26.04 (50), arch (51.1) PASS; ubuntu-24.04 (46) 17 of 18 (timing, see checklist step 3); fedora-45 never ran
- [ ] 4. Terminals: not started
- [ ] 5. GitHub Actions CI: not started
- [ ] 6. Packaging: not started

## Sunday checklist (phase 3 to done, then start phase 4)
1. Preflight: `df -h /home` (need 6 GB or more free; 16 GB on 2026-11-23), `git fetch --prune`, `git worktree list`. Another Claude session may work in this repo: never switch branches in the main checkout; use worktrees.
2. Rebase `feat/gnome-46-51` onto origin/main in its worktree. Its first two commits (f140711, b201a4e) are already on main as 649a2ce and e5a74e5: git should drop them; resolve any conflict in `tests/e2e/presence_e2e.py` or `memory/` keeping main's version plus db61188's changes.
3. Fix the e2e timing weakness: in `tests/e2e/presence_e2e.py` add `wait_state(session, state)` that polls `ctl("state")["result"]["groups"]` until that session reaches the state (timeout 10 s), and call it after every emit instead of fixed sleeps. Cause: on ubuntu-24.04 the check "A watching tab: no bounce on approval" ran before the permission event was processed (motion still `work`). Log: `../ai-activity-monitor-gnome-46-51/ci/out/ubuntu-24.04/run.log`. Image `glanceagent-test:ubuntu-24.04` (1.18 GB) is kept for this; remove it after.
4. Checks: `npm test`, `npm run lint`, host headless e2e with a private control dir (`AIMON_DEV_DIR=$XDG_RUNTIME_DIR/aimon-dev/<slug>`, `AIMON_DEV_CONTROL` and `AIMON_E2E_DIR` under it, `AIMON_VERSION_CHECK=1`).
5. Full matrix: `scripts/container-matrix.sh` (about 1 hour, each image rebuilt). Accept: all 6 PASS. If short on time: `AIMON_KEEP_IMAGES=1` only while free space stays above 10 GB.
6. PR for `feat/gnome-46-51`: body with problem, change, verification, not verified; self review as PR comment; `gh pr merge --rebase` WITHOUT `--delete-branch` (owner: keep significant branches); sync local main with `git merge --ff-only origin/main`; remove the worktree, keep the branch.
7. Update docs that say GNOME 46 only (checked 2026-11-23): README lines 3, 54, 202, 204; docs/ARCHITECTURE.md lines 4 and 13; AGENTS.md line 7. Change to "GNOME Shell 46 to 51" with the tested distro list. Line ARCHITECTURE 160 is a GNOME 46 fact, keep it. Then tick phase 3 here.
8. If time remains, phase 4 step 1 (research only): how Ptyxis, Kitty and Konsole expose (a) the active tab title in the window title, (b) a way to switch tabs from outside (D-Bus, remote control). Write findings to `memory/terminals.md`.

## Full plan after Sunday (rough effort)
- 4. Terminals, 1 to 2 days: per terminal a title rule and a tab switch method in `lib/windows.js` and `lib/providers.js`; container e2e that runs the real terminal (Ptyxis first: default on Fedora 41+ and Ubuntu 26.04). Accept: presence and Open in Terminal pass per terminal.
- 5. CI, half to one day: `.github/workflows/`: unit and lint on every push; container matrix on PRs touching `extension/`, `ci/`, `scripts/`, `tests/e2e/`, plus nightly (catches new GNOME on Arch); zip build on tags. Runners use normal Docker and about 14 GB disk: keep the guard. Accept: green on a PR.
- 6. Packaging, 1 to 2 days plus review wait: `gnome-extensions pack` zip for extensions.gnome.org; separate installer for the Claude and OpenCode hooks (the store cannot edit `~/.claude`); AUR and COPR packages. Needs owner accounts: extensions.gnome.org, AUR, Fedora (COPR).
- Then: tray app for non GNOME desktops (reuses adapters and `lib/core`); native Plasma widget only on demand.

## Needs from the owner
- Accounts for phase 6 (extensions.gnome.org, AUR, Fedora). Decision on replacing the Claude and OpenCode logos before publishing (D13).
- Docker volumes `pgdata_local`, `cf-*`, `taskdata`, flyrank: owner's call; never prune them.
- Later: sound effects and other features (discuss after phase 3 to 6).

## Tried and failed
- Container without a system bus: GNOME 49 crashes calling logind. Fixed: `dbus-daemon --system` as root and remove the stale `/run/systemd/seats`.
- Ubuntu images without `yaru-theme-gnome-shell`: the shell stops at startup (Ubuntu settings ask for Yaru). Container only; users need no theme.
- Focusing a test window right after spawning it: a later window steals focus. Fixed: wait for both windows, confirm focus via the shell.
- `docker builder prune --keep-storage` is deprecated in Docker 29 (means reserved space); use `--max-used-space`.

## Rules learned
- Containers only through `scripts/container-test.sh` or `container-matrix.sh` (D20). Never `volume prune` or `system prune -a`.
- Never leave a commit only on local main: any session that syncs resets it to origin/main.
- Keep branches with significant work after merging (ci/, feat/); delete small ones (owner, 2026-11-23).
- Host nested tests: always a private `AIMON_DEV_DIR`; the other session may run its own shell. Kill only the gnome-shell whose environment names your control dir.
- Never `pkill -f` or `pgrep -f` patterns that also match your own command line: match exact pids.
