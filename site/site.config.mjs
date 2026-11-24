// The one place for every value that changes between deployments.
// Astro reads it in astro.config.mjs and the page reads it in src/.

export const site = {
  name: 'GlanceAgent',
  // Placeholder until a domain is chosen. Used for canonical and OG URLs.
  // Override at build time with SITE_URL (the GitHub Pages workflow does).
  url: process.env.SITE_URL || 'https://glanceagent.example',
  // Path prefix when served from a subfolder, e.g. /ai-activity-monitor/ on
  // GitHub Pages. Override with BASE_PATH.
  base: process.env.BASE_PATH || '/',
  repoUrl: 'https://github.com/tsvlgd/ai-activity-monitor',
  repoDir: 'ai-activity-monitor',
  title: 'GlanceAgent: your coding agents, at a glance',
  description:
    'A GNOME Shell extension that shows what your Claude Code and OpenCode sessions are doing as small moving icons in the top bar and on the desktop.',
  // Promo video. Leave src empty to leave the section out of the page.
  // Put the file in public/media/ and set src to 'media/<file>.mp4'.
  video: {
    src: process.env.VIDEO_SRC || '',
    poster: process.env.VIDEO_POSTER || '',
  },
};
