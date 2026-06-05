export type SectionCoverage = {
  colors: number;
  typography: number;
  spacing: number;
  elevation: number;
  shapes: number;
  components: number;
  dosDonts: number;
};

export type Bundle = {
  id: string;
  num: string;
  name: string;
  tagline: string;
  description: string;
  category: "Devtools" | "Enterprise" | "Editorial" | "Marketing" | "Finance" | "Consumer";
  feel: "Dark" | "Light" | "Editorial" | "Bold" | "Playful" | "Corporate";
  palette: string[];
  coverage: number;
  sectionCoverage?: SectionCoverage;
  tokens: number;
  components: number;
  voteRate: number;
  voteCount: number;
  forks: number;
  updatedAgo: string;
  url: string;
  license: string;
  maintainer: string;
  version: string;
  worksWith: ("Claude" | "Cursor" | "Lovable" | "Figma Make")[];
  tags: string[];
  designMd: string;
  companionPrompt: string;
  scores: { label: string; score: number }[];
  /** Optional advisory shown on bundle detail when the source brand has
   * WCAG-failing contrast pairs. Format: one-line summary followed by
   * `componentPath: message` lines. Populated by the generator pipeline. */
  accessibilityNotes?: string;
  /** Companion prompt status — 'pending' when the second worker hasn't
   * finished yet, 'ready' when usable, 'failed' on error. Curated/seed
   * bundles default to 'ready'. */
  companionStatus?: 'pending' | 'ready' | 'failed';
  /** Bundle lifecycle status — 'published' is the default for curated
   * seed bundles; anonymous + freshly-generated bundles arrive as
   * 'pending_review' or 'personal'. The detail page renders a small
   * banner for non-published statuses. */
  lifecycleStatus?: 'personal' | 'pending_review' | 'published' | 'flagged' | 'rejected';
  /** Absolute URL to a square brand logo (apple-touch-icon, og:image, or favicon).
   * For user-generated bundles this is populated by the scrape pipeline from the
   * page's HTML head. For seed bundles, hand-picked from each brand's site. */
  brandLogoUrl?: string;
  /** Absolute URL to a durably-stored above-the-fold website screenshot, shown
   * as the detail-page hero. Populated by the capture-screenshot job; absent
   * until that backfill runs, in which case the hero falls back to the live
   * token-rendered PreviewPane. */
  previewImageUrl?: string;
};

const linear = `---
brand: Linear
version: 1.0.0
license: MIT
---

# ABSOLUTE CONSTRAINTS
1. Never use pure black (#000000); use #0D0E10 for deepest surface.
2. Primary accent is #5E6AD2; reserve for primary buttons, active states, focus rings.
3. Typography MUST be Inter with tight letter-spacing (-0.01em on headings).
4. All surfaces are dark by default; light mode is not part of this bundle.

# TOKEN VALUES
## Colors
- background:    #0D0E10
- surface_0:     #141518
- surface_1:     #1A1B1E
- border:        #26272B
- text_primary:  #F7F8F8
- text_muted:    #8A8F98
- accent_brand:  #5E6AD2
- accent_focus:  #7B85E0
- success:       #4CB782
- warning:       #E2A93B
- danger:        #EB5757

## Typography
- family:    Inter
- scale:     [12, 13, 14, 17, 22, 32, 48]
- weight:    { body: 400, medium: 510, strong: 600 }
- tracking:  { tight: -0.01em, default: 0, wide: 0.04em }
- leading:   { tight: 1.15, normal: 1.5, relaxed: 1.65 }

## Spacing
- base_unit: 4px
- scale:     [4, 8, 12, 16, 20, 24, 32, 48, 64]

## Radius
- xs: 4px
- sm: 6px
- md: 8px
- lg: 12px

## Elevation
- card:    "0 1px 0 #1F2024 inset, 0 8px 24px -12px #000"
- popover: "0 16px 40px -8px rgba(0,0,0,.5)"

## Motion
- base:        150ms cubic-bezier(.2,.7,.1,1)
- emphasized:  220ms cubic-bezier(.2,.7,.1,1)
- spring:      { stiffness: 320, damping: 28 }

# COMPONENT ANATOMY
## Button
- height: 28px (sm) / 32px (md) / 36px (lg)
- padding-x: 10px / 12px / 16px
- radius: md
- font-weight: 510
- primary: bg=accent_brand, fg=#FFFFFF, hover: lighten 6%
- secondary: bg=surface_1, fg=text_primary, border=border

## Input
- height: 32px
- padding-x: 10px
- background: surface_0
- border: 1px solid border
- focus: ring 2px accent_focus, border accent_brand

## Card
- background: surface_0
- border: 1px solid border
- radius: lg
- padding: 16px

# FORBIDDEN
- Rounded buttons over 8px radius
- Gradients on functional surfaces
- Sans-serif other than Inter
- Pure black or pure white text on UI chrome
`;

