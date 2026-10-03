# Portfolio design

Updated October 3, 2026.

## Hero

HELLO is a volume of individually simulated silver particles. It uses the
bundled licensed Helvetiker Bold typeface, sampled into a compact binary asset.
The browser renders points rather than a solid lettering mesh.

Cursor strokes carry nearby particles through the letter volume. Springs bring
them back to their resting positions. Moving reflections and sparse glints give
the grains a metallic finish; motion brightens the local trail. The background
retains its blue and cream lighting and falling original stickers. Background
refraction is rendered separately from the particle word.

The desktop simulation uses 65,536 points. Narrow layouts use 16,384 points and
a lower rendering budget. The scene pauses while hidden or offscreen. Reduced
motion, unavailable WebGL, or an asset failure shows the static particle SVG.
The word remains decorative; the heading and all useful content are HTML.

## Content and layout

- Present Himanshu as a software engineer working with AI agents and data.
- Explain each real project before presenting its implementation details.
- Use genuine project screenshots, the supplied portrait, and factual experience.
- Keep navigation, project links, contact information, and resume accessible.
- Use a compact hero followed by About, Work, Experience, Certifications, Contact.
- Recompose mobile content to fit the screen without horizontal overflow.

## Release checks

Validate the particle asset, malformed-asset handling, lint, TypeScript, and the
static export. Review desktop and mobile presentation, cursor response, scroll
return, and asset-failure recovery. Only `out/` is uploaded by the Pages workflow.
Development caches and local verification evidence stay outside the publication.
