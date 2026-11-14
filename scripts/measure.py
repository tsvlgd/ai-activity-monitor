#!/usr/bin/env python3
"""Measure what AI Activity Monitor costs, in a way you can repeat.

  scripts/measure.py hook  [--runs 50]    cost of one Claude hook run
  scripts/measure.py shell [--window 30]  CPU and memory of a test GNOME Shell,
                                          with and without the extension

Why CPU time and not only wall clock: wall clock includes waiting for a busy
machine, CPU time (user + system) is the work actually done for the process.
Numbers are only comparable within one run of this script.
"""

import argparse
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOOK = os.path.join(ROOT, "adapters", "claude-code", "aimon_hook.py")
CLK = os.sysconf("SC_CLK_TCK")


def run_many(argv, runs, stdin=None, env=None):
    wall, cpu = [], []
    for _ in range(runs):
        t0 = os.times()
        s = time.perf_counter()
        subprocess.run(argv, input=stdin, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        wall.append((time.perf_counter() - s) * 1000)
        t1 = os.times()
        cpu.append(((t1.children_user - t0.children_user) + (t1.children_system - t0.children_system)) * 1000)
    return wall, cpu


def cmd_hook(runs):
    payload = json.dumps({"session_id": "measure", "cwd": "/tmp", "hook_event_name": "PreToolUse",
                          "tool_name": "Bash", "tool_input": {"command": "ls"}}).encode()
    with tempfile.TemporaryDirectory() as spool:
        env = dict(os.environ, AIMON_SPOOL_DIR=spool)
        cases = [
            ("hook (python3)", ["python3", HOOK], payload),
            ("hook (python3 -S)", ["python3", "-S", HOOK], payload),
            ("bare python3 -c pass", ["python3", "-c", "pass"], None),
            ("bare python3 -S -c pass", ["python3", "-S", "-c", "pass"], None),
            ("/bin/true (floor)", ["/bin/true"], None),
        ]
        print(f"{runs} runs each, interleaved order not used; load average now: {os.getloadavg()[0]:.2f}")
        print(f"{'case':26} {'wall mean':>10} {'wall p50':>9} {'wall p90':>9} {'cpu mean':>9}")
        for name, argv, stdin in cases:
            wall, cpu = run_many(argv, runs, stdin, env)
            wall.sort()
            print(f"{name:26} {statistics.mean(wall):9.1f}ms {statistics.median(wall):8.1f}ms "
                  f"{wall[int(len(wall) * 0.9) - 1]:8.1f}ms {statistics.mean(cpu):8.1f}ms")


def proc_ticks(pid):
    with open(f"/proc/{pid}/stat") as fh:
        f = fh.read().rsplit(")", 1)[1].split()
    return int(f[11]) + int(f[12])  # utime + stime


def proc_mem(pid):
    rss = pss = 0
    with open(f"/proc/{pid}/status") as fh:
        for line in fh:
            if line.startswith("VmRSS"):
                rss = int(line.split()[1])
    try:
        with open(f"/proc/{pid}/smaps_rollup") as fh:
            for line in fh:
                if line.startswith("Pss:"):
                    pss = int(line.split()[1])
    except OSError:
        pass
    return rss / 1024, pss / 1024


def seed_spool(spool, kinds):
    """kinds: list of (provider, [event kinds]) written as real normalized events."""
    now = time.time()
    for provider, seq in kinds:
        path = os.path.join(spool, f"{provider}--measure.jsonl")
        with open(path, "w") as fh:
            for i, kind in enumerate(seq):
                fh.write(json.dumps({"v": 1, "ts": round(now - 5 + i * 0.1, 3), "provider": provider,
                                     "session": "measure", "kind": kind, "detail": "measure",
                                     "cwd": "/tmp"}) + "\n")


def devctl(*args):
    subprocess.run([os.path.join(ROOT, "scripts", "devctl.sh"), *args], stdout=subprocess.PIPE,
                   stderr=subprocess.DEVNULL, timeout=15)


def devstate():
    out = subprocess.run([os.path.join(ROOT, "scripts", "devctl.sh"), "state"], stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, timeout=15).stdout.decode()
    try:
        return json.loads(out.strip().splitlines()[-1])["result"]
    except Exception:
        return {}


def find_headless(after):
    for _ in range(90):
        out = subprocess.run(["pgrep", "-f", "gnome-shell --headless"], stdout=subprocess.PIPE).stdout.decode().split()
        pids = [int(p) for p in out if int(p) not in after]
        if pids:
            return max(pids)
        time.sleep(1)
    raise RuntimeError("test shell did not start")


def variant(name, ext, kinds, settings, window, expect=None):
    before = set(int(p) for p in subprocess.run(["pgrep", "-f", "gnome-shell --headless"], stdout=subprocess.PIPE)
                 .stdout.decode().split())
    with tempfile.TemporaryDirectory() as spool:
        os.chmod(spool, 0o700)
        seed_spool(spool, kinds)
        env = dict(os.environ, AIMON_HEADLESS="1", AIMON_EXT="1" if ext else "0", AIMON_SPOOL_DIR=spool)
        proc = subprocess.Popen([os.path.join(ROOT, "scripts", "dev-nested.sh"), "1600x900"], env=env,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        pid = None
        try:
            pid = find_headless(before)
            time.sleep(25)  # startup settles
            facts = {}
            if ext:
                # The test shell inhibits animations; switch them on and CHECK that the
                # variant really reached the state it claims to measure, retrying a few times.
                # The test shell keeps its settings between runs, so ALWAYS start from the
                # defaults, then apply this variant's changes (a leftover "off" ruined a run once).
                merged = {"animate-working": "true", "desktop-play": "true", **settings}
                ok = False
                for _attempt in range(4):
                    devctl("animations-on")
                    for key, value in merged.items():
                        devctl("set", key, value)
                    time.sleep(6)
                    before_state = devstate()
                    motions = {t.get("motion") for t in before_state.get("tiles", [])} | \
                              {i.get("motion") for i in before_state.get("panel", [])}
                    facts["motion"] = sorted(m for m in motions if m)
                    if expect is None or set(facts["motion"]) == expect or (not facts["motion"] and not expect):
                        ok = True
                        break
                facts["valid"] = ok
                pos0 = [(t["provider"], t["rect"]["x"], t["rect"]["y"]) for t in before_state.get("tiles", [])]
            t0, wall0 = proc_ticks(pid), time.time()
            time.sleep(window)
            ticks, wall = proc_ticks(pid) - t0, time.time() - wall0
            rss, pss = proc_mem(pid)
            if ext:
                after_state = devstate()
                pos1 = [(t["provider"], t["rect"]["x"], t["rect"]["y"]) for t in after_state.get("tiles", [])]
                facts["tiles_moved"] = pos0 != pos1
            cpu_pct = ticks / CLK / wall * 100
            flag = "" if facts.get("valid", True) else "   <== INVALID: did not reach the intended state, ignore this row"
            print(f"{name:44} cpu {cpu_pct:5.1f}% of one core   rss {rss:6.1f} MB   pss {pss:6.1f} MB   {facts}{flag}")
            return cpu_pct, rss, pss
        finally:
            subprocess.run(["pkill", "-TERM", "-g", str(os.getpgid(proc.pid))], stderr=subprocess.DEVNULL)
            if pid:
                try:
                    os.kill(pid, 15)
                except OSError:
                    pass
            time.sleep(4)


def cmd_shell(window):
    work = [("claude-code", ["session_start", "prompt", "tool_start"]), ("opencode", ["session_start", "prompt", "tool_start"])]
    done = [("claude-code", ["session_start", "prompt", "turn_complete"]), ("opencode", ["session_start", "prompt", "turn_complete"])]
    print(f"test shell (headless, software rendering), window {window}s, load average now {os.getloadavg()[0]:.2f}")
    print("software rendering means absolute CPU is higher than your GPU desktop; compare rows, not totals\n")
    variant("A. extension OFF (baseline)", False, [], {}, window)
    variant("B. extension on, no agents", True, [], {}, window, expect=set())
    variant("C. 2 agents working, play off", True, work, {"desktop-play": "false"}, window, expect={"work"})
    variant("D. 2 agents working, play ON (roaming)", True, work, {"desktop-play": "true"}, window, expect={"work"})
    variant("E. 2 agents done (attention bounce), play off", True, done, {"desktop-play": "false"}, window, expect={"attention"})
    variant("F. 2 agents working, animation switched off", True, work, {"desktop-play": "false", "animate-working": "false"}, window, expect={"none"})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    h = sub.add_parser("hook")
    h.add_argument("--runs", type=int, default=50)
    s = sub.add_parser("shell")
    s.add_argument("--window", type=int, default=30)
    a = ap.parse_args()
    if a.cmd == "hook":
        cmd_hook(a.runs)
    else:
        cmd_shell(a.window)


if __name__ == "__main__":
    sys.exit(main())
