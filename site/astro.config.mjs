import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
import {fileURLToPath} from 'node:url';
import {site} from './site.config.mjs';

// The demo island imports the extension's pure core (lib/core) directly, so
// the demo runs the real reducer, store, notification policy and roaming.
const core = fileURLToPath(new URL('../extension/glanceagent@mehfooj.dev/lib/core', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  site: site.url,
  base: site.base,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react()],
  vite: {
    resolve: {alias: {'@glance-core': core}},
    server: {fs: {allow: [repoRoot]}},
  },
});
