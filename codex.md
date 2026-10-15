# Site build guidelines

This is a living guide for building Emma Xu's site. Read it before changing a page. Update it when we agree on a new convention or a change makes an existing rule inaccurate. Keep rules concrete and tied to the codebase.

## Current structure

- The site uses plain HTML, CSS, and JavaScript; there is no build step.
- `global.css` contains the base page styling and shared navigation. Every page loads it.
- `navigation.js` provides the shared navigation interaction.
- Page-specific styles and behavior may live in a page stylesheet or the page itself. `who-i-am.css` and `who-i-am.js` are examples of extracted page files.
- Shared visual assets live under `assets/`. The Who I Am artwork is under `assets/contact/`; the Projects artwork is under `assets/projects/`.
- `projects-config.js` owns the verified project asset/content configuration. `projects-morph-data.js` contains generated glyph coordinates for its transition; regenerate it with `python3 scripts/generate-project-morph-data.py` when artwork or overview slots change.

## Building pages

1. Reuse existing rules in `global.css` and existing shared classes before adding new CSS. Keep genuinely page-specific styling scoped to a page class (for example, `.who-page`). When the same new styling is needed on multiple pages, move it into `global.css` rather than copying it.
2. Preserve the site's established typography, colors, spacing, navigation, and interaction patterns unless the task calls for a design change. Check the existing pages before introducing a new pattern.
3. Use the shared `.site-nav` markup and `navigation.js` for desktop navigation. Keep the `.page-menu` links in this order: Projects, Emma Xu, Who I am. Mark exactly one current-page link with both `selected` and `aria-current="page"`; on the Contact page, that link is the separate Contact trigger. Shared rules in `global.css` keep the selected link bold and centered, reveal other page links on hover or keyboard focus, and keep them reachable on touch screens. On Contact, mark Emma Xu `always-visible` so it remains visible alongside the selected Contact link. Page styles may position the navigation but should not redefine this behavior.
   Use `.site-nav--portrait` on Who I Am and Projects to keep their side navigation at the same viewport positions while artwork moves. Its desktop and mobile positions live in `global.css`.
4. Keep content semantic: use a meaningful page title, a `main` landmark, appropriate headings, real links for navigation, and buttons for actions. Give interactive images accessible names.
5. Make layouts work on narrow screens as well as desktop. The existing mobile breakpoint is `640px`; follow it where a shared behavior needs to stay consistent. Avoid horizontal overflow and check that controls remain reachable.
6. Respect `prefers-reduced-motion` for animation and transitions. Keep visible focus styles for interactive elements.
7. Reuse assets from `assets/` where they fit. Use relative paths so pages work as static files.
8. For animated interactive artwork, keep its layout and interaction region stationary and animate a child layer. Keep hover, focus, and touch preview state independent of the motion clock so animation cannot reset an active preview.
9. When outlined SVG artwork transforms, keep the supplied SVG as the settled view. Use its existing cutouts instead of adding rectangular masks around project slots. Keep overview slots in `projects-config.js` and regenerate the temporary sample field after artwork or overview slot changes. Its point cloud and echoes should follow one continuous sway clock. Keep the readable text and navigation outside that moving layer.
10. Configure each Projects original-image preview in `projects-config.js` relative to its ASCII slot. For offset previews, keep the visible original smaller than and inside the ASCII slot, using an inset edge or corner. WIT keeps its centered placement. Preview placement is specific to Projects; do not apply it to the Who I Am page.
11. Keep the Projects overview silhouette matched to the Who I Am portrait's visible size and vertical position. Its 850-unit crop needs a 1.016 height correction and a 0.886 source width factor because the head was removed from the supplied SVG. The Projects stage has a 26px desktop and 8px mobile top offset to align visible silhouettes. Scale and move the entire source layer, including its configured cutouts and previews.
12. Keep inline project links as structured text segments in `projects-config.js`, rendered as real anchors in `projects.js`. Underline them before hover and attach the shared typewriter behavior from `navigation.js` after rendering the copy. Give inline typewriter links a fixed width so typing cannot move nearby text or shrink the click target. Let pointer events pass through the Projects stage so its art cannot block overlapping copy; restore them on `.project-choice` buttons.

## Before finishing a page change

- Check the affected page at desktop and mobile widths, including navigation, focus, and any hover or tap interaction.
- Check pages that share any global CSS or JavaScript changed in the task.
- Update this guide when the work establishes, changes, or retires a reusable convention. Do not add temporary task notes here.
