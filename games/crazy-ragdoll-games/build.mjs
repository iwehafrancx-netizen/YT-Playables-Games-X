// Usage: node build.mjs            → dist/ (upload bundle for YouTube Playables)
//        node build.mjs --target=crazygames-basic  → dist-crazygames-basic/ (Basic Launch, no ads)
//        node build.mjs --target=crazygames-full   → dist-crazygames-full/ (Full Launch, with ads)
//        node build.mjs --target=playgama          → dist-playgama/ (Playgama Bridge, with ads)
//        node build.mjs --preview  → preview/crazy-ragdoll-games.html (single self-contained file)
//        node build.mjs --dev      → dist/ unminified with source maps
//        node build.mjs --embed    → preview/crazy-ragdoll-games-embed.html: body-only page for hosts that supply the document shell
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm, stat, copyFile } from 'node:fs/promises';

const preview = process.argv.includes('--preview');
const embed = process.argv.includes('--embed');
const dev = process.argv.includes('--dev');
const target = process.argv.find((a) => a.startsWith('--target='))?.slice(9) ?? 'youtube';

// Each storefront gets its own SDK tag, build-time platform choice and output folder.
const TARGETS = {
  youtube: { platform: 'youtube', ads: false, out: 'dist', sdk: '<script src="https://www.youtube.com/game_api/v1"></script>' },
  'crazygames-basic': { platform: 'crazygames', ads: false, out: 'dist-crazygames-basic', sdk: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>' },
  'crazygames-full': { platform: 'crazygames', ads: true, out: 'dist-crazygames-full', sdk: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>' },
  playgama: { platform: 'playgama', ads: true, out: 'dist-playgama', sdk: '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>', files: ['playgama-bridge-config.json'] },
};
const T = TARGETS[target];
if (!T) throw new Error(`Unknown target "${target}". Use one of: ${Object.keys(TARGETS).join(', ')}`);

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  loader: { '.woff2': 'dataurl' },
  define: { __TARGET__: JSON.stringify(T.platform), __ADS__: String(T.ads) },
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
  const page = `<title>Crazy Ragdoll Games</title>\n<meta name="theme-color" content="#f4f5f7" />\n<style>${css}</style>\n${body.trim()}\n`;
  await mkdir('preview', { recursive: true });
  await writeFile('preview/crazy-ragdoll-games-embed.html', page);
  const { size } = await stat('preview/crazy-ragdoll-games-embed.html');
  console.log(`preview/crazy-ragdoll-games-embed.html  ${(size / 1024 / 1024).toFixed(2)} MB`);
} else if (preview) {
  html = html
    .replace('<!--SDK-->', '')
    .replace('<link rel="stylesheet" href="game.css" />', () => `<style>${css}</style>`)
    .replace('<script src="game.js"></script>', inlineScript);
  await mkdir('preview', { recursive: true });
  await writeFile('preview/crazy-ragdoll-games.html', html);
  const { size } = await stat('preview/crazy-ragdoll-games.html');
  console.log(`preview/crazy-ragdoll-games.html  ${(size / 1024 / 1024).toFixed(2)} MB`);
} else {
  await rm(T.out, { recursive: true, force: true });
  await mkdir(T.out, { recursive: true });
  await writeFile(`${T.out}/index.html`, html.replace('<!--SDK-->', T.sdk));
  await writeFile(`${T.out}/game.js`, js);
  await writeFile(`${T.out}/game.css`, css);
  for (const f of T.files ?? []) await copyFile(`platform/${f}`, `${T.out}/${f}`);
  const total = Buffer.byteLength(js) + Buffer.byteLength(css) + Buffer.byteLength(html);
  console.log(`${T.out}/  ${(total / 1024 / 1024).toFixed(2)} MB`);
}