const stripe = `---
brand: Stripe
version: 1.0.0
license: MIT
---

# ABSOLUTE CONSTRAINTS
1. Primary brand color is #635BFF; use angled gradients with deep navy #0A2540.
2. Default surface is white #FFFFFF; secondary surface #F6F9FC.
3. Typography family is Sohne or Inter fallback with -0.012em tracking.
4. Heading scale tops at 64px; use generous leading 1.08 on display sizes.

# TOKEN VALUES
## Colors
- background:    #FFFFFF
- surface:       #F6F9FC
- text_main:     #0A2540
- text_muted:    #425466
- accent_brand:  #635BFF
- accent_alt:    #00D4FF
- accent_warm:   #FFB320
- success:       #00C853
- danger:        #FF5A5F

## Gradients
- hero:    "linear-gradient(135deg, #635BFF 0%, #00D4FF 50%, #FFB320 100%)"
- subtle:  "linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%)"

## Typography
- family:    Inter
- scale:     [13, 14, 16, 18, 24, 32, 48, 64]
- weight:    { body: 425, heading: 540, display: 600 }
- tracking:  { tight: -0.012em, default: 0 }

## Spacing
- scale: [4, 8, 12, 16, 24, 32, 48, 64, 96]

## Radius
- sm: 4px
- md: 6px
- lg: 12px
- pill: 999px

## Elevation
- soft:  "0 2px 4px rgba(50,71,92,.04), 0 6px 24px -8px rgba(50,71,92,.12)"
- raised: "0 8px 32px -8px rgba(99,91,255,.18)"

# COMPONENT ANATOMY
## Button
- height: 36px / 44px
- radius: pill
- primary: bg=accent_brand, fg=#FFFFFF
- font-weight: 540

## Card
- background: #FFFFFF
- border: 1px solid #E3E8EE
- radius: lg
- padding: 24px

# FORBIDDEN
- Black text (#000000); use text_main #0A2540
- Pure red destructive states; use #FF5A5F
- Single-stop hero backgrounds; use the gradient stack
`;

const notion = `---
brand: Notion
version: 1.0.0
license: MIT
---

# ABSOLUTE CONSTRAINTS
1. Calm, document-feel surfaces; no bright accent colors on chrome.
2. Body text uses Inter; serif (Lyon) only for marketing headlines.
3. All borders are 1px and #EDEDEC; never use shadow on document chrome.
4. Block elements use 6px radius; no rounded-full or sharp corners.

# TOKEN VALUES
## Colors
- background:    #FFFFFF
- surface:       #FBFBFA
- text_main:     #37352F
- text_muted:    #787774
- border:        #EDEDEC
- accent_brand:  #2383E2
- highlight:     #FFF2D1

## Typography
- family_body:    Inter
- family_display: Lyon Text
- scale:          [12, 13, 14, 16, 20, 28, 40]
- weight:         { body: 400, medium: 500, bold: 600 }
- leading:        { normal: 1.5, relaxed: 1.7 }

## Spacing
- scale: [2, 4, 8, 12, 16, 24, 40, 64]

## Radius
- block: 6px
- card: 6px

## Elevation
- subtle: "0 1px 2px rgba(15,15,15,.04)"
- popover: "0 4px 12px rgba(15,15,15,.08)"

# COMPONENT ANATOMY
## Button
- height: 28px
- padding-x: 8px
- radius: 6px
- ghost-first: prefer text buttons over filled

## Card
- background: surface
- border: 1px solid border
- radius: 6px

# FORBIDDEN
- Bright fills on more than one element per view
- Drop shadows on document blocks
- Headings without ample top-margin (32px minimum)
`;

