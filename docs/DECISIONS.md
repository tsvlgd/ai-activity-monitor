# Decisions, review findings and open risks

This file records the significant design decisions, what the alternatives
were, what each choice costs, what an independent review found, how the
project was verified, and what is still open. For the explanation of the
design itself read [GUIDE.md](GUIDE.md); for the reference read
[ARCHITECTURE.md](ARCHITECTURE.md).

## How to review any design decision

Ask these six questions. A decision that cannot answer them is a guess.

1. What problem does it solve, and what happens if nothing is done?
2. What were the alternatives, and why were they rejected?
3. What does it cost (CPU, memory, complexity, lock in)?
4. How hard is it to change later?
5. What would show that it was the wrong call?
6. What does it put at risk (user files, the desktop, privacy)?

## Decision log

| # | Decision | Alternatives | Why | Cost and consequence | Cost to reverse |
| --- | --- | --- | --- | --- | --- |
| D1 | A GNOME Shell extension draws everything | Own window, Electron, tray icon | Wayland only lets the compositor draw on top and raise windows | Tied to GNOME and its version | High: the display layer is rewritten |
| D2 | Adapters write JSON lines into files in RAM | D-Bus, socket, HTTP | Decoupled, replayable, debuggable with `cat`, no new daemon | Needs trimming, locking, cleanup | Medium: change two adapters and `spool.js` |
| D3 | Pure core with no GNOME imports | Logic mixed into the UI | Testable in a second, portable | One more boundary to maintain | Low |
| D4 | Hook written in Python, standard library only | Shell, Node | Safe text handling, readable, about 35 ms per run | A new process per event | Low |
| D5 | One icon per agent, not per session | One icon per session | No clutter | Several sessions share one icon (count badge and a switcher in the card) | Low |
| D6 | State from events, liveness from `/proc` | Trust `SessionEnd` only | A closed terminal sends no end event | A 4 second timer, one `/proc` read per live session | Low |
| D7 | Replay files silently after a restart, then post pending approvals again | Start empty | Survives restarts without duplicate notifications | Slightly more code | Low |
| D8 | Notify for approval, error, long turns (15 s or more) and crashes. One notification per session, deduplicated for 30 s | Notify on every change | Avoid spam | Short turns are not announced, by design | Low (settings) |
| D9 | Desktop tiles live on the desktop layer, plus separate top bar icons | Floating over everything, one surface only | Tiles for the empty desktop, top bar for any window | Two surfaces to keep in sync | Medium |
| D10 | Play mode (roaming tiles) is on by default, and a dragged tile is parked | Off by default | It is a core part of the design | The most expensive feature, see the performance section of the guide | Low (settings) |
| D11 | The installer edits `~/.claude/settings.json` with a timestamped backup, touching only entries that contain `aimon_hook.py` | Ask the user to edit by hand | Reversible and exact | The file is rewritten (2 space indent) | Low: `uninstall.sh` |
| D12 | The test shell is isolated: headless, private D-Bus, `DISPLAY` unset, helper extensions disabled | Test on the live desktop | An early test leaked a helper window onto a real screen | Slower to test | Low |
| D13 | The Claude and OpenCode logos ship as icon assets | Hand drawn imitations | Recognisable at a glance | The logos belong to their owners (see open questions) | Low |
| D14 | The test control channel (`devcontrol.js`) ships inside the extension, gated by an environment variable and a folder path | Remove it from the installed copy | One code base for tests and use | About 160 lines of dead weight in production | Medium (needs a dynamic import) |

## Independent review

