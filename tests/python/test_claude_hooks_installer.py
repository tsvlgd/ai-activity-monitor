"""Tests for scripts/claude_hooks.py: idempotent, reversible, preserves user hooks."""

import importlib.util
import json
import os
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("claude_hooks", os.path.join(ROOT, "scripts", "claude_hooks.py"))
ch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ch)

USER = {
    "model": "opus",
    "hooks": {
        "Stop": [{"hooks": [{"type": "command", "command": "notify-send done"}]}],
        "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "guard.sh"}]}],
    },
}


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "settings.json")
        with open(self.path, "w") as fh:
            json.dump(USER, fh)

    def tearDown(self):
        self.dir.cleanup()

    def run_cli(self, *args):
        return ch.main(["claude_hooks.py", *args])

    def test_install_twice_is_idempotent_and_preserves_user_hooks(self):
        self.run_cli("install", self.path, "/x/aimon_hook.py")
        self.run_cli("install", self.path, "/x/aimon_hook.py")
        data = json.load(open(self.path))
        ours = [g for gs in data["hooks"].values() for g in gs if ch.is_ours(g)]
        self.assertEqual(len(ours), len(ch.EVENTS))
        self.assertIn(USER["hooks"]["Stop"][0], data["hooks"]["Stop"])
        self.assertIn(USER["hooks"]["PreToolUse"][0], data["hooks"]["PreToolUse"])
        self.assertEqual(data["model"], "opus")

    def test_uninstall_restores_original(self):
        self.run_cli("install", self.path, "/x/aimon_hook.py")
        self.run_cli("uninstall", self.path)
        self.assertEqual(json.load(open(self.path)), USER)

    def test_every_write_keeps_a_distinct_backup(self):
        for _ in range(3):
            self.run_cli("install", self.path, "/x/aimon_hook.py")
        backups = [f for f in os.listdir(self.dir.name) if ".aimon-backup-" in f]
        self.assertEqual(len(backups), 3)
        first = sorted(backups, key=lambda f: os.path.getmtime(os.path.join(self.dir.name, f)))[0]
        oldest = [json.load(open(os.path.join(self.dir.name, f))) for f in backups]
        self.assertIn(USER, oldest, f"original content must survive in a backup ({first})")

    def test_dry_run_writes_nothing(self):
        before = open(self.path).read()
        self.run_cli("install", self.path, "/x/aimon_hook.py", "--dry-run")
        self.assertEqual(open(self.path).read(), before)


if __name__ == "__main__":
    unittest.main()
