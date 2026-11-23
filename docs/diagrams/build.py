#!/usr/bin/env python3
"""Builds the diagrams embedded in README.md and docs/GUIDE.md.

Each diagram is described once and written twice:
  NN-name.excalidraw  editable (excalidraw.com or the VS Code Excalidraw extension)
  NN-name.svg         picture that the Markdown files embed

Line counts are read from the source files. Run: python3 docs/diagrams/build.py
"""

import glob
import json
import math
import os
import random
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
EXT = "extension/glanceagent@mehfooj.dev"

COL = {
    "blue": ("#a5d8ff", "#4a9eed"), "green": ("#b2f2bb", "#22c55e"), "orange": ("#ffd8a8", "#f59e0b"),
    "purple": ("#d0bfff", "#8b5cf6"), "red": ("#ffc9c9", "#ef4444"), "yellow": ("#fff3bf", "#f59e0b"),
    "teal": ("#c3fae8", "#06b6d4"), "pink": ("#eebefa", "#ec4899"), "grey": ("#e9ecef", "#868e96"),
    "zblue": ("#dbe4ff", "#4a9eed"), "zpurple": ("#e5dbff", "#8b5cf6"), "zgreen": ("#d3f9d8", "#22c55e"),
    "zteal": ("#c3fae8", "#06b6d4"), "zorange": ("#ffe8cc", "#f59e0b"), "zgrey": ("#f1f3f5", "#868e96"),
}
FONT = "DejaVu Sans, Helvetica, Arial, sans-serif"
warnings = []


