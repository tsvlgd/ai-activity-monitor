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
UUID="ai-activity-monitor@local"
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

if [ -n "$DO_EXT" ]; then
  echo "== GNOME Shell extension"
  run glib-compile-schemas "$ROOT/extension/$UUID/schemas"
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
