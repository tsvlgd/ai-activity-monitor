# AgentGlance research and Linux product plan for AI Activity Monitor

Date: 2026-11-23. Scope: read only research. Sources: agentglance.app, the GitHub repository `hezi/AgentGlance` (read through the GitHub API, source text only, nothing built or run), gjs.guide porting and review pages, distro release coverage, and the `ddterm/gnome-shell-image` container images. Our repository was read at its working tree, which contains uncommitted edits from a parallel session (see section 4.0).

Owner scope update applied: mobile phone connectivity (Web Remote), model and token tracking, display templates and inline diffs are listed in the inventory as **excluded by owner** and are left out of the gap ranking and the top 10.

## 0. Verification status

| Claim | Status |
| --- | --- |
| Site content (agentglance.app) | Verified, fetched. The site is a single landing page. There are **no** separate features, docs, pricing, changelog or FAQ pages. The changelog lives in the repository as `docs/releasenotes/*.html` plus a Sparkle `docs/appcast.xml`; I read those instead. |
| Source repository | Verified: `github.com/hezi/AgentGlance`, Swift, 25 stars, created 2026-03-27, last push 2026-04-16 (dormant for seven months). |
| License | **Inconsistent.** Site and README say MIT, but the repository has no LICENSE file and GitHub reports no license. Treat as unlicensed until a LICENSE file exists. |
| CI and packaging | Verified: no `.github` folder, no CI at all. Releases are built locally by `scripts/release.sh` (xcodebuild archive, Developer ID signing, notarization, zip, `gh release`), updates through Sparkle. |
| Supported agents | README claims "Claude Code and Codex CLI". **The code supports only Claude Code**: there is no Codex or Gemini integration anywhere; "codex" and "gemini" appear only as screenshot test fixtures (`AppState.swift:399-400`). The site itself says Codex and Gemini are "coming soon". |
| Author | Site credits `@jorgewritescode` on X; repository owner is `hezi`. Relationship not verified. |
| Distro GNOME versions | Verified from the pinned versions in `ddterm/gnome-shell-image` Dockerfiles (renovate maintained, pushed 2026-11-23) plus release coverage. RHEL 10 family version is taken from the AlmaLinux 10 image (49.5); I did not confirm when RHEL rebased from 47. |
| Ubuntu default terminal | Ptyxis is the default in Ubuntu 26.04 LTS. Sources disagree whether it became default in 25.04 or 25.10. Fedora default terminal (Ptyxis since Fedora 41) is from prior knowledge, not rechecked. |
| Claude Code plugin hooks and OpenCode `permission.ask` | From prior knowledge, not rechecked against current docs. Marked where used. |

## 1. What AgentGlance is

A macOS 14+ (Apple Silicon) SwiftUI menu bar app that draws a floating "pill" overlay near the notch. It runs an HTTP server on a Unix socket (`/tmp/agentglance.sock`) with TCP fallback on port 7483. Claude Code command hooks run a small Swift bridge binary (`~/.agentglance/bin/agentglance-bridge`) for 8 events (SessionStart, SessionEnd, PreToolUse, PostToolUse, Stop, Notification, PermissionRequest, UserPromptSubmit), with `matcher: ""` and `timeout: 120` on PermissionRequest.

How the hook works (`AgentGlance/Bridge/agentglance-bridge.swift`):

```
Claude Code hook (stdin JSON)
  -> bridge enriches: TERM_PROGRAM, ITERM_SESSION_ID, TMUX, TMUX_PANE, KITTY_WINDOW_ID, tty,
     session name from ~/.claude/sessions/<pid>.json (walks parent PIDs)
  -> Ghostty only: writes OSC 2 tab title "project · session" to stderr
  -> POST /hook/<Event> over the Unix socket (falls back to http://localhost:7483)
  -> PermissionRequest only: keeps the connection open, waits for the user's click,
     writes the decision JSON to stdout (Claude Code applies it)
```

Decisions it can return (`Server/HookServer.swift:313-500`): allow, deny with message, "always allow" (returns `updatedPermissions` with an `addRules` entry, `destination: projectSettings`, rule content = the command or file path), answer `AskUserQuestion` (returns `updatedInput` with answers), and dismiss/skip (no output, so Claude Code falls back to its own terminal prompt). Stale pending decisions are flushed when the user answers in the terminal instead.

Other mechanics: `HookConfigWatcher.swift` watches `~/.claude/settings.json` and reinjects its hooks if removed (rate limited to 5 repairs per hour). `TranscriptReader.swift` reads `~/.claude/projects/...jsonl` for model and tokens. `ProcessScanner.swift` finds already running Claude processes at launch and checks liveness every 5 s. `SleepManager.swift` holds an IOKit power assertion while working.

Security notes worth learning from: the socket sits in world writable `/tmp`, and the Web Remote is plain HTTP plus WebSocket on ports 7484/7485 with a 6 digit pairing code (60 s lifetime) and 32 byte bearer tokens stored in a JSON file.

## 2. Feature inventory

Legend for Linux column: what the GNOME (or generic Linux) equivalent would be.

### 2.1 Overlay and display

