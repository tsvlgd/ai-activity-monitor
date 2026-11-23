#!/usr/bin/env bash
# Install AI Activity Monitor for the current user. Nothing system wide.
#
#   scripts/install.sh [--extension] [--claude] [--opencode] [--all] [--dry-run]
#
#   --extension  copy the GNOME Shell extension to ~/.local/share/gnome-shell/extensions
#                and add it to org.gnome.shell enabled-extensions (loads after the
#                next login on Wayland)
#   --claude     copy the hook to ~/.local/share/ai-activity-monitor and add hook
#                entries to ~/.claude/settings.json (backup written first)
#   --opencode   copy the plugin to ~/.config/opencode/plugins/ (takes effect when
#                the OpenCode server restarts)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UUID="glanceagent@mehfooj.dev"
SCHEMA_PATH="/org/gnome/shell/extensions/glanceagent/"
# Earlier name of this extension. An install under it is moved over once.
OLD_UUID="ai-activity-monitor@local"
OLD_SCHEMA_PATH="/org/gnome/shell/extensions/ai-activity-monitor/"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
DATA_DIR="$HOME/.local/share/ai-activity-monitor"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
OC_PLUGIN_DIR="$HOME/.config/opencode/plugins"
DRY=""; DO_EXT=""; DO_CLAUDE=""; DO_OC=""
for a in "$@"; do
  case "$a" in
    --extension) DO_EXT=1 ;; --claude) DO_CLAUDE=1 ;; --opencode) DO_OC=1 ;;
    --all) DO_EXT=1; DO_CLAUDE=1; DO_OC=1 ;; --dry-run) DRY=1 ;;
    *) echo "unknown option $a"; exit 2 ;;
  esac
done
[ -z "$DO_EXT$DO_CLAUDE$DO_OC" ] && { sed -n '2,15p' "$0"; exit 2; }
run() { if [ -n "$DRY" ]; then echo "[dry run] $*"; else "$@"; fi; }
drop_enabled() {  # remove one UUID from org.gnome.shell enabled-extensions
  local current next
  current="$(gsettings get org.gnome.shell enabled-extensions)"
  [[ "$current" == *"$1"* ]] || return 0
  next="$(python3 -c "import ast,sys; v=ast.literal_eval(sys.argv[1].replace('@as ','')); print(str([x for x in v if x != sys.argv[2]]))" "$current" "$1")"
  run gsettings set org.gnome.shell enabled-extensions "$next"
}

# The extension was renamed (new UUID and settings schema, same keys). Carry
# the user's settings over once, never over settings the new name already has,
# then retire the old copy so the shell does not load both. The old settings
# stay in dconf, untouched, as a fallback.
migrate_old_name() {
  local old_dir="$HOME/.local/share/gnome-shell/extensions/$OLD_UUID" saved
  [ -d "$old_dir" ] || [[ "$(gsettings get org.gnome.shell enabled-extensions)" == *"$OLD_UUID"* ]] || return 0
  echo "moving the earlier install ($OLD_UUID) to $UUID"
  saved="$(dconf dump "$OLD_SCHEMA_PATH")"
  if [ -n "$saved" ] && [ -z "$(dconf dump "$SCHEMA_PATH")" ]; then
    if [ -n "$DRY" ]; then echo "[dry run] copy settings $OLD_SCHEMA_PATH to $SCHEMA_PATH"
    else printf '%s\n' "$saved" | dconf load "$SCHEMA_PATH"; fi
  fi
  drop_enabled "$OLD_UUID"
  [ -d "$old_dir" ] && run rm -rf "$old_dir"
  return 0
}

if [ -n "$DO_EXT" ]; then
  echo "== GNOME Shell extension"
  run glib-compile-schemas "$ROOT/extension/$UUID/schemas"
  migrate_old_name
  # Replace, do not merge, so files removed upstream do not linger.
  [ -d "$EXT_DIR" ] && run rm -rf "$EXT_DIR"
  run mkdir -p "$EXT_DIR"
  run cp -r "$ROOT/extension/$UUID/." "$EXT_DIR/"
  current="$(gsettings get org.gnome.shell enabled-extensions)"
  if [[ "$current" != *"$UUID"* ]]; then
    echo "previous enabled-extensions: $current" | { [ -n "$DRY" ] && cat || tee "$EXT_DIR/.enabled-extensions.before"; }
    next="$(python3 -c "import ast,sys; v=ast.literal_eval(sys.argv[1].replace('@as ','')); v.append(sys.argv[2]); print(str(v))" "$current" "$UUID")"
    run gsettings set org.gnome.shell enabled-extensions "$next"
  fi
  echo "Installed to $EXT_DIR. On Wayland, log out and back in to load it."
fi

if [ -n "$DO_CLAUDE" ]; then
  echo "== Claude Code hooks"
  run mkdir -p "$DATA_DIR"
  run install -m 0755 "$ROOT/adapters/claude-code/aimon_hook.py" "$DATA_DIR/aimon_hook.py"
  if [ -n "$DRY" ]; then
    python3 "$ROOT/scripts/claude_hooks.py" install "$CLAUDE_SETTINGS" "$DATA_DIR/aimon_hook.py" --dry-run
  else
    python3 "$ROOT/scripts/claude_hooks.py" install "$CLAUDE_SETTINGS" "$DATA_DIR/aimon_hook.py"
  fi
  echo "New Claude Code sessions report activity from now on."
fi

if [ -n "$DO_OC" ]; then
  echo "== OpenCode plugin"
  run mkdir -p "$OC_PLUGIN_DIR"
  run install -m 0644 "$ROOT/adapters/opencode/ai-activity-monitor.js" "$OC_PLUGIN_DIR/ai-activity-monitor.js"
  echo "Restart the OpenCode background server (opencode serve --service) to load it."
fi
