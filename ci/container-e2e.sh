#!/usr/bin/env bash
# Runs inside a test container: start GNOME Shell headless with GlanceAgent and
# run the end to end check. The repo is mounted read only at /src; results
# (shell log, final screenshot) go to /out when it is mounted.
set -euo pipefail
# GNOME 49 and later talk to logind over the system bus at startup, which a
# bare container lacks. Start one as root, then run the test as a normal user.
if [ "$(id -u)" = 0 ]; then
  # Package installs leave /run/systemd/seats behind although systemd is not
  # running here; GNOME takes that folder as "logind exists" and fails without
  # it. Removing it selects GNOME's own no logind fallback.
  rm -rf /run/systemd/seats
  mkdir -p /run/dbus
  dbus-daemon --system --fork
  exec runuser -u tester -- bash "$0" "$@"
fi
UUID="glanceagent@mehfooj.dev"
WORK="$HOME/glanceagent"
mkdir -p "$WORK"
tar -C /src --exclude=.git --exclude=media --exclude=node_modules -cf - . | tar -C "$WORK" -xf -
glib-compile-schemas "$WORK/extension/$UUID/schemas"

export XDG_RUNTIME_DIR="$(mktemp -d)"
# No desktop session exists in here, so the test windows may use wayland-0.
export AIMON_E2E_IN_CONTAINER=1
chmod 700 "$XDG_RUNTIME_DIR"
E2E="$XDG_RUNTIME_DIR/aimon-dev/e2e"
mkdir -p -m 700 "$E2E/spool"
LOG="$XDG_RUNTIME_DIR/aimon-dev/shell.log"
echo "== $(. /etc/os-release && echo "$PRETTY_NAME"), $(gnome-shell --version)"

AIMON_HEADLESS=1 AIMON_SPOOL_DIR="$E2E/spool" "$WORK/scripts/dev-nested.sh" 1600x900 > "$LOG" 2>&1 &
SHELL_PID=$!
finish() {
  kill "$SHELL_PID" 2>/dev/null || true
  if [ -d /out ] && [ -w /out ]; then
    cp "$LOG" /out/shell.log 2>/dev/null || true
    cp "$E2E/final.png" /out/final.png 2>/dev/null || true
  fi
}
trap finish EXIT

# The extension answers on its dev control channel once it is enabled.
ready=""
for _ in $(seq 1 90); do
  if timeout 5 "$WORK/scripts/devctl.sh" animations-on 2>/dev/null | grep -q '"enabled"'; then ready=1; break; fi
  kill -0 "$SHELL_PID" 2>/dev/null || break
  sleep 1
done
if [ -z "$ready" ]; then
  echo "FAIL: the shell or the extension did not come up. Last log lines:"
  tail -n 40 "$LOG"
  exit 1
fi
DISPLAY_NAME="$(grep -o "Using Wayland display name '[^']*'" "$LOG" | head -1 | cut -d"'" -f2)"
echo "== shell up on $DISPLAY_NAME, extension $UUID answering"
python3 -I "$WORK/tests/e2e/presence_e2e.py" "$DISPLAY_NAME"
