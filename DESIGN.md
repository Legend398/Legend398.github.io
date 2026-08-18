# Portfolio design contract

## Status and evidence

- Status: accepted implementation spec
- Last refreshed: 2026-08-18
- Primary surfaces: homepage plus three project case studies
- Reference evidence: the live `https://haoqi.design/` DOM/network/WebGL capture, its public Codrops engineering article, the user-supplied 37.27-second screen recording, a rendered SingleFile archive, desktop/mobile motion captures, and a Playwright trace
- Accepted concepts:
  - `.omx/design-concepts/portfolio-rebuild-2026-08-18/01-desktop-hero.png`
  - `.omx/design-concepts/portfolio-rebuild-2026-08-18/02-desktop-about-work.png`
  - `.omx/design-concepts/portfolio-rebuild-2026-08-18/03-desktop-experience-contact.png`
  - `.omx/design-concepts/portfolio-rebuild-2026-08-18/04-mobile-hero-about.png`
- Local content evidence: both supplied CV PDFs, the Loop Engineering README assets, genuine Stocklane screenshots, the runnable Credit Risk Streamlit application, and the supplied portrait

The reference is a craft target, not an identity template. Transfer its restraint, readable 3D typography, cursor-local optics, stable text, and scroll rhythm. Do not copy its word, copy, stickers, palette, cursor, tunnel, project layout, or branded assets.

## Visual thesis

A warm editorial engineering portfolio built around one clear glass word: `BUILD`. The word is recognizable before its material is noticed, stays sharp at rest, and becomes softly refractive only beneath a cursor that actually intersects it. The rest of the page is deliberately quiet so the work, portrait, and experience carry the story.

## Content plan

1. Hero: exact role, `Software, AI, and data—built to be used.`, one plain explanation, the glass `BUILD`, work and résumé actions.
2. About: the real portrait, one short explanation of cross-stack work, and three unboxed practice rows.
3. Work: Loop Engineering as the wide lead, then Stocklane and Credit Risk Explorer as equal media-led entries using genuine project artifacts.
4. Experience: one concise Enlab story followed by factual education and recognition rows.
5. Contact: one human question, the email, social links, and the same `BUILD` form reused low in the composition rather than a second unrelated 3D idea.

## Interaction thesis

- Glass: sharp by default. Real mesh raycasting gates one small screen-space frost/refraction lens that appears immediately and settles within 700ms after leave. No goo, vertex pulling, page-wide trail, or whole-object pointer rotation.
- Scroll: Lenis supplies restrained smooth scrolling; native anchors and keyboard behavior remain intact. The hero word and copy lift and fade over a short exit. No snap scrolling or multi-viewport blank runway.
- Project media: image-only parallax/curl of at most a few degrees. A pointer-local dot reveal may expose a second genuine artifact. Copy, links, and card geometry never move.

## Brand and voice

- Positioning: `Software Engineer · Agentic AI Engineer · Data Science`
- Personality: technically capable, direct, curious, composed, human.
- Homepage language explains what each product does before technical proof.
- Avoid slogans that could belong to anyone, generic AI vocabulary, fake terminals, decorative metrics, inflated impact, and unverifiable claims.
- Projects demonstrate range; they do not pretend to be client work or commercial-scale systems.

## Visual system

- Palette: warm ivory `#f4f0e7`, ink `#101713`, forest `#063f32`, vermilion `#ef4e32`, rule `rgba(16,23,19,.18)`, and clear ice highlights.
- Type: Schibsted Grotesk for display/body and Azeret Mono only for compact metadata. Newsreader remains available on case-study routes but is not mixed into every homepage section.
- Header: quiet `HK / Himanshu Kumar` wordmark, plain text links, and one restrained vermilion résumé action. No pill-shaped navigation shell.
- Grid: sparse alignment guides at very low opacity. No graph-paper dashboard skin.
- Imagery: genuine Loop Engineering media, genuine Stocklane screenshots, a genuine Credit Risk application screenshot, and the supplied portrait.
- Shapes: square or softly clipped media fields; no arbitrary coral circles, polaroids, orbit scribbles, fake windows, or unrelated finale geometry.

## Layout and rhythm

- Desktop hero: about one viewport. Glass word occupies the center/right; one compact human statement may overlap its lower edge intentionally without obscuring readability.
- About: calm two-column portrait and copy, followed by three simple capability rows.
- Work: a consistent two-column visual gallery with a wide Loop lead and equal Stocklane/Credit entries.
- Experience/contact: editorial rows and hairline dividers, not card stacks.
- Total desktop page target: roughly 6–7 viewport heights with no unexplained empty viewport.
- Mobile is recomposed, not a stacked desktop runway: readable glass word, one-column project media, 72–112px section gaps, no sticky multi-viewport scenes.

### Mobile hero contract

- The phone hero is a dedicated viewport scene, not the desktop grid collapsed to one column.
- At 390px, the role begins near 80px, the three-line headline near 123px, the glass field occupies roughly 350–500px, and the intro/actions anchor the lower viewport.
- `BUILD` is nearly viewport-wide with only controlled edge bleed. WebGL and reduced-motion fallback occupy the same field; motion preference must never change composition.
- The header keeps the HK mark and name but replaces the desktop navigation with a plain two-line 44px menu target.
- Phone actions use short visible labels while preserving the full accessible names. Neither label may wrap.
- The dark About background peeks into the first viewport to signal continuity. The hero has no arbitrary fixed spacer.
- Mobile WebGL uses DPR 1, press/drag-only touch refraction, demand rendering, and a static glass fallback until the first real frame is ready.

## Glass implementation

- One beveled `TextGeometry` mesh using the bundled permitted typeface JSON.
- A two-pass render target: a small original light-field scene is drawn into an FBO while the word is excluded, then the word shader samples that texture for refraction, dispersion, and Fresnel. No copied model, texture, sticker, or shader asset.
- The main canvas remains transparent outside the mesh; DOM and CSS own page structure and accessibility.
- A global pointer sample is raycast against the word. Only a real mesh hit enables the screen-space local blur/refraction lens.
- One fixed, modest DPR; offscreen/hidden gating; demand rendering after interaction settles; CSS `BUILD` fallback for reduced motion or unavailable WebGL.

## Accessibility and performance

- WCAG 2.2 AA contrast, visible focus, semantic headings/landmarks, and at least 44px practical targets.
- Every important message is semantic DOM content; canvas is decorative.
- Reduced motion renders a static clear word and disables parallax.
- Core page remains usable without JavaScript/WebGL.
- LCP text and glass fallback render without waiting on WebGL; genuine imagery receives dimensions and appropriate priority with no layout shift.
- Target: no horizontal overflow at 390px, no console errors, no idle scene draws, and practical pointer motion on the available Intel Iris Xe test device.

## Acceptance bar

- At first glance, the hero is identified as a glass word—not a creature, knot, tube, or plastic sculpture.
- The word is crisp without pointer contact; localized blur/refraction occurs only under direct contact.
- All three projects show real and relevant imagery.
- A recruiter can explain each project after one scan.
- No repeated full-screen filler slogan and no dead scroll stage.
- Desktop and mobile each form a coherent composition with no accidental overlaps or overflow.
- Lint, typecheck, production build, targeted interaction tests, and fresh visual review pass before release.

## Open evidence boundary

- Add an Enlab product image or URL only if it is public and approved.
- Do not add location or work-mode claims until confirmed.
