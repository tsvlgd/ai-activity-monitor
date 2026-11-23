# End to end check of "quiet while watching" in the headless nested shell.
#
#   W="$XDG_RUNTIME_DIR/aimon-dev/e2e"; mkdir -p -m 700 "$W/spool"
#   AIMON_HEADLESS=1 AIMON_SPOOL_DIR="$W/spool" scripts/dev-nested.sh 1600x900 &
#   python3 -I tests/e2e/presence_e2e.py <nested wayland display, e.g. wayland-1>
#
# The nested shell prints "Using Wayland display name '...'" on start. Two
# GTK test windows stand in for a terminal (two Claude tabs) and an editor.
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get("AIMON_E2E_DIR") or os.path.join(os.environ["XDG_RUNTIME_DIR"], "aimon-dev", "e2e")
SPOOL = os.path.join(WORK, "spool")
STATE = os.path.join(WORK, "state")
os.makedirs(SPOOL, mode=0o700, exist_ok=True)
os.makedirs(STATE, exist_ok=True)
NESTED = sys.argv[1]
STAR, SPIN = "✳", "◐"
T1, T2 = "AI activity monitor results", "Linux AI activity monitor"
failures = []

def ctl(*args):
    out = subprocess.run([f"{ROOT}/scripts/devctl.sh", *args], capture_output=True, text=True, timeout=10).stdout
    return json.loads(out.strip().splitlines()[-1])

def focus(title, timeout=20):
    # Windows appear later on slow (software rendered) shells: retry, and stop
    # the run if the window never shows up, since every check after depends on it.
    end = time.time() + timeout
    while time.time() < end:
        r = ctl("focus", *title.split(" "))
        if "focused" in r["result"]:
            # Activation is asynchronous: done only once the shell reports it.
            for _ in range(20):
                time.sleep(0.15)
                now = ctl("state")["focusAfter"] or ""
                if title in now:
                    return now
            print(f"     focus asked for {title!r}, shell reports {now!r}")
        time.sleep(0.3)
    sys.exit(f"window titled like {title!r} never appeared")

def state():
    return ctl("state")["result"]

def emit(session, kind, ts=None, **extra):
    ev = {"v": 1, "ts": round(ts or time.time(), 3), "provider": "claude-code", "session": session,
          "kind": kind, "cwd": "/home/u/Dev/ai-activity-monitor", **extra}
    with open(os.path.join(SPOOL, f"claude-code--{session}.jsonl"), "a") as fh:
        fh.write(json.dumps(ev) + "\n")

def set_title(app, title):
    with open(os.path.join(STATE, f"{app}.title"), "w") as fh:
        fh.write(title)
    time.sleep(0.4)

def notes(st):
    return sum(src["count"] for src in st["notifications"] if src["title"] == "GlanceAgent")

def panel(st):
    return next((p for p in st["panel"] if p["provider"] == "claude-code"), None)

def check(name, cond, detail):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    if not cond:
        failures.append(name)
        print("     groups:", json.dumps(state()["groups"]))

def turn(session, kind="turn_complete", **extra):
    now = time.time()
    emit(session, "prompt", ts=now - 20, detail="do the thing", pid=PID[session], title=TITLE[session])
    emit(session, kind, ts=now, title=TITLE[session], **extra)
    time.sleep(0.8)

def resolve(session):
    emit(session, "tool_end", tool="Bash")
    emit(session, "turn_complete", title=TITLE[session])
    emit(session, "prompt", detail="next", pid=PID[session], title=TITLE[session])
    time.sleep(0.6)

# Two windows: a terminal (two Claude tabs inside) and an unrelated app.
for app in ("org.test.Terminal", "org.test.Editor"):
    for f in (f"{app}.pid", f"{app}.title"):
        try: os.unlink(os.path.join(STATE, f))
        except OSError: pass
    ctl("spawn", "python3", "-I", f"{HERE}/fake_window.py", app, "start", STATE, NESTED)
for _ in range(50):
    if all(os.path.exists(os.path.join(STATE, f"{a}.pid")) for a in ("org.test.Terminal", "org.test.Editor")):
        break
    time.sleep(0.2)
time.sleep(1.5)
term_child = int(open(os.path.join(STATE, "org.test.Terminal.pid")).read())
set_title("org.test.Editor", "notes.txt - Editor")
# Both sessions run in the same terminal process, like two gnome-terminal tabs.
RUN = str(int(time.time()))
S1, S2 = f"s1-{RUN}", f"s2-{RUN}"
PID = {S1: term_child, S2: term_child}
TITLE = {S1: T1, S2: T2}
for s in (S1, S2):
    emit(s, "session_start", pid=PID[s], title=TITLE[s])
time.sleep(0.6)

