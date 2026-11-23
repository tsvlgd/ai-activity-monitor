#!/usr/bin/env python3
"""Claude Code hook adapter for AI Activity Monitor.

Claude Code runs this once per hook event with the event JSON on stdin.
It maps the event to the normalized schema (docs/EVENTS.md) and appends one
line to a per session spool file under $XDG_RUNTIME_DIR. It never prints to
stdout (stdout of some hooks is fed back into the model) and always exits 0
so it can never block or alter the agent.

Stdlib only. Typical run time is about 30 ms.
"""

import fcntl
import json
import os
import re
import sys
import time

PROVIDER = "claude-code"
SCHEMA_VERSION = 1
MAX_SPOOL_BYTES = 256 * 1024
KEEP_LINES = 200

# (pattern, replacement) pairs. Keep in sync with SECRET in
# adapters/opencode/ai-activity-monitor.js; shared vectors in tests/redaction_vectors.json.
SECRET_PATTERNS = [
    # Bearer first, so "Authorization: Bearer <tok>" cannot leave <tok> behind.
    (re.compile(r"(?i)\bbearer\s+\S+"), "[redacted]"),
    # NAME=value where NAME contains key, token, secret, password (OPENAI_API_KEY=...).
    (re.compile(r"(?i)\b\w*(api_?key|token|secret|passw(or)?d|passwd|credential)\w*\s*[:=]\s*\S+"), "[redacted]"),
    (re.compile(r"(?i)\b(authorization)\s*[:=]\s*\S+"), "[redacted]"),
    (re.compile(r"\b(sk|ghp|gho|ghs|github_pat|xox[bap]|glpat|AKIA)[-_]?[A-Za-z0-9_\-]{8,}"), "[redacted]"),
    # Credentials inside any URL scheme (https, postgres, mongodb, redis, ...).
    (re.compile(r"(?i)\b([a-z][a-z0-9+.\-]*://)[^\s/:@]+:[^\s/@]+@"), r"\1[redacted]@"),
    # mysql -pSECRET (no space form only, so "mkdir -p dir" is untouched).
    (re.compile(r"(?i)\b(mysql|mariadb|mysqldump|mysqladmin)\b(.*?)\s-p(?!\s)\S+"), r"\1\2 -p[redacted]"),
]


def redact(text):
    for pattern, replacement in SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


HOME = os.path.expanduser("~")


def first_line(value, limit=120):
    if not isinstance(value, str):
        return ""
    line = value.strip().splitlines()[0] if value.strip() else ""
    line = redact(line)
    if HOME and HOME != "/":
        line = line.replace(HOME, "~")
    return line if len(line) <= limit else line[: limit - 1] + "…"


def basename(path):
    return os.path.basename(path.rstrip("/")) if isinstance(path, str) and path else ""


def describe_tool(name, tool_input):
    """Short human description of a tool call. Never includes file contents."""
    ti = tool_input if isinstance(tool_input, dict) else {}
    if name == "Bash":
        desc = ti.get("description")
        cmd = first_line(ti.get("command", ""), 90)
        return f"Running {cmd}" if cmd else (first_line(desc) or "Running command")
    if name in ("Edit", "MultiEdit", "Write", "NotebookEdit"):
        target = basename(ti.get("file_path") or ti.get("notebook_path", ""))
        return f"Editing {target}" if target else "Editing file"
    if name == "Read":
        target = basename(ti.get("file_path", ""))
        return f"Reading {target}" if target else "Reading file"
    if name in ("Grep", "Glob"):
        return f"Searching {first_line(ti.get('pattern', ''), 60)}".strip()
    if name in ("WebFetch", "WebSearch"):
        url = ti.get("url") or ti.get("query", "")
        host = re.sub(r"^https?://([^/]+).*$", r"\1", url) if isinstance(url, str) else ""
        return f"Browsing {first_line(host, 60)}".strip()
    if name in ("Task", "Agent"):
        return f"Subagent: {first_line(ti.get('description', ''), 70)}".rstrip(": ")
    if name.startswith("mcp__"):
        parts = name.split("__")
        return f"MCP {parts[1]}: {parts[-1]}" if len(parts) >= 3 else name
    return f"Running {name}"


