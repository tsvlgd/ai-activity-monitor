# AI Activity Monitor promo: script and storyboard

1920 x 1080, 30 fps, 1416 frames (47.2 s). Voice: `en-US-AndrewNeural` (rate +4%), generated into `voice/out/`.
Each scene lasts its clip duration plus 0.35 s; the outro gets 1.8 s more for the end card.
Word timings come from `src/timeline.json` and drive every key action through `wf(scene, word)`.

| # | Scene | Start frame | Frames | Seconds |
|---|-------|-------------|--------|---------|
| 1 | hook | 0 | 158 | 5.27 |
| 2 | problem | 158 | 168 | 5.60 |
| 3 | intro | 326 | 140 | 4.67 |
| 4 | topbar | 466 | 276 | 9.20 |
| 5 | desktop | 742 | 291 | 9.70 |
| 6 | click | 1033 | 136 | 4.53 |
| 7 | outro | 1169 | 247 | 8.23 |

Frame numbers below are local to the scene.

## 1 Hook

> You run AI coding agents in the terminal. Then you switch windows, and lose track.

* Desktop with the wallpaper and the light MacTahoe top bar (workspace pill, clock `Fri 14 Nov 20:45`, wifi, volume, battery).
* A `gnome-terminal` window (`#1C1F24`, JetBrains Mono, user palette, traffic lights) types `claude`, shows the welcome box, then types the prompt `refactor the auth module and run the tests` character by character. Tool lines stream in from frame 58.
* "switch" (84): a light browser window with a generic docs page slides in from the right and covers the terminal.
* "lose" (117): the browser blurs and a faint question mark appears where the terminal was.

## 2 Problem

> Is it still working? Does it need your approval? Did it finish, or fail? So you keep checking.

* The browser blurs behind four large state chips that pop in on their words: "Still working?" (working, 15), "Needs approval?" (waiting, 53), "Finished?" (completed, 83), "Failed?" (error, 101). Chip colours are the `.aimon-chip-*` colours.
* "keep" (130): chips fall away, the windows flicker browser, terminal, browser every 5 frames with a GNOME style Alt + Tab switcher.

## 3 Intro

> Meet AI Activity Monitor. A tiny layer on your Linux desktop.

* Soft blurred desktop. Three provider tiles pop in (3, 8, 13): Claude Code (working, bobbing), OpenCode (waiting, hopping), Codex (completed, hopping).
* The title appears word by word on "AI" (14), "Activity" (24), "Monitor" (39).
* Tagline on "A" (66); "Linux desktop" is underlined on "Linux" (94).

## 4 Top bar

> Every agent gets a live icon in the top bar, visible over any app. Working, it moves. Needs you, it turns amber. Done, it bounces.

* A maximised browser under the top bar. Three icons pop into the top bar just left of the clock on "icon" (39), with a brief highlight ring.
* "top" (57): the camera zooms 2.4x into the top bar; the page underneath softens.
* "Working" (135): Claude Code dot turns green and the icon starts the work motion (380 ms each way). Inset: `Bash(npm test)`, `Running tests…`.
* "amber" (205): OpenCode dot turns amber, the attention bounce starts, a "need you!" bubble appears under the icon and a GNOME notification drops in: "OpenCode needs your approval". Inset: permission prompt.
* "bounces" (238): Codex dot turns blue, "done!" bubble, attention bounce (170 ms hop, 460 ms bounce, 120 ms rest). Inset: `All tests passed`.

## 5 Desktop

> On an empty desktop, Claude Code, OpenCode and Codex roam around, bump into each other, and say hi. Drag one to a corner, and it stays.

* Empty desktop with the wallpaper. Tiles (84 px) pop in on their names: Claude Code (44), OpenCode (75), Codex (97).
* "roam" (112): tiles start moving. Physics is a pure function of the frame (`src/lib/sim.ts`): fixed step integration, wall reflection and elastic equal mass collisions, precomputed once and memoised. Velocities were tuned with a seeded search so the bumps land on the voice.
* Bump at 137: "hi OpenCode!" and "hey Claude!". Bump at 185: "yo Codex!" and "hey OpenCode!".
* "Drag" (209): the cursor grabs the Claude Code tile and drops it in the top right corner at 238. The tile is a fixed obstacle from then on; the others keep roaming and bounce off it.
* "stays" (255): a small "parked" label with a pin appears under it.

## 6 Click

> Click an icon to see what it is doing, and jump straight back to its terminal.

* The roaming tiles glide to a stop. The cursor clicks the OpenCode tile (8) and the preview card opens beside it (11): header icon, "OpenCode", "auth-service · 2m", chip "Working", "Running npm test", dark log box with three lines, buttons "Open in Terminal" and "Dismiss". The camera zooms 1.35x onto the card.
* "jump" (69): the cursor clicks "Open in Terminal", the card closes, the camera pulls back and the OpenCode terminal window slides to the front showing the test run.

## 7 Outro

> Small hooks send events. A GNOME extension draws them. No cloud. AI Activity Monitor.

* Flow on a soft desktop: "agent hooks" (12) to "events in memory" (26) to "GNOME extension" (54) to the three tiles (78), with animated dots on the arrows.
* "No" (107): a dark "No cloud. Everything stays local." badge.
* End card (131): the three tiles, "AI Activity Monitor" and "Linux · GNOME Shell". Held to the end. No URL.

## Audio

* Voice per scene from `public/vo/*.mp3` at full volume.
* Sound effects from `public/sfx/` (pop, click, whoosh, bump, ding) at volume 0.2 to 0.35, only when the file exists.
* Ambient bed `sfx/bed.wav` at 0.25 with a 1 s fade in and a 1.5 s fade out (prop `bedVolume`).

## Captions

Burned in, bottom centre, dark rounded pill. Pages break at sentence ends or at a comma once a page is long enough, so a page stays within two lines. The spoken word is highlighted in green; upcoming words are dimmed.

## Props

* `wallpaper`: `'user'` (default, `public/wallpaper.png`) or `'neutral'` (original look alike: light gradient with a faint wireframe box). The `PromoNeutral` composition uses `'neutral'`.
* `captions`: boolean, default true.
* `bedVolume`: number, default 0.25.
