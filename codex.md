# Site build guidelines

This is a living guide for building Emma Xu's site. Read it before changing a page. Update it when we agree on a new convention or a change makes an existing rule inaccurate. Keep rules concrete and tied to the codebase.

## Current structure

- The site uses plain HTML, CSS, and JavaScript; there is no build step.
- `global.css` contains the base page styling and shared navigation. Every page loads it.
- `navigation.js` provides the shared navigation interaction.
- Page-specific styles and behavior may live in a page stylesheet or the page itself. `who-i-am.css` and `who-i-am.js` are examples of extracted page files.
- Shared visual assets live under `assets/`.

## Building pages

1. Reuse existing rules in `global.css` and existing shared classes before adding new CSS. Keep genuinely page-specific styling scoped to a page class (for example, `.who-page`). When the same new styling is needed on multiple pages, move it into `global.css` rather than copying it.
2. Preserve the site's established typography, colors, spacing, navigation, and interaction patterns unless the task calls for a design change. Check the existing pages before introducing a new pattern.
3. Use the shared `.site-nav` markup and `navigation.js` for desktop navigation. Keep the `.page-menu` links in this order: Projects, Emma Xu, Who I am. Mark exactly one current-page link with both `selected` and `aria-current="page"`; on the Contact page, that link is the separate Contact trigger. Shared rules in `global.css` keep the selected link bold and centered, reveal other page links on hover or keyboard focus, and keep them reachable on touch screens. On Contact, mark Emma Xu `always-visible` so it remains visible alongside the selected Contact link. Page styles may position the navigation but should not redefine this behavior.
4. Keep content semantic: use a meaningful page title, a `main` landmark, appropriate headings, real links for navigation, and buttons for actions. Give interactive images accessible names.
5. Make layouts work on narrow screens as well as desktop. The existing mobile breakpoint is `640px`; follow it where a shared behavior needs to stay consistent. Avoid horizontal overflow and check that controls remain reachable.
6. Respect `prefers-reduced-motion` for animation and transitions. Keep visible focus styles for interactive elements.
7. Reuse assets from `assets/` where they fit. Use relative paths so pages work as static files.

## Before finishing a page change

- Check the affected page at desktop and mobile widths, including navigation, focus, and any hover or tap interaction.
- Check pages that share any global CSS or JavaScript changed in the task.
- Update this guide when the work establishes, changes, or retires a reusable convention. Do not add temporary task notes here.
