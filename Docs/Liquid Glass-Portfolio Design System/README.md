# Liquid Glass — Khalid Al Dosari Portfolio Design System

A design system distilled from the **Khalid Al Dosari personal portfolio** — a single-page,
dark-themed, *"liquid glass"* static site. It captures the brand's fonts, colors, glass material,
iconography, content voice, and a faithful UI-kit recreation so any agent can generate
on-brand interfaces and assets.

> **What "Liquid Glass" is:** a premium dark aesthetic built on frosted, translucent surfaces
> floating over an ambient cyan/blue/violet glow. Surfaces are never flat opaque blocks — they
> are glass that refracts the colored light behind them.

---

## 1. Product context

| | |
|---|---|
| **Owner / subject** | Khalid Al Dosari — خالد آل دوســـــري |
| **Role positioning** | CS Student · Data Scientist · AI Engineer |
| **Portfolio** | A single-page personal portfolio (About, Education, Projects, Experience, Certifications, Skills, Languages). Original source: `github.com/khaliddosari/portfolio` |
| **Portfolio tech** | Vanilla HTML / CSS / JS — *no framework, no build step*. Hosted on Cloudflare via Wrangler. |
| **Namtheg AutoML (نَمذِج)** | The second product built on this design system. A Next.js 14 (App Router) + Tailwind CSS + TypeScript app. Upload a CSV, pick a target, and the pipeline trains and compares ML models, then uses an LLM to explain results. Hosted at `namtheg.onrender.com`. |
| **Identity** | Bilingual (English + Arabic). IMSIU senior CS student, Riyadh, Saudi Arabia. |

The design system covers **two products** — the personal portfolio website and the Namtheg AutoML
web app — sharing the same color palette, glass material, typography, and motion language. The
portfolio is the *visual source of truth*; the AutoML app is the *production Next.js reference
implementation* via `globals.css` + `tailwind.config.ts`.

### Sources used to build this system
- **GitHub — portfolio (private):** `github.com/khaliddosari/portfolio`
  (`prd/PRD.md`, `static/index.html`, `static/styles.css`, `static/script.js`, image assets)
- **GitHub — brand fonts:** `github.com/khaliddosari/thmanyah-fonts`
  (Thmanyah typeface, served live via jsDelivr `@v1`)
- **Frontend/ — Namtheg AutoML Next.js app:** `Frontend/app/globals.css`,
  `Frontend/tailwind.config.ts`, `Frontend/components/` — the production Tailwind layer.
- **Uploaded:** the Thmanyah `.otf` font files + the hero portrait (`photo.jpg`)

> Explore those repositories directly for the highest-fidelity source of truth — especially
> `prd/PRD.md`, which is an exhaustive project knowledge base maintained alongside the code.

---

## 2. Content fundamentals (voice & copy)

**Vibe:** professional, concise, growth-minded, quietly confident. Reads like a strong résumé
written by a builder, not a marketer. Technical fluency is shown, not boasted.

**Person & tense**
- **First person** in the About section ("I specialize in…", "I've also spent…").
- **Third-person / imperative bullets** elsewhere — experience responsibilities lead with strong
  past/present verbs: **Manage**, **Oversee**, **Supervised**, **Coordinated**, **Lead**.

**Casing**
- **Title Case** for section titles and card headings ("About Me", "Cash Back Optimizer").
- Sentence case for body copy and bullets.
- Tech names keep their canonical casing — `FastAPI`, `Next.js`, `PyTorch`, `LangChain`,
  `MongoDB`. (One stylistic exception in source: `NEXT.JS` appears uppercased on one tag.)

**Bilingual identity (do not drop)**
- The Arabic name **خالد آل دوســـــري** always appears above the Latin **Khalid Al Dosari**.
- Arabic is set in the Thmanyah display serif with full ligature/stylistic-set features on.
- The product wordmark **نَمذِج** (Arabic for "model") is always rendered in Thmanyah Serif Display
  bold via the `<Brand />` component (`font-display font-bold text-primary`).

**Emphasis**
- Inline `<b>` bolding highlights key terms inside paragraphs — *agentic*, *machine learning*,
  *artificial intelligence*, the tech stack of each project. Used liberally but purposefully.