def loc(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return sum(1 for _ in fh)


def loc_glob(pattern):
    return sum(loc(os.path.relpath(p, ROOT)) for p in glob.glob(os.path.join(ROOT, pattern), recursive=True))


def center(b):
    return (b["x"] + b["w"] / 2, b["y"] + b["h"] / 2)


def edge_point(b, toward):
    cx, cy = center(b)
    dx, dy = toward[0] - cx, toward[1] - cy
    if dx == 0 and dy == 0:
        return (cx, cy)
    if b["kind"] == "ellipse":
        rx, ry = b["w"] / 2, b["h"] / 2
        k = 1 / math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        return (cx + dx * k, cy + dy * k)
    hw, hh = b["w"] / 2, b["h"] / 2
    k = min(hw / abs(dx) if dx else 1e9, hh / abs(dy) if dy else 1e9)
    return (cx + dx * k, cy + dy * k)


class Diagram:
    def __init__(self, name, w, h, title):
        self.name, self.w, self.h = name, w, h
        self.rnd = random.Random(name)
        self.els, self.svg, self.boxes, self.n = [], [], {}, 0
        self.by_id = {}
        self.text("title", 24, 16, title, fs=26, color="#1e1e1e", bold=True)

    # ---- low level -------------------------------------------------------
    def _el(self, typ, id, x, y, w, h, stroke="#1e1e1e", bg="transparent", sw=2, dash="solid", opacity=100, rounded=False):
        e = {"id": id, "type": typ, "x": round(x, 1), "y": round(y, 1), "width": round(w, 1), "height": round(h, 1),
             "angle": 0, "strokeColor": stroke, "backgroundColor": bg, "fillStyle": "solid", "strokeWidth": sw,
             "strokeStyle": dash, "roughness": 1, "opacity": opacity, "groupIds": [], "frameId": None,
             "roundness": {"type": 3} if rounded else None, "seed": self.rnd.randint(1, 2 ** 31 - 1), "version": 1,
             "versionNonce": self.rnd.randint(1, 2 ** 31 - 1), "isDeleted": False, "boundElements": [],
             "updated": 1, "link": None, "locked": False}
        self.els.append(e)
        self.by_id[id] = e
        return e

    def _bound_text(self, id, container, cx, cy, text, fs, color):
        lines = text.split("\n")
        w = max(len(l) for l in lines) * fs * 0.55
        h = len(lines) * fs * 1.25
        e = self._el("text", id, cx - w / 2, cy - h / 2, w, h, stroke=color)
        e.update({"text": text, "fontSize": fs, "fontFamily": 2, "textAlign": "center", "verticalAlign": "middle",
                  "baseline": int(fs * 0.9), "containerId": container, "originalText": text, "lineHeight": 1.25,
                  "autoResize": True})
        self.by_id[container]["boundElements"].append({"type": "text", "id": id})

    def _svg_lines(self, lines, cx, cy, fs, color, anchor="middle", x=None, bold=False):
        lh = fs * 1.25
        top = cy - len(lines) * lh / 2 + lh * 0.8
        out = []
        for i, line in enumerate(lines):
            px = cx if x is None else x
            out.append(f'<text x="{px:.1f}" y="{top + i * lh:.1f}" text-anchor="{anchor}" font-family="{FONT}" '
                       f'font-size="{fs * 0.92:.1f}" fill="{color}"{" font-weight=\"bold\"" if bold else ""}>{escape(line)}</text>')
        return "".join(out)

    # ---- elements --------------------------------------------------------
    def text(self, id, x, y, text, fs=16, color="#495057", bold=False):
        lines = text.split("\n")
        w = max(len(l) for l in lines) * fs * 0.55
        h = len(lines) * fs * 1.25
        e = self._el("text", id, x, y, w, h, stroke=color)
        e.update({"text": text, "fontSize": fs, "fontFamily": 2, "textAlign": "left", "verticalAlign": "top",
                  "baseline": int(fs * 0.9), "containerId": None, "originalText": text, "lineHeight": 1.25,
                  "autoResize": True})
        self.svg.append(self._svg_lines(lines, 0, y + h / 2, fs, color, anchor="start", x=x, bold=bold))

    def zone(self, id, x, y, w, h, color, label):
        fill, stroke = COL[color]
        self._el("rectangle", id, x, y, w, h, stroke=stroke, bg=fill, sw=1, opacity=45, rounded=True)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{fill}" fill-opacity="0.55" '
                        f'stroke="{stroke}" stroke-width="1.5"/>')
        self.text(id + "_l", x + 14, y + 8, label, fs=18, color="#343a40", bold=True)

    def plain(self, id, x, y, w, h, color):
        """A filled rectangle without text (used for bars)."""
        fill, stroke = COL[color]
        self._el("rectangle", id, x, y, w, h, stroke=stroke, bg=fill, rounded=True)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')

    def box(self, id, x, y, w, h, text, color="blue", fs=16, shape="rect", dash="solid"):
        fill, stroke = COL[color]
        lines = text.split("\n")
        need_w = max(len(l) for l in lines) * fs * 0.58 + 24
        need_h = len(lines) * fs * 1.25 + 14
        if need_w > w or need_h > h:
            warnings.append(f"{self.name}:{id} text needs {need_w:.0f}x{need_h:.0f} but box is {w}x{h}")
        self.boxes[id] = {"kind": "ellipse" if shape == "ellipse" else "rect", "x": x, "y": y, "w": w, "h": h}
        self._el("ellipse" if shape == "ellipse" else "rectangle", id, x, y, w, h, stroke=stroke, bg=fill, dash=dash,
                 rounded=shape != "ellipse")
        cx, cy = x + w / 2, y + h / 2
        self._bound_text(id + "_t", id, cx, cy, text, fs, "#1e1e1e")
        dash_attr = ' stroke-dasharray="7 5"' if dash == "dashed" else ""
        if shape == "ellipse":
            self.svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{w / 2}" ry="{h / 2}" fill="{fill}" stroke="{stroke}" '
                            f'stroke-width="2"{dash_attr}/>')
        else:
            self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" '
                            f'stroke-width="2"{dash_attr}/>')
        self.svg.append(self._svg_lines(lines, cx, cy, fs, "#1e1e1e"))

    def arrow(self, a, b, label=None, via=(), color="#343a40", dash="solid", sw=2, fs=15, label_at=0.5):
        A, B = self.boxes[a], self.boxes[b]
        start = edge_point(A, via[0] if via else center(B))
        end = edge_point(B, via[-1] if via else center(A))
        pts = [start, *via, end]
        self.n += 1
        id = f"arrow{self.n}"
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        e = self._el("arrow", id, start[0], start[1], max(xs) - min(xs), max(ys) - min(ys), stroke=color, sw=sw, dash=dash)
        e.update({"points": [[round(p[0] - start[0], 1), round(p[1] - start[1], 1)] for p in pts],
                  "lastCommittedPoint": None, "startBinding": {"elementId": a, "focus": 0, "gap": 4},
                  "endBinding": {"elementId": b, "focus": 0, "gap": 4}, "startArrowhead": None,
                  "endArrowhead": "arrow", "elbowed": False})
        A_el, B_el = self.by_id[a], self.by_id[b]
        A_el["boundElements"].append({"id": id, "type": "arrow"})
        B_el["boundElements"].append({"id": id, "type": "arrow"})
        dash_attr = ' stroke-dasharray="8 6"' if dash == "dashed" else ""
        path = " ".join(f"{'M' if i == 0 else 'L'}{p[0]:.1f},{p[1]:.1f}" for i, p in enumerate(pts))
        self.svg.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{sw}"{dash_attr}/>')
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        ang = math.atan2(y2 - y1, x2 - x1)
        hx = [(x2, y2), (x2 - 14 * math.cos(ang - 0.4), y2 - 14 * math.sin(ang - 0.4)),
              (x2 - 14 * math.cos(ang + 0.4), y2 - 14 * math.sin(ang + 0.4))]
        self.svg.append('<polygon points="' + " ".join(f"{px:.1f},{py:.1f}" for px, py in hx) + f'" fill="{color}"/>')
        if label:
            segs = [(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), i) for i in range(len(pts) - 1)]
            _, i = max(segs)
            mx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * label_at
            my = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * label_at
            lines = label.split("\n")
            tw = max(len(l) for l in lines) * fs * 0.58 + 10
            th = len(lines) * fs * 1.25 + 4
            self.svg.append(f'<rect x="{mx - tw / 2:.1f}" y="{my - th / 2:.1f}" width="{tw:.1f}" height="{th:.1f}" '
                            f'rx="5" fill="#ffffff" fill-opacity="0.92"/>')
            self.svg.append(self._svg_lines(lines, mx, my, fs, "#212529"))
            self._bound_text(id + "_t", id, mx, my, label, fs, "#212529")

    def arrow_pts(self, pts, label=None, color="#343a40", dash="solid", sw=2, fs=15):
        """Arrow along explicit points, not attached to any box."""
        self.n += 1
        id = f"arrow{self.n}"
        start = pts[0]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        e = self._el("arrow", id, start[0], start[1], max(xs) - min(xs), max(ys) - min(ys), stroke=color, sw=sw, dash=dash)
        e.update({"points": [[round(p[0] - start[0], 1), round(p[1] - start[1], 1)] for p in pts],
                  "lastCommittedPoint": None, "startBinding": None, "endBinding": None, "startArrowhead": None,
                  "endArrowhead": "arrow", "elbowed": False})
        dash_attr = ' stroke-dasharray="8 6"' if dash == "dashed" else ""
        path = " ".join(f"{'M' if i == 0 else 'L'}{p[0]:.1f},{p[1]:.1f}" for i, p in enumerate(pts))
        self.svg.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{sw}"{dash_attr}/>')
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        ang = math.atan2(y2 - y1, x2 - x1)
        hx = [(x2, y2), (x2 - 14 * math.cos(ang - 0.4), y2 - 14 * math.sin(ang - 0.4)),
              (x2 - 14 * math.cos(ang + 0.4), y2 - 14 * math.sin(ang + 0.4))]
        self.svg.append('<polygon points="' + " ".join(f"{px:.1f},{py:.1f}" for px, py in hx) + f'" fill="{color}"/>')
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            lines = label.split("\n")
            tw = max(len(l) for l in lines) * fs * 0.58 + 10
            th = len(lines) * fs * 1.25 + 4
            self.svg.append(f'<rect x="{mx - tw / 2 + 0:.1f}" y="{my - th / 2:.1f}" width="{tw:.1f}" height="{th:.1f}" rx="5" fill="#ffffff" fill-opacity="0.92"/>')
            self.svg.append(self._svg_lines(lines, mx, my, fs, "#212529"))
            self._bound_text(id + "_t", id, mx, my, label, fs, "#212529")

    def save(self):
        scene = {"type": "excalidraw", "version": 2, "source": "ai-activity-monitor/docs/diagrams/build.py",
                 "elements": self.els, "appState": {"viewBackgroundColor": "#ffffff", "gridSize": None}, "files": {}}
        with open(os.path.join(HERE, f"{self.name}.excalidraw"), "w", encoding="utf-8") as fh:
            json.dump(scene, fh, indent=1)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
               f'<rect width="100%" height="100%" fill="#ffffff"/>' + "".join(self.svg) + "</svg>")
        with open(os.path.join(HERE, f"{self.name}.svg"), "w", encoding="utf-8") as fh:
            fh.write(svg)