const carbon = `---
brand: IBM Carbon
version: 11.42.0
license: Apache-2.0
---

# ABSOLUTE CONSTRAINTS
1. Density-first; default to 32px row height in tables.
2. Type family is IBM Plex Sans; mono is IBM Plex Mono.
3. Color palette is industrial — no rounded brand accents.
4. All interactive elements meet WCAG AA contrast minimums.

# TOKEN VALUES
## Colors
- ui_background:       #161616
- ui_01:               #262626
- ui_02:               #393939
- ui_03:               #525252
- text_primary:        #F4F4F4
- text_secondary:      #C6C6C6
- interactive_brand:   #0F62FE
- support_success:     #42BE65
- support_warning:     #F1C21B
- support_error:       #FA4D56

## Typography
- family_sans: IBM Plex Sans
- family_mono: IBM Plex Mono
- scale:       [12, 14, 16, 18, 20, 24, 32, 42]
- weight:      { regular: 400, semibold: 600 }
- tracking:    0

## Spacing (Carbon spacing tokens)
- spacing-01: 2px
- spacing-02: 4px
- spacing-03: 8px
- spacing-04: 12px
- spacing-05: 16px
- spacing-06: 24px
- spacing-07: 32px

## Radius
- always: 0px

## Motion
- productive: 110ms cubic-bezier(.2,0,.38,.9)
- expressive: 240ms cubic-bezier(.4,.14,.3,1)

# COMPONENT ANATOMY
## Button (Primary)
- height: 48px (default), 40px (field), 32px (small)
- radius: 0
- background: interactive_brand
- color: #FFFFFF

## Data Table
- row-height: 32px (compact) / 40px (default) / 48px (tall)
- zebra: false by default

# FORBIDDEN
- Border-radius > 0 on any interactive element
- Decorative gradients
- Custom font families
`;

const arc = `---
brand: Arc Browser
version: 1.0.0
license: MIT
---

# ABSOLUTE CONSTRAINTS
1. Personality-first; warm coral accent on cool dark canvas.
2. Use generous rounded corners; nothing should feel sharp.
3. Iconography is hand-drawn / playful, never sterile system glyphs.

# TOKEN VALUES
## Colors
- background:    #1A1A1A
- surface:       #232323
- text_main:     #FFFFFF
- text_muted:    #A8A8A8
- accent_coral:  #FF6E4A
- accent_warm:   #FFE5C2
- accent_cool:   #6FB1FC

## Typography
- family:  Inter
- scale:   [13, 14, 16, 18, 22, 28, 38]
- weight:  { body: 450, medium: 540 }

## Radius
- sm: 8px
- md: 12px
- lg: 16px
- pill: 999px

# COMPONENT ANATOMY
## Sidebar Tab
- radius: 8px
- height: 32px
- hover: lighten surface by 6%

## Button
- radius: pill
- weight: 540

# FORBIDDEN
- Sharp corners
- Pure neutral grays without warm cast
- Heavy borders
`;