**Tone examples (verbatim from the site)**
- Hero tagline: *"CS Student | Data Scientist | AI Engineer"* (pipe-separated roles).
- About: *"I design scalable, production-ready solutions that turn raw data into actionable
  insights and real-world impact."*
- Experience bullet: *"Supervised teams in critical and prestigious events and conferences for
  multiple government and private entities."*

**Conventions**
- No emoji anywhere in product copy.
- Pipe `|` separates roles in taglines; bullets (`•` via `<ul>`) for responsibilities.
- Dates written long-form: *"August 2022 - present"*, *"October 2024 - November 2025"*.
- Contact details (email, phone, LinkedIn, GitHub, CV) are **identical** across hero, sidebar,
  and footer — keep them in sync.

---

## 3. Visual foundations

### Color
- **Background:** near-black `#0a0a0f`, with a secondary `#111118`. Everything lives on dark.
- **Accent:** a **cyan → blue gradient** (`#4fc3f7 → #0288d1`, 135°). Used sparingly for CTAs,
  links, underlines, tag text, glows, the logo ring. Never as large fills.
- **Text:** off-white `#e8e8ed` primary, cool grey `#9999a8` muted. No pure white, no pure black text.
- **Ambient field:** a fixed, heavily-blurred (`blur(40px)`) layer of radial glows behind
  everything — cyan top-left, blue top-right, violet bottom, cyan bottom-right. This is the light
  the glass refracts. **Without it the glass looks flat — never remove it.**
- **Selection:** `background: rgba(79, 195, 247, 0.28)`, `color: #ffffff`.

### Typography
- **Body:** Inter. **Headings / UI / buttons:** IBM Plex Sans. **Mono / tags / code:** JetBrains Mono.
- **Brand / Arabic display:** Thmanyah Serif Display (+ Serif Text, Sans). Editorial serif with
  rich OpenType ligatures and stylistic sets — used for the Arabic name, the نَمذِج wordmark, and
  any signature moments.
- Section titles: IBM Plex Sans, 2rem, 700, centered, with a 50px gradient underline (`::after`).
- Hero name: 2.5rem, 700, tight tracking (`-0.5px`).

### The liquid-glass material
Every surface (cards, nav-when-scrolled, buttons-outline, tags, mobile drawer) composes from:
- `background: --glass-bg` — a faint 8%→2% white diagonal gradient.
- `backdrop-filter: blur(24px) saturate(180%)` (strong variant: 32px / 200%).
- `border: 1px solid rgba(255,255,255,0.12)` — a bright hairline.
- `--glass-highlight` — layered inset shadows: a bright top inset edge + dark bottom inset edge,
  simulating a lit glass bevel.
- `--glass-shadow` — `0 12px 40px rgba(0,0,0,0.35)` drop shadow for float.

**In the Next.js app**, the glass material is composed via utility classes defined in `globals.css`:

| Class | What it does |
|---|---|
| `.glass` | Full glass surface: `--glass-bg` + blur + hairline border + radius + highlights/shadow |
| `.glass-hover` | Adds `transition` + `:hover` brightening, lift (-2px), deeper shadow |
| `.glass-strong` | Stronger variant: 10%→3% white bg, `blur(32px) saturate(200%)` — used for sidebar/navbar |
| `.ghost-border` | Just `border: var(--glass-border)` — alias for thin hairline only |
| `.card-shadow` | Just `box-shadow: var(--glass-highlight), var(--glass-shadow)` |
| `.ambient-shadow` | Just `box-shadow: var(--glass-shadow-hover)` (cyan bloom + deep drop) |

### Chips & tags (pixel-perfect specs)

**`.tag`** — project tech chips (monospace, cyan):
```css
font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 500;
color: var(--accent); /* #4fc3f7 */
background: rgba(79, 195, 247, 0.08);
border: 1px solid rgba(79, 195, 247, 0.25);
border-radius: var(--radius-pill); /* 20px */
padding: 4px 12px; white-space: nowrap;
```

**`.skill-tag`** — skill glass pills:
```css
display: inline-flex; align-items: center; gap: 6px;
font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);
background: var(--glass-bg); border: var(--glass-border);
border-radius: var(--radius-pill); padding: 6px 14px;
transition: all 0.3s ease;
/* :hover → color: var(--accent); border-color: rgba(79,195,247,0.5);
   background: rgba(79,195,247,0.08); transform: translateY(-1px); */
```

