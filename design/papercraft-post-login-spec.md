# PaperCraft post-login workspace — design handoff

## UX rationale

The first post-login view should answer two things immediately: which kind of paper can I create, and where can I resume my work? The studio home therefore contains only the two paper modes and three recent papers. Coaching and school creation then diverge into small, named steps, keeping the live paper visible beside the settings that shape it. The question bank appears once as a coaching-only destination, with drill-down by exam, subject, and chapter. The glass treatment connects the workspace to the public landing page while a dark green backing keeps text legible.

## Sitemap

```text
Paper studio (#studio)
├── Coaching paper (#coaching)
│   ├── Paper details
│   ├── Question bank (#bank)
│   └── Preview
├── School paper (#school)
│   ├── Details
│   ├── Sections
│   └── Preview
└── My papers (#drafts)
    ├── Search / filter / sort
    └── Open / duplicate / print / delete
```

The sidebar remains persistent on desktop. On mobile it becomes a slide-out drawer. The Question bank item is hidden while in the school flow. The question picker is a single coaching tab and sidebar route, not an additional section under paper details.

## Design tokens

The tokens are implemented in `styles.css` as `--pc-*` custom properties and reused by the Tailwind extension in `tailwind.config.ts`.

| Token | Value | Use |
|---|---|---|
| `--pc-forest` | `#234638` | Deep mesh base and navigation backing |
| `--pc-green` | `#345B48` | Primary workspace green |
| `--pc-sage` | `#A3B39A` | Mesh light and success accent |
| `--pc-sand` | `#D8C3A0` | Primary action and active tab |
| `--pc-peach` | `#D28D68` | Warm mesh highlight |
| `--pc-ink` | `#F8F6EF` | Main text on glass |
| `--pc-muted` | `rgba(248,246,239,.76)` | Supporting text |
| `--pc-glass` | `rgba(255,255,255,.14)` | Standard glass panel |
| `--pc-glass-strong` | `rgba(255,255,255,.22)` | Emphasized glass surface |
| `--pc-glass-border` | `rgba(255,255,255,.38)` | Glass outline |
| `--pc-blur` | `18px` | Standard surface blur |
| `--pc-radius` | `22px` | Glass card radius |
| `--pc-shadow` | `0 22px 70px rgba(20,39,29,.18)` | Glass depth |
| `--pc-highlight` | `inset 0 1px 0 rgba(255,255,255,.48)` | Top-edge glass highlight |

## Frames and responsive layout

Create **Workspace / Desktop 1440 × 1000** and **Workspace / Mobile 375 × 812**. Use an app canvas with a fixed 246 px desktop sidebar and a flexible content region. The top bar is 74 px high. Content has 64 px desktop horizontal padding and 17 px mobile padding.

- **Studio home:** vertical auto-layout; 2-column format cards; 3-column recent-paper row. Stop content after this row.
- **Coaching details:** 2-column auto-layout, approximately 1.1:0.9. Group fields inside four collapsible panels. Keep the paper preview sticky in the second column.
- **Question bank:** exam/subject controls above a 2-column chapter-browser and question-list layout. Keep a selected-question tray attached to the viewport bottom while that tab is active.
- **Preview:** center a full-size sheet with reorder controls and a print action. Hide editor controls from the printed frame.
- **School flow:** stepper-controlled details and sections panels; preview remains visible at right. The school flow contains no Question bank entry.
- **My papers:** toolbar above a 3-column grid; list variant uses a wide preview thumbnail column. Mobile collapses to one card column and turns the persistent sidebar into a drawer.
- Use content-driven height; do not clip the page to the viewport frame. Apply 8 px spacing increments. Minimum mobile action target is 44 × 44 px.

## Figma layer names

```text
Workspace / Desktop
├── App background / Mesh
├── Sidebar / Persistent
│   ├── Brand
│   ├── Workspace navigation
│   ├── Educator help card
│   └── User footer
├── Main content
│   ├── Topbar / Breadcrumb
│   ├── Studio home
│   │   ├── Page heading
│   │   ├── Paper mode card / Coaching
│   │   ├── Paper mode card / School
│   │   └── Recent papers / 3 cards
│   ├── Coaching workflow
│   │   ├── Workflow heading + autosave
│   │   ├── Tabs / Details · Questions · Preview
│   │   ├── Details / Test · Header · Content · Layout
│   │   ├── Question bank / Exam · Subject · Chapter · Questions
│   │   ├── Selected question tray
│   │   └── Paper preview
│   ├── School workflow
│   │   ├── Stepper / Details · Sections · Preview
│   │   ├── School details
│   │   ├── Section editor
│   │   └── Paper preview
│   └── My papers
│       ├── Search, filters, sort, view toggle
│       └── Saved paper cards
└── Modal / Delete confirmation
```

