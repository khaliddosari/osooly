---
name: liquid-glass-design
description: Use this skill to generate well-branded interfaces and assets for the Liquid Glass design system — covering both the Khalid Al Dosari personal portfolio and the Namtheg AutoML (نَمذِج) Next.js app. The system is dark, frosted "liquid glass" surfaces over an ambient cyan/blue glow. Contains design guidelines, color & glass tokens, type, Thmanyah brand fonts, logos/assets, a UI-kit recreation of the portfolio, and the production Next.js/Tailwind reference implementation.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files:
- `README.md` — product context (portfolio + Namtheg AutoML), content voice, visual foundations,
  chip/button pixel-perfect specs, iconography, app shell layout, index, full Tailwind token
  reference, hard rules.
- `colors_and_type.css` — import this to inherit every CSS custom property: color, liquid-glass
  material, type families, spacing, radii, `@font-face` for Thmanyah, semantic type classes.
- `fonts/` — Thmanyah `.otf` (Sans, Serif Text, Serif Display).
- `assets/` — `logo.png` (KA mark), `photo.jpg`, `favicon.ico`, `icon-cv.svg`, `logos/` (orgs).
- `preview/` — small specimen cards for color, type, glass, spacing, components.
- `ui_kits/portfolio/` — interactive recreation of the portfolio site (React + source CSS).

Production Next.js app reference (relative to repo root):
- `Frontend/app/globals.css` — Tailwind component layer with `.glass*`, `.btn-*`, `.tag`,
  `.skill-tag`, `.ambient-field`, scrollbar, range input, motion keyframes.
- `Frontend/tailwind.config.ts` — full MD3→LiquidGlass color map, font families, type scale,
  animation names.
- `Frontend/components/icon.tsx` — `<Icon>` component with FA map.
- `Frontend/components/brand.tsx` — `<Brand>` wordmark (نَمذِج).
- `Frontend/components/layout-shell.tsx` — app shell (sidebar + ambient field + footer).

If creating **visual artifacts** (slides, mocks, throwaway prototypes):
- Link `colors_and_type.css`, keep the dark background + ambient glow field.
- Compose surfaces from the glass tokens (`.glass`, `--glass-bg`, `backdrop-filter`, etc.).

If working on **production Next.js code**:
- Use `.glass` / `.glass-hover` / `.glass-strong` utility classes from `globals.css`.
- Use Tailwind MD3-named classes (`bg-surface`, `text-primary`, `border-outline-variant`, etc.)
  — they map to liquid glass values per `tailwind.config.ts`.
- Use `<Icon name="...">` for all icons, `<Brand />` for the نَمذِج wordmark.

Stay on-brand regardless of context: dark only, translucent glass surfaces, cyan→blue accent used
sparingly, Font Awesome + the CV SVG for icons, bilingual identity preserved, no emoji.

If the user invokes this skill without other guidance, ask what they want to build, ask a few
focused questions, then act as an expert designer outputting HTML artifacts or production code.
