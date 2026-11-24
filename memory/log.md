# Log

- 2026-11-23: PR #5 merged (container tests, distro images, disk safety); Sunday plan written to memory/active-task.md
- 2026-11-23: Disk emergency (/home full from test images and 12 GB build cache); added disk guard, cache cap, per run image removal and scripts/cleanup-ci.sh (D20)
- 2026-11-23: Phase 2 done: e2e passes on GNOME 49 (Fedora 43) in Docker via scripts/container-test.sh
- 2026-11-23: Layered GNOME compatibility build agreed as the next workstream (memory/active-task.md); nothing built yet
- 2026-11-23: Presence fix and GlanceAgent rename merged to main (6baf87f, 773e916), license GPL-2.0-or-later, install migration tested in a sandbox; live desktop moved to the new UUID
- 2026-11-23: Presence fix (quiet while watching, 4 hops) built, tested (59 Node, 22 Python, 18 e2e), installed live; memory tree created; agentglance research saved (docs/research/agentglance.md)
- 2026-11-23: Promo video v2 and v3 (GlanceAgent name in video, top bar click, Chrome video beat) rendered, backed up in media/promo-video (0261226, 0d7bc8c)
- 2026-11-23: Repo now keeps only the final promo video v3 MP4; video source and other renders git ignored, kept in ~/Dev/workspace/aimon-video
- 2026-11-23: Owner kept the name GlanceAgent despite AgentGlance (macOS); AGENTS.md now requires typed branches (feat, fix, docs, ...) and Conventional Commits
- 2026-11-23: Owner standing rule: agents open the PR, review, test and merge to main themselves, and keep local main equal to origin/main (AGENTS.md Git workflow)
- 2026-11-23: PRs 1 to 3 merged: presence for detached sessions, agent merges own PRs, held icon destroyed crash fix and stress script. Blank top bar cause still unknown.
- 2026-11-24: Owner kept the real logos (D21, PR #8). Landing site and social kit started on feat/landing-site with the designer agent: Astro, React demo island on lib/core, launch posts, Pages workflow.
- 2026-11-24: Landing site approved by owner (lgtm) and merged; branch feat/landing-site kept to preserve the work. Live after Pages is enabled.