# ---------------------------------------------------------------------------
def d01_mind_map():
    d = Diagram("01-mind-map", 1500, 960, "GlanceAgent: the whole system on one page")
    d.box("c", 590, 410, 320, 140, "AI Activity\nMonitor\none GNOME extension\nplus two small adapters", "yellow", 19, "ellipse")
    d.box("in", 40, 90, 430, 200, "1  INPUT: the agents report\n\nClaude Code: a hook script runs on\nevery event, JSON arrives on stdin\nOpenCode: a plugin listens to the\nserver's internal event stream", "blue", 17)
    d.box("tr", 535, 70, 430, 200, "2  TRANSPORT: files in RAM\n\nOne small JSON line per event in\n$XDG_RUNTIME_DIR/ai-activity-monitor\nThe kernel tells us when a file\nchanges (inotify). No network", "teal", 17)
    d.box("br", 1030, 90, 430, 200, "3  BRAIN: pure logic\n\nEvents become session states:\nidle, working, waiting, completed,\nerror, ended. Decides what to show\nand when to notify", "purple", 17)
    d.box("out", 1030, 660, 430, 250, "4  OUTPUT: what you see\n\nTop bar icons (every window)\nDesktop tiles (empty desktop, play)\nPreview card, Open in Terminal\nGNOME notifications\nMotion and colour show the state", "green", 17)
    d.box("lx", 535, 740, 430, 190, "5  LINUX pieces used\n\nGNOME Shell and GJS (JavaScript)\nWayland, /proc, D-Bus, tmpfs\ninotify, gsettings, flock", "orange", 17)
    d.box("tru", 40, 660, 430, 250, "6  TRUST: how we know it works\n\n62 automated tests\nIndependent review, 4 High fixed\nInstaller with backups, uninstaller\nSecrets redacted, costs measured", "pink", 17)
    d.arrow("c", "in", via=[(560, 380)], color="#868e96")
    d.arrow("c", "tr", color="#868e96")
    d.arrow("c", "br", via=[(940, 380)], color="#868e96")
    d.arrow("c", "out", via=[(940, 600)], color="#868e96")
    d.arrow("c", "lx", color="#868e96")
    d.arrow("c", "tru", via=[(560, 600)], color="#868e96")
    d.arrow("in", "tr", "JSON lines", color="#1971c2", sw=3)
    d.arrow("tr", "br", "file changed", color="#1971c2", sw=3)
    d.arrow("br", "out", "state to draw", color="#1971c2", sw=3, label_at=0.45)
    d.text("legend", 40, 320, "Blue arrows: the order data flows.\nGrey arrows: supporting parts.", 16)
    d.save()


