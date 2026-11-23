#!/usr/bin/env bash
# Build one distro test image and run the end to end check inside it.
#
#   scripts/container-test.sh fedora-43        (images live in ci/containers/)
#
# Exit status is the test result. The shell log and final screenshot land in
# ci/out/<distro>/. Nothing touches the desktop this runs on.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DISTRO="${1:?usage: scripts/container-test.sh <distro> (one of: $(ls "$ROOT/ci/containers" | tr '\n' ' '))}"
[ -f "$ROOT/ci/containers/$DISTRO/Dockerfile" ] || { echo "no image definition ci/containers/$DISTRO"; exit 2; }
ENGINE="${CONTAINER_ENGINE:-docker}"
IMAGE="glanceagent-test:$DISTRO"
OUT="$ROOT/ci/out/$DISTRO"
mkdir -p "$OUT"
chmod 777 "$OUT"  # the container's test user writes results here
"$ENGINE" build -q -t "$IMAGE" "$ROOT/ci/containers/$DISTRO" >/dev/null
"$ENGINE" run --rm -v "$ROOT:/src:ro" -v "$OUT:/out" "$IMAGE" bash /src/ci/container-e2e.sh