# A. Watching the session's own tab: nothing at all.
set_title("org.test.Terminal", f"{STAR} {T1}")
focus(T1)
ctl("tray-clear"); time.sleep(0.2); base = notes(state())
turn(S1)
st = state()
check("A watching tab: no notification on completion", notes(st) == base, st["notifications"])
check("A watching tab: icon still", panel(st)["motion"] == "none", panel(st))
emit(S1, "prompt", detail="x", pid=PID[S1], title=T1); time.sleep(0.4)
emit(S1, "permission", detail="Approve: Bash", title=T1); time.sleep(0.8)
st = state()
check("A watching tab: no notification on approval", notes(st) == base, st["notifications"])
check("A watching tab: no bounce on approval", panel(st)["motion"] == "none", panel(st))
resolve(S1)

# B. Other Claude tab active in the same window: notify and hop exactly 4 times.
set_title("org.test.Terminal", f"{STAR} {T2}")
ctl("tray-clear"); time.sleep(0.2); base = notes(state())
emit(S1, "permission", detail="Approve: Bash", title=T1)
time.sleep(0.8)
st = state()
check("B other tab: approval notifies", notes(st) == base + 1, st["notifications"])
check("B other tab: bounces", panel(st)["motion"] == "attention", panel(st))
time.sleep(5)
hops = panel(state())["hops"]
time.sleep(2)
check("B other tab: exactly 4 hops then rest", hops == 4 and panel(state())["hops"] == 4, f"hops {hops} then {panel(state())['hops']}")

# C. Switching to the session's tab counts as seeing it: notification withdrawn.
set_title("org.test.Terminal", f"{SPIN} {T1}")
time.sleep(0.6)
st = state()
check("C arrive at tab: notification withdrawn", notes(st) == base, st["notifications"])
check("C arrive at tab: icon still", panel(st)["motion"] == "none", panel(st))
resolve(S1)

# D. Another app focused: notify and bounce.
focus("notes.txt")
time.sleep(0.5)
ctl("tray-clear"); time.sleep(0.2); base = notes(state())
turn(S1)
st = state()
check("D other app: completion notifies", notes(st) == base + 1, st["notifications"])
check("D other app: bounces", panel(st)["motion"] == "attention", panel(st))
focus(T1)  # back to the terminal, still on s1's tab: seen
time.sleep(0.6)
st = state()
check("D back to window on that tab: withdrawn", notes(st) == base, st["notifications"])

# E. Watching s2's tab while s1 asks: s1 still notifies, s2 stays quiet.
resolve(S1)
set_title("org.test.Terminal", f"{STAR} {T2}")
ctl("tray-clear"); time.sleep(0.2); base = notes(state())
turn(S2)
st = state()
check("E s2 watched: no notification for s2", notes(st) == base, st["notifications"])
turn(S1, kind="permission", detail="Approve: Bash")
st = state()
check("E s1 not watched: s1 notifies", notes(st) == base + 1, st["notifications"])
check("E s1 not watched: bounces", panel(st)["motion"] == "attention", panel(st))

# F. Shell tab (no agent glyph) active: notify.
emit(S1, "tool_end", tool="Bash"); emit(S1, "turn_complete", title=T1); time.sleep(0.5)
set_title("org.test.Terminal", "user@host: ~/Dev")
ctl("tray-clear"); time.sleep(0.2); base = notes(state())
turn(S1, kind="turn_error", detail="Stopped: rate limit")
st = state()
titles = [t for src in st["notifications"] for t in src["items"]]
check("F shell tab: error notifies", "Claude Code stopped with an error" in titles, st["notifications"])

# G. Resume: same session id, new process, while watching its tab: still quiet.
emit(S1, "session_end", reason="prompt_input_exit"); time.sleep(3.2)
set_title("org.test.Terminal", f"{STAR} {T1}")
focus(T1); time.sleep(0.4)
emit(S1, "session_start", reason="resume", pid=PID[S1], title=T1); time.sleep(0.5)
ctl("tray-clear"); time.sleep(0.2); base = notes(state())
turn(S1)
st = state()
check("G resumed session watched: no notification", notes(st) == base, st["notifications"])
check("G resumed session watched: icon still", panel(st)["motion"] == "none", panel(st))

ctl("shot", os.path.join(WORK, "final.png"))
time.sleep(1)

# Leave nothing behind for the next run: end sessions, close windows.
for sid in (S1, S2):
    emit(sid, "session_end", reason="other")
for app in ("org.test.Terminal", "org.test.Editor"):
    child = int(open(os.path.join(STATE, f"{app}.pid")).read())
    parent = int(open(f"/proc/{child}/stat").read().rsplit(")", 1)[1].split()[1])
    for pid in (child, parent):
        try: os.kill(pid, 15)
        except OSError: pass
print(f"\n{'ALL PASS' if not failures else 'FAILED: ' + ', '.join(failures)}")
sys.exit(1 if failures else 0)
