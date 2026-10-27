// Rasterize the supplied detail SVGs for compact Projects views.
// Run with Sharp available to Node (for example, through NODE_PATH).
// The SVGs stay in the repository as the source artwork and desktop assets.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'projects-config.js'), 'utf8'), context);
const projects = context.window.projectConfig.projects;
const output = path.join(root, 'assets/projects/mobile');
fs.mkdirSync(output, { recursive: true });

function splitLongPath(source, sourceWidth) {
  const match = source.match(/^([\s\S]*?)<path d="([\s\S]*?)" fill="black"\s*\/>\s*<\/svg>\s*$/);
  if (!match) throw new Error('Expected one black path in the supplied SVG');
  const [, opening, data] = match;
  const moves = [...data.matchAll(/M(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  const boundaries = [0];
  let last = 0;
  for (let index = 1; index < moves.length; index += 1) {
    const current = moves[index];
    const previous = moves[index - 1];
    // Split between ASCII rows, so a letter and its cutouts remain one path.
    if (current.index - last > 650_000 &&
        Number(current[1]) < Number(previous[1]) - sourceWidth * 0.3 &&
        Number(current[2]) > Number(previous[2]) + 2 &&
        /Z\s*$/.test(data.slice(Math.max(0, current.index - 4), current.index))) {
      boundaries.push(current.index);
      last = current.index;
    }
  }
  boundaries.push(data.length);
  const parts = boundaries.slice(0, -1).map((start, index) => data.slice(start, boundaries[index + 1]));
  if (parts.some((part) => part.length > 2_000_000)) {
    throw new Error('A detail SVG path is too long to rasterize safely; inspect its row ordering');
  }
  return opening + parts.map((part) => `<path d="${part}" fill="black"/>`).join('\n') + '</svg>';
}

(async () => {
  for (const project of projects) {
    const source = fs.readFileSync(path.join(root, 'assets/projects/ascii', project.large), 'utf8');
    // Compact artwork never exceeds 392 CSS pixels. Render at 3× for sharp glyphs.
    const width = Math.round(Math.min(project.art.maxWidth, 392) * 3);
    const density = Math.max(72, Math.ceil(72 * width / project.art.width));
    const svg = splitLongPath(source, project.art.width);
    const destination = path.join(output, project.mobile);
    const result = await sharp(Buffer.from(svg), { density, limitInputPixels: false })
      .resize({ width })
      .webp({ lossless: true, effort: 6 })
      .toFile(destination);
    console.log(`${project.id}: ${result.width}×${result.height}, ${Math.round(result.size / 1024)} KiB`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
