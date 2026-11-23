"""Generate one voice clip per scene plus word timings (edge-tts).

Output: voice/out/<id>.mp3 and voice/out/timeline.json with each scene's
duration and word start times, used to size scenes and burn captions.
"""
import asyncio
import json
import os
import subprocess
import sys

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
TICKS = 10_000_000  # edge-tts offsets are in 100 ns units


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", path], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


async def scene(cfg, s):
    path = os.path.join(OUT, f"{s['id']}.mp3")
    comm = edge_tts.Communicate(s["text"], cfg["voice"], rate=cfg["rate"], boundary="WordBoundary")
    words = []
    with open(path, "wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"t": chunk["offset"] / TICKS, "d": chunk["duration"] / TICKS, "w": chunk["text"]})
    return {"id": s["id"], "text": s["text"], "file": f"{s['id']}.mp3", "duration": duration(path), "words": words}


async def main():
    with open(os.path.join(HERE, "script.json"), encoding="utf-8") as fh:
        cfg = json.load(fh)
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    old = {}
    if only and os.path.exists(os.path.join(OUT, "timeline.json")):
        with open(os.path.join(OUT, "timeline.json"), encoding="utf-8") as fh:
            old = {x["id"]: x for x in json.load(fh)["scenes"]}
    scenes = []
    for s in cfg["scenes"]:
        if only and s["id"] != only and s["id"] in old:
            scenes.append(old[s["id"]])
            continue
        for attempt in range(4):
            try:
                scenes.append(await scene(cfg, s))
                break
            except edge_tts.exceptions.NoAudioReceived:
                # The free service drops requests now and then; a retry succeeds.
                await asyncio.sleep(1.5 * (attempt + 1))
        else:
            raise SystemExit(f"no audio for scene {s['id']} after 4 attempts")
    with open(os.path.join(OUT, "timeline.json"), "w", encoding="utf-8") as fh:
        json.dump({"voice": cfg["voice"], "scenes": scenes}, fh, indent=1)
    total = sum(s["duration"] for s in scenes)
    for s in scenes:
        print(f"{s['id']:<8} {s['duration']:5.2f}s  {len(s['words'])} words")
    print(f"speech total {total:.1f}s")


asyncio.run(main())
