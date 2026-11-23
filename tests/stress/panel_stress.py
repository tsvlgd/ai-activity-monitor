#!/usr/bin/env python3
"""Stress scenarios for the top bar, run against the headless test shell.

Start the shell first (never the real session):
  AIMON_SPOOL_DIR=$XDG_RUNTIME_DIR/aimon-dev/spool AIMON_HEADLESS=1 \
    scripts/dev-nested.sh 1920x1080 > /tmp/aimon-stress.log 2>&1 &
Then:
  python3 tests/stress/panel_stress.py /tmp/aimon-stress.log [scenario ...]

After each scenario it prints the count of assertion style lines the shell
wrote, the panel box widths, and saves a shot under $XDG_RUNTIME_DIR/aimon-dev/shots.
A blank bar shows as a panel box width of 0 or a rising set_viewport count.
"""
import json, os, random, re, subprocess, sys, time

RT = os.environ["XDG_RUNTIME_DIR"]
SPOOL = os.environ.get("AIMON_SPOOL_DIR", f"{RT}/aimon-dev/spool")
SHOTS = f"{RT}/aimon-dev/shots"
HERE = os.path.dirname(os.path.abspath(__file__))
DEVCTL = os.path.join(HERE, "..", "..", "scripts", "devctl.sh")
LOG = sys.argv[1] if len(sys.argv) > 1 else "/tmp/aimon-stress.log"
PATTERNS = ["set_viewport", "JS ERROR", "Gjs-CRITICAL", "Clutter-CRITICAL", "assertion", "CRITICAL"]
os.makedirs(SHOTS, exist_ok=True)
procs = []


def counts():
    text = open(LOG, errors="replace").read()
    return {p: len(re.findall(re.escape(p), text)) for p in PATTERNS}


def ctl(*args):
    out = subprocess.run([DEVCTL, *map(str, args)], capture_output=True, text=True).stdout.strip()
    try:
        return json.loads(out.splitlines()[-1])
    except Exception:
        return {"raw": out}


def nested_bus():
    # dconf writes below must never reach the real session: refuse unless the
    # control path is set and the bus found is not the login session's bus.
    if not os.environ.get("AIMON_DEV_CONTROL"):
        raise SystemExit("set AIMON_DEV_CONTROL to this run's private control file")
    pid = subprocess.run(["pgrep", "-f", "^gnome-shell --headless"], capture_output=True, text=True).stdout.split()
    for p in pid:
        try:
            env = open(f"/proc/{p}/environ").read().split("\0")
        except OSError:
            continue
        if any(e.startswith(f"AIMON_DEV_CONTROL={os.environ.get('AIMON_DEV_CONTROL', '')}") for e in env):
            bus = next(e.split("=", 1)[1] for e in env if e.startswith("DBUS_SESSION_BUS_ADDRESS="))
            if bus.endswith(f"{RT}/bus") or f"unix:path={RT}/bus" in bus:
                raise SystemExit("refusing: that is the real session bus")
            return bus
    raise SystemExit("nested shell not found")


def live_pid():
    p = subprocess.Popen(["sleep", "600"])
    procs.append(p)
    return p


def emit(provider, session, kind, pid=None, detail=None, cwd="/tmp"):
    ev = {"v": 1, "ts": round(time.time(), 3), "provider": provider, "session": session, "kind": kind, "cwd": cwd}
    if pid:
        ev["pid"] = pid
    if detail:
        ev["detail"] = detail
    os.makedirs(SPOOL, mode=0o700, exist_ok=True)
    with open(f"{SPOOL}/{provider}--{session}.jsonl", "a") as fh:
        fh.write(json.dumps(ev) + "\n")


def start(provider, session, p):
    emit(provider, session, "session_start", p.pid)
    emit(provider, session, "prompt", p.pid, "do the thing")


def widths():
    r = ctl("state").get("result", {})
    return {k: v["w"] for k, v in r.get("panelBoxes", {}).items()}, r


