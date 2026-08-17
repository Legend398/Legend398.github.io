# Portfolio design contract

## Status and evidence

- Status: active rebuild
- Last refreshed: 2026-08-17
- Primary surfaces: homepage plus three project case studies
- Reference: `https://haoqi.design/` and the user-supplied 37.27-second screen recording
- Local evidence: current desktop/mobile captures, the Loop Engineering README assets, Stocklane screenshots, the runnable Credit Risk Streamlit application, CV/profile content, and the supplied portrait

The reference is a craft target, not an identity template. Transfer its restraint, readable 3D typography, cursor-local optics, stable text, and scroll rhythm. Do not copy its word, copy, stickers, palette, cursor, tunnel, project layout, or branded assets.

## Visual thesis

A calm ink-blue portfolio built around one clear glass word: `BUILD`. The word is recognizable before its material is noticed, stays sharp at rest, and becomes softly refractive only beneath a cursor that actually intersects it.

## Content plan

1. Hero: name and exact role, one plain-language positioning sentence, one glass word, résumé/GitHub actions.
2. About: portrait and a short explanation of how Himanshu works across software, agentic AI, and data.
3. Work: three consistent media-led project entries using genuine project artifacts.
4. Experience: one concise Enlab story followed by education and recognition.
5. Contact: one sentence, email, and social links. No second unrelated 3D scene.

## Interaction thesis

- Glass: sharp by default. Cursor intersection creates one small local frost/refraction lens that appears immediately and settles within 700ms after leave. No goo, vertex pulling, page-wide trail, or whole-object pointer rotation.
- Scroll: the hero word and copy lift and fade together over a short native-scroll exit. No scroll-jacking and no multi-viewport blank runway.
- Project media: restrained image-only depth or 1–2% scale. Copy, links, and card geometry remain stable.

## Brand and voice

- Positioning: `Software Engineer · Agentic AI Engineer · Data Science`
- Personality: technically capable, direct, curious, composed, human.
- Homepage language explains what each product does before technical proof.
- Avoid slogans that could belong to anyone, generic AI vocabulary, fake terminals, decorative metrics, inflated impact, and unverifiable claims.
- Projects demonstrate range; they do not pretend to be client work or commercial-scale systems.

## Visual system

- Palette: midnight ink, warm ivory, clear ice, and one restrained electric-blue accent.
- Type: Schibsted Grotesk for display/body and Azeret Mono only for small metadata. Newsreader remains available on editorial case-study routes but is not mixed through the homepage.
- Header: quiet wordmark and plain text links. No pill-shaped navigation shell or dominant résumé capsule.
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

## Glass implementation

- One beveled `TextGeometry` mesh using a bundled permitted typeface JSON.
- One native `MeshPhysicalMaterial`; no multi-pass Drei transmission material or post-processing blur.
- Clear transmission, low roughness, modest thickness, Fresnel/rim light, and a composed backdrop that gives the material something to refract.
- Pointer events come from the word mesh intersection. The material receives intersection UV and applies a small local roughness/refraction lens.
- `frameloop="demand"`, fixed modest DPR, visibility/offscreen gating, no continuous idle rendering, and a semantic CSS fallback for reduced motion or unavailable WebGL.

## Accessibility and performance

- WCAG 2.2 AA contrast, visible focus, semantic headings/landmarks, and at least 44px practical targets.
- Every important message is semantic DOM content; canvas is decorative.
- Reduced motion renders a static clear word and disables parallax.
- Core page remains usable without JavaScript/WebGL.
- LCP imagery receives dimensions and appropriate priority; no layout shift from media.
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
