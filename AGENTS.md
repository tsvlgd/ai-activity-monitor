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

## Git workflow

Never commit straight to `main`. Every change gets its own branch, cut from an
up to date `main`, and is merged back only when it is done and green.

| Branch prefix | Use it for |
| --- | --- |
| `feat/<slug>` | A new capability users can see |
| `fix/<slug>` | A bug fix |
| `docs/<slug>` | Docs, AGENTS.md, diagrams, memory notes only |
| `refactor/<slug>` | Code change with no behaviour change |
| `perf/<slug>` | Speed or resource use |
| `test/<slug>` | Tests only |
| `chore/<slug>`, `ci/<slug>`, `build/<slug>` | Tooling, scripts, CI, packaging |

`<slug>` is short and lower case, for example `fix/preview-buttons-overflow`.

* One worktree per branch when another session may be working in this repo:
  `git worktree add ../ai-activity-monitor-<slug> -b fix/<slug> main`. Never
  switch branches in a working tree someone else is using.
* Keep a branch to one topic. Unrelated fixes found on the way get their own
  branch.
* Before merging: `npm test` and `npm run lint` pass, plus the headless shell
  check for anything under `extension/`. Then rebase on `main` and merge with a
  fast forward (or squash a noisy branch) so `main` stays linear.
* After merging: push `main`, delete the branch locally and on the remote, and
  remove its worktree.

### Commit messages: Conventional Commits

Every commit follows [Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <summary>

<body: what changed and why, wrapped at 72>

<footer: BREAKING CHANGE: ..., Refs: ...>
```

* `type` matches the branch prefix: `feat`, `fix`, `docs`, `refactor`, `perf`,
  `test`, `chore`, `ci`, `build`, `revert`.
* `scope` names the area: `core`, `ui`, `extension`, `claude-adapter`,
  `opencode-adapter`, `scripts`, `docs`, `memory`, `video`.
* Summary in the imperative, lower case, no final period, at most 72
  characters: `fix(ui): keep preview buttons inside the card`.
* A breaking change adds `!` after the scope and a `BREAKING CHANGE:` footer,
  for example a changed event schema or extension UUID.
* Memory updates ride with the work they describe, or go alone as
  `docs(memory): ...`.

## Commands

```bash
npm test          # 59 Node + 22 Python tests, must pass before any change is done
npm run lint      # ESLint
AIMON_HEADLESS=1 scripts/dev-nested.sh 1600x900
scripts/devctl.sh state
```

## Skills and tools that fit this project

* Frontend design: `impeccable` for UI polish of the indicators and preview.
* Backend pattern: `codebase-design` (deep modules, seams) for the adapter and store boundary.
* `agent-desktop` MCP can capture the host screen but cannot click on Wayland;
  use the dev control channel for interaction tests.
