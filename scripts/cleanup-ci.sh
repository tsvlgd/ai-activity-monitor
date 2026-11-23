#!/usr/bin/env bash
# Free disk space used by the container tests, and nothing else. Safe to run
# any time; running it twice does no harm.
#
#   scripts/cleanup-ci.sh [--dry-run] [--keep <distro>]... [--full]
#   scripts/cleanup-ci.sh --guard
#
# Removes only what this repository creates:
#   * images tagged glanceagent-test:<distro>, except --keep ones and any a
#     container still uses
#   * dangling image layers labelled org.glanceagent.test=1 (our rebuilds)
#   * Docker build cache above AIMON_BUILD_CACHE_MAX (default 3GB); --full
#     removes all of it. Build cache is shared by every build on this Docker
#     and cannot be filtered by project; it holds only rebuildable layers,
#     never data, so the cap is safe for other projects too
#   * logs under ci/out/*/ (each distro's final.png is kept) and __pycache__
#     folders inside this repository
# Never touches volumes, containers, other images, base images, or anything
# outside this repository.
#
# --guard checks free space on the filesystem that holds Docker's data. Under
# AIMON_DISK_CLEAN_GB (default 6) it runs a --full cleanup; if still under
# AIMON_DISK_MIN_GB (default 3) it stops with exit status 3 and a message.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${CONTAINER_ENGINE:-docker}"
REPO="glanceagent-test"
LABEL="org.glanceagent.test=1"
CACHE_MAX="${AIMON_BUILD_CACHE_MAX:-3GB}"
CLEAN_GB="${AIMON_DISK_CLEAN_GB:-6}"
MIN_GB="${AIMON_DISK_MIN_GB:-3}"
DRY=""; GUARD=""; FULL=""; KEEP=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --guard) GUARD=1 ;;
    --full) FULL=1 ;;
    --keep) shift; KEEP+=("${1:?--keep needs a distro name}") ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "cleanup-ci: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

run() { if [ -n "$DRY" ]; then echo "  [dry run] $*"; else "$@"; fi; }
have_engine() { command -v "$ENGINE" >/dev/null 2>&1 && "$ENGINE" info >/dev/null 2>&1; }

# Where Docker keeps its data (rootless Docker: under /home).
data_dir() {
  local d=""
  have_engine && d="$("$ENGINE" info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
  [ -n "$d" ] && [ -e "$d" ] && { echo "$d"; return; }
  echo /home
}
free_gb() { df --output=avail -B1G "$(data_dir)" | tail -n 1 | tr -d ' '; }

cleanup() {
  local full="$1" before after
  before="$(free_gb)"
  echo "cleanup-ci: ${before} GB free on $(data_dir) before"
  if have_engine; then
    # Our images, unless kept or in use by a container.
    local used; used="$("$ENGINE" ps -a --format '{{.Image}}' 2>/dev/null || true)"
    while read -r ref size; do
      [ -n "$ref" ] || continue
      local distro="${ref#"$REPO":}" keep=""
      for k in "${KEEP[@]}"; do [ "$k" = "$distro" ] && keep=1; done
      if [ -n "$keep" ]; then echo "  keep $ref ($size), asked to keep"; continue; fi
      if grep -qx "$ref" <<<"$used"; then echo "  keep $ref ($size), a container uses it"; continue; fi
      echo "  remove image $ref ($size)"
      run "$ENGINE" rmi "$ref" >/dev/null
    done < <("$ENGINE" images "$REPO" --format '{{.Repository}}:{{.Tag}} {{.Size}}' 2>/dev/null || true)
    # Dangling layers from our own rebuilds only (filtered by our label).
    echo "  remove dangling layers labelled $LABEL"
    run "$ENGINE" image prune -f --filter "label=$LABEL" >/dev/null
    if [ "$ENGINE" = docker ]; then
      if [ -n "$full" ]; then
        echo "  remove all build cache"
        run docker builder prune -af >/dev/null
      else
        echo "  trim build cache to $CACHE_MAX"
        run docker builder prune -f --max-used-space "$CACHE_MAX" >/dev/null
      fi
    fi
  else
    echo "  $ENGINE is not running; skipping images and build cache"
  fi
  # Test output: logs go, each distro's final screenshot stays.
  if [ -d "$ROOT/ci/out" ]; then
    while IFS= read -r f; do
      echo "  remove ${f#"$ROOT"/}"
      run rm -f "$f"
    done < <(find "$ROOT/ci/out" -type f ! -name final.png 2>/dev/null)
  fi
  while IFS= read -r d; do
    echo "  remove ${d#"$ROOT"/}"
    run rm -rf "$d"
  done < <(find "$ROOT" -name __pycache__ -type d -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null)
  after="$(free_gb)"
  if [ -n "$DRY" ]; then
    echo "cleanup-ci: dry run, nothing removed (${after} GB free)"
  else
    echo "cleanup-ci: ${after} GB free after (freed about $((after - before)) GB)"
  fi
}

if [ -n "$GUARD" ]; then
  avail="$(free_gb)"
  if [ "$avail" -ge "$CLEAN_GB" ]; then
    exit 0
  fi
  echo "disk guard: only ${avail} GB free on $(data_dir) (below ${CLEAN_GB} GB), cleaning up first"
  cleanup 1
  avail="$(free_gb)"
  if [ "$avail" -lt "$MIN_GB" ]; then
    echo "disk guard: still only ${avail} GB free on $(data_dir), below the ${MIN_GB} GB minimum." >&2
    echo "disk guard: stopping before a build fills the disk. Free space by hand, then run again." >&2
    exit 3
  fi
  exit 0
fi

cleanup "$FULL"