def find_agent_pid():
    """The long lived claude process is an ancestor: hook -> sh -c -> claude."""
    pid = os.getppid()
    fallback = None
    for _ in range(6):
        try:
            with open(f"/proc/{pid}/stat", "rb") as fh:
                stat = fh.read().decode("utf-8", "replace")
            comm = stat[stat.index("(") + 1 : stat.rindex(")")]
            ppid = int(stat[stat.rindex(")") + 2 :].split()[1])
        except (OSError, ValueError, IndexError):
            break
        if comm == "claude" or comm.startswith("claude"):
            return pid
        if fallback is None and comm not in ("sh", "bash", "dash", "zsh", "python3", "python"):
            fallback = pid
        if ppid <= 1:
            break
        pid = ppid
    return fallback


def terminal_info():
    env = os.environ
    info = {}
    if env.get("GNOME_TERMINAL_SCREEN"):
        info["screen"] = env["GNOME_TERMINAL_SCREEN"]
    if env.get("GNOME_TERMINAL_SERVICE"):
        info["service"] = env["GNOME_TERMINAL_SERVICE"]
    program = env.get("TERM_PROGRAM") or ("kitty" if env.get("KITTY_WINDOW_ID") else "")
    if program:
        info["program"] = program
    if env.get("WINDOWID"):
        info["window"] = env["WINDOWID"]
    return info or None


# Events where the extension must know which tab is the session's: it stays
# quiet when the user is already looking at that tab.
TITLED_KINDS = ("session_start", "prompt", "permission", "input_needed", "turn_complete", "turn_error")
TITLE_TAIL_BYTES = 64 * 1024
_AI_TITLE = re.compile(r'"type"\s*:\s*"ai-title"')


def session_title(transcript_path):
    """Latest title Claude Code shows in the terminal tab, or "".

    Claude Code appends {"type":"ai-title","aiTitle":...} records to the
    transcript and puts that text in the tab title. Only the tail is read, so
    the cost stays flat however long the transcript grows.
    """
    if not isinstance(transcript_path, str) or not transcript_path:
        return ""
    try:
        with open(transcript_path, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(0, size - TITLE_TAIL_BYTES))
            tail = fh.read().decode("utf-8", "replace")
    except OSError:
        return ""
    for line in reversed(tail.splitlines()):
        if not _AI_TITLE.search(line):
            continue
        try:
            title = json.loads(line).get("aiTitle")
        except (ValueError, AttributeError):
            continue  # the first line of the tail may be cut in half
        if isinstance(title, str) and title.strip():
            return first_line(title, 90)
    return ""


def map_event(payload):
    """Return (kind, extra) for a Claude Code hook payload, or None to skip."""
    name = payload.get("hook_event_name", "")
    sub = bool(payload.get("agent_id"))  # subagent events share the session
    tool = payload.get("tool_name", "") or ""
    tool_input = payload.get("tool_input")

    if name == "SessionStart":
        return "session_start", {"reason": payload.get("source", "")}
    if name == "UserPromptSubmit":
        return "prompt", {"detail": first_line(payload.get("prompt", ""), 140)}
    if name == "PreToolUse":
        if tool == "AskUserQuestion":
            questions = (tool_input or {}).get("questions") if isinstance(tool_input, dict) else None
            q = questions[0].get("question", "") if isinstance(questions, list) and questions and isinstance(questions[0], dict) else ""
            return "input_needed", {"tool": tool, "detail": first_line(q, 120) or "Question for you"}
        if tool == "ExitPlanMode":
            return "input_needed", {"tool": tool, "detail": "Plan ready for your review"}
        return "tool_start", {"tool": tool, "detail": describe_tool(tool, tool_input)}
    if name == "PostToolUse":
        return "tool_end", {"tool": tool}
    if name == "PostToolUseFailure":
        if payload.get("is_interrupt"):
            return "turn_interrupted", {}
        return "tool_error", {"tool": tool, "detail": f"{tool} failed: {first_line(str(payload.get('error', '')), 80)}"}
    if name == "PermissionRequest":
        return "permission", {"tool": tool, "detail": f"Approve: {describe_tool(tool, tool_input)}"}
    if name == "Notification":
        ntype = payload.get("notification_type", "")
        message = first_line(payload.get("message", ""), 120)
        if ntype in ("permission_prompt",):
            return "permission", {"detail": message or "Approval required"}
        if ntype in ("elicitation_dialog", "agent_needs_input"):
            return "input_needed", {"detail": message or "Waiting for input"}
        if ntype == "idle_prompt":
            return "idle_hint", {}
        return None
    if name == "Stop":
        return None if sub else ("turn_complete", {})
    if name == "StopFailure":
        err = payload.get("error") or payload.get("error_type") or payload.get("reason") or "unknown"
        if isinstance(err, dict):
            err = err.get("type") or err.get("message") or "unknown"
        # Observed: {"error": "model_not_found"}; values are snake_case codes.
        return "turn_error", {"detail": f"Stopped: {first_line(str(err), 80).replace('_', ' ')}"}
    if name == "PreCompact":
        return "activity", {"detail": "Compacting context"}
    if name == "SessionEnd":
        return "session_end", {"reason": payload.get("reason", "")}
    return None


