"""install.sh moves an install made under the earlier name to the new one.

Runs the real installer in a throwaway HOME with its own dconf database and
private D-Bus, so the desktop it runs on is never touched. Skips where the
tools are missing.
"""
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OLD, NEW = "ai-activity-monitor@local", "glanceagent@mehfooj.dev"
TOOLS = ("dbus-run-session", "gsettings", "dconf", "glib-compile-schemas")

SCENARIO = r"""
set -e
gsettings set org.gnome.shell enabled-extensions "['other@x.org', '%(old)s']"
mkdir -p "$HOME/.local/share/gnome-shell/extensions/%(old)s"
dconf write /org/gnome/shell/extensions/ai-activity-monitor/edge "'top'"
dconf write /org/gnome/shell/extensions/ai-activity-monitor/icon-size 52
"$ROOT/scripts/install.sh" --extension >/dev/null
echo "enabled=$(gsettings get org.gnome.shell enabled-extensions)"
echo "edge=$(dconf read /org/gnome/shell/extensions/glanceagent/edge)"
echo "size=$(dconf read /org/gnome/shell/extensions/glanceagent/icon-size)"
echo "oldkept=$(dconf read /org/gnome/shell/extensions/ai-activity-monitor/edge)"
echo "olddir=$(test -d "$HOME/.local/share/gnome-shell/extensions/%(old)s" && echo yes || echo no)"
echo "newdir=$(test -f "$HOME/.local/share/gnome-shell/extensions/%(new)s/metadata.json" && echo yes || echo no)"
# A second run must not overwrite settings changed under the new name.
dconf write /org/gnome/shell/extensions/glanceagent/edge "'left'"
mkdir -p "$HOME/.local/share/gnome-shell/extensions/%(old)s"
"$ROOT/scripts/install.sh" --extension >/dev/null
echo "edge2=$(dconf read /org/gnome/shell/extensions/glanceagent/edge)"
""" % {"old": OLD, "new": NEW}


@unittest.skipUnless(all(shutil.which(t) for t in TOOLS), "needs dbus-run-session, gsettings, dconf")
class InstallMigrationTests(unittest.TestCase):
    def run_scenario(self):
        with tempfile.TemporaryDirectory() as home:
            env = {"PATH": os.environ["PATH"], "HOME": home, "ROOT": ROOT,
                   "XDG_CONFIG_HOME": os.path.join(home, ".config"),
                   "XDG_DATA_HOME": os.path.join(home, ".local", "share"),
                   "XDG_RUNTIME_DIR": home, "GSETTINGS_BACKEND": "dconf"}
            r = subprocess.run(["dbus-run-session", "--", "bash", "-c", SCENARIO],
                               env=env, capture_output=True, text=True, timeout=60)
            self.assertEqual(r.returncode, 0, r.stderr)
            return dict(line.split("=", 1) for line in r.stdout.splitlines() if "=" in line)

    def test_old_install_is_moved_once(self):
        out = self.run_scenario()
        self.assertIn(NEW, out["enabled"])
        self.assertIn("other@x.org", out["enabled"])  # other extensions untouched
        self.assertNotIn(OLD, out["enabled"])
        self.assertEqual(out["edge"], "'top'")
        self.assertEqual(out["size"], "52")
        self.assertEqual(out["oldkept"], "'top'")  # old settings stay as a fallback
        self.assertEqual(out["olddir"], "no")
        self.assertEqual(out["newdir"], "yes")
        self.assertEqual(out["edge2"], "'left'")  # never copied over newer settings


if __name__ == "__main__":
    unittest.main()
