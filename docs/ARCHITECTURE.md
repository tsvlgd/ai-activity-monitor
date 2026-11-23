# Architecture

GlanceAgent shows what Claude Code and OpenCode sessions are doing, as
small moving icons in the top bar and on the empty desktop of a GNOME Shell 46
Wayland session. This document describes the components, the data flow and the
reasoning behind each decision.

## Developed and tested on

| Item | Value |
| --- | --- |
| OS | Ubuntu 24.04 LTS |
| Desktop | GNOME Shell 46, Wayland |
| Terminal | `gnome-terminal` (single server process for all windows) |
| Claude Code | 2.1.x, command hooks |
| OpenCode | 2.3.x, v2 plugin API, one shared background server (`opencode serve --service`) |
| Runtimes | gjs 1.80, Node 24, Python 3.12 |

## Components

```
 Claude Code session                OpenCode server (shared, all sessions)
   hook events (stdin JSON)           event bus (ctx.event.subscribe)
          |                                     |
 adapters/claude-code/aimon_hook.py   adapters/opencode/ai-activity-monitor.js
   map to normalized event              map to normalized event
          \                                     /
           \   append one JSON line per change /
            v                                 v
   $XDG_RUNTIME_DIR/ai-activity-monitor/spool/<provider>--<session>.jsonl
                              |
                Gio.FileMonitor (lib/spool.js)
                              |
           SessionStore (lib/core/store.js, pure)
             reduceSession (lib/core/model.js)
             decideNotification (lib/core/policy.js)
                              |
        extension.js (orchestrator, liveness sweep, decay timer)
         /          |            |               \
 EdgeIndicators  PanelIndicators  PreviewCard    Notifier
 (desktop tiles, (top bar icons,  (lib/ui/        (lib/notifier.js)
  lib/ui/         lib/ui/          preview.js)
  indicators.js)  panel.js)           |
        |                     lib/windows.js (Open in Terminal: raise window, switch tab)
 lib/core/roaming.js (which tiles are parked)
 lib/desktopstate.js (which areas windows cover)
```

| Layer | Files | Responsibility |
| --- | --- | --- |
| Claude Code adapter | `adapters/claude-code/aimon_hook.py` | Map hook payloads to normalized events. Record the agent PID and terminal identity. Redact secrets. Never print, always exit 0. |
| OpenCode adapter | `adapters/opencode/ai-activity-monitor.js` | Subscribe to the v2 event bus. Ignore streaming deltas. Fold subagent sessions into their root. One writer per server process. |
| Session state store | `lib/core/store.js`, `lib/core/model.js` | Pure reducer from events to session records. Aggregation per provider. Pending prompts are tracked per agent. No GObject imports, so Node tests run it unchanged. |
| Activity manager | `extension.js` | Wires spool, store, liveness, decay, notifications and UI. Owns every timer and signal and releases them in `disable()`. |
| Notification integration | `lib/core/policy.js`, `lib/core/presence.js`, `lib/notifier.js` | Pure spam policy, a pure "is the user already watching this session" check, and the GNOME 46 MessageTray. One notification per session, replaced in place. |
| Presentation | `lib/ui/indicators.js`, `lib/ui/panel.js`, `lib/ui/preview.js`, `lib/ui/motion.js`, `lib/core/roaming.js`, `lib/desktopstate.js`, `stylesheet.css` | Desktop tiles that roam in play mode and can be parked by dragging, top bar icons placed anywhere on the bar with a "done" or "needs you" bubble, motion by state (work, four attention hops with a bounce then still, still), a focus safe preview card 380 px wide, hover labels. |
| Provider registry | `lib/providers.js` | Name, icon, order and liveness strategy per agent. Adding an agent means one adapter plus one entry here. |

## Key decisions

1. **GNOME Shell extension for presentation.** On Wayland only the
   compositor can draw always on top edge chrome, raise another client's
   window, and observe stage input without a grab. A separate GTK app
   cannot do any of these reliably.
2. **Spool files instead of D-Bus or sockets.** Adapters append to per
   session JSONL files in the per user tmpfs runtime dir (mode 0700 dir,
   0600 files). Writers never block on the desktop being up, and the
   extension rebuilds full state by replaying the files after a shell
   restart. Files are compacted at 256 KiB (first line plus last 200 lines).
3. **Event driven, with process checks only for liveness.** State comes from
   agent lifecycle events. A slow sweep every 4 seconds checks that the agent
   process still exists (PID plus comm plus start time, so a recycled PID is
   not mistaken for the agent). That catches a terminal closed hard, where no
   `SessionEnd` hook can run.
