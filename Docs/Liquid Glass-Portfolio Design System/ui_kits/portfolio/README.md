# Portfolio UI Kit — Liquid Glass

A faithful, interactive recreation of the **Khalid Al Dosari portfolio website**
(github.com/khaliddosari/portfolio). Built with React + Babel in the browser, styled with the
exact CSS lifted from the source site. This is the single product surface of the brand.

## Run it
Open `index.html`. The whole single page scrolls inside one container so the sticky glass
navbar, scroll-spy active-link highlighting, and smooth in-page navigation all work in preview.
Resize below 768px to get the right-sliding **liquid-glass mobile drawer** (tap the hamburger).

## Files
| File | Role |
|------|------|
| `index.html` | Mounts React, loads fonts (Google + local Thmanyah via `../../colors_and_type.css`), Font Awesome, and all components. |
| `portfolio.css` | Component styles, verbatim from the source `static/styles.css` (tokens/fonts come from `colors_and_type.css`). |
| `data.js` | All page content (identity, nav, about, education, projects, experience, certifications, skills, languages) on `window.PORTFOLIO`. |
| `Navbar.jsx` | Sticky navbar + scroll state + interactive mobile glass drawer (`window.Navbar`). |
| `Hero.jsx` | `Hero`, `ContactRow`, and the simple sections `About` / `Education` / `Languages` (`window.Hero`, `window.Sections`). |
| `Cards.jsx` | `Projects`, `Experience` (timeline), `Certifications`, `Skills`, `Footer` (`window.Cards`). |
| `App.jsx` | Assembles every section, wires scroll-spy + smooth nav, renders to `#root`. |

## Components covered
- **Navbar** — logo (glowing KA avatar), centered links with sliding underline, active state.
- **Mobile drawer** — frosted right drawer with sidebar header/brand, icon nav items, social footer; dim+blur backdrop overlay.
- **Hero** — circular portrait with glass bevel ring + cyan glow, bilingual name, tagline, contact row, primary CTA.
- **Glass cards** — `edu-card`, `project-card` (with top sheen), `cert-card`, `timeline-content`, `language-card`.
- **Timeline** — glowing accent dot rail with glass content cards.
- **Tags** — `.tag` (mono cyan project chips) and `.skill-tag` (glass pills, cyan on hover).
- **Buttons** — `.btn-primary` (gradient), `.btn-sm`, `.btn-outline` (glass).
- **Footer** — social/contact row + copyright.

## Notes / fidelity
- Icons are **Font Awesome 6.5.1** + the bespoke CV SVG (`assets/icon-cv.svg`), matching the source.
- Interactivity is cosmetic: external links point to the real project/profile URLs; certificate
  "Verify/PDF" links are stubbed to `#` (the live site links to Coursera / Google Drive).
- The source uses AOS scroll-reveal animations; this kit omits them so all content is visible
  immediately in preview. Add `data-aos="fade-up"` + staggered delays to reproduce them.
- The `.tag` weight is bumped to 600 (per design-system review) vs. 500 in the original source.
