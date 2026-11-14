#!/usr/bin/env python3
"""Add or remove AI Activity Monitor hook entries in a Claude Code settings file.

  claude_hooks.py install   <settings.json> <hook_script> [--dry-run]
  claude_hooks.py uninstall <settings.json> [--dry-run]
  claude_hooks.py status    <settings.json>

Only entries whose command contains MARKER are ever added or removed; every
other hook and setting is preserved byte for byte in meaning (the file is
re-serialized with 2 space indentation). A timestamped backup is written
before any change. Idempotent: installing twice does not duplicate entries.
"""

import json
import os
import shlex
import shutil
import sys
import time

MARKER = "aimon_hook.py"
EVENTS = [
    "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
    "PermissionRequest", "Notification", "Stop", "StopFailure", "PreCompact", "SessionEnd",
]
TOOL_EVENTS = {"PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest"}


def load(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    return json.loads(text) if text.strip() else {}


def is_ours(group):
    return any(MARKER in str(h.get("command", "")) for h in group.get("hooks", []) if isinstance(h, dict))


def strip(settings):
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return settings, 0
    removed = 0
    for event in list(hooks.keys()):
        groups = hooks[event]
        if not isinstance(groups, list):
            continue
        kept = [g for g in groups if not (isinstance(g, dict) and is_ours(g))]
        removed += len(groups) - len(kept)
        if kept:
            hooks[event] = kept
        else:
            del hooks[event]
    if not hooks:
        del settings["hooks"]
    return settings, removed


def add(settings, hook_script):
    settings, _ = strip(settings)
    hooks = settings.setdefault("hooks", {})
    command = {"type": "command", "command": f"python3 {shlex.quote(hook_script)}", "timeout": 5}
    for event in EVENTS:
        group = {"hooks": [dict(command)]}
        if event in TOOL_EVENTS:
            group = {"matcher": "*", "hooks": [dict(command)]}
        hooks.setdefault(event, []).append(group)
    return settings


def write(path, settings, dry_run):
    if dry_run:
        print(json.dumps(settings.get("hooks", {}), indent=2))
        return
    if os.path.exists(path):
        base = f"{path}.aimon-backup-{time.strftime('%Y%m%d-%H%M%S')}"
        backup, n = base, 1
        while os.path.exists(backup):  # never overwrite an earlier backup
            backup = f"{base}.{n}"
            n += 1
        shutil.copy2(path, backup)
        print(f"backup: {backup}")
    tmp = f"{path}.aimon-tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(settings, fh, indent=2)
        fh.write("\n")
    if os.path.exists(path):
        shutil.copymode(path, tmp)
    os.replace(tmp, path)


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    action, path = argv[1], argv[2]
    dry = "--dry-run" in argv
    settings = load(path)
    if action == "status":
        groups = [g for gs in settings.get("hooks", {}).values() if isinstance(gs, list) for g in gs if isinstance(g, dict) and is_ours(g)]
        print(f"{len(groups)} AI Activity Monitor hook entries in {path}")
        return 0
    if action == "install":
        if len(argv) < 4:
            print("install needs the hook script path")
            return 2
        write(path, add(settings, argv[3]), dry)
        print(f"installed {len(EVENTS)} hook events into {path}" + (" (dry run)" if dry else ""))
        return 0
    if action == "uninstall":
        settings, removed = strip(settings)
        write(path, settings, dry)
        print(f"removed {removed} hook entries from {path}" + (" (dry run)" if dry else ""))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
