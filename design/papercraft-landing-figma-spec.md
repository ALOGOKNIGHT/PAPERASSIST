# PaperCraft landing page — Figma handoff

## Design rationale

PaperCraft should feel like a considered teaching workspace, not a generic SaaS dashboard. A deep forest-to-sage canvas with restrained sand and peach light gives the page warmth, while translucent surfaces keep the interface open and layered. A serif accent makes the headline feel authored; the paper preview stays readable and familiar so the product itself remains the focus. Bento sizing, tangible exam details, and small interactions show the value before asking educators to sign up.

## Frames and responsive rules

Create three responsive page frames: **Desktop 1440 × 1000**, **Tablet 768 × 1024**, and **Mobile 375 × 812**. The page continues vertically; frame height is a viewport reference, not a clipping boundary. Use a centered content container with a 1240 px maximum width and 104 px desktop side gutters, 40 px tablet gutters, and 18 px mobile gutters.

- Desktop: hero uses two columns, 1:1; feature bento uses a 1.15:0.85 split with the first feature spanning both rows; paper formats use a 0.8:1.2 split; steps form a three-column horizontal rail.
- Tablet: retain the two-column hero and bento when the content column is at least 320 px; reduce outer gutters to 40 px. Paper format cards remain side by side if each is at least 220 px wide.
- Mobile: single-column hero, feature stack, paper-format stack, and vertical steps; navbar becomes a full-screen overlay. Keep CTA actions at least 44 px tall and preserve 18 px outer gutters.
- Section gaps: 96 px desktop, 64 px mobile. Card gaps: 16 px desktop, 10 px mobile. Use 8 px increments for spacing.
- Use content-driven heights and fixed-width preview card only within the hero visual. Avoid fixed page heights.

## Auto-layout and layer names

Build the page from editable text, vector icons, and frames. Suggested hierarchy:

```text
PaperCraft / Landing page
├── Scroll progress
├── Navigation / Desktop (sticky)
│   ├── Brand
│   ├── Nav links
│   ├── Paper modes / Mega menu
│   └── Auth actions
├── Hero / Split
│   ├── Copy / Eyebrow + headline + description + actions
│   └── Paper preview / Glass frame
│       ├── Preview mode / School · JEE · NEET
│       ├── Exam sheet / Header · Questions · Footer
│       ├── Badge / Ready to print
│       └── Badge / Live preview
├── Trust strip
├── Feature bento
│   ├── Question bank / Tall
│   ├── School templates / Wide
│   └── Paper branding / Wide
├── Paper formats / Split
│   ├── Format card / Coaching
│   └── Format card / Classroom
├── Steps / Horizontal rail
├── CTA / Glass banner
└── Footer
```

Use vertical auto-layout for page sections and card contents. Hero and format sections use horizontal auto-layout with `Fill container` columns and a 40–56 px gap. Feature Bento is a 2-column grid with 16 px gutters; the tall card spans two rows. Format cards are vertical auto-layout with 20 px padding and `Space between` content. Stepper numbers align to a 1 px rail. For mobile, switch split sections to vertical auto-layout and stack cards at full width. Keep navbar contents horizontal with `Space between`; use an overlay frame for mobile navigation.

## Text styles

| Style name | Typeface | Size / line height | Weight / tracking | Use |
|---|---|---:|---|---|
| Display / Hero | DM Sans | 76 / 78 px | 600 / -3.8 px | Main headline |
| Display / Serif accent | Instrument Serif Italic | 78 / 80 px | 400 / -1.5 px | Headline emphasis |
| Heading / Section | DM Sans | 48 / 52 px | 600 / -2 px | Section heading |
| Heading / Card | DM Sans | 20 / 26 px | 600 / -0.4 px | Feature card heading |
| Heading / Format | DM Sans | 24 / 29 px | 600 / -0.5 px | Format card heading |
| Body / Large | DM Sans | 15 / 26 px | 400 / 0 | Hero description |
| Body / Regular | DM Sans | 12 / 19 px | 400 / 0 | Card and step descriptions |
| Label / Eyebrow | DM Sans | 9 / 14 px | 700 / 2 px | Section eyebrow |
| Label / Control | DM Sans | 11 / 16 px | 600 / 0 | Buttons and navigation |
| Exam / Body | Georgia | 8 / 12 px | 400 / 0 | Small paper question text |

For mobile, Display / Hero becomes 46 / 48 px (-2.7 px tracking), Heading / Section becomes 36 / 40 px, and all body copy retains a minimum 11 px size.

## Color styles

| Style name | Value | Use |
|---|---|---|
| Canvas / Forest | `#234638` | Deep background base |
| Canvas / Green | `#345B48` | Background and glass underlay |
| Accent / Sage | `#A3B39A` | Mesh light |
| Accent / Sand | `#D8C3A0` | Primary action and headline accent |
| Accent / Peach | `#D28D68` | Warm mesh highlight |
| Text / Primary | `#F8F6EF` | Main text on dark glass |
| Text / Muted | `rgba(248,246,239,0.76)` | Supporting text on dark glass |
| Glass / Surface | `rgba(255,255,255,0.14)` | Cards and navbar |
| Glass / Strong | `rgba(255,255,255,0.22)` | CTA or emphasized surface |
| Glass / Border | `rgba(255,255,255,0.38)` | Glass outline |
| Paper / White | `#FFFDF7` | Preview sheet |
| Paper / Ink | `#363D34` | Preview sheet text |

Use a dark forest underlay behind all white text. Keep small muted copy on a surface with sufficient opacity; do not put 9–12 px text directly over bright mesh areas. Verify final text/background pairs meet WCAG AA when translating to Figma effects and overlays.

## Effect styles

| Style name | Figma effect |
|---|---|
| Glass / Navbar | Background blur 20 px; shadow 0, 12, 32, 0 at 20% forest; inner top highlight 0, 1, 0 white 48% |
| Glass / Card | Background blur 18 px; shadow 0, 22, 70, 0 at 18% forest; inner top highlight 0, 1, 0 white 48% |
| Glass / Menu | Background blur 20 px; shadow 0, 22, 70, 0 at 18% forest |
| Glass / Modal | Background blur 22 px; shadow 0, 24, 90, 0 at 30% black; 1 px white 38% stroke |
| Paper / Preview | Drop shadow 0, 25, 65, 0 at 28% forest; subtle 1 px white stroke |
| Action / Glow | Drop shadow 0, 8, 24, 0 at 24% forest; hover glow 0, 0, 24, 0 at 30% sand |

The CSS token source in `styles.css` defines the live values (`--pc-*`). `tailwind.config.ts` maps the same tokens for reuse in a Tailwind migration. Limit simultaneous background blur to the nav, hero frame, visible cards, and open menu/modal; keep grain as a single fixed overlay.

## Interaction and accessibility notes

- Paper mode segmented control switches the preview header, subject, title, sample questions, and mode badge.
- Navbar is sticky, gains frost and compacts after scroll; active link follows the visible section. Paper modes opens a keyboard reachable two-tile menu.
- Mobile hamburger morphs to close and reveals a staggered full-screen menu. Escape closes it and the paper modes menu.
- Feature and format cards use a cursor spotlight and restrained 3D tilt on pointer hover. Buttons lift on hover, move slightly toward the pointer, and press down on activation.
- Scroll reveal and step rail fill are disabled or simplified under `prefers-reduced-motion`.
- Keep visible focus rings. Use semantic nav, buttons and links, accessible names for icon-only controls, and maintain a 44 px minimum touch target in the production Figma build.