def d02_data_flow():
    d = Diagram("02-data-flow", 1580, 900, "One event, end to end: Claude starts a tool and the icon starts moving")
    d.zone("zA", 20, 70, 400, 800, "zblue", "Terminals (agent processes)")
    d.zone("zB", 440, 70, 270, 800, "zteal", "A folder in RAM")
    d.zone("zC", 730, 70, 480, 800, "zpurple", "gnome-shell process (our extension)")
    d.zone("zD", 1230, 70, 330, 800, "zgreen", "Screen")
    d.box("a1", 40, 120, 360, 100, "1. Claude Code starts a tool\n(Bash, Edit, Read...) after\nyou send a prompt", "blue")
    d.box("a2", 40, 270, 360, 120, "2. Claude runs our hook command\naimon_hook.py (short lived,\nabout 35 ms). Event JSON arrives\non its stdin", "orange")
    d.box("a3", 40, 470, 360, 100, "1b. OpenCode server (background)\nprocesses the same kind of event:\nsession.tool.called", "blue")
    d.box("a4", 40, 620, 360, 100, "2b. Our plugin, running inside the\nserver, receives it through\nctx.event.subscribe", "orange")
    d.box("an", 40, 755, 360, 90, "Both convert to the SAME\nnormalized line (docs/EVENTS.md)", "yellow")
    d.box("b1", 455, 250, 240, 380, "3. Append ONE line\nto the session's file\n\nclaude-code--ID.jsonl\nopencode--ID.jsonl\n\n{\"v\":1, \"kind\":\n \"tool_start\",\n \"detail\":\"Running ls\",\n \"ts\":1794...}\n\nfiles live in RAM", "teal", 16)
    d.box("c1", 750, 120, 440, 90, "4. The kernel (inotify) says a file\nchanged. SpoolWatcher wakes up", "purple")
    d.box("c2", 750, 240, 440, 90, "5. Read the new lines. parseEvent()\nthrows away anything malformed", "purple")
    d.box("c3", 750, 360, 440, 120, "6. SessionStore.reduceSession():\npure function: old state + event\n= new state (idle, working...)", "purple")
    d.box("c4", 750, 510, 440, 90, "7. decideNotification(): spam rules\n(dedupe, only long turns, ...)", "purple")
    d.box("c5", 750, 630, 440, 110, "8. extension.js render(): group by\nagent, tell the UI to draw. Also\nstarts/stops the motion", "purple")
    d.box("d1", 1250, 130, 290, 100, "Top bar icon\nstarts moving up and\ndown (state: working)", "green")
    d.box("d2", 1250, 260, 290, 100, "Desktop tile\nsame state, same motion", "green")
    d.box("d3", 1250, 390, 290, 100, "Preview card\nupdates when open:\n\"Running ls\"", "green")
    d.box("d4", 1250, 520, 290, 100, "GNOME notification\nonly for approval, error,\nlong turn done", "green")
    d.arrow("a1", "a2", "event fires", color="#e8590c")
    d.arrow("a2", "b1", "append a line", color="#e8590c")
    d.arrow("a3", "a4", "event", color="#e8590c")
    d.arrow("a4", "b1", "append a line", color="#e8590c")
    d.arrow("b1", "c1", "", via=[(720, 440), (720, 165)], color="#1971c2", sw=3)
    d.arrow("c1", "c2", color="#1971c2", sw=3)
    d.arrow("c2", "c3", color="#1971c2", sw=3)
    d.arrow("c3", "c4", color="#1971c2", sw=3)
    d.arrow("c4", "c5", color="#1971c2", sw=3)
    d.arrow("c5", "d1", via=[(1215, 690), (1215, 180)], color="#2f9e44", sw=3)
    d.arrow("c5", "d2", via=[(1215, 690), (1215, 310)], color="#2f9e44", sw=3)
    d.arrow("c5", "d3", via=[(1215, 690), (1215, 440)], color="#2f9e44", sw=3)
    d.arrow("c4", "d4", via=[(1215, 555), (1215, 570)], color="#2f9e44", sw=3)
    d.text("note", 750, 770, "No network, no server of our own. Total path:\nusually a few milliseconds from event to screen.", 16)
    d.save()