def spool_dir():
    base = os.environ.get("AIMON_SPOOL_DIR")
    if not base:
        runtime = os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}"
        base = os.path.join(runtime, "ai-activity-monitor", "spool")
    os.makedirs(base, mode=0o700, exist_ok=True)
    return base


def safe_name(session):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", session)[:96]


def append_line(path, line):
    """Append one line; compact when the file grows large.

    The lock lives on a separate, never replaced ``<path>.lock`` file and the
    data file is opened only after the lock is held. Locking the data file
    itself is unsafe: compaction replaces it, so a writer waiting on the old
    inode would append to a deleted file (found by review, reproduced with
    16 concurrent writers losing about 40 percent of lines).
    """
    lock_fd = os.open(f"{path}.lock", os.O_WRONLY | os.O_CREAT, 0o600)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        try:
            os.write(fd, line.encode("utf-8"))
            size = os.fstat(fd).st_size
        finally:
            os.close(fd)
        if size > MAX_SPOOL_BYTES:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                lines = fh.readlines()
            tmp = f"{path}.tmp{os.getpid()}"
            with open(tmp, "w", encoding="utf-8") as out:
                # Keep the first line (session_start metadata) plus the tail.
                out.writelines(lines[:1] + lines[-KEEP_LINES:])
            os.chmod(tmp, 0o600)
            os.replace(tmp, path)
    finally:
        os.close(lock_fd)  # closing releases the flock


def build_event(payload, now=None):
    mapped = map_event(payload)
    session = payload.get("session_id")
    if not mapped or not isinstance(session, str) or not session:
        return None
    kind, extra = mapped
    event = {
        "v": SCHEMA_VERSION,
        "ts": round(now if now is not None else time.time(), 3),
        "provider": PROVIDER,
        "session": session,
        "kind": kind,
        "cwd": payload.get("cwd", "") if isinstance(payload.get("cwd"), str) else "",
    }
    event.update({k: v for k, v in extra.items() if v})
    # Subagent hooks share the session id; agent_id tells their prompts apart.
    if isinstance(payload.get("agent_id"), str) and payload["agent_id"]:
        event["agent"] = payload["agent_id"][:64]
    if kind in TITLED_KINDS and "agent" not in event:
        title = session_title(payload.get("transcript_path"))
        if title:
            event["title"] = title
    if kind in ("session_start", "prompt"):
        pid = find_agent_pid()
        if pid:
            event["pid"] = pid
        term = terminal_info()
        if term:
            event["term"] = term
    return event


def main():
    try:
        raw = sys.stdin.read(1024 * 1024)
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            return 0
        event = build_event(payload)
        if event is None:
            return 0
        path = os.path.join(spool_dir(), f"{PROVIDER}--{safe_name(event['session'])}.jsonl")
        append_line(path, json.dumps(event, separators=(",", ":")) + "\n")
    except Exception as exc:  # never break the agent
        if os.environ.get("AIMON_DEBUG"):
            print(f"aimon hook error: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