A reviewer with no implementation responsibility read the complete code base
and ran its own experiments, including a 16 process stress test of the spool
writer. It found no Critical issues and four High issues. All High findings
and the substantive Medium findings were fixed, each with a regression test.

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | Spool compaction raced with concurrent hook writers: the lock was held on the file being replaced, so 39 to 48 of 100 lines were lost under stress, which could leave a session stuck on working | Lock a separate `<file>.lock` that is never replaced and open the data file after the lock is held. The stress test now loses 0 of 100 lines in every run (`ConcurrencyTests`) |
| High | OpenCode: one project location shutting down ended every session, and after the first plugin instance was disposed nothing reported events until the server restarted | Shutdown is scoped to sessions in that directory. A per process registry keeps one subscription and hands it to a surviving instance |
| High | With parallel subagents, any tool event cleared another agent's pending approval and withdrew its notification | Pending prompts are tracked per agent (the `agent` field, from the Claude `agent_id` or the OpenCode child session). Only that agent's own later event resolves it |
| High | Process identity was never refreshed when the PID changed (resume, server restart), causing a false "ended unexpectedly" and deleting a live spool | Identity is remembered per PID and reset when the PID changes |
| Medium | Nothing cleared a stuck working state after a missed end of turn | Working with no events for 20 minutes (2 hours while a tool runs) decays to idle |
| Medium | A notification triggered by the line that caused compaction was replayed silently | Lines newer than anything seen before still notify after a reset |
| Medium | Screen lock disables the extension and drops pending approval notifications | Pending approvals are posted again after enable |
| Medium | Redaction missed `NAME_API_KEY=`, `GITHUB_TOKEN=`, non http URL credentials and `mysql -p` | Broader patterns in both adapters, with shared test vectors |
| Medium | An outside click acknowledged results | Outside clicks only close the preview |
| Medium | Rebuilding the preview on every event could swallow a click | The card is built once and updated in place |
| Medium | A client in a subdirectory never counted as attached | Prefix match on the session directory |
| Medium | Continuous repaint while working | Accepted: the motion is required, the actor is small, it stops when not working and it respects reduced motion |
| Low | Unquoted hook path, stale files on reinstall, preview above modal dialogs, bidi characters, dev channel scope | Fixed: `shlex.quote`, clean reinstall, preview in normal chrome, bidi and zero width characters stripped, dev channel only honoured inside the harness runtime folder |
| Low | No dark variant, no real frosted blur in St | Accepted: St has no rounded backdrop blur |

### The five most important production failure scenarios

1. A long session with parallel tools crosses the compaction size and loses
   the end of turn line, leaving the tile working forever. Fixed with the lock
   file and the stale working decay.
2. One OpenCode project closes, all OpenCode sessions end and monitoring goes
   silent. Fixed with scoped shutdown and handover.
3. Parallel subagents hide a pending approval. Fixed with per agent pending
   state.
4. A resume or server restart triggers a false termination and deletes a live
   spool. Fixed with identity per PID.
5. Screen lock during a long task loses approval notifications. Fixed by
   posting pending approvals again on enable.

## How this was verified

Automated tests run with `npm test`: 49 Node tests (state machine, notification
policy, OpenCode event mapping, roaming rules, and a contract test that feeds
real hook subprocess output and real plugin writer output through the
extension store) and 18 Python tests (Claude hook mapping, redaction, silent
stdout, exit code 0 on garbage input, file modes, compaction under concurrency,
and the settings installer: idempotent install, exact rollback, dry run).
`npm run lint` runs ESLint.

The GNOME only code (`spool.js`, `notifier.js`, `windows.js`,
`desktopstate.js`, the UI files and `extension.js`) has no unit tests, because
it needs GNOME Shell. It was checked with a headless GNOME Shell 46
(`AIMON_HEADLESS=1 scripts/dev-nested.sh`) running in its own D-Bus session
with a virtual monitor, against real Claude Code and OpenCode sessions.
Interaction used the development control channel (`scripts/devctl.sh`), which
emits the real `clicked` signals of tiles and buttons, and a virtual pointer
device for real pointer paths. Scenarios covered: idle, working, tool use,
both agents at once, approval, completion, error, several sessions of one
agent, a killed agent (ended within one 4 second sweep), shell restart with a
live session, fullscreen hiding, the preview never taking focus, dragging and
parking tiles, and top bar icons.

