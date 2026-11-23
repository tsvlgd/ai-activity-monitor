# GlanceAgent promo: script and storyboard (v3)

1920 x 1080, 30 fps, 1457 frames (48.6 s). Voice: `en-US-AndrewNeural` (rate +4%), generated into `voice/out/` (v1 clips are kept in `voice/out_v1/`).
Each voiced scene lasts its clip duration plus 0.35 s; the outro gets 1.8 s more for the end card. A silent 3 s interlude sits between the top bar and the states scene.
Word timings come from `src/timeline.json` and drive every key action through `wf(scene, word)`.

| # | Scene | Start frame | Frames | Seconds |
|---|-------|-------------|--------|---------|
| 1 | hook | 0 | 158 | 5.27 |
| 2 | problem | 158 | 168 | 5.60 |
| 3 | intro | 326 | 117 | 3.90 |
| 4 | topbar | 443 | 207 | 6.90 |
| 5 | interlude (silent) | 650 | 90 | 3.00 |
| 6 | matters | 740 | 273 | 9.10 |
| 7 | click | 1013 | 216 | 7.20 |
| 8 | outro | 1229 | 228 | 7.60 |

Frame numbers below are local to the scene.

## 1 Hook

> You run AI coding agents in the terminal. Then you switch windows, and lose track.