def finish(name, before):
    time.sleep(1.5)
    after = counts()
    shot = f"{SHOTS}/{name}.png"
    ctl("shot", shot)
    w, r = widths()
    delta = {k: after[k] - before[k] for k in PATTERNS if after[k] - before[k]}
    print(f"{name}: new log lines {delta or 'none'} | boxes {w} | icons {len(r.get('panel', []))} | shot {shot}", flush=True)


def clear():
    for f in os.listdir(SPOOL):
        os.unlink(f"{SPOOL}/{f}")
    time.sleep(1)


def icon_xy(provider):
    for i in widths()[1].get("panel", []):
        if i["provider"] == provider:
            r = i["rect"]
            return r["x"] + r["w"] // 2, r["y"] + r["h"] // 2
    return 200, 14


def three():
    ps = {"claude-code": live_pid(), "opencode": live_pid(), "lab": live_pid()}
    for prov, p in ps.items():
        start(prov, "s1", p)
    time.sleep(2)
    return ps


def sc_flips(secs=60):
    ps = three()
    kinds = ["tool_start", "tool_end", "permission", "permission_resolved", "turn_complete", "prompt", "turn_error", "input_needed", "activity"]
    end = time.time() + secs
    while time.time() < end:
        prov = random.choice(list(ps))
        emit(prov, "s1", random.choice(kinds), ps[prov].pid, "x")
        time.sleep(random.uniform(0.02, 0.3))


def sc_drag():
    three()
    x, y = icon_xy("opencode")
    cx = 960
    ctl("pointer", "move", x, y); ctl("pointer", "down")
    for nx in range(x, cx + 120, 40):
        ctl("pointer", "move", nx, y)
    ctl("pointer", "up", cx + 120, y)
    time.sleep(1)
    x, y = icon_xy("claude-code")
    ctl("pointer", "move", x, y); ctl("pointer", "down")
    for nx in range(x, 1700, 80):
        ctl("pointer", "move", nx, y)
    ctl("pointer", "move", 900, 600)          # leave the bar
    ctl("pointer", "up", 900, 600)            # release outside the panel
    x, y = icon_xy("lab")
    ctl("pointer", "move", x, y); ctl("pointer", "down")
    ctl("pointer", "move", x + 100, y)
    ctl("key", "Escape") if False else None
    ctl("pointer", "up", 20, y)
    # drag onto the clock and release exactly on it
    x, y = icon_xy("lab")
    ctl("pointer", "move", x, y); ctl("pointer", "down"); ctl("pointer", "move", 960, y); ctl("pointer", "up", 960, y)


def sc_hover():
    three()
    for _ in range(6):
        for prov in ("claude-code", "opencode", "lab"):
            x, y = icon_xy(prov)
            ctl("pointer", "move", x, y)
            time.sleep(random.uniform(0.02, 0.2))
            ctl("pointer", "move", 900, 500)
    # hover while a bubble fires
    ps = {"claude-code": None}
    x, y = icon_xy("claude-code")
    ctl("pointer", "move", x, y)
    emit("claude-code", "s1", "turn_complete")
    time.sleep(0.5)
    ctl("pointer", "move", 900, 500)


def sc_card_end():
    ps = three()
    for _ in range(5):
        x, y = icon_xy("opencode")
        ctl("pointer", "click", x, y)
        time.sleep(0.4)
        emit("opencode", "s1", "turn_complete", ps["opencode"].pid)
        emit("opencode", "s1", "session_end", ps["opencode"].pid, "gone")
        time.sleep(0.2)
        ctl("pointer", "click", x, y)
        time.sleep(3.5)
        ps["opencode"] = live_pid(); start("opencode", f"s{_ + 2}", ps["opencode"])
        time.sleep(1.5)


def sc_kill_pid():
    ps = three()
    x, y = icon_xy("claude-code")
    ctl("pointer", "click", x, y)
    time.sleep(0.5)
    ps["claude-code"].kill()
    time.sleep(8)
    ctl("pointer", "click", x, y)
    time.sleep(1)


