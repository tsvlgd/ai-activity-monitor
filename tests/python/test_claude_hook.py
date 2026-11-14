"""Unit tests for the Claude Code hook adapter (stdlib unittest)."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HOOK = os.path.join(ROOT, "adapters", "claude-code", "aimon_hook.py")
spec = importlib.util.spec_from_file_location("aimon_hook", HOOK)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


def p(name, **kw):
    return {"session_id": "s-1", "cwd": "/w/proj", "hook_event_name": name, **kw}


class MapEventTests(unittest.TestCase):
    def kind(self, payload):
        ev = hook.build_event(payload, now=100.0)
        return ev and ev["kind"]

    def test_lifecycle_mapping(self):
        self.assertEqual(self.kind(p("SessionStart", source="startup")), "session_start")
        self.assertEqual(self.kind(p("UserPromptSubmit", prompt="hi")), "prompt")
        self.assertEqual(self.kind(p("PreToolUse", tool_name="Bash", tool_input={"command": "ls"})), "tool_start")
        self.assertEqual(self.kind(p("PostToolUse", tool_name="Bash")), "tool_end")
        self.assertEqual(self.kind(p("PermissionRequest", tool_name="Bash", tool_input={"command": "rm x"})), "permission")
        self.assertEqual(self.kind(p("Stop")), "turn_complete")
        self.assertEqual(self.kind(p("StopFailure", error="rate_limit")), "turn_error")
        self.assertEqual(self.kind(p("SessionEnd", reason="prompt_input_exit")), "session_end")

    def test_notifications(self):
        self.assertEqual(self.kind(p("Notification", notification_type="permission_prompt", message="Claude needs permission")), "permission")
        self.assertEqual(self.kind(p("Notification", notification_type="idle_prompt")), "idle_hint")
        self.assertEqual(self.kind(p("Notification", notification_type="auth_success")), None)

    def test_subagent_stop_does_not_complete_parent(self):
        self.assertIsNone(hook.build_event(p("Stop", agent_id="a1")))
        self.assertIsNone(hook.build_event(p("SubagentStop", agent_id="a1")))

    def test_interrupt_and_tool_failure(self):
        self.assertEqual(self.kind(p("PostToolUseFailure", tool_name="Bash", error="x", is_interrupt=True)), "turn_interrupted")
        self.assertEqual(self.kind(p("PostToolUseFailure", tool_name="Bash", error="exit 1")), "tool_error")

    def test_unknown_and_invalid(self):
        self.assertIsNone(hook.build_event(p("InstructionsLoaded")))
        self.assertIsNone(hook.build_event({"hook_event_name": "Stop"}))

    def test_secrets_redacted_and_text_bounded(self):
        ev = hook.build_event(p("PreToolUse", tool_name="Bash", tool_input={"command": "curl -H 'Authorization: Bearer abc123' https://x"}))
        self.assertNotIn("abc123", ev["detail"])
        ev = hook.build_event(p("UserPromptSubmit", prompt="export API_KEY=supersecretvalue now\nline2"))
        self.assertNotIn("supersecretvalue", ev["detail"])
        self.assertNotIn("line2", ev["detail"])
        ev = hook.build_event(p("PreToolUse", tool_name="Bash", tool_input={"command": "x" * 500}))
        self.assertLessEqual(len(ev["detail"]), 120)

    def test_file_tools_show_basename_only(self):
        ev = hook.build_event(p("PreToolUse", tool_name="Edit", tool_input={"file_path": "/home/u/secret/dir/app.py", "old_string": "a"}))
        self.assertEqual(ev["detail"], "Editing app.py")


class QuestionAndHomeTests(unittest.TestCase):
    def test_ask_user_question_is_input_needed(self):
        ev = hook.build_event(p("PreToolUse", tool_name="AskUserQuestion", tool_input={"questions": [{"question": "Which DB?"}]}))
        self.assertEqual(ev["kind"], "input_needed")
        self.assertEqual(ev["detail"], "Which DB?")

    def test_home_is_shortened(self):
        home = os.path.expanduser("~")
        ev = hook.build_event(p("PreToolUse", tool_name="Bash", tool_input={"command": f"ls {home}/Dev"}))
        self.assertEqual(ev["detail"], "Running ls ~/Dev")


def _race_writer(args):
    path, n = args
    hook.append_line(path, json.dumps({"n": n, "pad": "x" * 250}) + "\n")


class ConcurrencyTests(unittest.TestCase):
    def test_no_lines_lost_when_compaction_races_with_writers(self):
        """16 writers across a compaction must lose nothing."""
        import multiprocessing as mp
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "f.jsonl")
            with open(path, "w") as fh:
                while fh.tell() < hook.MAX_SPOOL_BYTES - 3000:
                    fh.write(json.dumps({"n": -1, "pad": "x" * 250}) + "\n")
            with mp.get_context("fork").Pool(16) as pool:
                pool.map(_race_writer, [(path, n) for n in range(100)])
            seen = set()
            for line in open(path):
                seen.add(json.loads(line)["n"])
            self.assertEqual([n for n in range(100) if n not in seen], [])


class EndToEndProcessTests(unittest.TestCase):
    def run_hook(self, payload, spool):
        env = dict(os.environ, AIMON_SPOOL_DIR=spool)
        r = subprocess.run([sys.executable, HOOK], input=json.dumps(payload), capture_output=True, text=True, env=env, timeout=10)
        return r

    def test_writes_spool_silently_and_exits_zero(self):
        with tempfile.TemporaryDirectory() as d:
            spool = os.path.join(d, "spool")
            r = self.run_hook(p("SessionStart", source="startup"), spool)
            self.assertEqual(r.returncode, 0)
            self.assertEqual(r.stdout, "")
            files = sorted(os.listdir(spool))
            self.assertEqual(files, ["claude-code--s-1.jsonl", "claude-code--s-1.jsonl.lock"])
            self.assertEqual(oct(os.stat(os.path.join(spool, files[1])).st_mode & 0o777), "0o600")
            self.assertEqual(oct(os.stat(spool).st_mode & 0o777), "0o700")
            self.assertEqual(oct(os.stat(os.path.join(spool, files[0])).st_mode & 0o777), "0o600")
            line = json.loads(open(os.path.join(spool, files[0])).read().strip())
            self.assertEqual(line["kind"], "session_start")
            self.assertEqual(line["v"], 1)

    def test_garbage_input_never_fails(self):
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ, AIMON_SPOOL_DIR=d)
            r = subprocess.run([sys.executable, HOOK], input="{not json", capture_output=True, text=True, env=env, timeout=10)
            self.assertEqual(r.returncode, 0)
            self.assertEqual(r.stdout, "")

    def test_compaction_keeps_file_bounded(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "f.jsonl")
            for i in range(4000):
                hook.append_line(path, json.dumps({"i": i, "pad": "x" * 80}) + "\n")
            size = os.path.getsize(path)
            self.assertLess(size, hook.MAX_SPOOL_BYTES + 200)
            lines = open(path).read().splitlines()
            self.assertEqual(json.loads(lines[0])["i"], 0)
            self.assertEqual(json.loads(lines[-1])["i"], 3999)


if __name__ == "__main__":
    unittest.main()


class RedactionVectorTests(unittest.TestCase):
    """Shared vectors with the OpenCode adapter (tests/redaction_vectors.json)."""

    def test_shared_vectors(self):
        vectors = json.load(open(os.path.join(ROOT, "tests", "redaction_vectors.json")))
        for text, secret in vectors["leaks"]:
            self.assertNotIn(secret, hook.redact(text), text)
        self.assertEqual(hook.redact("mkdir -p build/out"), "mkdir -p build/out")