### Buttons

**`.btn-primary`** — filled cyan gradient CTA:
```css
display: inline-flex; align-items: center; justify-content: center; gap: 8px;
font-weight: 700; color: #0a0a0f;
background: var(--accent-gradient); border-radius: var(--radius-sm); /* 8px */
box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 0 24px rgba(79,195,247,0.18);
/* :hover → translateY(-2px); shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 0 40px rgba(79,195,247,0.35); */
```

**`.btn-glass`** — outline glass secondary button:
```css
display: inline-flex; align-items: center; justify-content: center; gap: 8px;
font-weight: 600; color: var(--text-primary);
background: var(--glass-bg); backdrop-filter: var(--glass-blur);
border: var(--glass-border); border-radius: var(--radius-sm);
/* :hover → color: var(--accent); border-color: rgba(79,195,247,0.5); translateY(-2px); */
```

### Backgrounds
- No imagery as background. No repeating patterns or textures. The "texture" is entirely the
  ambient radial glow + glass refraction.
- `.section-alt` bands add an almost-invisible (1.8% white) vertical gradient to separate
  alternating sections (portfolio only; AutoML uses continuous near-black).

### Corners, borders, elevation
- Default radius **16px** (cards, drawer panels). Buttons **8px**. Tags/pills **20px** (fully round).
- Borders are always **translucent white hairlines**, never solid colored borders.
- Elevation = drop shadow + inset bevel highlights, *not* flat material elevation. Hover deepens
  the shadow and adds a faint cyan glow (`0 0 40px rgba(79,195,247,0.1)`).

### Motion
- **Default transition:** `0.3s ease` on `all` for interactive elements.
- **Hover lift:** `translateY(-2px)` (cards), `-4px` (project cards), `-1px` (small chips).
- **Scroll reveals:** AOS `fade-up`, `duration 700`, `easing 'ease-out'`, `once: true`, staggered
  `data-aos-delay` in 100ms increments down a section (portfolio only).
- **Mobile drawer:** slides in from the right (portfolio) or left (AutoML) with
  `cubic-bezier(0.16, 1, 0.3, 1)` over 0.4s; the page behind blurs (`blur(12px)`) and dims.
- **Ambient drift:** `18s ease-in-out infinite alternate` — `translate3d(0,-2%,0) scale(1.05)`.
  Applied via `animate-drift` class on `.ambient-field`. Stops under `prefers-reduced-motion`.
- **Shimmer:** `shimmer-effect` keyframe (`translateX(-100%→100%)`), 2s linear infinite.
  Used as a hover overlay on `.btn-primary` to add a light sweep.
- **Fade-up:** `fadeUp` 0.3s ease-out — `opacity: 0, translateY(6px)` → resting. Applied via
  `animate-fade-up` for elements that reveal on state change.
- No bounce, no spring, no parallax. Calm and premium.

### Hover / press states
- **Links:** color shifts `--accent` → `--accent-dark`; nav links grow an underline left-to-right.
- **Cards:** brighten glass (`--glass-bg-hover`), lift, stronger shadow + cyan glow.
- **Primary button:** lift `-2px`, brighter inner highlight + larger cyan glow. Text stays near-black.
- **Skill tags:** fill with faint cyan, border turns cyan, text turns cyan, lift `-1px`.
- No explicit "press/active" shrink — the system relies on hover affordances.

### Scrollbar
```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.16); border-radius: 20px; }
::-webkit-scrollbar-thumb:hover { background-color: rgba(79,195,247,0.5); }
```

### Range input
```css
/* thumb: 20px circle, #4fc3f7, box-shadow: 0 0 12px rgba(79,195,247,0.5) */
/* track: 4px height, rgba(255,255,255,0.12) bg, border-radius: 2px */
```

### Transparency & blur — when
- Blur is used on any surface that should read as glass: cards, the scrolled navbar/sidebar,
  outline buttons, tags, the mobile drawer + its backdrop overlay.
- The top of the navbar uses a `mask-image` fade so it dissolves into the page rather than ending
  in a hard line (portfolio only).