const vercel = `---
brand: Vercel
version: 1.0.0
license: MIT
---

# ABSOLUTE CONSTRAINTS
1. Mono-first interface; default to Geist Sans + Geist Mono.
2. Color palette is monochrome; black/white with one functional accent.
3. Surfaces are flat; never use shadow elevation on chrome.

# TOKEN VALUES
## Colors
- background:    #000000
- surface_1:     #0A0A0A
- surface_2:     #111111
- border:        #1F1F1F
- text_primary:  #EAEAEA
- text_muted:    #888888
- accent_blue:   #0070F3
- success:       #0070F3
- warning:       #F5A623
- error:         #E00

## Typography
- family_sans: Geist
- family_mono: Geist Mono
- scale:       [12, 13, 14, 16, 18, 24, 32, 48]
- weight:      { regular: 400, medium: 500, semibold: 600 }

## Radius
- sm: 4px
- md: 6px
- lg: 8px

## Spacing
- scale: [2, 4, 8, 12, 16, 24, 32, 48]

# COMPONENT ANATOMY
## Button (Primary)
- bg: text_primary
- fg: background
- radius: md
- height: 32px

## Code Block
- font: family_mono
- bg: surface_2
- border: 1px solid border

# FORBIDDEN
- Decorative gradients
- Drop shadows on chrome
- Color other than accent_blue for primary action
`;

const ramp = `---
brand: Ramp
version: 1.0.0
license: MIT
---

# ABSOLUTE CONSTRAINTS
1. Fintech-warm; ochre primary on near-black surface.
2. Type is precise sans (Söhne/Inter); numbers use tabular-nums.
3. Data density is high; tables default to 36px row height.

# TOKEN VALUES
## Colors
- background:    #1B1B1B
- surface:       #232323
- text_main:     #F5F4F0
- text_muted:    #7A7975
- accent_ochre:  #FBD867
- accent_green:  #5CC689
- accent_red:    #F25C5C

## Typography
- family: Inter
- scale:  [12, 13, 14, 16, 20, 28, 40]
- weight: { body: 450, medium: 540 }
- numeric: tabular-nums

## Radius
- sm: 4px
- md: 6px

# COMPONENT ANATOMY
## Table
- row-height: 36px
- border: 1px solid #2A2A2A
- header: surface, text_muted, uppercase, 11px tracking 0.06em

## Pill (Status)
- height: 22px
- padding-x: 8px
- radius: 4px

# FORBIDDEN
- Currency without tabular-nums
- Brightening ochre beyond #FFE08A
- Rounded buttons over 6px
`;

const atlassian = `---
brand: Atlassian
version: 1.0.0
license: Apache-2.0
---

# ABSOLUTE CONSTRAINTS
1. Enterprise-blue primary (#0052CC); navy text for high contrast.
2. Component density is moderate; default 32px button height.
3. Always pair status pills with icons for accessibility.

# TOKEN VALUES
## Colors
- background:    #FAFBFC
- surface:       #FFFFFF
- text_main:     #172B4D
- text_muted:    #5E6C84
- border:        #DFE1E6
- accent_brand:  #0052CC
- accent_hover:  #0747A6
- success:       #36B37E
- warning:       #FFAB00
- danger:        #DE350B

## Typography
- family: Inter
- scale:  [12, 14, 16, 20, 24, 32]
- weight: { body: 400, medium: 500, semibold: 600 }

## Radius
- sm: 3px
- md: 4px

# COMPONENT ANATOMY
## Button (Primary)
- height: 32px
- padding-x: 12px
- radius: 4px
- background: accent_brand

## Pill
- height: 20px
- always icon + label

# FORBIDDEN
- Status pills without icons
- Rounded buttons over 6px radius
- Pure black text (#000)
`;

function makeCompanion(name: string, primaryFlavor: string): string {
  return `You are designing a UI inside the ${name} design system. Treat the attached design.md as the absolute source of truth.

# OPERATING RULES
1. Read design.md before generating any UI. If a token is missing, ask before guessing.
2. Use only tokens declared in design.md. Inline hex values, ad-hoc spacing, or new font families are violations.
3. Match the ${name} ${primaryFlavor}. Do not blend with other brand aesthetics, even if asked for variety.
4. When the user says "make a card" or "add a button", look up the component anatomy section first and use those exact specs.
5. Use mono font ONLY for code, timestamps, IDs, and tabular numeric data. Never for prose.
6. Density: respect the spacing scale exactly — do not subdivide between scale steps.

# REFUSAL CRITERIA
If the request would violate FORBIDDEN rules in design.md, explain which rule is at risk and propose a compliant alternative. Do not silently override.

# OUTPUT FORMAT
- Generate Tailwind / inline-style React that uses design.md tokens via CSS variables or direct hex.
- Annotate any deviation with a comment: // deviation: <reason>
- Surface a "coverage" note at the end: which tokens from design.md you used, which you skipped.

# CALIBRATION
Coverage target: 92%+ of declared tokens used per UI block.
When user pastes a Figma frame or screenshot, infer which tokens it maps to and report the mapping before generating.
`;
}

