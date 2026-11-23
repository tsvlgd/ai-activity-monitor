#!/usr/bin/env bash
# Run the container end to end check for several distros, one after another.
#
#   scripts/container-matrix.sh                 every image in ci/containers/
#   scripts/container-matrix.sh fedora-43 arch  just these
#
# Prints one line per distro with the result, the time and the free disk
# space after it, so a slow leak is visible. Each run goes through the disk
# guard (scripts/cleanup-ci.sh --guard); if the guard stops a run, the loop
# stops too. Full logs: ci/out/<distro>/run.log. Exit status 0 only when all
# distros passed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ $# -gt 0 ]; then DISTROS=("$@"); else mapfile -t DISTROS < <(ls "$ROOT/ci/containers"); fi
failed=0
for d in "${DISTROS[@]}"; do
  mkdir -p "$ROOT/ci/out/$d"
  start=$(date +%s)
  "$ROOT/scripts/container-test.sh" "$d" > "$ROOT/ci/out/$d/run.log" 2>&1
  rc=$?
  secs=$(( $(date +%s) - start ))
  gnome="$(grep -m1 -o 'GNOME Shell [0-9.]*' "$ROOT/ci/out/$d/run.log" || echo 'GNOME ?')"
  free="$(grep -o '[0-9]* GB free' "$ROOT/ci/out/$d/run.log" | tail -n 1)"
  case "$rc" in
    0) result=PASS ;;
    3) result=STOPPED ;;
    *) result=FAIL ;;
  esac
  printf '%-14s %-7s %4ss  %-18s %s\n' "$d" "$result" "$secs" "$gnome" "${free:-free space unknown}"
  if [ "$rc" = 3 ]; then
    grep 'disk guard' "$ROOT/ci/out/$d/run.log" | tail -n 2
    echo "stopped: not enough disk space for the remaining distros"
    exit 3
  fi
  [ "$rc" = 0 ] || failed=1
done
exit "$failed"
