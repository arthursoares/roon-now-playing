// @ts-check
import { defineConfig } from 'astro/config';

// Project page on GitHub Pages → served under /roon-now-playing.
// `site` + `base` make every generated link/asset path base-aware.
export default defineConfig({
  site: 'https://arthursoares.github.io',
  base: '/roon-now-playing',
  trailingSlash: 'ignore',
});