- Imagery (portrait, logos) is **opaque** — glass is for chrome/containers, not photos.

### Imagery vibe
- The hero portrait is a clean, neutral-grey studio headshot — cool, crisp, professional.
- Logos are small (48–72px), `object-fit: contain`, on their own backgrounds, with `onerror`
  fallbacks that hide broken images.
- The portrait sits in a 380px circle with a glass bevel ring + cyan outer glow.

---

## 4. Iconography

- **Icon component:** `<Icon name="..." />` — accepts semantic names (Material Symbol convention)
  and renders Font Awesome 6.5.1 glyphs via an internal map. Sizing via `style={{ fontSize }}`
  or Tailwind text-size classes. All icons `inherit currentColor`.
- **Underlying icon font:** **Font Awesome 6.5.1** (loaded from cdnjs), solid (`fas`) + brand
  (`fab`) styles. The `Icon` component always emits `<i class="fa-solid fa-..." />`.
- **FA brand icons** (`fab`) are used directly (not via `<Icon>`) for social links:
  `fab fa-linkedin`, `fab fa-github`.
- **Icon name map** (semantic → FA class):

| Semantic name | FA class | Use |
|---|---|---|
| `menu` | `fa-bars` | Mobile hamburger |
| `close` | `fa-xmark` | Drawer close |
| `upload_file` | `fa-file-arrow-up` | Data ingestion nav |
| `analytics` | `fa-chart-column` | Dataset overview nav |
| `model_training` | `fa-gears` | Model training nav |
| `insights` | `fa-chart-line` | Analytics nav |
| `rocket_launch` | `fa-rocket` | Inference nav |
| `graph_3` | `fa-diagram-project` | App brand icon |
| `auto_awesome` | `fa-wand-magic-sparkles` | AI autopilot badge |
| `play_arrow` | `fa-play` | Start CTA |
| `sync` | `fa-arrows-rotate` | Loading spinner |
| `download` | `fa-download` | Download action |
| `delete` | `fa-trash` | Remove file |
| `check_circle` | `fa-circle-check` | Success state |
| `error` | `fa-circle-exclamation` | Error state |

- **One bespoke inline SVG:** the **CV / résumé icon** (`assets/icon-cv.svg`) — drawn with
  `stroke="currentColor"`, `stroke-width="2.2"`, round caps/joins. Used in the portfolio only.
- **No emoji. No unicode-glyph icons.** Icons are always FA or the CV SVG.
- Icons are small (14–20px / 1.1–1.3rem), inherit `currentColor`, muted grey at rest, cyan on hover.

**Recreating the system:** load Font Awesome 6.5.1 from CDN and use `<Icon>` for all app icons.
Do not substitute another icon library — the FA solid/brand mix is part of the look.

---

## 5. App shell & layout

### Portfolio (vanilla HTML)
Fixed top navbar, full-width sections. Mobile: right-sliding glass drawer overlay.

### Namtheg AutoML (Next.js)
Fixed **left sidebar** (208px / `w-52`) + scrollable main content area. Layout handled by
`<LayoutShell>` in `components/layout-shell.tsx`:

```
┌─────────────────────────────────────────────────┐
│  [Sidebar w-52, glass-strong, border-r]         │
│  Brand mark + nav items + "Create New" btn      │
│  ┌───────────────────────────────────────────┐  │
│  │  Main area  ml-52                         │  │
│  │  <main> page content                      │  │
│  └───────────────────────────────────────────┘  │
│  [Footer fixed bottom, glass/blur, border-t]    │
└─────────────────────────────────────────────────┘
```

Mobile: `md:hidden` top header bar (glass-strong, `border-b`) + full-screen slide-from-left
drawer (`-translate-x-full` → `translate-x-0`, `duration-300 ease-in-out`) + `bg-black/60
backdrop-blur-md` overlay.

**Sidebar nav items** (workflow steps, ordered):
1. Data Ingestion — `upload_file` icon — `/`
2. Dataset Overview — `analytics` icon — `/{runId}/preview`
3. Model Training — `model_training` icon — `/{runId}/running`
4. Analytics — `insights` icon — `/{runId}/result`
5. Inference — `rocket_launch` icon — `/{runId}/inference`