Not verified:

* OpenCode permission prompts were never observed live. `permission.asked` is
  mapped and unit tested from the event names in the OpenCode 2.3 binary.
* Claude `Notification` types other than `idle_prompt` were not observed live.
* Multiple monitors. Indicators use the primary monitor only.
* A real physical double click. Release by double click was driven through the
  signal path and the pointer device, not a hand on a mouse.
* Animation smoothness on real hardware. Motion was verified by sampling
  `translation_y` in a software rendered shell.
* Tab selection inside gnome-terminal. Raising the right window is verified;
  the tab switch uses the terminal's `active-tab` action and was checked on a
  real desktop only.
* Behaviour on any setup other than the one in the README.

## Open questions and risks

| # | Question | Options | Notes |
| --- | --- | --- | --- |
| O1 | Play mode default | Keep as is, throttle to about 20 updates per second, run only when the desktop is empty and idle, or default off | The one feature with a visible cost; see the performance numbers in the guide |
| O2 | Hook speed | Keep Python (about 35 ms per event, roughly 70 ms per tool call), or rewrite in shell | Measure first with `scripts/measure.py hook`; revisit only if agents feel slower |
| O3 | Test channel in the installed copy | Keep, or remove with a dynamic import | Less code is less risk; not urgent |
| O4 | Support another agent (Codex CLI, Gemini CLI) | New adapter, one `providers.js` entry, one icon | Most of the effort is learning the agent's events |
| O5 | Wider distribution | Rename the UUID, choose a license, test other GNOME versions, submit for review | Today it targets one tested setup |
| O6 | Old settings backups | `~/.claude/settings.json.aimon-backup-*` accumulate | Delete all but the newest once satisfied |

| Risk | Likelihood | What happens | Mitigation |
| --- | --- | --- | --- |
| A newer GNOME release | Certain, eventually | The extension stops loading until `metadata.json` and the changed APIs are updated | Re test after a desktop upgrade; `scripts/dev-nested.sh` makes that quick |
| Claude Code changes its hook payloads | Possible | Some states stop updating | The contract tests and `scripts/lab.sh watch` show it immediately |
| OpenCode changes its plugin API again (it already did between 1.x and 2.x) | Likely | The OpenCode icon goes silent | Use a throwaway probe plugin that logs every event |
| Tab matching depends on terminal title conventions | Setup dependent | Open in Terminal raises the window but may pick the wrong tab | Rules live in `lib/providers.js` |
| A bug in the extension JavaScript | Possible | One callback fails and logs; an endless loop would freeze the whole desktop | All work is event driven, no loops; every timer and signal is released in `disable()` |
| Unverified paths | Known | See the not verified list above | Test one by hand before relying on it |

Known limits, accepted:

* **OpenCode subagent folding depends on seeing the creation event.** The
  adapter learns which session is a child from the `session.created` event
  that carries `parentID`, and keeps that link only in memory
  (`tracker.parentOf`). If the plugin is loaded or reloaded after a child
  session already exists, the link is unknown: the child is reported as its
  own session, so the OpenCode icon shows a count of 2 and the child's
  `execution.succeeded` can look like a root turn completing. This was
  demonstrated with a small script on the real `mapEvent`, not seen on a live
  desktop. Plugin loads normally happen at server start, before any child
  exists, so this is rare. Possible fixes: persist the links in a small file,
  or look the parent up when an unknown session first appears.
* **Brand assets.** The Claude and OpenCode logos in
  `extension/ai-activity-monitor@local/icons/` belong to their owners. Replace
  them if you redistribute this project.
* **Desktop wide trust.** The extension runs inside GNOME Shell without a
  sandbox, as every GNOME extension does. It contains no network code, which
  can be checked with the audit in the guide.
