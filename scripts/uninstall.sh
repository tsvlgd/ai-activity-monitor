#!/usr/bin/env bash
# Remove everything install.sh added, and nothing else.
#
#   scripts/uninstall.sh [--dry-run]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UUID="ai-activity-monitor@local"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
DATA_DIR="$HOME/.local/share/ai-activity-monitor"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
OC_PLUGIN="$HOME/.config/opencode/plugins/ai-activity-monitor.js"
SPOOL="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ai-activity-monitor"
DRY=""; [ "${1:-}" = "--dry-run" ] && DRY=1
run() { if [ -n "$DRY" ]; then echo "[dry run] $*"; else "$@"; fi; }

current="$(gsettings get org.gnome.shell enabled-extensions)"
if [[ "$current" == *"$UUID"* ]]; then
  next="$(python3 -c "import ast,sys; v=ast.literal_eval(sys.argv[1].replace('@as ','')); print(str([x for x in v if x != sys.argv[2]]))" "$current" "$UUID")"
  run gsettings set org.gnome.shell enabled-extensions "$next"
fi
[ -d "$EXT_DIR" ] && run rm -rf "$EXT_DIR"
run dconf reset -f /org/gnome/shell/extensions/ai-activity-monitor/

if [ -f "$CLAUDE_SETTINGS" ]; then
  if [ -n "$DRY" ]; then python3 "$ROOT/scripts/claude_hooks.py" uninstall "$CLAUDE_SETTINGS" --dry-run >/dev/null && echo "[dry run] remove aimon hook entries from $CLAUDE_SETTINGS"
  else python3 "$ROOT/scripts/claude_hooks.py" uninstall "$CLAUDE_SETTINGS"; fi
fi
[ -d "$DATA_DIR" ] && run rm -rf "$DATA_DIR"
[ -f "$OC_PLUGIN" ] && run rm -f "$OC_PLUGIN"
[ -d "$SPOOL" ] && run rm -rf "$SPOOL"
echo "Uninstalled. Log out and back in to unload the extension from a running Wayland session."
