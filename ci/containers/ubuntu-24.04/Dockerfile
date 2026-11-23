# Test image: ubuntu:24.04 with GNOME Shell, run headless.
# Built and run by scripts/container-test.sh; the repo is mounted at /src.
FROM docker.io/library/ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
# Ubuntu's shell loads the Yaru theme at startup; without it, it stops.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gnome-shell yaru-theme-gnome-shell dbus dbus-daemon dconf-cli libglib2.0-bin libgl1-mesa-dri \
        python3 python3-gi gir1.2-gtk-3.0 procps findutils tar \
    && rm -rf /var/lib/apt/lists/*
# The runner starts a system bus as root, then drops to this user: GNOME
# Shell refuses to run as root.
RUN useradd -m tester
