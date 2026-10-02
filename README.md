# Himanshu Kumar — Portfolio

[View the live portfolio](https://legend398.github.io/)

A software-engineering portfolio built from verified CV and project evidence. The homepage pairs plain-language project stories and genuine product media with a rounded glass `Welcome` word powered by Three.js. The word stays sharp at rest and applies a local optical ripple only where the pointer intersects it; reduced-motion and no-WebGL sessions receive a readable static fallback.

## Run locally

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin (for example, `https://portfolio.example`) so canonical, sitemap, and social metadata use the production URL. Vercel production URLs are detected automatically.

## GitHub Pages

The `main` branch deploys automatically through `.github/workflows/deploy-pages.yml`. To validate the same static export locally:

```powershell
npm run verify:pages
```

## Rebuild the Welcome sculpture

Requires Node.js 24, matching `package.json`. The bundled Pacifico font and its
SIL OFL 1.1 license make the model reproducible without a network request:

```sh
npm run build:welcome
npm run verify:welcome
```

This regenerates both `public/model/welcome.glb` and the matching static SVG
outline in `components/hero/WelcomePath.ts`. Failed or stalled model downloads
switch to the static word after at most 10 seconds, and the page loader always
releases. Reduced-motion and no-JavaScript visitors also get the static word.

## Verify

```powershell
npx playwright install chromium
npm run verify
```

The Playwright suite checks all case-study routes, keyboard navigation, genuine project images, publishing metadata, overflow, the interactive glass-word path, offscreen pausing, reduced-motion behavior, and the no-WebGL fallback. The content source is `lib/portfolio.ts`; design, provenance, and reference boundaries are documented in `DESIGN.md`.
