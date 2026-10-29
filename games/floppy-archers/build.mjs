// Usage: node build.mjs            → dist/ (the upload bundle: one Playgama Bridge build for every platform)
//        node build.mjs --preview  → preview/floppy-archers.html (single self-contained file)
//        node build.mjs --dev      → dist/ unminified with source maps
//        node build.mjs --embed    → preview/floppy-archers-embed.html: body-only page for hosts that supply the document shell
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm, stat, copyFile } from 'node:fs/promises';

const preview = process.argv.includes('--preview');
const embed = process.argv.includes('--embed');
const dev = process.argv.includes('--dev');
const SDK = '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  loader: { '.woff2': 'dataurl' },
  write: false,
  outdir: 'out',
  logLevel: 'warning',
});

const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text;
let html = await readFile('index.html', 'utf8');

const inlineScript = () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;

if (embed) {
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace('<script src="game.js"></script>', inlineScript);
  const page = `<title>Floppy Archers</title>\n<meta name="theme-color" content="#1d2233" />\n<style>${css}</style>\n${body.trim()}\n`;
  await mkdir('preview', { recursive: true });
  await writeFile('preview/floppy-archers-embed.html', page);
  const { size } = await stat('preview/floppy-archers-embed.html');
  console.log(`preview/floppy-archers-embed.html  ${(size / 1024 / 1024).toFixed(2)} MB`);
} else if (preview) {
  html = html
    .replace('<!--SDK-->', '')
    .replace('<link rel="stylesheet" href="game.css" />', () => `<style>${css}</style>`)
    .replace('<script src="game.js"></script>', inlineScript);
  await mkdir('preview', { recursive: true });
  await writeFile('preview/floppy-archers.html', html);
  const { size } = await stat('preview/floppy-archers.html');
  console.log(`preview/floppy-archers.html  ${(size / 1024 / 1024).toFixed(2)} MB`);
} else {
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', html.replace('<!--SDK-->', SDK));
  await writeFile('dist/game.js', js);
  await writeFile('dist/game.css', css);
  await copyFile('platform/playgama-bridge-config.json', 'dist/playgama-bridge-config.json');
  const total = Buffer.byteLength(js) + Buffer.byteLength(css) + Buffer.byteLength(html);
  console.log(`dist/  ${(total / 1024 / 1024).toFixed(2)} MB`);
}