def d03_processes():
    js = loc_glob(f"{EXT}/**/*.js")
    d = Diagram("03-processes", 1500, 930, "Who runs where: the real processes and how they talk")
    d.box("claude", 30, 110, 320, 120, "claude (Claude Code)\nlong lived process\nin one terminal tab", "blue", 17)
    d.box("hook", 30, 320, 320, 110, "aimon_hook.py\nstarted by Claude per event,\nexits in about 35 ms", "orange", 17)
    d.box("ocs", 30, 540, 340, 140, "opencode serve --service\none background server,\nall OpenCode sessions live here\nplus our plugin, inside it", "blue", 17)
    d.box("oct", 30, 760, 320, 100, "opencode (TUI client)\nyour terminal tab,\nthe screen you type in", "blue", 17)
    d.box("sp", 540, 320, 300, 180, "Spool folder in RAM\n$XDG_RUNTIME_DIR/\nai-activity-monitor/spool\nfiles, not a process", "teal", 17)
    d.box("ker", 530, 640, 320, 230, "Linux kernel\ninotify: file change alerts\n/proc: facts about processes\npipes: stdin to the hook\ntmpfs: files kept in RAM", "yellow", 17)
    d.box("gs", 1010, 150, 440, 330, "gnome-shell (the compositor)\nONE process draws your whole\ndesktop and runs all extensions.\nOur extension is JavaScript\n(GJS) inside it:\n" + f"about {js:,} lines in {len(glob.glob(os.path.join(ROOT, EXT, '**/*.js'), recursive=True))} files\nrunning on its main thread", "purple", 17)
    d.box("gt", 1010, 650, 440, 150, "gnome-terminal-server\nowns every terminal window\nand tab (one process)", "blue", 17)
    d.arrow("claude", "hook", "spawns, pipes JSON\nto its stdin", color="#e8590c")
    d.arrow("hook", "sp", "append one line", color="#e8590c")
    d.arrow("ocs", "sp", "plugin appends a line", via=[(400, 600), (400, 450)], color="#e8590c")
    d.arrow("oct", "ocs", "talks to server\n(their business)", color="#868e96", dash="dashed")
    d.arrow("sp", "gs", "inotify: file changed", color="#1971c2", sw=3)
    d.arrow("gs", "ker", "reads /proc/PID every 4 s:\nis the agent still alive?", via=[(1100, 560), (860, 700)], color="#1971c2")
    d.arrow("gs", "gt", "D-Bus: switch tab\nWayland: raise window", color="#2f9e44", sw=3)
    d.text("legend", 540, 530, "Solid: data we send or read.\nDashed: not ours, shown for context.\nOrange: written by the agents' side.\nBlue/green: done inside gnome-shell.", 15)
    d.save()


def d04_code():
    d = Diagram("04-code-architecture", 1640, 1070, "Source code map: layers and who may depend on whom")
    d.zone("z1", 20, 70, 1600, 190, "zblue", "ADAPTERS: run OUTSIDE GNOME. Both write lines into the spool folder that lib/spool.js watches")
    d.box("hk", 40, 120, 480, 120, f"adapters/claude-code/aimon_hook.py ({loc('adapters/claude-code/aimon_hook.py')} lines)\nPython. Hook JSON in, one spool line out.\nRedacts secrets, finds the agent PID", "blue")
    d.box("pl", 540, 120, 530, 120, f"adapters/opencode/ai-activity-monitor.js ({loc('adapters/opencode/ai-activity-monitor.js')} lines)\nJS plugin. Subscribes to the event bus,\nmaps to the same line, one writer per server", "blue")
    d.box("ev", 1090, 120, 510, 120, "docs/EVENTS.md: THE CONTRACT\nboth adapters write this schema,\nthe extension reads it", "yellow")
    d.zone("z2", 20, 310, 1600, 180, "zpurple", "PURE CORE: no GNOME imports, unit tested in plain Node")
    d.box("mo", 40, 360, 400, 110, f"lib/core/model.js ({loc(EXT + '/lib/core/model.js')} lines)\nevent kinds, parseEvent, reduceSession:\nTHE state machine. aggregateProvider", "purple")
    d.box("st", 460, 360, 360, 110, f"lib/core/store.js ({loc(EXT + '/lib/core/store.js')} lines)\nSessionStore: holds all sessions,\nfeeds events in, keeps notify memory", "purple")
    d.box("po", 840, 360, 360, 110, f"lib/core/policy.js ({loc(EXT + '/lib/core/policy.js')} lines)\ndecideNotification: when is a\nnotification worth showing", "purple")
    d.box("ps", 1220, 360, 380, 110, f"lib/core/presence.js ({loc(EXT + '/lib/core/presence.js')} lines)\nisWatching: is the user already\nlooking at this session's tab", "purple")
    d.zone("z3", 20, 540, 1600, 270, "zgreen", "GNOME GLUE: talks to the operating system and the shell")
    d.box("ex", 40, 590, 400, 200, f"extension.js ({loc(EXT + '/extension.js')} lines)\nTHE ORCHESTRATOR\nenable() builds everything,\ndisable() tears it all down.\nTimers: liveness 4 s, decay 15 s", "green")
    d.box("sw", 470, 590, 345, 90, f"lib/spool.js ({loc(EXT + '/lib/spool.js')})\nwatch folder (inotify), read lines", "green")
    d.box("pr", 470, 700, 345, 90, f"lib/procs.js ({loc(EXT + '/lib/procs.js')})\n/proc: alive? who is the parent?", "green")
    d.box("wi", 835, 590, 370, 90, f"lib/windows.js ({loc(EXT + '/lib/windows.js')})\nfind the terminal, switch the tab", "green")
    d.box("ds", 835, 700, 370, 90, f"lib/desktopstate.js ({loc(EXT + '/lib/desktopstate.js')})\nwhich windows cover the desktop", "green")
    d.box("no", 1225, 590, 375, 90, f"lib/notifier.js ({loc(EXT + '/lib/notifier.js')})\nGNOME notifications", "green")
    d.box("pv", 1225, 700, 375, 90, f"lib/providers.js ({loc(EXT + '/lib/providers.js')}), prefs.js ({loc(EXT + '/prefs.js')})\nagent names/icons, settings window", "green")
    d.zone("z4", 20, 860, 1600, 140, "zorange", "UI: draws the actors you see (motion.js is shared by tiles and top bar)")
    d.box("ind", 40, 905, 400, 80, f"lib/ui/indicators.js ({loc(EXT + '/lib/ui/indicators.js')})\ndesktop tiles, drag, play mode", "orange")
    d.box("pan", 470, 905, 345, 80, f"lib/ui/panel.js ({loc(EXT + '/lib/ui/panel.js')})\ntop bar icons, drag", "orange")
    d.box("pre", 835, 905, 370, 80, f"lib/ui/preview.js ({loc(EXT + '/lib/ui/preview.js')})\nthe click card", "orange")
    d.box("mot", 1225, 905, 375, 80, f"lib/ui/motion.js ({loc(EXT + '/lib/ui/motion.js')})\nwork motion, attention hop", "orange")
    d.arrow_pts([(820, 540), (820, 490)], "extension.js feeds events in,\nasks what to show", color="#1971c2", sw=3)
    d.arrow_pts([(820, 810), (820, 860)], "extension.js tells the UI what to draw", color="#1971c2", sw=3)
    d.text("tools", 20, 1015, "TOOLS AND TESTS (not part of the running system): scripts/install.sh, uninstall.sh, claude_hooks.py (safe settings edit), dev-nested.sh and devctl.sh (headless test\nshell), measure.py (performance). tests/: 60 Node tests plus 30 Python tests. stylesheet.css and icons/ are the look.", 15)
    d.save()