| # | Feature | Detail | macOS specific? | Linux equivalent |
| --- | --- | --- | --- | --- |
| A1 | Floating pill overlay near the notch | Collapsed pill shows aggregate state; expands to a session list on hover or click; 300 ms collapse delay so resize handles can be grabbed; pin button keeps it expanded | Notch placement and `NSPanel` are macOS | GNOME: chrome actor via `Main.layoutManager.addChrome` (we already do this). wlroots, KDE: `wlr-layer-shell` surface. XFCE/X11: override redirect or always on top window |
| A2 | Two window modes | "Classic (Notch Overlay)" and "System Chrome" (native window, real resize, system blur), default since 1.4 | Yes | A normal resizable panel window is only possible in the shell; elsewhere a layer shell or regular window |
| A3 | Draggable pill with snap | Snaps to default spot, screen edges and corners, with visual snap guides and proximity feedback; "Reset Position" | No | Shell actor drag (we have drag for tiles and icons) |
| A4 | Which screen | Main screen, follow cursor, or a specific screen | No | `Main.layoutManager.monitors`, pointer position via `global.get_pointer()` |
| A5 | Appearance | Liquid Glass styling with frost slider, dark/light/system mode, font scale XS to XXL plus system, expanded width, "fit width to text", "show status text" in pill | Liquid Glass is macOS 26 | St CSS with `-st-accent-color` (GNOME 47+), `St.Settings` color scheme, blur via `Shell.BlurEffect` |
| A6 | Empty state | When no sessions: a view with Settings and Setup buttons | No | Preview card empty state |
| A7 | Menu bar icon | Pulsing dot for state (replaced a spinning arc in 1.3), brighter idle icons in 2.0; menu with native items | Menu bar is macOS | Top bar icon (we have) or StatusNotifierItem tray |
| A8 | Tooltips on header buttons | Pin and settings buttons have tooltips | No | We have hover labels |

### 2.2 Session information

| # | Feature | Detail | Linux equivalent |
| --- | --- | --- | --- |
| B1 | Multiple sessions as rows | Each row: state icon, project path (shortened, `~`), session name, elapsed time, current tool, task progress, the user prompt that started the turn | Preview card list |
| B2 | States | idle, working, awaitingApproval, ready (finished, waiting for next prompt), complete (session ended, fades after 8 s); stale after 5 min of no activity | Our model has idle, working, waiting, completed, error, ended |
| B3 | Rich working status | Sub states Thinking (prompt sent, no tool yet), Running tool, Compacting (from Notification `compact`) | Reducer sub state |
| B4 | Completion cards | Shows the agent's last message (`last_assistant_message` from Stop) rendered as Markdown (headings, bullets, inline formatting) with Show More | Pango markup or a small Markdown subset in St |
| B5 | Task progress | Counts TodoWrite todos: done, in progress, open | Parse `tool_input.todos` in the hook |
| B6 | Session grouping | Group by none, project or status; sort alphabetical or last updated; collapsible headers; collapsed groups remembered across launches | Store grouping, gsettings key |
| B7 | Session names | From Claude's `--resume` name or session file | We read the AI title from the transcript |
| B8 | Liveness | Process scan at launch, liveness check every 5 s, ghost sessions removed | We have this |
| B9 | Model and token tracking | **Excluded by owner.** Model name and input plus output tokens from the transcript; site also says "cost per session" | Not planned |
| B10 | Display templates | **Excluded by owner.** Tokens like `{cwd}`, `{state}`, `{model}`, `{total_tokens}` for header, row title and row detail | Not planned |

### 2.3 Interaction with the agent (the core differentiator)

| # | Feature | Detail | Linux equivalent |
| --- | --- | --- | --- |
| C1 | Approve tool requests | Allow, Always Allow, Deny, Skip buttons on PermissionRequest. Write approvals mark new versus existing files | Blocking PermissionRequest hook plus a return channel from the shell |
| C2 | Inline diffs | **Excluded by owner.** Red/green diff for Edit approvals | Not planned |
| C3 | Queued approvals | Per session queue; option "Show all queued approvals at once" | Same |
| C4 | Answer questions | AskUserQuestion options as selectable buttons, multi select, one question at a time with prev/next, tap to expand long text | Same, return `updatedInput` |
| C5 | Review plans | ExitPlanMode: rendered preview of the plan file (first lines, expandable), Approve, Reject, Open the full file | Same; open file with `Gio.AppInfo.launch_default_for_uri` |
| C6 | Smart auto expand | Overlay expands on approval requests; suppressed while the session's terminal is focused | Our WIP `presence.js` already detects "user is watching" |
| C7 | Keyboard navigation | Global hotkey (default Cmd+Shift+C, rebindable) toggles overlay; arrow mode (up/down rows, left/right actions, Return) or number mode (row number then action number) | `Main.wm.addKeybinding` with a gsettings `as` key; modal grab while open |
| C8 | Jump to terminal | One click or double tap a row raises the right terminal tab: Terminal.app and iTerm2 by tty via AppleScript, Kitty via `kitten @`, Ghostty via a tty to tab cache built from `ps` and `lsof` plus OSC 2 titles; Warp in README; tmux pane info captured | Per terminal: gnome-terminal `org.gtk.Actions`, Ptyxis, Konsole D-Bus, Kitty remote control, WezTerm CLI, tmux `select-pane`, Ghostty (no Linux API yet) |
| C9 | Notifications | macOS notifications for awaiting approval, ready, complete, each with "Open Terminal" and "Dismiss" actions; opt out toggle (2.0) | `MessageTray` (GNOME) or `org.freedesktop.Notifications` with actions |
| C10 | Sound | "Play sound on notifications" toggle; plays `NSSound.beep()` on approval and ready | `global.display.get_sound_player().play_from_theme(...)` or canberra |
| C11 | Sleep prevention | Keeps the Mac awake while any agent works | `org.gnome.SessionManager.Inhibit` (suspend/idle flags) or `org.freedesktop.login1.Manager.Inhibit` |

