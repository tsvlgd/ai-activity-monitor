#!/usr/bin/env bash
# Lab helper for docs/GUIDE.md. Safe by design:
#   * "watch" only reads.
#   * "fake" writes events for a made up agent called "lab", never for Claude
#     or OpenCode, so you cannot confuse it with real activity.
#
#   scripts/lab.sh watch            print every real event as it arrives
#   scripts/lab.sh fake STATE       STATE is working | waiting | done | error
#   scripts/lab.sh clean            end the made up session and remove its file
#
# Set AIMON_SPOOL_DIR to use another folder (the default is the real spool).
set -euo pipefail
SPOOL="${AIMON_SPOOL_DIR:-${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ai-activity-monitor/spool}"
FILE="$SPOOL/lab--lab1.jsonl"

emit() { # emit KIND [DETAIL]  appends one normalized event line
  python3 - "$FILE" "$1" "${2:-}" <<'PY'
import json, sys, time
path, kind, detail = sys.argv[1:4]
event = {"v": 1, "ts": round(time.time(), 3), "provider": "lab", "session": "lab1", "kind": kind,
         "cwd": "/tmp/lab"}
if detail:
    event["detail"] = detail
with open(path, "a") as fh:
    fh.write(json.dumps(event) + "\n")
PY
}

case "${1:-}" in
  watch)
    echo "Watching $SPOOL (Ctrl+C to stop). Use Claude or OpenCode in another window."
    python3 -u - "$SPOOL" <<'PY'
import json, os, sys, time
spool, offsets = sys.argv[1], {}
os.makedirs(spool, mode=0o700, exist_ok=True)
for name in os.listdir(spool):                     # start from "now": skip history
    if name.endswith(".jsonl"):
        offsets[name] = os.path.getsize(os.path.join(spool, name))
while True:
    for name in sorted(os.listdir(spool)):
        if not name.endswith(".jsonl"):
            continue
        path = os.path.join(spool, name)
        size = os.path.getsize(path)
        start = offsets.get(name, 0)
        if size < start:                           # file was compacted
            start = 0
        if size > start:
            with open(path, "rb") as fh:
                fh.seek(start)
                chunk = fh.read()
            for line in chunk.decode("utf-8", "replace").splitlines():
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                print(f"{time.strftime('%H:%M:%S', time.localtime(e['ts']))}  {e['provider']:11} "
                      f"{e['session'][:8]:8}  {e['kind']:19} {e.get('detail', '')}")
        offsets[name] = size
    time.sleep(0.25)
PY
    ;;
  fake)
    mkdir -p -m 700 "$SPOOL"
    case "${2:-}" in
      working) emit session_start; emit prompt "made up prompt"; emit tool_start "Running a made up command" ;;
      waiting) emit permission "Approve: a made up edit" ;;
      done)    emit turn_complete ;;
      error)   emit turn_error "a made up error" ;;
      *) echo "usage: $0 fake working|waiting|done|error"; exit 2 ;;
    esac
    echo "wrote events for the made up agent 'lab' into $FILE"
    echo "(waiting also raises one real approval notification, that is the point of the lab)"
    ;;
  clean)
    [ -f "$FILE" ] && emit session_end "lab"
    sleep 4
    rm -f "$FILE" "$FILE.lock"
    echo "made up session ended and removed"
    ;;
  *)
    sed -n 2,14p "$0"
    exit 2
    ;;
esac