def d05_state_machine():
    d = Diagram("05-state-machine", 1400, 900, "The brain: six session states and what moves a session between them")
    d.box("idle", 40, 330, 230, 110, "idle\nopen, waiting for\nyour next prompt", "grey", 17, "ellipse")
    d.box("work", 520, 330, 260, 130, "working\ngenerating text or\nrunning a tool", "green", 17, "ellipse")
    d.box("wait", 520, 90, 260, 130, "waiting\nneeds approval or\nan answer from you", "orange", 17, "ellipse")
    d.box("done", 1040, 330, 260, 130, "completed\nturn finished\n(blue dot, bounces)", "blue", 17, "ellipse")
    d.box("err", 520, 600, 260, 130, "error\nturn failed\n(red dot, bounces)", "red", 17, "ellipse")
    d.box("end", 1040, 640, 260, 110, "ended\nsession gone,\nicon removed", "grey", 17, "ellipse")
    d.arrow("idle", "work", "prompt", color="#2f9e44", sw=3)
    d.arrow("work", "wait", "permission or\nquestion asked", via=[(560, 280)], color="#e8590c")
    d.arrow("wait", "work", "answered:\nagent moves on", via=[(760, 280)], color="#2f9e44")
    d.arrow("work", "done", "turn_complete\n(Stop hook)", color="#1971c2", sw=3)
    d.arrow("work", "err", "turn_error\n(StopFailure)", color="#e03131", label_at=0.78)
    d.arrow("done", "idle", "hold time passes\n(3 min) or new prompt\nreturns to working", via=[(1170, 530), (155, 530)], color="#868e96", label_at=0.25)
    d.arrow("err", "idle", "hold time passes", via=[(155, 665)], color="#868e96")
    d.arrow("work", "idle", "interrupt, or no events\nfor 20 min (stale)", via=[(400, 290)], color="#868e96", dash="dashed")
    d.arrow("done", "end", "session_end,\nor the agent\nprocess vanished", via=[(1340, 440), (1340, 640)], color="#e03131", dash="dashed")
    d.text("n1", 40, 760, "From ANY state: session_end (clean exit) or process gone\n(terminal killed) moves a session to ended. Process gone also\nraises the 'ended unexpectedly' notification.", 16)
    d.text("n2", 40, 120, "Dismiss on the preview card does NOT change the state.\nIt marks the result as seen: the icon stays, the bounce stops.\nA new state makes it news again.", 16)
    d.text("n3", 840, 90, "Several sessions of one agent share one icon:\nthe highest priority state wins\n(waiting > error > working > completed > idle).", 16)
    d.save()


def d06_footprint():
    d = Diagram("06-footprint", 1500, 900, "What this system puts on a machine, and how to remove it")
    d.zone("zi", 20, 70, 470, 640, "zblue", "FILES we installed")
    d.box("f1", 40, 120, 430, 150, "~/.local/share/gnome-shell/\nextensions/glanceagent@mehfooj.dev/\nthe extension: JS, CSS, icons,\nsettings schema", "blue", 16)
    d.box("f2", 40, 300, 430, 120, "~/.local/share/ai-activity-monitor/\naimon_hook.py\ncopy of the Claude hook", "blue", 16)
    d.box("f3", 40, 450, 430, 120, "~/.config/opencode/plugins/\nai-activity-monitor.js\ncopy of the OpenCode plugin", "blue", 16)
    d.box("f4", 40, 600, 430, 90, "source of truth: this\nrepository (git)", "yellow", 16)
    d.zone("ze", 510, 70, 470, 640, "zorange", "SETTINGS we edited")
    d.box("e1", 530, 120, 430, 170, "~/.claude/settings.json\n+ 11 hook entries, each runs\naimon_hook.py. Other hooks kept.\nBackup: settings.json.aimon-backup-*", "orange", 16)
    d.box("e2", 530, 320, 430, 120, "dconf: org.gnome.shell\nenabled-extensions\n+ glanceagent@mehfooj.dev", "orange", 16)
    d.box("e3", 530, 470, 430, 120, "dconf: /org/gnome/shell/extensions/\nai-activity-monitor/\nour preferences (positions, switches)", "orange", 16)
    d.zone("zr", 1000, 70, 480, 640, "zgreen", "RUNTIME (temporary)")
    d.box("r1", 1020, 120, 440, 150, "$XDG_RUNTIME_DIR/ai-activity-monitor/\nspool/*.jsonl and .lock\nRAM only, gone at logout or reboot,\ncapped 256 KB per session", "green", 16)
    d.box("r2", 1020, 300, 440, 120, "gnome-shell loads the extension\nat login (Wayland rule)", "green", 16)
    d.box("r3", 1020, 450, 440, 120, "OpenCode server loads the plugin\nwhen the server starts", "green", 16)
    d.box("r4", 1020, 600, 440, 90, "Claude runs the hook per event\nonly in NEW Claude sessions", "green", 16)
    d.box("rm", 20, 740, 1460, 130, "REMOVE EVERYTHING:   scripts/uninstall.sh   (try --dry-run first)\nRemoves the extension and its settings, only OUR hook entries from settings.json, the OpenCode plugin, the spool.\nExact rollback of settings.json: copy back the newest settings.json.aimon-backup-* file.", "red", 17)
    d.save()