Active item: `text-primary font-bold scale-[1.04]`. Disabled (no runId): `opacity-40 cursor-not-allowed`.

**Public share routes** (`/share/*`): no sidebar — just `AmbientField` + main content.

### Ambient field component
```jsx
<div className="ambient-field animate-drift" aria-hidden="true" />
```
Defined in `globals.css`. Position `fixed inset-0 z-0 pointer-events-none overflow-hidden filter
blur(40px)`. Two `::before`/`::after` pseudo-elements carry the cyan/blue (top-left) and
violet/cyan (bottom-right) radial gradients. Slow-drifts via `animate-drift`. **Never remove.**

---

## 6. Index / manifest

Root files:
- **`README.md`** — this file. Product context, voice, visual foundations, iconography, app
  shell, manifest, Tailwind layer reference, hard rules.
- **`colors_and_type.css`** — the full CSS custom-property token set: `@font-face` (local
  Thmanyah), color + glass + type + spacing + shape variables, semantic type classes.
- **`SKILL.md`** — Agent-Skill front-matter so this system loads in Claude Code.

Folders:
- **`fonts/`** — Thmanyah `.otf` files (Sans, Serif Text, Serif Display × Light/Regular/Medium/Bold/Black).
- **`assets/`** — `logo.png` (KA brand mark), `favicon.ico`, `photo.jpg`, `icon-cv.svg`,
  `logos/` (university, employers, certification issuers).
- **`preview/`** — small HTML specimen cards (color, type, glass, spacing, components).
- **`ui_kits/portfolio/`** — faithful interactive recreation of the portfolio: `index.html` +
  JSX components (`Navbar`, `Hero`, `GlassCard`, `ProjectCard`, `Timeline`, `Tag`, `Button`,
  `SkillGroup`, `CertCard`, `Footer`, `MobileDrawer`). See its own README.

Production app files (relative to repo root):
- **`Frontend/app/globals.css`** — Tailwind base + component layer with all glass/button/chip
  classes, ambient field, scrollbar, range input, motion keyframes.
- **`Frontend/tailwind.config.ts`** — full MD3→LiquidGlass color token remapping, font families,
  type scale, animation/keyframe definitions.
- **`Frontend/components/icon.tsx`** — `<Icon>` component, FA map.
- **`Frontend/components/brand.tsx`** — `<Brand>` wordmark (نَمذِج).
- **`Frontend/components/layout-shell.tsx`** — app shell (AmbientField, sidebar, header, footer).
- **`Frontend/components/sidebar.tsx`** — fixed sidebar with nav items.
- **`Frontend/components/site-footer.tsx`** — fixed desktop footer.

---

## 7. Tailwind / Next.js application layer

The Next.js app re-maps **MD3 token names → liquid glass values** so the entire codebase uses
semantic class names without renaming. Use the table below when writing Tailwind classes.

### Color tokens (tailwind.config.ts)

| Tailwind class | Value | Role |
|---|---|---|
| `bg-surface` / `bg-background` | `#0a0a0f` | Page background |
| `bg-surface-dim` | `#08080c` | Darkest surface |
| `bg-surface-container-lowest` | `rgba(255,255,255,0.03)` | Card ghost |
| `bg-surface-container-low` | `rgba(255,255,255,0.04)` | Card default |
| `bg-surface-container` | `rgba(255,255,255,0.05)` | Card elevated |
| `bg-surface-container-high` | `rgba(255,255,255,0.07)` | Card prominent |
| `bg-surface-container-highest` | `rgba(255,255,255,0.09)` | Highest card |
| `bg-surface-variant` | `rgba(255,255,255,0.06)` | Subtle surface |
| `text-on-surface` / `text-on-background` | `#e8e8ed` | Primary text |
| `text-on-surface-variant` / `text-outline` | `#9999a8` | Muted text |
| `border-outline-variant` | `rgba(255,255,255,0.12)` | Hairline border |
| `text-primary` / `bg-primary` | `#4fc3f7` | Accent cyan |
| `text-primary-container` / `bg-primary-container` | `#0288d1` | Accent deep blue |
| `bg-surface-purple-tint` | `rgba(79,195,247,0.12)` | Cyan icon bg wash |
| `bg-surface-green-tint` | `rgba(128,216,130,0.14)` | Success icon bg wash |
| `text-success-green` | `#5fd07f` | Success text |
| `text-error` / `bg-error` | `#ff6b6b` | Error accent |
| `bg-error-container` | `rgba(255,107,107,0.16)` | Error bg wash |
| `text-warning-orange` | `#f4a664` | Warning accent |
| `text-info-blue` | `#4fc3f7` | Info (= accent) |

