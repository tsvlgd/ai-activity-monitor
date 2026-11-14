# AGENTS.md

Guidance for coding agents working in this repository (AI Activity Monitor).

## What this is

A GNOME Shell 46 extension (`extension/ai-activity-monitor@local`) plus two
adapters (`adapters/claude-code`, `adapters/opencode`) that feed it through
JSONL spool files. Read `docs/ARCHITECTURE.md` and `docs/EVENTS.md` first;
`docs/GUIDE.md` is the full guide and `docs/DECISIONS.md` holds the decision log.

## Rules

* `lib/core/*` must stay pure: no `gi://` or `resource://` imports. Node tests
  import these files directly.
* Adapters must never print to stdout, never block, and always exit 0.
* Any new event kind needs: a mapping in the adapter, a reducer case in
  `lib/core/model.js`, a row in `docs/EVENTS.md`, and tests.
* Every signal, timer and actor created in `enable()` must be released in
  `disable()`.
* Never let both the layout manager (`trackFullscreen`) and extension code
  write the same actor's `visible` property.
* Never test against the real desktop session. Use
  `AIMON_HEADLESS=1 scripts/dev-nested.sh` and `scripts/devctl.sh`.
* Docs style: no emojis, no hyphens in prose.
* Keep `docs/diagrams/build.py` in step with the code it counts, and rebuild with
  `python3 docs/diagrams/build.py` after structural changes.

## Commands

```bash
npm test          # 49 Node + 18 Python tests, must pass before any change is done
npm run lint      # ESLint
AIMON_HEADLESS=1 scripts/dev-nested.sh 1600x900
scripts/devctl.sh state
```

## Skills and tools that fit this project

* Frontend design: `impeccable` for UI polish of the indicators and preview.
* Backend pattern: `codebase-design` (deep modules, seams) for the adapter and store boundary.
* `agent-desktop` MCP can capture the host screen but cannot click on Wayland;
  use the dev control channel for interaction tests.