Use Auto Layout for all content relationships. Sidebar is vertical with a fill-height spacer before the help card and account footer. Studio cards are vertical with `Space between`; recent cards use a fixed 94 px thumbnail and flexible metadata. Details accordions are vertical; question cards use a horizontal number/content/action layout. The question list chapter column is fixed at 220 px on desktop and moves above the question list on mobile. The sticky preview tray uses horizontal Auto Layout with the primary action pinned to the trailing edge.

## Text styles

| Style | Typeface | Desktop | Mobile | Use |
|---|---|---:|---:|---|
| Page title | Instrument Serif | 48 / 52 px | 39 / 42 px | Studio and My papers headings |
| Workflow title | Instrument Serif | 34 / 38 px | 30 / 34 px | Paper steps |
| Section title | Instrument Serif | 30 / 34 px | 26 / 30 px | Recent papers and picker |
| Card title | DM Sans | 22 / 27 px | 18 / 23 px | Paper formats |
| Body / Standard | DM Sans | 12 / 19 px | 10 / 16 px | Descriptions and question metadata |
| Body / Field | DM Sans | 11 / 16 px | 10 / 15 px | Form labels and values |
| Label / Eyebrow | DM Sans | 9 / 14 px | 8 / 12 px | All caps section labels |
| Button | DM Sans | 10 / 14 px | 9 / 13 px | Actions and tabs |
| Paper / Question | Georgia | 8 / 12 px | 8 / 12 px | Exam preview |

## Color styles

- **Canvas / Forest:** `#234638`
- **Canvas / Green:** `#345B48`
- **Accent / Sage:** `#A3B39A`
- **Accent / Sand:** `#D8C3A0`
- **Accent / Warm brown:** `#8B7155`
- **Accent / Peach:** `#D28D68`
- **Text / Primary:** `#F8F6EF`
- **Text / Secondary:** `rgba(248,246,239,.76)`
- **Glass / Surface:** `rgba(255,255,255,.14)`
- **Glass / Strong:** `rgba(255,255,255,.22)`
- **Glass / Border:** `rgba(255,255,255,.38)`
- **Paper / Sheet:** `#FFFDF7`
- **Paper / Ink:** `#303930`

Use a dark green backing behind every light text layer. Keep small body text above 4.5:1 contrast by increasing surface opacity or adding a dark overlay where the mesh is bright.

## Effects

| Effect style | Settings |
|---|---|
| Glass / Sidebar | Background blur 20 px; shadow 8, 0, 35, 0 forest 12%; 1 px white 25% stroke |
| Glass / Card | Background blur 18 px; shadow 0, 18, 54, 0 forest 18%; inner top highlight white 45% |
| Glass / Dialog | Background blur 22 px; shadow 0, 24, 80, 0 black 32%; 1 px white 40% stroke |
| Preview / Paper | Drop shadow 0, 25, 65, 0 forest 29%; warm white fill |
| Action / Hover | Drop shadow 0, 12, 30, 0 forest 27%; sand edge glow 0, 0, 24, 30% |

## Component variants

- **GlassCard:** default / hover spotlight / selected gradient border.
- **Button:** primary / secondary glass / icon / loading / disabled / focus-visible.
- **Tabs:** details / questions / preview; active sliding-pill position 0, 1, 2.
- **Chip:** default / active / difficulty easy, medium, hard.
- **Modal:** confirm delete / cancel / destructive action.
- **Toast:** success / info / error.
- **Stepper:** upcoming / active / complete, horizontal desktop and vertical mobile.
- **QuestionCard:** default / added / drag target / empty results; metadata includes chapter, source, difficulty, and marks.
- **PaperPreview:** coaching / school / zoomed / expanded / print.
- **PaperCard:** grid / list / hover with Open, Duplicate, Download PDF, Delete.
- **Sidebar item:** default / hover / active / hidden for school flow.

The current app implements these screens in its existing HTML/CSS/JS structure. The source is not a Next.js/TypeScript project yet; this specification is the design handoff if the workspace is migrated to that stack.

The question-bank indicator is derived from the same array used by the picker: 272 imported JEE Main Physics questions plus 12 clearly identified demo questions for the JEE/NEET subject paths = 284 available items in the mock UI.