def d07_performance():
    # Values measured by scripts/measure.py shell --window 30 (one complete run, headless
    # software rendered shell): (label, CPU percent of one core, RSS MB, invalid).
    rows = {
        "A": ("extension off", 0.7, 233.1, False),
        "B": ("extension on, no agents", 3.2, 223.5, False),
        "C": ("two agents working", 1.4, 232.3, False),
        "D": ("working with play mode", 10.2, 220.3, False),
        "E": ("both finished", 4.0, 230.2, False),
        "F": ("motion switched off", 0.6, 227.3, False),
    }
    d = Diagram("07-performance", 1500, 960, "What it costs: measured numbers (software rendered test shell, one core = 100%)")
    colors = {"A": "grey", "B": "grey", "C": "blue", "D": "red", "E": "blue", "F": "grey"}
    names = {"A": "A. extension OFF (baseline)", "B": "B. extension on, no agents", "C": "C. two agents working (motion)",
             "D": "D. working + play mode roaming", "E": "E. both done (attention bounce)", "F": "F. working, motion switched off"}
    d.text("h1", 40, 70, "GNOME Shell CPU while each case runs, 30 s window (shorter bar is better)", fs=18, color="#343a40")
    top = max([v[1] for v in rows.values()] + [1.0])
    scale = 640 / top
    y = 115
    for k in "ABCDEF":
        if k not in rows:
            continue
        label, cpu, rss, invalid = rows[k]
        w = max(cpu * scale, 6)
        d.text(f"l{k}", 40, y + 14, names[k], fs=17, color="#212529")
        d.plain(f"b{k}", 470, y, w, 44, colors[k])
        d.text(f"v{k}", 470 + w + 14, y + 10, f"{cpu:.1f}%" + ("  (invalid row)" if invalid else ""), fs=19, color="#212529")
        y += 62
    d.text("h2", 40, y + 20, "One Claude hook run (milliseconds, mean of 40), paid on every Claude event", fs=18, color="#343a40")
    y += 65
    for label, ms, color in [("Our hook (python3)", 34.1, "orange"), ("Empty Python program", 21.1, "grey"),
                             ("Empty Python with -S", 10.8, "grey"), ("An empty program (/bin/true)", 0.5, "grey")]:
        w = max(ms * 12, 6)
        d.text(f"hl{label}", 40, y + 10, label, fs=17, color="#212529")
        d.plain(f"hb{label}", 470, y, w, 36, color)
        d.text(f"hv{label}", 470 + w + 14, y + 6, f"{ms:.1f} ms", fs=19, color="#212529")
        y += 50
    d.box("n1", 40, y + 25, 1420, 120, "Reading the picture: the extension itself is lost in the noise (A, B, C, E, F are all within a few percent of one core).\nPlay mode (D) is the one expensive feature: a JavaScript timer moves widgets 30 times a second.\nMemory is not shown: with versus without the extension differs by less than the run to run noise of about 10 MB.\nEvery bar comes from scripts/measure.py, which you can run yourself. Percentages are indicative within about 2 points.", "yellow", 16)
    d.save()