### 2.4 Remote, onboarding, updates, platform

| # | Feature | Detail | Linux equivalent |
| --- | --- | --- | --- |
| D1 | Web Remote | **Excluded by owner.** Phone web UI over LAN or Tailscale, pairing code, device list, revoke | Not planned |
| D2 | Onboarding | First launch view "Setup Claude Code Hooks" shows the hooks JSON for `~/.claude/settings.json`; menu bar "Setup Hooks"/"Setup Integrations..." button writes it | Prefs page button with explicit consent |
| D3 | Hook self repair | Watches settings.json and reinjects hooks if another tool removes them (max 5 per hour) | `Gio.FileMonitor` on the settings file |
| D4 | Hook server settings | Port setting with Apply; server status (port, session count, pending decisions) | Not needed with spool files |
| D5 | Permissions pane | Requests macOS Automation and Notification permissions | macOS only. No Linux equivalent needed inside GNOME Shell |
| D6 | Launch at login | Toggle | Implicit for a shell extension; XDG autostart for a companion app |
| D7 | Move to Applications prompt | One click move | macOS only |
| D8 | Auto updates | Sparkle appcast, update dialog on launch, "Check for Updates" | extensions.gnome.org updates, distro package managers |
| D9 | Signed and notarized | Since 1.4 | EGO review; signed distro repos |
| D10 | Debug pane | Screenshot mode with scripted scenarios, test sessions, test approvals, test questions, plan review, state changes | Our `devcontrol.js` harness |
| D11 | Supported agents | Claude Code only in code. Codex and Gemini "coming soon" | We support Claude Code and OpenCode |
| D12 | Platform | macOS 14+, Apple Silicon only | Linux |
| D13 | Pricing | Free | |
| D14 | License | Claims MIT, no LICENSE file | |
| D15 | Install | Download zip from GitHub Releases or build in Xcode; "about 30 seconds" | |

## 3. Gap analysis against our repository

Status: **Have**, **Partial**, **Lack**, **N/A** (not applicable on Linux or not needed), **Excluded**.

| # | AgentGlance feature | Status | Evidence in our repo |
| --- | --- | --- | --- |
| A1 | Floating overlay with expandable session list | Partial | Top bar icons `lib/ui/panel.js`, desktop tiles `lib/ui/indicators.js`, click opens the preview card `lib/ui/preview.js` (380 px, focus safe). No always visible list of all sessions; the card shows one session with a switcher. |
| A2 | Window modes | N/A | Shell chrome is already the right surface on GNOME. |
| A3 | Drag with snap | Partial | Tiles park where dropped (`lib/core/roaming.js`, `tile-positions`), icons drag along the bar (`panel-placement`). No snap to edges/corners, no guides. |
| A4 | Screen selection | Lack | Primary monitor only: `lib/ui/indicators.js:567` `Main.layoutManager.primaryMonitor`; README "multiple monitors are untested". |
| A5 | Appearance controls | Partial | `icon-size`, `spacing`, `edge`, `offset-*` in the schema; follows shell theme via `stylesheet.css`. No font scale, width or explicit dark/light. |
| A6 | Empty state with setup | Lack | Nothing shows when no session exists; setup is CLI only (`scripts/install.sh`). |
| A7 | Menu bar icon with state | Have | Top bar icons with state dot, count and motion (`lib/ui/panel.js`, `lib/ui/motion.js`). We go further: desktop tiles, roaming play mode, attention hop. |
| A8 | Tooltips | Have | Hover labels (`hoverPhrase` in `lib/ui/indicators.js`). |
| B1 | Rows with path, elapsed, prompt, tool | Partial | Card shows project, current step, recent activity, prompt preview (`show-prompt-text`), `formatDuration` in `lib/core/model.js`. Only one session at a time. |
| B2 | States | Have | `lib/core/model.js` (idle, working, waiting, completed, error, ended) plus decay timer and notification policy. |
| B3 | Thinking / Running / Compacting | Partial | Compacting maps to an `activity` detail (`adapters/claude-code/aimon_hook.py:209`, OpenCode `session.compaction.started`). No explicit thinking sub state. |
| B4 | Completion card with last message | Lack | Hook does not read `last_assistant_message`; card shows activity, not the answer. |
| B5 | TodoWrite progress | Lack | No todo parsing in the adapter or reducer. |
| B6 | Group by project or status | Lack | We group only per provider (`SessionStore.byProvider` in `lib/core/store.js`). |
| B7 | Session names | Have | Transcript AI title (`aimon_hook.py:136` `session_title`), OpenCode session title. |
| B8 | Liveness | Have | 4 s sweep with PID plus comm plus start time (`lib/procs.js`, `extension.js`); shared server handling for OpenCode. Stronger than AgentGlance. |
| B9 | Model and tokens | Excluded | |
| B10 | Display templates | Excluded | |
| C1 | Allow / Always / Deny / Skip | Lack | Adapters are one way writers. Hook template uses `timeout: 5` (`scripts/claude_hooks.py:64`) and never prints (AGENTS.md rule). Needs a return channel and a rule change for one event. |
| C2 | Inline diffs | Excluded | |
| C3 | Approval queue | Lack | Depends on C1. |
| C4 | Answer questions | Lack | We detect `input_needed` and notify, but cannot answer. |
| C5 | Plan review | Lack | No ExitPlanMode handling. |
| C6 | Auto expand, suppressed when terminal focused | Partial | Uncommitted `lib/core/presence.js` (`isWatching`) and `focusInfo` in `lib/windows.js` suppress attention when the user already looks at the tab. No auto open of the card. |
| C7 | Global hotkey and keyboard navigation | Lack | No keybinding in schema or code; tiles and buttons are deliberately `can_focus: false`. |
| C8 | Jump to terminal tab | Partial | Raises any terminal by PID ancestry (`lib/windows.js:21-39`), switches tabs only in gnome-terminal (`lib/windows.js:114-150`). No tmux, Kitty, WezTerm, Konsole, Ptyxis tab selection. |
| C9 | Notifications with actions | Have | `lib/notifier.js:90` "Focus terminal" action, one per session, replaced in place, spam policy in `lib/core/policy.js`, four `notify-*` toggles. |
| C10 | Sound | Lack | No sound code. |
| C11 | Sleep prevention | Lack | No inhibitor. |
| D1 | Web Remote | Excluded | |
| D2 | In app onboarding | Partial | `scripts/install.sh --claude/--opencode` with dry run and backups; nothing inside prefs. |
| D3 | Hook self repair | Lack | No watcher on `~/.claude/settings.json`. |
| D4, D5, D7 | Port, permissions, move to Applications | N/A | |
| D6 | Launch at login | N/A | Extension loads with the shell. |
| D8 | Auto updates | Lack | No EGO listing, no packages. |
| D9 | Signed releases | Lack | No releases yet. |
| D10 | Debug scenarios | Have | `lib/devcontrol.js`, `scripts/devctl.sh`, `scripts/lab.sh`, headless harness. |
| D11 | Agents | Have, ahead | Claude Code and OpenCode (`lib/providers.js`); AgentGlance only Claude Code. |
| D14 | License | Lack | README: "No license has been chosen yet". |