* Desktop with the wallpaper and the light MacTahoe top bar (workspace pill, clock `Fri 14 Nov 20:45`, wifi, volume, battery).
* A `gnome-terminal` window (`#1C1F24`, JetBrains Mono, the user's palette, traffic lights) types `claude`, shows the welcome box, then types `refactor the auth module and run the tests` character by character. Tool lines stream in from frame 58.
* "switch" (84): a light browser window with a generic docs page slides in and covers the terminal.
* "lose" (117): the browser blurs and a faint question mark appears where the terminal was.

## 2 Problem

> Is it still working? Does it need your approval? Did it finish, or fail? So you keep checking.

* Four large state chips pop in on their words: "Still working?" (15), "Needs approval?" (53), "Finished?" (83), "Failed?" (101), in the `.aimon-chip-*` colours.
* "keep" (130): the chips fall away and the windows flicker browser, terminal, browser with a GNOME style Alt + Tab switcher.

## 3 Intro

> Meet GlanceAgent. A tiny layer on your Linux desktop.

* Soft blurred desktop. Three provider tiles pop in (3, 8, 13).
* "GlanceAgent" (10): the name rises in letter by letter.
* "A" (43): the tagline fades up; "Linux desktop" is underlined on "Linux" (71).

## 4 Top bar

> Every agent gets a live icon in the top bar. Watch a video or read a blog in Chrome, and you still see it.

* A maximised browser under the light top bar, first on a docs tab. On "icon" (40) three icons pop into the top bar just left of the clock (Claude Code, OpenCode, Codex) with a brief green ring. All three show the work motion with green dots for the whole scene.
* "Watch" (89): the browser switches to its second tab, a generic video page (`video.example.net`, no real brand): a large 16:9 player with drifting soft shapes and a "Calm by default" slide, a progress bar that advances, pause, next and volume controls, the time counter, the title "Designing calm interfaces, conference talk", a channel line with a generic avatar, and an "Up next" column.
* "blog" (127): the browser switches to its third tab, a clean article "A gentle guide to Wayland" (author line, image block, paragraphs) that slowly scrolls.
* "still" (167): the camera zooms 2x toward the top bar, keeping a wide strip of the article visible beneath the three working icons.

## 5 Interlude (silent, no captions)

* Crossfades in over the last 8 frames of the top bar scene, with a whoosh.
* The empty desktop with the wallpaper. Three desktop tiles at 126 px (1.5x the v1 size) are already roaming, all working.
* Physics is a pure function of the frame (`src/lib/sim.ts`, memoised). Velocities were tuned with a seeded search so two bumps land inside the cut: Claude Code and OpenCode at frame 15 ("hi OpenCode!", "hey Claude!"), OpenCode and Codex at frame 52 ("yo Codex!", "hey OpenCode!"). Each bump has a bump sound. A new greeting replaces the tile's previous bubble.
* No cursor, no drag, no parked tile. Crossfades out under the next scene.

## 6 Matters

> When Claude Code needs your approval, it turns amber. When OpenCode asks you to pick an option, it tells you. When Codex is done, it bounces.

* Back to the zoomed top bar (2.4x). Underneath, the same video keeps playing (its clock carries on from the topbar scene), scrolled so the moving picture, the advancing progress bar and the time counter sit under the icons. All three icons start out working.
* "approval" (37): a small Claude terminal inset shows the cause (`Update(src/auth/session.ts)`, "Do you want to make this edit?").
* "amber" (74): the Claude Code dot turns amber, the attention bounce starts (170 ms hop, 460 ms bounce, 120 ms rest), a "need you!" bubble appears and a GNOME banner drops in: "Claude Code needs your approval", "Allow edit to src/auth/session.ts?".
* "asks" (122): OpenCode inset with the question and options.
* "option" (144): the OpenCode dot turns amber, attention bounce, "need you!" bubble, banner "OpenCode has a question", "Which database should we use?". The Claude bubble and banner step aside first so nothing overlaps.
* "Codex" (198): Codex inset `All tests passed`.
* "done" (214): the Codex dot turns blue (`#6688cc`), "done!" bubble, attention bounce, which is in motion as the voice says "bounces".

## 7 Click (all on top bar icons)

> Click an icon to see what it needs. Open in Terminal takes you straight to that prompt. Dismiss, and it stops bouncing.

* The zoomed top bar over the same video page, which pauses on the first click. Claude Code and OpenCode are amber and bouncing, Codex blue and bouncing.
* "icon" (10): the cursor clicks the Claude Code top bar icon (pressed highlight). The preview card drops down under the icon: Claude Code, "auth-service · 1m", chip "Needs you" in the waiting colours, "Approve: Edit session.ts", a dark log with three recent lines, buttons "Open in Terminal" and "Dismiss".
* "Open" (64): the cursor clicks "Open in Terminal", the card closes and the Claude terminal slides to the front with a Claude Code permission prompt: "Edit file src/auth/session.ts", a four line diff, "Do you want to make this edit to session.ts?" and the options "1. Yes", "2. Yes, and don't ask again this session", "3. No, and tell Claude what to do differently". The selected option pulses on "prompt" (120).
* 132: the terminal slides away. The cursor clicks the bouncing Codex icon (147); its card shows chip "Done", "All tests passed" and the test log.
* 168, just before "stops": the cursor clicks "Dismiss". The card closes, the Codex icon settles to still within 150 ms with a brief blue ring, and keeps its blue dot, while the other two keep bouncing. The cursor fades away.

## 8 Outro

> Small hooks send events. A GNOME extension draws them. No cloud. GlanceAgent.

* Flow on a soft desktop: "agent hooks" (12) to "events in memory" (26) to "GNOME extension" (54) to the three tiles (78).
* "No" (107): a dark "No cloud. Everything stays local." badge.
* End card at 131, landing on "GlanceAgent" (135): the three tiles, "GlanceAgent" and "Linux · GNOME Shell". Held to the end. No URL.

## Audio

* Voice per scene from `public/vo/*.mp3` at full volume; the interlude has no voice.
* Sound effects from `public/sfx/` (pop, click, whoosh, bump, ding) at volume 0.18 to 0.4, only when the file exists.
* Ambient bed `sfx/bed.wav` at 0.25 with a 1 s fade in and a 1.5 s fade out (prop `bedVolume`).

## Captions

Burned in, bottom centre, dark rounded pill. Pages break at sentence ends or at a comma once a page is long enough, so a page stays within two lines. The spoken word is highlighted in green. No captions in the interlude.

## Props and compositions

* `Promo`: the user's wallpaper (`public/wallpaper.png`). `PromoNeutral`: the original look alike wallpaper (light gradient with a faint wireframe box).
* `captions`: boolean, default true. `bedVolume`: number, default 0.25.
