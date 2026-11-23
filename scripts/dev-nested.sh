#!/usr/bin/env bash
# Run the extension in a throwaway nested GNOME Shell window.
# Uses private XDG dirs and its own D-Bus session, so the real desktop
# session, its settings and its extensions are never touched.
#
#   scripts/dev-nested.sh [WIDTHxHEIGHT]
# Env: AIMON_SPOOL_DIR  spool directory the nested extension reads
#      AIMON_DEV_DIR    throwaway state dir (default $XDG_RUNTIME_DIR/aimon-dev)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UUID="glanceagent@mehfooj.dev"
DEV="${AIMON_DEV_DIR:-${XDG_RUNTIME_DIR}/aimon-dev}"
SIZE="${1:-1600x900}"
# AIMON_HEADLESS=1 runs on a virtual monitor with no window on the host screen.
MODE="${AIMON_HEADLESS:+headless}"
# Ubuntu ships its own shell mode (dock, theme); other distros run the default.
SHELL_MODE=""
[ -f /usr/share/gnome-shell/modes/ubuntu.json ] && SHELL_MODE="--mode=ubuntu"
mkdir -p "$DEV/data/gnome-shell/extensions" "$DEV/cfg" "$DEV/cache"
ln -sfn "$ROOT/extension/$UUID" "$DEV/data/gnome-shell/extensions/$UUID"
# Mirror the real desktop look (read only): user theme extension, theme name,
# wallpaper, colour scheme and fonts. Nothing is written to the real dconf.
UT="user-theme@gnome-shell-extensions.gcampax.github.com"
[ -d "$HOME/.local/share/gnome-shell/extensions/$UT" ] && ln -sfn "$HOME/.local/share/gnome-shell/extensions/$UT" "$DEV/data/gnome-shell/extensions/$UT"
r() { dconf read "$1" 2>/dev/null || true; }
MIRROR=""
for k in /org/gnome/shell/extensions/user-theme/name \
         /org/gnome/desktop/background/picture-uri /org/gnome/desktop/background/picture-uri-dark \
         /org/gnome/desktop/background/picture-options /org/gnome/desktop/interface/color-scheme \
         /org/gnome/desktop/interface/gtk-theme /org/gnome/desktop/interface/icon-theme \
         /org/gnome/desktop/interface/font-name /org/gnome/desktop/interface/clock-show-date \
         /org/gnome/desktop/interface/clock-format /org/gnome/desktop/interface/clock-show-weekday \
         /org/gnome/shell/extensions/dash-to-dock/dock-position /org/gnome/shell/extensions/dash-to-dock/autohide \
         /org/gnome/shell/extensions/dash-to-dock/dock-fixed /org/gnome/shell/extensions/dash-to-dock/intellihide \
         /org/gnome/shell/extensions/dash-to-dock/extend-height /org/gnome/shell/extensions/dash-to-dock/dash-max-icon-size; do
  v="$(r "$k")"; [ -n "$v" ] && MIRROR+="dconf write $k \"$v\""$'\n'
done
# AIMON_EXT=0 leaves our extension disabled (used by scripts/measure.py as the baseline).
EXTS="['$UT', '$UUID']"
[ "${AIMON_EXT:-1}" = 0 ] && EXTS="['$UT']"
cat > "$DEV/run-inner.sh" <<INNER
#!/usr/bin/env bash
dconf write /org/gnome/shell/enabled-extensions "$EXTS"
$MIRROR
dconf write /org/gnome/shell/disable-extension-version-validation true
# Desktop icons would launch a helper app; keep the test shell self contained.
dconf write /org/gnome/shell/disabled-extensions "['ding@rastersoft.com']"
dconf write /org/gnome/desktop/interface/enable-animations true
dconf write /org/gnome/shell/welcome-dialog-last-shown-version "'99'"
if [ "$MODE" = headless ]; then
  exec gnome-shell --headless --wayland --no-x11 --virtual-monitor $SIZE $SHELL_MODE
fi
exec gnome-shell --nested --wayland $SHELL_MODE
INNER
chmod +x "$DEV/run-inner.sh"
# Never let anything started inside the test shell reach the real display:
# no X11 route to the host Xwayland. Apps must target the test display.
unset DISPLAY
export XDG_DATA_HOME="$DEV/data" XDG_CONFIG_HOME="$DEV/cfg" XDG_CACHE_HOME="$DEV/cache"
export MUTTER_DEBUG_DUMMY_MODE_SPECS="$SIZE"
# Test control channel (see lib/devcontrol.js). Never set in real sessions.
export AIMON_DEV_CONTROL="${AIMON_DEV_CONTROL:-$DEV/control}"
export AIMON_DEBUG=1
exec dbus-run-session -- "$DEV/run-inner.sh"
