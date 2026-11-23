#!/usr/bin/env bash
# Build one distro test image and run the end to end check inside it.
#
#   scripts/container-test.sh fedora-43        (images live in ci/containers/)
#
# Exit status is the test result (3: stopped by the disk guard). The shell log
# and final screenshot land in ci/out/<distro>/. Nothing touches the desktop
# this runs on.
#
# Disk use stays bounded: the disk guard runs before the build, the build
# cache is trimmed to 3 GB after it, and the image (1 to 4 GB) is removed when
# the run ends, pass or fail. AIMON_KEEP_IMAGES=1 keeps it, for debugging.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DISTRO="${1:?usage: scripts/container-test.sh <distro> (one of: $(ls "$ROOT/ci/containers" | tr '\n' ' '))}"
[ -f "$ROOT/ci/containers/$DISTRO/Dockerfile" ] || { echo "no image definition ci/containers/$DISTRO"; exit 2; }
ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE="glanceagent-test:$DISTRO"
OUT="$ROOT/ci/out/$DISTRO"

"$ROOT/scripts/cleanup-ci.sh" --guard

# Remove the image however the run ends, Ctrl+C included: an interrupted run
# used to leave its 1 to 4 GB image behind.
remove_image() {
  [ "${AIMON_KEEP_IMAGES:-}" = 1 ] && return 0
  # A stopped run can leave its container for a moment; only ones made from
  # our own image match this filter.
  "$ENGINE" ps -aq --filter "ancestor=$IMAGE" 2>/dev/null | xargs -r "$ENGINE" rm -f >/dev/null 2>&1 || true
  "$ENGINE" rmi "$IMAGE" >/dev/null 2>&1 || true
}
trap remove_image EXIT
trap 'exit 130' INT TERM

mkdir -p "$OUT"
chmod 777 "$OUT"  # the container's test user writes results here
# The label lets cleanup-ci.sh find our dangling layers and nobody else's.
"$ENGINE" build -q --label org.glanceagent.test=1 -t "$IMAGE" "$ROOT/ci/containers/$DISTRO" >/dev/null
if [ "$ENGINE" = docker ]; then
  docker builder prune -f --max-used-space "${AIMON_BUILD_CACHE_MAX:-3GB}" >/dev/null
fi

rc=0
"$ENGINE" run --rm -v "$ROOT:/src:ro" -v "$OUT:/out" "$IMAGE" bash /src/ci/container-e2e.sh || rc=$?

remove_image
free="$(df --output=avail -B1G "$("$ENGINE" info --format '{{.DockerRootDir}}' 2>/dev/null || echo /home)" | tail -n 1 | tr -d ' ')"
echo "== $DISTRO: $([ "$rc" = 0 ] && echo PASS || echo FAIL), ${free} GB free"
exit "$rc"
