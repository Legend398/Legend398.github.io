# Third-party notices

## Pacifico: Welcome lettering

The `Welcome` lettering in `public/model/welcome.glb` and
`components/hero/WelcomePath.ts` is generated from the bundled, unmodified
Pacifico typeface. `scripts/build-welcome.mjs` constructs the rounded mesh from
its glyph outlines; it does not use another portfolio's model as input.

- Copyright 2018 The Pacifico Project Authors
- Upstream: <https://github.com/googlefonts/Pacifico>
- Font source: <https://github.com/google/fonts/tree/main/ofl/pacifico>
- Bundled font: `scripts/assets/Pacifico-Regular.ttf`
- License: SIL Open Font License 1.1; full text in `scripts/assets/Pacifico-OFL.txt`
- Font SHA-256: `5b6c0d5334a7bf77dea52b975c5a0c408878c0f7115ed5b6fb151f634b7bf701`

The previously borrowed `hello` model has been removed from the source and
static export. This records the replacement's source and license, and is not a
legal opinion about unrelated assets or the portfolio as a whole.

## React Bits: Liquid Ether and Ripple Distortion

`components/effects/LiquidEther` and `components/effects/RippleDistortion` are adapted from official React Bits component sources. The portfolio adds local styling, accessibility fallbacks, lifecycle guards, and project-specific settings.

- Project: <https://www.reactbits.dev/>
- Liquid Ether: <https://www.reactbits.dev/backgrounds/liquid-ether>
- Ripple Distortion: <https://www.reactbits.dev/animations/ripple-distortion>
- Source: <https://github.com/DavidHDev/react-bits>
- Copyright: React Bits contributors
- License: MIT License with Commons Clause

The license permits use and modification in this portfolio while restricting sale of the components themselves as a product or service.

## OGL

Ripple Distortion uses OGL 1.0.11.

- Source: <https://github.com/oframe/ogl>
- License: Unlicense
