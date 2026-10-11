// Usage: node build.mjs            → dist/ (upload bundle for YouTube Playables)
//        node build.mjs --preview  → preview/flop-labs.html (single self-contained file)
//        node build.mjs --dev      → dist/ unminified with source maps
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';

const preview = process.argv.includes('--preview');
const dev = process.argv.includes('--dev');
const SDK = '<script src="https://www.youtube.com/game_api/v1"></script>';

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

if (preview) {
  html = html
    .replace('<!--SDK-->', '')
    .replace('<link rel="stylesheet" href="game.css" />', () => `<style>${css}</style>`)
    .replace('<script src="game.js"></script>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  await mkdir('preview', { recursive: true });
  await writeFile('preview/flop-labs.html', html);
  const { size } = await stat('preview/flop-labs.html');
  console.log(`preview/flop-labs.html  ${(size / 1024 / 1024).toFixed(2)} MB`);
} else {
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', html.replace('<!--SDK-->', SDK));
  await writeFile('dist/game.js', js);
  await writeFile('dist/game.css', css);
  const total = Buffer.byteLength(js) + Buffer.byteLength(css) + Buffer.byteLength(html);
  console.log(`dist/  ${(total / 1024 / 1024).toFixed(2)} MB`);
}