### 3.1 Top 10 gaps, ranked (excluded features left out)

Ranked by user value for a public product divided by effort, with the Linux reality in mind.

1. **Approve, Always Allow, Deny, Skip from the card (C1, C3).** The single feature that turns a monitor into a control surface. Needs: a blocking PermissionRequest hook with a long timeout, a return channel (see 3.2), and fail open behaviour (no output means Claude asks in the terminal).
2. **Answer AskUserQuestion options (C4).** Same channel as 1, returns `updatedInput`.
3. **Plan review for ExitPlanMode (C5).** Same channel; render the plan preview, Approve/Reject, open file.
4. **Session list in the card (A1, B1).** Every session as a row with state, project, elapsed, prompt; today the card shows one session behind a switcher.
5. **Completion card with the agent's last message (B4).** Cheap: Stop carries `last_assistant_message`; redact and truncate in the hook.
6. **Global hotkey and keyboard navigation (C7).** `Main.wm.addKeybinding` plus a modal key handler while the card is open; essential once approvals exist.
7. **Terminal tab switching beyond gnome-terminal (C8).** Ptyxis is now the default on Ubuntu 26.04 and Fedora, so today's tab switching fails on most fresh installs. Add tmux, Kitty, WezTerm, Konsole and Ptyxis strategies.
8. **Multiple monitors and screen choice (A4).** Primary, follow pointer, specific monitor.
9. **In prefs onboarding plus hook self repair (D2, D3, A6).** "Connect Claude Code" and "Connect OpenCode" buttons with explicit consent, status of each integration, empty state with a setup link, watcher that warns (not silently rewrites) when hooks disappear.
10. **Task progress, grouping and rich status (B5, B6, B3)** bundled, then sleep inhibit and sound (C11, C10) as small finishing items.

### 3.2 Design note for the return channel (gap 1 to 3)

Our spool is one way by design (`docs/ARCHITECTURE.md` decision 2). Two options:

| Option | How | Strength | Risk |
| --- | --- | --- | --- |
| Response file | Hook writes the request line, then waits (inotify or poll, bounded) for `$XDG_RUNTIME_DIR/ai-activity-monitor/replies/<request-id>.json` written by the extension | Keeps one mechanism, no listener in the shell, replay safe | Hook process must block; polling cost |
| Unix socket in the shell | Extension serves `Gio.SocketService` on `$XDG_RUNTIME_DIR/ai-activity-monitor/control.sock` (mode 0600) | Instant, like AgentGlance | A listener inside the compositor; must never block the shell main loop |

