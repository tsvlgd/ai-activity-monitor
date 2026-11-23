# Test image: Arch Linux (rolling, newest GNOME) with GNOME Shell, run headless.
# Built and run by scripts/container-test.sh; the repo is mounted at /src.
FROM docker.io/library/archlinux:latest
RUN pacman -Syu --noconfirm --needed \
        gnome-shell dbus dconf glib2 mesa \
        python python-gobject gtk3 procps-ng findutils tar util-linux \
    && pacman -Scc --noconfirm
# The runner starts a system bus as root, then drops to this user: GNOME
# Shell refuses to run as root.
RUN useradd -m tester
