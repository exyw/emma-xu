# Mobile implementation checks

Implemented against the 18 October 2026 mobile brief and the user's subsequent mobile-only changes. The desktop baseline is commit `634eb0b`. No publication or production asset replacement.

## Current behavior

- Mobile Home has a smaller spotlight (`clamp(64px, 20vw, 84px)`), drag/tap/keyboard control, continuous release to drift and session reveal/replay state. Before Reveal, the selected Emma Xu navigation link is the only visible name beneath the mask; the decorative desktop title and all other navigation links are hidden, and the navigation is inert and aria-hidden. Reveal hides the name during its 350ms fade, then shows the desktop-arranged centered menu. Replay returns to the spotlight state. The Home view fits the dynamic viewport without scrolling or the old 500px artwork floor. The bottom instruction hint is removed; Reveal and Replay remain in their existing bottom position. Mobile Home navigation labels are 12px with tighter visual spacing and 44px touch targets. The compact navigation typewriter cursor sits inline with its text. Desktop Home keeps its original spotlight size, tracking, dismissal and navigation reveal.
- Mobile reuses the desktop's plain text navigation and typewriter links. On Home, tapping Emma Xu reveals Projects and Who I am, types them in that order and repeats while open; a second tap closes and cancels the sequence. Other pages keep their top navigation. Links support immediate activation, outside dismissal and Escape focus restoration. Contact uses the desktop submenu, arranged vertically on mobile. Expanded top menus reserve space below navigation; there is no boxed dropdown or plus icon.
- The pause button and its manual/session functionality are removed. Old stored pause values have no effect. System reduced-motion settings remain supported live.
- Mobile project text is usable during the morph and flips black/white according to the background beneath each region. Title, copy and pagination have no transition backing boxes or shadows. Settled details return to the existing warm text palette. Desktop spacing and reveal timing are unchanged.
- Mobile ghost previews, keepsake selection, overview swipes, looping project controls, hash routes and reading/focus restoration remain in place.

## Changed files

- `experience.js`, `global.css`, `navigation.js`: motion/input policy, shared text navigation, touch dismissal, safe areas, ghost scheduling and swipe handling.
- `index.html`, `home.css`, `home.js`: separate desktop/mobile spotlight controllers and mobile Reveal/Replay styling.
- `who-i-am.html`, `who-i-am.css`, `who-i-am.js`: responsive portrait, selection and overview navigation.
- `projects.html`, `projects.css`, `projects.js`: mobile detail layout, colour-only transitions, project navigation and history/focus handling.
- `contact.html`, `contact.css`, `contact.js`, `liquid.js`: shared Contact submenu, mobile reading flow, retained desktop liquid/stretch treatment and system motion support.
- `scripts/check-interactions.cjs`, `codex.md`: integration/regression checks and reusable conventions.

## Checks actually performed

- JavaScript syntax checks and `git diff --check`.
- 120 DOM interaction checks, including the centered Home menu, spotlight-to-menu reveal timing, active-spotlight navigation hiding, viewport-height, 12px navigation labels, tightened label spacing, inline typing cursor and removed Home hint; repeated sequential typing and cancellation on close/Replay; removed pause controls/state; small transparent Reveal styling and mobile spotlight radius; shared text menu activation and dismissal; touch-operated Contact submenu; transparent project transition text regions and black-to-white colour flips; spotlight/replay; ghost selection and suspension; drag, swipe, zoom and multi-touch boundaries; all project routes and wrap boundaries; history/reading/focus restoration; rapid morph input; system reduced-motion changes; and retained desktop behaviors.
- All 93 original top-level desktop CSS rules match their pre-mobile declarations. This compares parsed source rules, not rendered pixels.
- Earlier asset and coordinate checks remain applicable: the CV PDF is absent; five original Who I Am images exist for eleven keepsakes; expanded 44px silhouette targets do not overlap at the minimum portrait scale. Compact sizing calculations covered 320×568, 360×740, 390×844, 430×932, 844×390 and 768×1024.

Run with a separate jsdom 27.4.0 installation:

```sh
NODE_PATH=/path/to/test-only/node_modules node scripts/check-interactions.cjs
```

## Verification limits

The browser-control tool was unavailable. A local headless Chrome screenshot attempt exited before rendering. No browser screenshots, rendered layout checks, physical iOS/Android tests, native pinch/edge gesture checks, toolbar/safe-area or enlarged-text/zoom checks, screen-reader tests, raster burst/contrast assessment or GPU performance measurements were performed. DOM checks apply mocked media queries and mock geometry, canvas rendering and time; they do not establish browser or WCAG conformance.
