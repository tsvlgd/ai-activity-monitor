# GNOME 49 test image: Fedora 43 with GNOME Shell, run headless.
# Built and run by scripts/container-test.sh; the repo is mounted at /src.
FROM registry.fedoraproject.org/fedora:43
RUN dnf -y install --setopt=install_weak_deps=False \
        gnome-shell dbus-daemon dconf glib2 mesa-dri-drivers \
        python3 python3-gobject gtk3 procps-ng findutils tar \
    && dnf clean all
# The runner starts a system bus as root, then drops to this user: GNOME
# Shell refuses to run as root.
RUN useradd -m tester