def d08_desktop_stack():
    d = Diagram("08-desktop-stack", 1640, 1130, "The desktop stack from the hardware up, and which kind of thing each name is")
    # ---- left: the layers -------------------------------------------------
    d.zone("zL", 20, 70, 800, 1030, "zgrey", "Layers, top to bottom (who talks to whom)")
    d.box("chrome", 40, 115, 240, 95, "Chrome\na program with\nits own window", "blue", 16)
    d.box("term", 300, 115, 240, 95, "gnome-terminal-server\nowns every terminal\nwindow and tab", "blue", 15)
    d.box("agent", 560, 115, 240, 95, "claude, opencode\nrun inside a tab,\nsend us events", "blue", 16)
    d.box("wl", 40, 250, 760, 75, "WAYLAND: the rulebook between apps and compositor (not a program)\nApps may say: here is my picture and size. Apps may NOT say: put me on top", "orange", 15)
    d.zone("zS", 40, 345, 760, 420, "zpurple", "gnome-shell: ONE program, two jobs")
    d.box("comp", 60, 395, 340, 105, "Job 1: COMPOSITOR\nstacks every window picture,\nplaces and raises windows", "purple", 16)
    d.box("dsh", 420, 395, 360, 105, "Job 2: DESKTOP SHELL\ntop bar, Activities screen,\nnotifications, panel menus", "purple", 16)
    d.box("gjs", 60, 525, 340, 100, "GJS\nthe engine that runs JavaScript\nand calls GNOME libraries", "teal", 16)
    d.box("ext", 420, 525, 360, 100, "OUR EXTENSION\nloaded JavaScript, same program,\nsame powers as GNOME Shell", "green", 16)
    d.box("mt", 60, 655, 720, 85, "MAIN THREAD: one task at a time (a click, a timer, a file change).\nA task that takes 200 ms freezes the whole desktop for 200 ms.", "yellow", 16)
    d.box("ker", 40, 800, 470, 195, "LINUX KERNEL\nDRM/KMS: puts pixels on the screen\ninput: mouse and keyboard events\ninotify: file changed alerts\n/proc: facts about running processes\ntmpfs: folders kept in RAM", "orange", 16)
    d.box("dbus", 530, 800, 270, 195, "D-Bus\na small message program\n(a daemon, not the kernel)\nprograms call each\nother's functions", "pink", 15)
    d.box("hw", 40, 1025, 760, 55, "HARDWARE: GPU, screen, keyboard, mouse", "grey", 16)
    d.arrow("chrome", "wl", "draw requests", color="#868e96")
    d.arrow("term", "wl", color="#868e96")
    d.arrow("agent", "term", "run inside", color="#868e96")
    d.arrow("wl", "comp", color="#e8590c", sw=3)
    d.arrow("gjs", "ext", "runs it", color="#2f9e44", sw=3)
    d.arrow("ext", "comp", "may raise windows,\ndraw on top", via=[(410, 510)], color="#2f9e44", sw=3, fs=14)
    d.arrow("mt", "ker", "inotify, /proc", via=[(280, 770)], color="#1971c2", fs=14)
    d.arrow("mt", "dbus", "switch tab", via=[(660, 770)], color="#1971c2", fs=14)
    d.arrow("ker", "hw", color="#868e96")
    # ---- right: entity resolution ------------------------------------------
    d.zone("zR", 850, 70, 770, 1030, "zgrey", "Entity resolution: which kind of thing is this name?")
    d.box("q", 870, 115, 730, 80, "Ask of every name: is it a PROGRAM, a RULEBOOK, a ROLE,\nan ENGINE or LOADED CODE?", "yellow", 17)
    kinds = [("k1", "ROLE\nCompositor\ndecides who\nis on screen", "purple"),
             ("k2", "RULEBOOK\nWayland\napps and\ncompositor\ntalk by it", "orange"),
             ("k3", "PROGRAM\nGNOME Shell\nChrome\nclaude\nzsh", "blue"),
             ("k4", "ENGINE\nGJS\nruns the\nJavaScript\ninside GNOME", "teal"),
             ("k5", "LOADED CODE\nExtension\nlives inside\nGNOME Shell", "green")]
    for i, (id, text, color) in enumerate(kinds):
        d.box(id, 868 + i * 149, 220, 135, 150, text, color, 14)
    d.text("hdr2", 870, 380, "Same word, different thing (the usual confusion)", fs=18, color="#343a40", bold=True)
    d.box("w1", 870, 415, 355, 190, "The word Shell means two things\n\nzsh or bash: the command\nshell, reads what you type\n\nGNOME Shell: draws the\nwhole desktop", "pink", 16)
    d.box("w2", 1245, 415, 355, 190, "The word Extension means two things\n\nGNOME extension: code in\nGNOME Shell (ours)\n\nVS Code extension: code in\nyour editor, unrelated", "pink", 16)
    d.box("w3", 870, 625, 355, 190, "The word Terminal means four things\n\nwindow: what you see\ntab: one screen in a window\nserver: ONE process owns all\nprogram: claude or zsh inside", "pink", 16)
    d.box("w4", 1245, 625, 355, 190, "The word Session means three things\n\nlogin session: your desktop\nagent session: one id from\nClaude or OpenCode\nmonitor session: our record", "pink", 16)
    d.text("hdr3", 870, 828, "How our own code decides two things are the same one", fs=18, color="#343a40", bold=True)
    d.box("e1", 870, 862, 355, 100, "Same process?\nname plus start time,\nnever the process id alone", "green", 16)
    d.box("e2", 1245, 862, 355, 100, "Same session?\nkey = provider:session id\nfor example claude-code:04ee", "green", 16)
    d.box("e3", 870, 978, 355, 100, "Which agent in a session?\nevent has an agent field, else\nmain. OpenCode child: parentOf", "green", 16)
    d.box("e4", 1245, 978, 355, 100, "Which terminal tab?\nterminal id from the environment,\nelse match the window title", "green", 16)
    d.save()


if __name__ == "__main__":
    for fn in (d01_mind_map, d02_data_flow, d03_processes, d04_code, d05_state_machine, d06_footprint, d07_performance, d08_desktop_stack):
        fn()
    print("\n".join(warnings) if warnings else "all text fits its boxes")
    print("wrote", len(glob.glob(os.path.join(HERE, "*.svg"))), "svg and", len(glob.glob(os.path.join(HERE, "*.excalidraw"))), "excalidraw files")