def sc_dismiss():
    ps = three()
    for i in range(5):
        emit("claude-code", "s1", "turn_complete", ps["claude-code"].pid)
        time.sleep(0.5)
        x, y = icon_xy("claude-code")
        ctl("pointer", "click", x, y)
        time.sleep(0.4)
        ctl("action", "Dismiss")
        emit("claude-code", "s1", "prompt", ps["claude-code"].pid, "again")
        time.sleep(0.5)


def sc_tiles():
    three()
    ctl("set", "desktop-play", "true")
    ctl("set", "desktop-tiles", "true")
    time.sleep(4)
    for prov in ("claude-code", "opencode", "lab"):
        t = [t for t in widths()[1].get("tiles", []) if t["provider"] == prov]
        if not t:
            continue
        r = t[0]["rect"]; x, y = r["x"] + r["w"] // 2, r["y"] + r["h"] // 2
        ctl("pointer", "move", x, y); ctl("pointer", "down")
        for i in range(1, 8):
            ctl("pointer", "move", x + 40 * i, y + 30 * i)
        ctl("pointer", "up", x + 280, y + 210)
        time.sleep(0.5)
    time.sleep(3)
    t = widths()[1].get("tiles", [])
    if t:
        r = t[0]["rect"]; x, y = r["x"] + 20, r["y"] + 20
        ctl("pointer", "click", x, y); ctl("pointer", "click", x, y)
    time.sleep(3)


def sc_press_destroy():
    # press an icon, end its session while held (icon destroyed), then release;
    # also press twice in a row without a release in between
    ps = three()
    x, y = icon_xy("opencode")
    ctl("pointer", "move", x, y); ctl("pointer", "down")
    ctl("pointer", "move", x + 30, y)
    emit("opencode", "s1", "session_end", ps["opencode"].pid)
    time.sleep(4)
    ctl("pointer", "move", x + 200, y + 300); ctl("pointer", "up", x + 200, y + 300)
    x, y = icon_xy("lab")
    ctl("pointer", "move", x, y); ctl("pointer", "down"); ctl("pointer", "down")
    ctl("pointer", "move", x + 50, y)
    ctl("pointer", "up", x + 50, y)
    ctl("pointer", "move", 900, 500)


def sc_tile_press_destroy():
    # hold a desktop tile while its session ends, then release and click elsewhere
    ps = three()
    t = [t for t in widths()[1]["tiles"] if t["provider"] == "opencode"][0]["rect"]
    x, y = t["x"] + t["w"] // 2, t["y"] + t["h"] // 2
    ctl("pointer", "move", x, y); ctl("pointer", "down"); ctl("pointer", "move", x + 40, y + 40)
    emit("opencode", "s1", "session_end", ps["opencode"].pid)
    time.sleep(4)
    ctl("pointer", "up", x + 40, y + 40)
    ctl("pointer", "click", 960, 500)
    x, y = icon_xy("lab")
    ctl("pointer", "click", x, y)


def sc_toggle():
    three()
    # The nested shell has no Extensions D-Bus service, so toggle through its own dconf.
    env = dict(os.environ, DBUS_SESSION_BUS_ADDRESS=nested_bus())
    uuid = "glanceagent@mehfooj.dev"
    for i in range(10):
        subprocess.run(["dconf", "write", "/org/gnome/shell/enabled-extensions", "@as []"], env=env); time.sleep(1)
        subprocess.run(["dconf", "write", "/org/gnome/shell/enabled-extensions", f"['{uuid}']"], env=env); time.sleep(1.5)
        emit("opencode", "s1", "turn_complete", None)


SCENARIOS = {f[3:]: f for f in globals() if f.startswith("sc_")}
if __name__ == "__main__":
    names = sys.argv[2:] or list(SCENARIOS)
    print("baseline", counts(), widths()[0])
    try:
        for n in names:
            clear()
            for p in procs:
                p.kill()
            procs.clear()
            before = counts()
            globals()[f"sc_{n}"]()
            finish(n, before)
    finally:
        for p in procs:
            p.kill()
