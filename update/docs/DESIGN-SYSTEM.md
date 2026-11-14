# Nexus Finance design system

All public pages, product views, application forms, and staff screens share these rules.

## Theme and colour

`src/nexus-tokens.css` is the source of truth. `src/index.css` exposes semantic Tailwind utilities. Use `bg-canvas`, `bg-surface`, `bg-subtle`, `text-ink`, `text-muted`, `text-brand`, `border-rule`, `bg-action`, and `text-on-action` in components.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | #F7F8FA | #0D1624 |
| Surface | #FFFFFF | #121E2E |
| Secondary surface | #EDF2F6 | #192A3E |
| Main text | #101E30 | #F3F6FA |
| Supporting text | #526174 | #B3BFD0 |
| Link / selection | #0D51B2 | #8AB8FF |
| Primary button | #0D51B2 | #0D51B2 |
| Positive status | #007B58 | #69D3B0 |

Solid primary buttons use white text in either theme. Image captions and badges use fixed light text against their dark overlay. Error and warning colours have separate semantic tokens; do not use them as decorative accents. Avoid literal hex colours in component class names.

## Typography and rhythm

Bricolage Grotesque for headings; Instrument Sans for body text and controls. Heading weights are 500, page titles 600, controls and emphasis 600, body 400. Avoid 700–900 weights. Page titles scale from 36 to 64px; marketing section titles from 30 to 50px. The homepage hero intentionally has the largest type. Monetary values use tabular numerals.

Keep a 4px spacing rhythm. Desktop content aligns to a shared container, with 48px gutters, reducing to 32px and then 20px. Main sections use 88px vertical spacing, reducing to 56px on mobile. Cards use 12px corners; buttons and form controls use 7px corners. Circular icon controls and avatar crops remain circular.

## Icons and interaction

Use the existing Phosphor icon set with regular outline weight. Most utility icons are 16–20px. Preserve filled social brand marks and rating stars where the shape is meaningful. Do not mix ornamental icon styles.

Sapphire identifies primary actions and selected controls. Emerald is reserved for positive financial/status information. Use a border or text in addition to colour to identify a state. Keep shadows subtle; do not add neon glows or blur effects. Respect reduced-motion preferences.

## Files

- `src/nexus-tokens.css`: both colour themes.
- `src/nexus-layout.css`: navigation, hero, and product layouts.
- `src/nexus-system.css`: shared type, controls, surfaces, responsive rules, footer, and partner strip.
- `src/hooks/useDialogFocus.ts`: application dialog focus handling.

## Verification

Production build, TypeScript checks, and diff whitespace checks. Browser checks covered light and dark palettes, the homepage at 320/768/1024/1440px, all major public page templates at 320px, application steps, labelled contact controls, and application keyboard focus/escape behaviour. The existing forms and staff portal remain demonstration implementations; this style pass does not add server delivery or authentication.
