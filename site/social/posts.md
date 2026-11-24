# Launch posts

Draft copy for each channel. Replace `{SITE}` with the site URL once a domain is
chosen. Repository: https://github.com/tsvlgd/ai-activity-monitor

Images live in `social/out/`. Native video (the promo in
`media/promo-video/out/glanceagent-promo-v3.mp4`) usually beats a link card on
X and LinkedIn, so attach it where the post says so.

Facts every post must keep true: GNOME Shell 46 on Wayland, Claude Code and
OpenCode, installed from source with `scripts/install.sh`, GPL 2.0 or later.

## X (thread, attach the video to post 1)

1/
I run several coding agents at once and kept losing track of which one was
waiting on me.

So I built GlanceAgent: a GNOME extension that puts each Claude Code and
OpenCode session in your top bar as a small icon that moves while it works and
hops when it needs you.

2/
Five states, readable from across the room:
idle, working, waiting for you, done, error.

Click an icon for a preview card with the current step and recent activity.
"Open in Terminal" jumps to the exact terminal tab.

3/
It stays quiet when you are already watching the session. No notification
spam: at most one per session, for approvals, errors, long turns that finish
and agents that die.

4/
How it works: a Claude Code hook and an OpenCode plugin write events to a
spool in RAM. The extension watches it and runs a pure reducer. Nothing runs
as root.

You can play with a live demo in the browser: {SITE}

5/
Free and open source (GPL), GNOME Shell 46.
Code and install steps: https://github.com/tsvlgd/ai-activity-monitor

## LinkedIn (attach the video, link in the first comment)

Coding agents changed how I work. I now run several Claude Code and OpenCode
sessions in parallel, and the new bottleneck is me: noticing which one is done
and which one has been waiting ten minutes for an approval.

So I built GlanceAgent, a GNOME Shell extension that gives every agent session
a small icon in the top bar and on the desktop.

What it does:
* Shows five states at a glance: idle, working, waiting for you, done, error
* Moves while an agent works and hops when it needs you
* Opens a preview card with the current step, and jumps straight to the right
  terminal tab
* Sends at most one notification per session, and stays quiet while you are
  watching that session

What I learned building it: on Wayland only the compositor may draw over other
windows or raise another app's window, so this had to be a shell extension,
not an app. I kept the state logic as a pure reducer with no GNOME imports,
which made it testable in Node and let the website run the same code as a
live demo.

Try the demo in your browser, or install it on GNOME 46. Links in the
comments.

First comment:
Live demo: {SITE}
Code: https://github.com/tsvlgd/ai-activity-monitor

## Reddit

Check each subreddit's self promotion rules and flair before posting. Post as
a person, answer comments for the first hour.

### r/gnome

Title: I made an extension that shows your AI coding agents as live icons in
the top bar

Body:
GlanceAgent puts each Claude Code or OpenCode session in the top bar (and
optionally as tiles on the empty desktop). Icons move while the agent works,
hop when it needs your approval, and sit still when idle. Click one for a
preview card; "Open in Terminal" raises the window and switches to the right
tab.

Some GNOME details people here may care about:
* Built for GNOME Shell 46 on Wayland
* Draggable icons along the bar, tiles hide under windows and during
  fullscreen
* Respects reduced motion
* Preview card never takes keyboard focus from the window you are typing in

Install is from source for now (`scripts/install.sh --extension`). Feedback on
the shell side is very welcome.

Demo: {SITE}
Code: https://github.com/tsvlgd/ai-activity-monitor

### r/ClaudeAI (use the "Built with Claude" flair if available)

Title: I kept missing Claude Code approval prompts, so I built top bar icons
that hop when Claude needs me

Body:
If you run several Claude Code sessions, you know the problem: one finished
ten minutes ago, another is stuck on a permission prompt, and you are in a
browser tab.

GlanceAgent is a GNOME extension driven by Claude Code hooks. Each session
gets a small icon: it moves while Claude works, hops when it needs an
approval, and shows a "done" bubble when the turn ends. Click it to see the
current step, then jump straight to the terminal tab.

The installer adds hook entries to `~/.claude/settings.json`, keeps your
existing hooks and writes a backup first. It also supports OpenCode.

Linux with GNOME 46 only for now. Demo you can click in the browser: {SITE}
Code: https://github.com/tsvlgd/ai-activity-monitor

### r/linux

Title: GlanceAgent: a GNOME Shell extension that shows coding agent sessions
as live top bar icons (GPL)

Body:
Small open source project. A Claude Code hook and an OpenCode plugin write
events as JSON lines to a spool in `$XDG_RUNTIME_DIR`. The extension watches
it with inotify, runs a pure reducer and draws icons, a preview card and
rate limited notifications. Nothing runs as root, no system packages are
installed, and uninstall removes only what install added.

Why an extension and not a tray app: on Wayland only the compositor can draw
over other windows and raise another app's window, which is what "Open in
Terminal" needs.

Code and architecture docs: https://github.com/tsvlgd/ai-activity-monitor

## Hacker News

Title: Show HN: GlanceAgent, top bar icons for your Claude Code and OpenCode
sessions

URL: https://github.com/tsvlgd/ai-activity-monitor

First comment:
Hi HN. I run several coding agents in parallel and kept losing the one that
was waiting on me, so I built a GNOME Shell extension that shows each session
as a small animated icon: moving while working, hopping when it needs input,
still when idle.

Design notes:
* Adapters (a Claude Code hook in Python, an OpenCode plugin in JS) append
  normalized events to JSONL spool files in RAM. They never print to stdout,
  never block, and always exit 0, so they cannot break the agent.
* The state logic is a pure reducer with no GNOME imports. It runs under Node
  for tests, and the landing page runs the same module for its live demo:
  {SITE}
* It has to be a shell extension because on Wayland only the compositor can
  draw over other windows and raise another app's window.

GNOME Shell 46 on Wayland, GPL 2.0 or later. Happy to answer questions about
the shell side, which had more surprises than the agent side.
