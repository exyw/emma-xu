# Projects content still needed

The page uses the verified small/large ASCII SVG and original image for each of CHIP, WIT, DK, CNN, and Connect3. The asset paths, overview placements, detail sizes, labels, and supplied CHIP copy are in `projects-config.js`.

CHIP's supplied text includes “Try it here!”, but no destination was provided. The call to action is omitted until its real demo URL is available.

For WIT, DK, CNN, and Connect3, the artwork labels establish only the names shown on the page. Before adding fuller project details, obtain each project's public title, stack and year, short description, Emma's contribution, outcome or favourite learning, and any demo or repository URL. The page currently shows each verified label and its supplied large artwork, without placeholder text or dead links.

If the overview slots or SVGs change, update `projects-config.js`, then regenerate `projects-morph-data.js` with `python3 scripts/generate-project-morph-data.py`. The generated point field is only used during a morph; settled views use the original SVGs.
