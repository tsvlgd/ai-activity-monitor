# Test image: debian:13 with GNOME Shell, run headless.
# Built and run by scripts/container-test.sh; the repo is mounted at /src.
FROM docker.io/library/debian:13
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        gnome-shell dbus dbus-daemon dconf-cli libglib2.0-bin libgl1-mesa-dri \
        python3 python3-gi gir1.2-gtk-3.0 procps findutils tar \
    && rm -rf /var/lib/apt/lists/*
# The runner starts a system bus as root, then drops to this user: GNOME
# Shell refuses to run as root.
RUN useradd -m tester
