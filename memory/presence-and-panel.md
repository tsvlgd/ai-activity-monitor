# Presence and top bar stability

## Presence (quiet while the user watches the session tab)
- Rule lives in `lib/core/presence.js` (pure) and `focusInfo` in `lib/windows.js`.
- Bug found 2026-11-23: Claude Code can start its terminal client from a detached helper (chain claude.exe, claude.exe, claude.exe, systemd), so no window is an ancestor and the ownership check said "not watching" every time. Fixed in PR #1 (810a15f): a detached session counts as watched only on an exact tab title match with the session title, in a terminal window.
- Accepted risks: two detached sessions with the same title in different windows; a dead pid counts as detached.
- Not seen on the real desktop yet (needs a login). The headless e2e (`tests/e2e/presence_e2e.py`) fails scenarios A, B, C on main in this environment because its fake terminal windows never appear in the nested shell; cause not found.

## Blank top bar (seen once on the real desktop, 2026-11-23)
- Symptoms: empty panel strip, thousands of `cogl_framebuffer_set_viewport` assertions, shell main thread at 60 to 90 percent; disabling then enabling the extension cleared it. Cause NOT found, never reproduced headless.
- Real defect fixed, PR #3 (7c010da, e910a0a): a held icon or tile destroyed by a session ending left the stage capture or grab alive and crashed the headless shell. Likely irrelevant to the blank bar (needs a held icon at that moment).
- If it recurs: do not log out; disable then enable the extension; run `journalctl --user -b | grep -c set_viewport`; check Looking Glass (alt+F2, lg) for zero size actors under Main.panel.
- Stress script: `tests/stress/panel_stress.py` (headless only, needs `AIMON_DEV_CONTROL`, refuses the real session bus).

## Incident
- A subagent toggled the real extension 10 times on the real bus (about 18:09) by mistake; ended enabled. Guard added in 71448ef.
