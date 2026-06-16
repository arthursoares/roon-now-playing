# Project site

Marketing + documentation site for **Roon Now Playing**, built with [Astro](https://astro.build)
and deployed to GitHub Pages at <https://arthursoares.github.io/roon-now-playing>.

## Develop

```bash
cd site
npm install
npm run dev      # http://localhost:4321/roon-now-playing
```

## Build

```bash
npm run build    # outputs to site/dist
npm run preview  # serve the production build locally
```

## Deploy

Pushed automatically by `.github/workflows/pages.yml` on changes under `site/**`.

> **One-time setup:** in the repository, set **Settings → Pages → Source = "GitHub
> Actions"**. The workflow cannot toggle this itself.

## Notes

- This is a **project page**, so `astro.config.mjs` sets `base: '/roon-now-playing'`.
  Use Astro's `<Image>` / `import.meta.env.BASE_URL` for asset and link paths so
  nothing breaks under the base path.
- Source screenshots live in `src/assets/` (optimized at build time by `astro:assets`).
  `public/og.jpg` is the social-share image; `public/favicon.svg` the icon.
- Copy is kept in sync with the root `README.md` / `CHANGELOG.md`.
