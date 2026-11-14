#!/usr/bin/env bash
# Send one command to the nested harness control channel and print its result.
#   scripts/devctl.sh state | click opencode | action Focus | shot /path.png [x y w h]
C="${AIMON_DEV_CONTROL:-${XDG_RUNTIME_DIR}/aimon-dev/control}"
before=$(wc -l < "$C.log" 2>/dev/null || echo 0)
echo "$*" >> "$C"
for _ in $(seq 1 40); do
  now=$(wc -l < "$C.log" 2>/dev/null || echo 0)
  [ "$now" -gt "$before" ] && { tail -n +"$((before + 1))" "$C.log"; exit 0; }
  sleep 0.1
done
echo '{"error":"no response"}'; exit 1