### Font family aliases

| Tailwind class | Stack |
|---|---|
| `font-sans` | IBM Plex Sans, Inter, sans-serif |
| `font-body` | Inter, IBM Plex Sans, sans-serif |
| `font-mono` | JetBrains Mono, Menlo, monospace |
| `font-arabic` | IBM Plex Sans Arabic, IBM Plex Sans, sans-serif |
| `font-display` | Thmanyah Serif Display, IBM Plex Sans Arabic, serif |

### Type scale

| Tailwind class | Size / Line-height / Weight |
|---|---|
| `text-headline-xl` | 48px / 56px / 700, tracking -0.02em |
| `text-headline-lg` | 32px / 40px / 700, tracking -0.01em |
| `text-headline-md` | 24px / 32px / 600 |
| `text-body-lg` | 18px / 28px / 400 |
| `text-body-md` | 16px / 24px / 400 |
| `text-label-md` | 14px / 20px / 600, tracking 0.05em |
| `text-label-sm` | 12px / 16px / 500 |

### Spacing aliases

| Tailwind name | Value |
|---|---|
| `p-gutter` / `px-gutter` | 24px |
| `gap-section-gap` | 80px |
| `p-base` | 8px |
| `max-w-container-max` | 1280px |

### Animations

| Class | Keyframe | Duration |
|---|---|---|
| `animate-drift` | `translate3d(0,-2%,0) scale(1.05)` | 18s ease-in-out infinite alternate |
| `animate-shimmer` | `backgroundPosition -200%→200%` | 1.8s infinite |
| `animate-fade-up` | `opacity 0→1, translateY 6px→0` | 0.3s ease-out |
| `animate-blink` | `opacity 1→0→1` | 1s step-end infinite |
| `animate-pulse-slow` | Standard pulse | 3s ease-in-out infinite |

> `prefers-reduced-motion`: `animate-drift` and `animate-shimmer` are disabled via the media
> query in `globals.css`. Always respect this.

### globals.css component classes

| Class | Purpose |
|---|---|
| `.glass` | Glass surface: bg + blur + hairline + radius + shadow |
| `.glass-hover` | Adds hover: brighten + lift + deeper shadow |
| `.glass-strong` | Stronger blur/opacity — sidebar, fixed bars |
| `.btn-primary` | Filled cyan gradient CTA (inline-flex, gap: 8px) |
| `.btn-glass` | Glass outline secondary button |
| `.tag` | Mono cyan chip — project tech stack |
| `.skill-tag` | Glass pill — skills with optional icon (gap: 6px) |
| `.section-title` | Centered h2 with 50px gradient underline (::after) |
| `.ambient-field` | Fixed glow backdrop (use with `animate-drift`) |
| `.shimmer` | Background shimmer utility (200% bg-size sweep) |

---

## 8. Hard rules (keep on-brand)
1. Dark only. Near-black background, off-white text. Never light-mode.
2. Surfaces are translucent **glass** (blur + hairline + inset bevel), never flat opaque blocks.
3. Accent is the **cyan→blue gradient**, used sparingly — CTAs, links, underlines, glows.
4. Keep the **ambient glow field** behind everything; glass needs it to refract.
5. Bilingual identity: Arabic name in Thmanyah display serif above the Latin name;
   نَمذِج wordmark always in `font-display font-bold text-primary`.
6. Icons = Font Awesome 6.5.1 via `<Icon>` + the one CV SVG. No emoji, no unicode icons.
7. Generous spacing, centered section titles, 16px radius, subtle `translateY` hover lifts.
8. Two distinct tag classes: project chips `.tag` (mono, cyan 8% bg), skill chips `.skill-tag` (glass pill).
9. Respect `prefers-reduced-motion` — stop `animate-drift` and `animate-shimmer`.