Either way: never use `/tmp` (AgentGlance's `/tmp/agentglance.sock` is world reachable), fail open on timeout or when the shell is absent, flush pending requests when the terminal answers first (AgentGlance `flushPendingDecisions`), and keep the AGENTS.md rule "adapters never print" for every event except PermissionRequest decisions. OpenCode would use the plugin permission hook (`permission.ask` in the v1 API; current v2 equivalent not verified).

## 4. Portability findings in our repository

### 4.0 Repository state caveat

Working tree differs from HEAD: modified `extension.js`, `lib/core/model.js`, `lib/providers.js`, `lib/ui/indicators.js`, `lib/ui/motion.js`, `lib/ui/panel.js`, `lib/windows.js`, adapter and tests, plus **untracked** `lib/core/presence.js` and `tests/unit/presence.test.js`. Tracked files already import `./core/presence.js` (`lib/providers.js:5`, `extension.js:19`). If those edits are committed without `presence.js`, the extension fails to load. Line numbers below are from the working tree.

### 4.1 Machine or user specific

No hard coded home paths, usernames or the owner's name in tracked code. Only `/home/u/...` as test data in `tests/python/test_claude_hook.py:64` (harmless). Paths use `$HOME`, `XDG_RUNTIME_DIR` and `GLib.get_home_dir()`.

| File:line | Finding | Severity |
| --- | --- | --- |
| `scripts/dev-nested.sh:19-35` | Mirrors the owner's look: user theme extension, `dash-to-dock` keys (Ubuntu Dock), wallpaper. Harmless on other machines (reads are guarded) but Ubuntu flavoured | Low |
| `scripts/dev-nested.sh:48`, `:50` | `--mode=ubuntu` exists only on Ubuntu's gnome-shell build; on Fedora, Arch, Debian the shell fails to start | High for contributors and CI |
| `scripts/dev-nested.sh:50` | `gnome-shell --nested` was removed in GNOME 49 (gjs.guide 49 page); use `--devkit --wayland` | High for contributors on 49+ |
| `scripts/dev-nested.sh:43` | Disables `ding@rastersoft.com`, Ubuntu's desktop icons extension | Low |

### 4.2 GNOME version coupling

| File:line | Finding | Breaks on |
| --- | --- | --- |
| `metadata.json:5` | `"shell-version": ["46"]` only; every other GNOME refuses to load it | 47+ (all current distros except Ubuntu 24.04) |
| `metadata.json:2` | UUID `ai-activity-monitor@local`: namespace should be a domain or account you control (EGO review guidelines) | EGO submission |
| `metadata.json:7` | `"version": 1` is deprecated and set by EGO | EGO review nit |
| `metadata.json:8` | `"url": "https://localhost/ai-activity-monitor"`; EGO wants the repository URL for bug reports | EGO submission |
| `lib/ui/panel.js:31`, `lib/ui/preview.js:60`, `:84`, `:102`, `:105`, `lib/ui/indicators.js:58`, `:77` | St `vertical` property: deprecated in 48, **removed in 51**; use `orientation: Clutter.Orientation.VERTICAL` | 51 (Fedora 45, Ubuntu 26.10, Arch, Tumbleweed, Debian 14) |
| `lib/ui/panel.js:48`, `:239`; `lib/ui/preview.js:52`; `lib/ui/indicators.js:103-106` | `button-press-event`, `captured-event`, `motion-event`, `button-release-event` signals deprecated in 51 in favour of gesture controllers (`Clutter.ClickGesture` etc.) | Works on 51 with deprecation; plan migration |
| `lib/devcontrol.js:133` | `Clutter.get_default_backend()` removed in 51; use `global.stage.context.get_backend()` | 51 (dev harness only) |
| `lib/notifier.js:8-90` | GNOME 46 `MessageTray.Source({...})` / `Notification({...})` object API; fine 46 to 51, but sets 46 as the floor (45 used positional constructors) | Below 46 |
| `lib/ui/panel.js:157`, `extension.js:183` | Private `Main.panel._leftBox/_centerBox/_rightBox`; stable for years but private | Any future refactor |
| `lib/desktopstate.js:11` | Desktop detection via DING title `Desktop Icons` and `customJS_ding`: Ubuntu specific desktop icons extension; other desktop icon extensions (Gtk4 DING fork on Fedora, none on vanilla GNOME) not considered | Behaviour differs off Ubuntu |
| `lib/ui/indicators.js:567` | Tiles only on primary monitor | Multi monitor users |
| `extension.js:451`, `:478`, `lib/ui/indicators.js:334` | Reduced motion read from `enable_animations` only; GNOME 51 added `St.Settings.get().reducedMotion` (`St.ReducedMotion`) | Accessibility on 51 |
| `extension.js:1`, `lib/notifier.js:1`, `docs/ARCHITECTURE.md`, `README.md` | Docs and comments say "GNOME Shell 46" | Docs only |

### 4.3 Terminal assumptions

| File:line | Finding |
| --- | --- |
| `schemas/...gschema.xml:80`, `lib/windows.js:176` | Default `terminal-command` is `gnome-terminal --working-directory=%d`. Not installed by default on Ubuntu 26.04 or Fedora (Ptyxis). Use `xdg-terminal-exec` when present, else detect Ptyxis (`ptyxis --new-window --working-directory`), Console (`kgx --working-directory`), Konsole, Kitty, WezTerm, then gnome-terminal. |
| `lib/windows.js:114-150` | Tab switching uses gnome-terminal's per window `org.gtk.Actions` `active-tab` action and walks tabs by title. Ptyxis, Console, Konsole, Kitty, WezTerm, Ghostty, tmux are not covered (README admits "switches tabs only in gnome-terminal"). |
| `adapters/claude-code/aimon_hook.py:113-124` | Terminal identity records `GNOME_TERMINAL_SCREEN`, `GNOME_TERMINAL_SERVICE`, `TERM_PROGRAM`, Kitty, `WINDOWID`. Missing: `TMUX`, `TMUX_PANE`, `KITTY_WINDOW_ID` value and `KITTY_LISTEN_ON`, `WEZTERM_PANE`, `KONSOLE_DBUS_SERVICE`/`KONSOLE_DBUS_SESSION`, `PTYXIS_*` (if any; not verified), tty (`os.ttyname(0)`). AgentGlance records tty and tmux pane. |
| `lib/windows.js:13` | `TERMINAL_CLASS` regex already lists many terminals for window raise; good. |
| `lib/providers.js` (`claudeTabScore`) | Tab matching depends on Claude Code's title glyphs; tmux hides terminal titles unless `set-titles on`. |

### 4.4 Adapter and installer assumptions

| File:line | Finding |
| --- | --- |
| `adapters/claude-code/hooks.template.json:8` (and 10 more entries), `scripts/claude_hooks.py:64` | Hook command is `python3 <path>`. Present on Ubuntu, Fedora, Debian, openSUSE desktops; not part of Arch `base`; fine for most Claude Code users but should be a documented dependency or replaced (see 5.3). |
| `scripts/claude_hooks.py:64` | `timeout: 5`: right for a monitor; a blocking approval hook needs a separate long timeout entry for PermissionRequest. |
| `adapters/claude-code/aimon_hook.py:97`, `lib/procs.js:10`, `:58`, `:65`, `scripts/measure.py:61-73` | `/proc` parsing: Linux only (fine for a Linux product), blocked inside a Flatpak sandbox (matters for 5.2). |
| `adapters/claude-code/aimon_hook.py:219`, `adapters/opencode/ai-activity-monitor.js:40`, `scripts/lab.sh:13`, `scripts/uninstall.sh:12` | Fallback `/run/user/<uid>` when `XDG_RUNTIME_DIR` is unset (SSH sessions, some containers). Acceptable; but the extension and the hook must agree, so log the chosen path once. |
| `scripts/install.sh:33` | Runs `glib-compile-schemas`: not needed since GNOME 44 for extensions packed by `gnome-extensions pack`, and needs `glib2` dev tools on some distros (`libglib2.0-bin` on Debian/Ubuntu). |
| `scripts/install.sh:36-42`, `scripts/uninstall.sh:18` | Edits `org.gnome.shell enabled-extensions` through `gsettings` plus a Python `ast` round trip. Works, but `gnome-extensions enable <uuid>` is the supported way and also works from a running session. Requires a GNOME session bus; fails over SSH. |
| `scripts/install.sh:16-18` | User install only; no system wide path (`/usr/share/gnome-shell/extensions`) for distro packages. |
| `scripts/install.sh` (whole) | No check that GNOME Shell is running or which version; installing on Plasma silently does nothing useful. |
| `package.json:8` | `python3 -m unittest`; tests assume Node 22+ (`node --test` globs). Fine in CI, document it. |
| `README.md` License section | No license: blocks EGO (needs GPL compatible), distro packaging and contributions. |
| `extension/.../icons/claude-code.svg`, `opencode.svg` | Third party logos. EGO guidelines require proof of permission for trademarked content; distros may also object. Ship neutral glyphs by default. |
| `lib/devcontrol.js` | File based control channel enabled by `AIMON_DEV_CONTROL`. Exclude it from release zips (reviewers flag hidden control paths) or keep it but prove it is inert without the variable. |

## 5. Packaging landscape (late 2026)

### 5.1 GNOME Shell versions by distro

Pinned versions from `ddterm/gnome-shell-image` (renovate maintained, updated 2026-11-23), cross checked with release coverage.

| Distro | Release | GNOME Shell | Support | Notes |
| --- | --- | --- | --- | --- |
| Ubuntu 22.04 LTS | 2022 | 42 | to 2027 | Pre ESM extension format; **do not target** |
| Ubuntu 24.04 LTS | 2024 | 46.0 | to 2029 | Owner's machine; gnome-terminal default |
| Ubuntu 26.04 LTS | Apr 2026 | 50.1 | to 2031 | Wayland only, Ptyxis default; upgrades from 24.04 opened with 26.04.1 in July |
| Ubuntu 26.10 | Oct 2026 | 51.0 | to Jul 2027 | |
| Debian 12 bookworm | 2023 | 43 | oldstable | **do not target** |
| Debian 13 trixie | Aug 2025 | 48.7 | stable | |
| Debian 14 forky | testing | 51.0 | | |
| Fedora 43 | Oct 2025 | 49.10 | to ~Dec 2026 | |
| Fedora 44 | Apr 2026 | 50.6 | | |
| Fedora 45 | Nov 2026 | 51.1 | | Plasma 6.8 in KDE edition |
| RHEL 10 / AlmaLinux 10 / CentOS Stream 10 | | 49.5 (Alma image) | long | Shipped 47 at 10.0; rebase timing not verified |
| openSUSE Leap 16.0 / 16.1 | Oct 2025 / 2026 | 48.4 / 48.8 | | Wayland only |
| openSUSE Tumbleweed | rolling | 51.1 | | |
| Arch Linux | rolling | 51.1 | | |
| Alpine 3.24 | | 50.3 | | Niche |

**Target range: `["46", "47", "48", "49", "50", "51"]`.** 47 has no current mainstream distro but costs nothing to list if CI covers it via a 46 or 48 smoke test; listing only versions you test is safer for EGO ("must not claim support for future versions"). Code changes needed for this range are small: St `vertical` to `orientation` (51), `Clutter.get_default_backend` (51, dev only), optional gesture migration and `reducedMotion` (51). Nothing else we use changed between 46 and 51 per the gjs.guide porting pages (47: `Clutter.Color` removed, not used; 48: `Clutter.Image` removed, not used; 49: `get_maximized`, `ClickAction`, `Meta.Rectangle` removed, not used; 50: no relevant changes; 51: `vertical` removed, async `disable()` throws, not used).

### 5.2 Non GNOME desktops

The README's own reasoning holds everywhere: on Wayland only the compositor can draw over windows, raise other clients and read the pointer globally. Each desktop exposes that power differently.

| Desktop | Share | Overlay surface | Tray | Raise terminal | Notifications | Realistic option |
| --- | --- | --- | --- | --- | --- | --- |
| KDE Plasma 6 (Kubuntu, Fedora KDE, openSUSE, Neon, Arch, SteamOS desktop) | Large | Plasmoid (QML) in panel or desktop; `LayerShellQt` for free floating | Native StatusNotifierItem | KWin script via D-Bus (`org.kde.KWin` `/Scripting`), Konsole D-Bus `setCurrentSession` | Native, actions supported | **Plasmoid** later; tray app works today |
| Cinnamon (Linux Mint 22) | Large among newcomers | Applet or desklet in CJS (old `imports.*` style, not ESM): a separate port of our UI, similar ideas | Native (XApp status icons) | Muffin window API inside the applet | Native | Tray app first; Cinnamon applet if demand |
| XFCE 4.20 | Medium | Panel plugin in C or Python; X11 mainly | `xfce4-panel` SNI plugin | `wmctrl`/EWMH on X11 | `xfce4-notifyd` | Tray app |
| Hyprland, Sway, niri, river (wlroots style) | Enthusiasts, overlaps strongly with AI CLI users | `wlr-layer-shell` via `gtk4-layer-shell` | Waybar tray (SNI) | `hyprctl dispatch focuswindow pid:<pid>`, `swaymsg '[pid=..] focus'`, `niri msg` | mako, dunst, swaync | Tray or layer shell app plus a **Waybar custom module** (`exec` returning JSON) |
| COSMIC (Pop!_OS 24.04) | Growing | Rust applets (libcosmic); supports layer shell | SNI supported | Not verified | Native | Tray app |
| GNOME without AppIndicator extension (Fedora Workstation, Debian) | | | **No tray** | | | GNOME extension is the only good path anyway |

Key fact: Mutter does not implement `wlr-layer-shell`, so a layer shell companion cannot replace the extension on GNOME, and a tray icon needs the AppIndicator extension (preinstalled on Ubuntu only). The extension stays the primary product on GNOME.

### 5.3 Recommended distribution strategy

Order by reach per unit of effort.

1. **extensions.gnome.org (primary, phase 1).** One zip, auto updates through Extension Manager and the browser connector, covers Ubuntu 24.04/26.04/26.10, Fedora 43 to 45, Debian 13, Leap 16, Tumbleweed, Arch, RHEL 10. Prerequisites: GPL compatible license (`GPL-2.0-or-later` is the simplest match with GNOME Shell), UUID on a namespace you own (for example `ai-activity-monitor@<user>.github.io`), real repository `url`, drop `version`, `shell-version` 46 to 51, neutral icons or written permission for logos, no dev control file in the zip, light logging. Build with `gnome-extensions pack --extra-source=lib --extra-source=icons --schema=...`.
2. **Agent adapters shipped through the agents' own plugin systems, not inside the extension zip.** EGO guidelines discourage bundled non GJS scripts, and editing `~/.claude/settings.json` from a shell extension invites review friction. Options: a Claude Code plugin that bundles the hook (plugin `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}`; from prior knowledge, verify current plugin docs) and an npm package for the OpenCode plugin referenced from `opencode.json`. Keep `scripts/install.sh` as the from source path, and add a prefs page that shows integration status and copies the one line install command (explicit user action).
3. **Distro packages for people who avoid EGO.** AUR `PKGBUILD` (installs to `/usr/share/gnome-shell/extensions/<uuid>` plus adapters to `/usr/share/ai-activity-monitor`), Fedora COPR spec, and optionally openSUSE Build Service which can emit deb and rpm for Debian, Ubuntu, Fedora and openSUSE from one source. A PPA is lower priority because EGO already covers Ubuntu.
4. **Companion tray app for every non GNOME desktop (phase 2).** Reuse `lib/core` unchanged by running it under `gjs` (it is already pure and runs in Node and gjs): a GJS GTK4 app that watches the same spool, exposes a StatusNotifierItem over D-Bus, sends `org.freedesktop.Notifications` with actions, raises terminals through per desktop strategies (KWin script, hyprctl, swaymsg, EWMH), and optionally draws a `gtk4-layer-shell` card on wlroots and Plasma. Ship as AUR, COPR, deb, and an AppImage. **Not Flatpak**: the sandbox hides host `/proc` (liveness and terminal lookup break), needs a hole for `$XDG_RUNTIME_DIR/ai-activity-monitor`, and cannot raise other windows on Wayland. Honest verdict: Flatpak fits poorly here.
5. **Waybar module (cheap add on).** `aimon status --waybar` printing JSON; one doc page reaches most Hyprland and Sway users.
6. **KDE plasmoid (phase 3, only if usage shows demand).** Best Plasma experience, but QML is a second UI codebase to maintain.

Architectural precondition for 4 to 6: keep the spool as the stable contract (`docs/EVENTS.md`), version it, and add the approval reply channel to the contract so every frontend can answer requests.

### 5.4 CI plan (GitHub Actions)

No CI exists today. Proposed workflows:

```
push / PR
  unit        ubuntu-latest: npm ci, npm test (Node unit + contract), npm run lint,
              python tests on a 3.9 / 3.11 / 3.13 matrix, docs style guard
  package     gnome-extensions pack -> upload zip artifact; validate metadata.json
              (uuid namespace, url, shell-version list matches the matrix below)
  shell-smoke matrix over ghcr images from ddterm/gnome-shell-image (podman on ubuntu-latest):
                ubuntu-24.04 (46)  debian-13 (48)  opensuse-leap-16.0 (48)
                fedora-43 (49)     almalinux-10 (49)
                ubuntu-26.04 (50)  fedora-44 (50)
                fedora-45 (51)     ubuntu-26.10 (51)  archlinux (51)
              steps per image:
                1. start container (systemd init, logind) as in their test/test-wayland.sh
                2. dbus-daemon --session; gnome-shell --wayland --headless --unsafe-mode
                   --virtual-monitor 1600x960
                3. gnome-extensions install --force zip; gnome-extensions enable <uuid>
                4. assert state ACTIVE via org.gnome.Shell.Extensions.GetExtensionInfo,
                   and no "ai-activity-monitor" errors in the journal
                5. drive scenarios with our harness: write spool lines (scripts/lab.sh),
                   AIMON_DEV_CONTROL clicks, screenshot via org.gnome.Shell.Screenshot
                6. disable and enable again 3 times, assert no leaked actors or sources
                   (guards the enable/disable rule in AGENTS.md)
                7. upload screenshots as artifacts
              on 50+: also try gnome-shell-test-tool --extension <zip> <test.js>
nightly       same smoke job on archlinux-unstable and fedora rawhide (if image exists)
              to see the next GNOME breakage before release day
tag v*        build zip, attach to GitHub Release, render PKGBUILD / spec from template,
              open AUR and COPR updates; EGO upload stays manual (or
              gnome-extensions upload --accept-tos with a token from secrets, never a
              password on the command line)
```

Notes:
* `ddterm/gnome-shell-image` is MIT licensed and covers exactly this matrix with renovate pinned versions; I verified the Dockerfiles and test script, but not the exact registry path of the published images (check the repository's workflows before wiring it).
* Containers need `--cap-add SYS_ADMIN,SYS_NICE,SYS_PTRACE,...` and `--userns=keep-id` (from their script); GitHub hosted runners support podman.
* Our `scripts/dev-nested.sh` cannot be reused in those images until `--mode=ubuntu` and `--nested` are removed or made conditional.
* Keep the existing "never test against the real desktop session" rule: CI is headless by construction.

## 6. Risks and verdicts

| Risk | Verdict |
| --- | --- |
| EGO rejection over license, UUID, logos, devcontrol, or bundled Python | Fix all five before submitting; each is cheap |
| Approval hook blocks Claude when the shell is down or restarting | Must fail open with a bounded wait; test with the shell stopped |
| Approval socket or reply files reachable by other users | Keep everything in `$XDG_RUNTIME_DIR` with 0700/0600; never `/tmp` |
| Uncommitted `presence.js` imported by tracked files | Commit together or the extension fails to load |
| GNOME 52 (March 2027) breakage | Nightly job on rolling images gives months of warning |
| Second UI codebase (plasmoid, Cinnamon applet) | Defer until tray app usage proves demand |
| AgentGlance as competitor | Dormant since April 2026, macOS only, Claude only; Linux has no equivalent we found in this pass (not exhaustively searched) |

## Sources

* https://agentglance.app/ and https://github.com/hezi/AgentGlance (README, `docs/releasenotes/1.3.0` to `2.0.0`, `AgentGlance/**/*.swift`, `scripts/release.sh`)
* https://gjs.guide/extensions/upgrading/gnome-shell-47.html through `-51.html`
* https://gjs.guide/extensions/review-guidelines/review-guidelines.html
* https://github.com/ddterm/gnome-shell-image (Dockerfiles, `test/test-wayland.sh`)
* [Ubuntu 26.04 LTS released (OMG Ubuntu)](https://www.omgubuntu.co.uk/2026/04/ubuntu-26-04-lts-released), [Ubuntu 26.04 summary for LTS users](https://documentation.ubuntu.com/release-notes/26.04/summary-for-lts-users/)
* [Ubuntu 26.10 released (Phoronix)](https://phoronix.com/news/Ubuntu-26.10-Released), [GNOME 51 released (Phoronix)](https://phoronix.com/news/GNOME-51-Released)
* [Fedora 45 released (Phoronix)](https://phoronix.com/news/Fedora-45-Released), [What is new in Fedora Workstation 45](https://fedoramagazine.org/whats-new-fedora-workstation-45/)
* [openSUSE Leap 16.0 features](https://en.opensuse.org/Portal:16.0/Features)
* [Ptyxis becomes Ubuntu's recommended terminal (Phoronix)](https://phoronix.com/news/Ubuntu-Ptyxis-Recommended), [Ubuntu 26.04 change default terminal docs](https://ubuntu.com/desktop/docs/en/26.04/how-to/change-the-default-terminal/)
