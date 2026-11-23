#!/usr/bin/env bash
# Remove everything install.sh added, and nothing else.
#
#   scripts/uninstall.sh [--dry-run]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UUID="glanceagent@mehfooj.dev"
DATA_DIR="$HOME/.local/share/ai-activity-monitor"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
OC_PLUGIN="$HOME/.config/opencode/plugins/ai-activity-monitor.js"
SPOOL="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ai-activity-monitor"
DRY=""; [ "${1:-}" = "--dry-run" ] && DRY=1
run() { if [ -n "$DRY" ]; then echo "[dry run] $*"; else "$@"; fi; }

# Current name first, then the earlier one (ai-activity-monitor@local).
for pair in "$UUID:glanceagent" "ai-activity-monitor@local:ai-activity-monitor"; do
  id="${pair%%:*}"; key="${pair##*:}"
  current="$(gsettings get org.gnome.shell enabled-extensions)"
  if [[ "$current" == *"$id"* ]]; then
    next="$(python3 -c "import ast,sys; v=ast.literal_eval(sys.argv[1].replace('@as ','')); print(str([x for x in v if x != sys.argv[2]]))" "$current" "$id")"
    run gsettings set org.gnome.shell enabled-extensions "$next"
  fi
  dir="$HOME/.local/share/gnome-shell/extensions/$id"
  [ -d "$dir" ] && run rm -rf "$dir"
  run dconf reset -f "/org/gnome/shell/extensions/$key/"
done

if [ -f "$CLAUDE_SETTINGS" ]; then
  if [ -n "$DRY" ]; then python3 "$ROOT/scripts/claude_hooks.py" uninstall "$CLAUDE_SETTINGS" --dry-run >/dev/null && echo "[dry run] remove aimon hook entries from $CLAUDE_SETTINGS"
  else python3 "$ROOT/scripts/claude_hooks.py" uninstall "$CLAUDE_SETTINGS"; fi
fi
[ -d "$DATA_DIR" ] && run rm -rf "$DATA_DIR"
[ -f "$OC_PLUGIN" ] && run rm -f "$OC_PLUGIN"
[ -d "$SPOOL" ] && run rm -rf "$SPOOL"
echo "Uninstalled. Log out and back in to unload the extension from a running Wayland session."
