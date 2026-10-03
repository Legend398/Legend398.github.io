# Himanshu Kumar — Portfolio

[View the live portfolio](https://legend398.github.io/)

A software-engineering portfolio built from verified CV and project evidence.
The homepage pairs project stories and product media with a volumetric HELLO
made of particles. Cursor movement carries nearby grains through the letters;
spring forces return them to their resting shape. Silver shading and sparse
highlights brighten with movement. Reduced-motion and no-WebGL
sessions receive a matching static particle illustration.

Regenerate the particle asset and fallback with `node scripts/build-hello-particles.mjs`.
The authoring script uses the bundled licensed Helvetiker typeface and Three.js;
no additional dependency or modeling application is required.
Run `node scripts/verify-hello-particles.mjs` to check the asset and decoder.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin (for example, `https://portfolio.example`) so canonical, sitemap, and social metadata use the production URL. Vercel production URLs are detected automatically.

## GitHub Pages

The `main` branch deploys automatically through `.github/workflows/deploy-pages.yml`. To validate the same static export locally:

```powershell
npm run verify:pages
```

## Verify

```powershell
npm run verify
```

The Playwright suite checks all case-study routes, keyboard navigation, genuine project images, publishing metadata, overflow, the interactive particle word, offscreen pausing, reduced-motion behavior, and the no-WebGL fallback. The content source is `lib/portfolio.ts`; current visual and interaction decisions are documented in `DESIGN.md`.