4. **Shared server providers.** OpenCode 2.x hosts every session in one
   background server, so the plugin PID says nothing about a single session.
   A session counts as attached while an `opencode` client process runs in
   the session directory. A detached idle session ends quietly after 20
   seconds. Only the server dying is reported as unexpected.
5. **One icon per provider.** Several sessions of the same agent share one
   icon with a count, and the preview has a session switcher. Icons are never
   repeated, on the desktop or in the top bar.
6. **Focus safety.** Tiles and preview buttons never take key focus
   (`can_focus: false`). On Wayland, presses on application windows never reach
   the shell's stage handlers, so while the card is open a transparent click
   catcher sits under it and closes it on any outside click (the closing click
   is consumed, like a GNOME popover). Terminal focus happens only on an
   explicit Open in Terminal click.
7. **Fullscreen.** The layout manager owns a wrapper actor's visibility
   (`trackFullscreen`), and the extension owns the inner stack's visibility,
   so an agent event during a fullscreen video can never show the tiles again.
   The preview closes when a window goes fullscreen.
8. **Two surfaces.** Top bar icons are visible from every window. Desktop tiles
   live on the desktop layer of the current workspace: `lib/desktopstate.js`
   reports which areas application windows cover and a tile hides where it is
   covered (`show-on` `always` puts them above every app).
9. **Parked and roaming tiles.** In play mode, desktop tiles roam the empty
   desktop and bounce off each other. Dragging a tile parks it: its position is
   saved per provider in `tile-positions`, it keeps its state motion but stops
   roaming, and roaming tiles bounce off it. A double click on a parked tile,
   or Release all in the preferences, removes the saved position. The rule
   lives in the pure `lib/core/roaming.js` so Node tests cover it.

## State machine

States: `idle`, `working`, `waiting`, `completed`, `error`, `ended`.

| Event | Transition |
| --- | --- |
| `session_start` | new session to `idle` |
| `prompt` | to `working`, turn timer starts |
| `activity`, `tool_start` | to `working` (tool start also counts active tools) |
| `tool_end`, `tool_error` | stays `working`; clears `waiting` |
| `permission`, `input_needed` | to `waiting` (approval or input) |
| `permission_resolved` | `waiting` to `working` |
| `turn_complete` | to `completed`, sets the turn boundary |
| `turn_error` | to `error` |
| `turn_interrupted`, `idle_hint` | `working` or `waiting` to `idle` |
| `session_end` | to `ended`, removed after 2.5 seconds |
| `process_gone` (synthesized) | to `ended`, flagged unexpected |
| decay timer | `completed` or `error` back to `idle` after the hold time |

Late events whose timestamp is older than the last turn boundary are ignored,
because parallel hook processes can deliver them out of order.

## Notification policy

Notify on: approval or input needed (urgent), error (urgent), completion of
a turn of at least 15 seconds, unexpected termination. Never notify while
replaying after a restart. The same kind for the same session within 30
seconds is suppressed. Each session owns at most one notification, replaced
in place, and an approval notification is withdrawn as soon as the agent moves
on.

Presence: when the user is already looking at the session, a new attention
state is marked as seen at once, so there is no notification, no bounce and no
bubble. Looking means the focused window's process is an ancestor of the
session's process and, for a terminal, the active tab's title (the window
title) equals the session title; for an editor such as VS Code the window
title names the project folder. Switching to that tab or window later also
counts as seeing it and withdraws its notification. Every unsure case notifies.
The rule is `isWatching` in the pure `lib/core/presence.js`; `focusInfo` in
`lib/windows.js` describes the focused window.

## Settings

All settings live in the `org.gnome.shell.extensions.glanceagent`
schema; the README lists every key and its default. The ones that shape the
architecture are `panel-indicators` and `desktop-tiles` (each surface can be
switched off), `desktop-play` (roaming), `show-on` (desktop layer or always on
top), `hide-idle`, `tile-positions` and `panel-placement` (positions set by
dragging), `completed-hold-seconds` (the decay hold) and the four `notify-*`
switches.

## Lessons learned while building

* OpenCode 2.3 is not the v1 plugin API: plugins are `{id, setup(ctx)}` and
  run inside one shared server, so environment variables and the PID belong
  to the server, not to the terminal.
* In GNOME 46, removing the last notification of a source destroys the
  source. Acquire the source only after replacing the old notification.
* `trackFullscreen` forces `visible = true` when fullscreen ends. Never let
  the layout manager and extension code both write one actor's visibility.

## Learn more

[GUIDE.md](GUIDE.md) explains this design from first principles, with diagrams,
labs and the measured cost of each part. [DECISIONS.md](DECISIONS.md) holds the
decision log, the review findings and the open risks. [EVENTS.md](EVENTS.md) is
the event schema.
