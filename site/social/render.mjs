#!/usr/bin/env node
// Render the social images from social/template.html with headless Chrome.
// No dependencies beyond Node and a Chrome or Chromium binary.
//
//   npm run social                 # from site/, after npm install (fonts)
//   CHROME=/usr/bin/chromium npm run social
//
// Writes social/out/<name>.png and copies the OG image to public/og.png.

import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const template = pathToFileURL(join(here, 'template.html')).href;

const sizes = [
  {name: 'og-1200x630', w: 1200, h: 630},
  {name: 'github-social-1280x640', w: 1280, h: 640},
  {name: 'landscape-1200x675', w: 1200, h: 675},
  {name: 'square-1080x1080', w: 1080, h: 1080},
  {name: 'portrait-1080x1350', w: 1080, h: 1350},
];

const candidates = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
const chrome = candidates.find((c) => spawnSync(c, ['--version'], {stdio: 'ignore'}).status === 0);
if (!chrome) {
  console.error('No Chrome or Chromium found. Set CHROME=/path/to/chrome.');
  process.exit(1);
}
if (!existsSync(join(here, '..', 'node_modules', '@fontsource-variable', 'inter'))) {
  console.error('Fonts missing. Run npm install in site/ first.');
  process.exit(1);
}

// PNG width and height live at bytes 16 to 24 of the IHDR chunk.
const pngSize = (file) => {
  const b = readFileSync(file);
  return {w: b.readUInt32BE(16), h: b.readUInt32BE(20)};
};

mkdirSync(out, {recursive: true});
const profile = mkdtempSync(join(tmpdir(), 'glanceagent-social-'));
let failed = false;
try {
  for (const s of sizes) {
    const file = join(out, `${s.name}.png`);
    const r = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--allow-file-access-from-files', `--user-data-dir=${profile}`,
      '--force-device-scale-factor=1', '--force-color-profile=srgb',
      `--window-size=${s.w},${s.h}`, '--virtual-time-budget=4000',
      `--screenshot=${file}`, template,
    ], {stdio: ['ignore', 'ignore', 'pipe']});
    if (r.status !== 0 || !existsSync(file)) {
      console.error(`${s.name}: chrome failed\n${r.stderr}`);
      failed = true;
      continue;
    }
    const got = pngSize(file);
    const ok = got.w === s.w && got.h === s.h;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok  ' : 'SIZE'} ${file} ${got.w}x${got.h}`);
  }
  copyFileSync(join(out, 'og-1200x630.png'), join(here, '..', 'public', 'og.png'));
  console.log('copied og-1200x630.png to public/og.png');
} finally {
  rmSync(profile, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