export const BUNDLES: Bundle[] = [
  {
    id: "linear",
    brandLogoUrl: "https://linear.app/apple-touch-icon.png",
    num: "042",
    name: "Linear",
    tagline: "Precise · dark-mode native",
    description: "Linear's dark geometric system. Engineered for high-speed product UIs with strict density, calm chrome, and a single violet accent.",
    category: "Devtools",
    feel: "Dark",
    palette: ["#5E6AD2", "#0D0E10", "#8A8F98", "#F4F4F5"],
    coverage: 98,
    tokens: 1847,
    components: 64,
    voteRate: 99,
    voteCount: 1240,
    forks: 312,
    updatedAgo: "5h ago",
    url: "linear.app",
    license: "MIT",
    maintainer: "Linear",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor", "Lovable", "Figma Make"],
    tags: ["Dashboard", "Devtools", "Dark", "Dense", "Inter"],
    sectionCoverage: { colors: 98, typography: 96, spacing: 95, elevation: 88, shapes: 92, components: 97, dosDonts: 90 },
    designMd: linear,
    companionPrompt: makeCompanion("Linear", "calm precise dark direction"),
    scores: [
      { label: "Colors", score: 98 },
      { label: "Typography", score: 96 },
      { label: "Layout & spacing", score: 95 },
      { label: "Component anatomy", score: 97 },
      { label: "Motion & feedback", score: 92 },
    ],
  },
  {
    id: "stripe",
    brandLogoUrl: "https://images.stripeassets.com/fzn2n1nzq965/4vVgZi0ZMoEzOhkcv7EVwK/8cce6fdcf2733b2ec8e99548908847ed/favicon.png?w=180&h=180",
    num: "041",
    name: "Stripe",
    tagline: "Vibrant modern finance",
    description: "Stripe's gradient-forward marketing system. Built for SaaS dashboards and high-conversion payment flows with angled hero gradients.",
    category: "Finance",
    feel: "Bold",
    palette: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320"],
    coverage: 96,
    tokens: 1532,
    components: 58,
    voteRate: 95,
    voteCount: 982,
    forks: 248,
    updatedAgo: "5h ago",
    url: "stripe.com",
    license: "MIT",
    maintainer: "Stripe",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor", "Lovable"],
    tags: ["Marketing", "Finance", "Gradient", "Bold"],
    sectionCoverage: { colors: 98, typography: 92, spacing: 90, elevation: 72, shapes: 88, components: 93, dosDonts: 86 },
    designMd: stripe,
    companionPrompt: makeCompanion("Stripe", "gradient-first marketing direction"),
    scores: [
      { label: "Colors", score: 98 },
      { label: "Typography", score: 92 },
      { label: "Layout & spacing", score: 95 },
      { label: "Component anatomy", score: 93 },
      { label: "Motion & feedback", score: 90 },
    ],
  },
  {
    id: "notion",
    brandLogoUrl: "https://www.notion.so/images/logo-ios.png",
    num: "040",
    name: "Notion",
    tagline: "Serif · calm document feel",
    description: "Notion's quiet document system. Soft borders, generous whitespace, and serif display type for marketing surfaces.",
    category: "Editorial",
    feel: "Editorial",
    palette: ["#000000", "#37352F", "#787774", "#FFFFFF"],
    coverage: 94,
    tokens: 1180,
    components: 42,
    voteRate: 94,
    voteCount: 1450,
    forks: 521,
    updatedAgo: "1d ago",
    url: "notion.so",
    license: "MIT",
    maintainer: "Notion Labs",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor", "Lovable", "Figma Make"],
    tags: ["Editorial", "Docs", "Serif", "Calm"],
    sectionCoverage: { colors: 92, typography: 98, spacing: 96, elevation: 0, shapes: 86, components: 88, dosDonts: 93 },
    designMd: notion,
    companionPrompt: makeCompanion("Notion", "quiet document direction"),
    scores: [
      { label: "Colors", score: 92 },
      { label: "Typography", score: 98 },
      { label: "Layout & spacing", score: 96 },
      { label: "Component anatomy", score: 90 },
      { label: "Motion & feedback", score: 88 },
    ],
  },
  {
    id: "carbon",
    brandLogoUrl: "https://www.ibm.com/content/dam/adobe-cms/default-images/icon-192x192.png",
    num: "039",
    name: "IBM Carbon",
    tagline: "Dense · enterprise grid",
    description: "IBM's open-source design system. Dense, accessibility-first, IBM Plex type family. The reference for enterprise software.",
    category: "Enterprise",
    feel: "Corporate",
    palette: ["#0F62FE", "#161616", "#525252", "#F4F4F4"],
    coverage: 96,
    tokens: 1842,
    components: 62,
    voteRate: 92,
    voteCount: 720,
    forks: 312,
    updatedAgo: "4d ago",
    url: "carbondesignsystem.com",
    license: "Apache-2.0",
    maintainer: "IBM",
    version: "11.42.0",
    worksWith: ["Claude", "Cursor"],
    tags: ["Enterprise", "Dashboards", "WCAG AA", "High-density", "Open source"],
    sectionCoverage: { colors: 96, typography: 98, spacing: 97, elevation: 94, shapes: 100, components: 99, dosDonts: 95 },
    designMd: carbon,
    companionPrompt: makeCompanion("IBM Carbon", "industrial enterprise direction"),
    scores: [
      { label: "Colors", score: 96 },
      { label: "Typography", score: 98 },
      { label: "Layout & spacing", score: 97 },
      { label: "Component anatomy", score: 99 },
      { label: "Motion & feedback", score: 94 },
    ],
  },
  {
    id: "arc",
    brandLogoUrl: "https://arc.net/favicon.png",
    num: "038",
    name: "Arc Browser",
    tagline: "Playful · warm coral",
    description: "Arc Browser's personality-first system. Warm coral accents on cool dark canvas with generous radii and hand-drawn iconography.",
    category: "Consumer",
    feel: "Playful",
    palette: ["#FF6E4A", "#1A1A1A", "#FFE5C2", "#FFFFFF"],
    coverage: 89,
    tokens: 1024,
    components: 38,
    voteRate: 89,
    voteCount: 612,
    forks: 198,
    updatedAgo: "1w ago",
    url: "arc.net",
    license: "MIT",
    maintainer: "The Browser Company",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor", "Lovable"],
    tags: ["Consumer", "Playful", "Warm", "Rounded"],
    sectionCoverage: { colors: 90, typography: 78, spacing: 72, elevation: 60, shapes: 95, components: 80, dosDonts: 65 },
    designMd: arc,
    companionPrompt: makeCompanion("Arc Browser", "warm playful direction"),
    scores: [
      { label: "Colors", score: 90 },
      { label: "Typography", score: 86 },
      { label: "Layout & spacing", score: 88 },
      { label: "Component anatomy", score: 87 },
      { label: "Motion & feedback", score: 95 },
    ],
  },
  {
    id: "vercel",
    brandLogoUrl: "https://vercel.com/apple-touch-icon.png",
    num: "037",
    name: "Vercel",
    tagline: "Mono · devtools minimal",
    description: "Vercel's monochrome devtools system. Geist sans + mono, single functional accent, zero decorative gradients.",
    category: "Devtools",
    feel: "Dark",
    palette: ["#000000", "#333333", "#666666", "#EAEAEA"],
    coverage: 95,
    tokens: 1296,
    components: 48,
    voteRate: 95,
    voteCount: 1112,
    forks: 402,
    updatedAgo: "3d ago",
    url: "vercel.com",
    license: "MIT",
    maintainer: "Vercel",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor", "Lovable", "Figma Make"],
    tags: ["Devtools", "Mono", "Minimal", "Geist"],
    sectionCoverage: { colors: 92, typography: 96, spacing: 94, elevation: 0, shapes: 90, components: 95, dosDonts: 88 },
    designMd: vercel,
    companionPrompt: makeCompanion("Vercel", "monochrome devtools direction"),
    scores: [
      { label: "Colors", score: 92 },
      { label: "Typography", score: 96 },
      { label: "Layout & spacing", score: 94 },
      { label: "Component anatomy", score: 95 },
      { label: "Motion & feedback", score: 90 },
    ],
  },
  {
    id: "ramp",
    brandLogoUrl: "https://ramp.com/favicon.ico",
    num: "036",
    name: "Ramp",
    tagline: "Fintech · ochre",
    description: "Ramp's fintech-warm system. Ochre primary on near-black surface, dense tables with tabular numerics for financial data.",
    category: "Finance",
    feel: "Dark",
    palette: ["#FBD867", "#1B1B1B", "#7A7975", "#F5F4F0"],
    coverage: 92,
    tokens: 1124,
    components: 44,
    voteRate: 92,
    voteCount: 480,
    forks: 142,
    updatedAgo: "1w ago",
    url: "ramp.com",
    license: "MIT",
    maintainer: "Ramp",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor"],
    tags: ["Finance", "Dark", "Tabular", "Warm"],
    sectionCoverage: { colors: 94, typography: 90, spacing: 88, elevation: 78, shapes: 80, components: 93, dosDonts: 82 },
    designMd: ramp,
    companionPrompt: makeCompanion("Ramp", "warm fintech direction"),
    scores: [
      { label: "Colors", score: 94 },
      { label: "Typography", score: 90 },
      { label: "Layout & spacing", score: 92 },
      { label: "Component anatomy", score: 93 },
      { label: "Motion & feedback", score: 89 },
    ],
  },
  {
    id: "atlassian",
    brandLogoUrl: "https://www.atlassian.com/apple-touch-icon.png",
    num: "035",
    name: "Atlassian",
    tagline: "Blue · enterprise",
    description: "Atlassian Design System. Enterprise-blue primary with navy text, accessible status pills, moderate density.",
    category: "Enterprise",
    feel: "Corporate",
    palette: ["#0052CC", "#172B4D", "#5E6C84", "#FAFBFC"],
    coverage: 88,
    tokens: 1402,
    components: 56,
    voteRate: 88,
    voteCount: 360,
    forks: 108,
    updatedAgo: "2w ago",
    url: "atlassian.design",
    license: "Apache-2.0",
    maintainer: "Atlassian",
    version: "1.0.0",
    worksWith: ["Claude", "Cursor", "Lovable"],
    tags: ["Enterprise", "Corporate", "Accessible"],
    sectionCoverage: { colors: 90, typography: 86, spacing: 88, elevation: 86, shapes: 92, components: 92, dosDonts: 90 },
    designMd: atlassian,
    companionPrompt: makeCompanion("Atlassian", "enterprise blue direction"),
    scores: [
      { label: "Colors", score: 90 },
      { label: "Typography", score: 88 },
      { label: "Layout & spacing", score: 89 },
      { label: "Component anatomy", score: 92 },
      { label: "Motion & feedback", score: 84 },
    ],
  },
];

export function getBundle(id: string): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

export const CATEGORIES = ["All", "Devtools", "Enterprise", "Editorial", "Marketing", "Finance", "Consumer"] as const;
export const FEELS = ["All", "Dark", "Light", "Editorial", "Bold", "Playful", "Corporate"] as const;
export const MODELS = ["Claude", "Cursor", "Lovable", "Figma Make"] as const;
