# Test double for a terminal window (or any app window) inside the nested shell.
# argv: app_id title state_dir wayland_display (the nested one, never the host)
# Writes the pid of a child "agent" process to <state_dir>/<app_id>.pid and
# polls <state_dir>/<app_id>.title to change the window title, the way a
# terminal shows its active tab's title.
import os, subprocess, sys
if len(sys.argv) < 5 or sys.argv[4] in ("", "wayland-0"):
    sys.exit("refusing: pass the nested compositor's display, never the host's")
os.environ["WAYLAND_DISPLAY"] = sys.argv[4]
os.environ["GDK_BACKEND"] = "wayland"
os.environ.pop("DISPLAY", None)
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GLib

app_id, title, state = sys.argv[1], sys.argv[2], sys.argv[3]
GLib.set_prgname(app_id)
if not Gtk.init_check()[0]:
    sys.exit("gtk init failed")
child = subprocess.Popen(["sleep", "900"])
with open(os.path.join(state, f"{app_id}.pid"), "w") as fh:
    fh.write(str(child.pid))
win = Gtk.Window(title=title)
win.set_wmclass(app_id, app_id)
win.set_default_size(600, 400)
win.connect("destroy", lambda *_: (child.kill(), Gtk.main_quit()))
tfile = os.path.join(state, f"{app_id}.title")

def poll():
    try:
        with open(tfile) as fh:
            t = fh.read().strip()
        if t and t != win.get_title():
            win.set_title(t)
    except OSError:
        pass
    return True

GLib.timeout_add(100, poll)
win.show_all()
Gtk.main()
