"""scripts/cleanup-ci.sh frees only what the container tests create.

The script runs from a copy inside a throwaway folder (so its repository is
that folder), with fake docker and df commands on PATH that record every call.
Nothing real is deleted, and the tests prove what would be.
"""
import os
import shutil
import stat
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPT = os.path.join(ROOT, "scripts", "cleanup-ci.sh")

FAKE_DOCKER = r"""#!/usr/bin/env bash
echo "docker $*" >> "$STUB_LOG"
case "$1" in
  info) [ "${2:-}" = "--format" ] && echo "$STUB_ROOT"; exit 0 ;;
  ps) cat "$STUB_DIR/ps" 2>/dev/null; exit 0 ;;
  images) cat "$STUB_DIR/images"; exit 0 ;;
  builder)
    if [ "$3" = "-af" ] && [ -f "$STUB_DIR/avail_after" ]; then cp "$STUB_DIR/avail_after" "$STUB_DIR/avail"; fi
    exit 0 ;;
esac
exit 0
"""

FAKE_DF = r"""#!/usr/bin/env bash
echo "Avail"
cat "$STUB_DIR/avail"
"""


class CleanupCiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.repo = os.path.join(self.tmp, "repo")
        os.makedirs(os.path.join(self.repo, "scripts"))
        shutil.copy(SCRIPT, os.path.join(self.repo, "scripts", "cleanup-ci.sh"))
        self.stubs = os.path.join(self.tmp, "stubs")
        self.bin = os.path.join(self.tmp, "bin")
        os.makedirs(self.stubs)
        os.makedirs(self.bin)
        for name, body in (("docker", FAKE_DOCKER), ("df", FAKE_DF)):
            path = os.path.join(self.bin, name)
            with open(path, "w") as fh:
                fh.write(body)
            os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)
        self.log = os.path.join(self.tmp, "calls.log")
        self.write("images", "glanceagent-test:fedora-43 1.76GB\nglanceagent-test:ubuntu-24.04 1.18GB\n")
        self.write("avail", "20\n")

    def write(self, name, text):
        with open(os.path.join(self.stubs, name), "w") as fh:
            fh.write(text)

    def run_script(self, *args):
        env = dict(os.environ, PATH=f"{self.bin}:{os.environ['PATH']}", STUB_DIR=self.stubs,
                   STUB_LOG=self.log, STUB_ROOT=self.tmp)
        r = subprocess.run(["bash", os.path.join(self.repo, "scripts", "cleanup-ci.sh"), *args],
                           env=env, capture_output=True, text=True, timeout=30)
        calls = []
        if os.path.exists(self.log):
            with open(self.log) as fh:
                calls = fh.read().splitlines()
        return r, calls

    def assert_never_touches_others(self, calls):
        for c in calls:
            self.assertNotIn("volume", c)
            self.assertNotIn("system prune", c)
            self.assertNotIn("container prune", c)
            if c.startswith("docker rmi"):
                self.assertIn("glanceagent-test:", c)
            if c.startswith("docker image prune"):
                self.assertIn("label=org.glanceagent.test=1", c)

    def test_dry_run_removes_nothing(self):
        out = os.path.join(self.repo, "ci", "out", "arch")
        os.makedirs(out)
        for f in ("run.log", "final.png"):
            open(os.path.join(out, f), "w").close()
        r, calls = self.run_script("--dry-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("remove image glanceagent-test:fedora-43", r.stdout)
        self.assertFalse([c for c in calls if c.startswith(("docker rmi", "docker image prune", "docker builder"))])
        self.assertTrue(os.path.exists(os.path.join(out, "run.log")))
        self.assert_never_touches_others(calls)

    def test_removes_our_images_and_honours_keep(self):
        r, calls = self.run_script("--keep", "ubuntu-24.04")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("docker rmi glanceagent-test:fedora-43", calls)
        self.assertNotIn("docker rmi glanceagent-test:ubuntu-24.04", calls)
        self.assertIn("docker builder prune -f --max-used-space 3GB", calls)
        self.assert_never_touches_others(calls)

    def test_image_in_use_by_a_container_is_kept(self):
        self.write("ps", "glanceagent-test:fedora-43\n")
        _, calls = self.run_script()
        self.assertNotIn("docker rmi glanceagent-test:fedora-43", calls)
        self.assertIn("docker rmi glanceagent-test:ubuntu-24.04", calls)

    def test_output_logs_go_screenshots_stay(self):
        out = os.path.join(self.repo, "ci", "out", "arch")
        cache = os.path.join(self.repo, "tests", "__pycache__")
        os.makedirs(out)
        os.makedirs(cache)
        for f in ("run.log", "shell.log", "final.png"):
            open(os.path.join(out, f), "w").close()
        r, _ = self.run_script()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(os.listdir(out), ["final.png"])
        self.assertFalse(os.path.exists(cache))

    def test_guard_does_nothing_with_enough_space(self):
        r, calls = self.run_script("--guard")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse([c for c in calls if c.startswith(("docker rmi", "docker builder", "docker image"))])

    def test_guard_cleans_when_low_and_continues_when_that_helps(self):
        self.write("avail", "5\n")
        self.write("avail_after", "9\n")
        r, calls = self.run_script("--guard")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("docker builder prune -af", calls)
        self.assertIn("docker rmi glanceagent-test:fedora-43", calls)
        self.assert_never_touches_others(calls)

    def test_guard_stops_when_still_too_low(self):
        self.write("avail", "2\n")
        r, calls = self.run_script("--guard")
        self.assertEqual(r.returncode, 3)
        self.assertIn("below the 3 GB minimum", r.stderr)
        self.assertIn("docker builder prune -af", calls)  # it tried cleaning first
        self.assert_never_touches_others(calls)


if __name__ == "__main__":
    unittest.main()
