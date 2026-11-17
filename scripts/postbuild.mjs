// Post-build steps for the static export in ./out:
// 1. Inject the list of hashed build assets + a build version into out/sw.js (offline precache, cache versioning).
// 2. Inject a strict Content-Security-Policy <meta> into every HTML page, allowing only the exact inline
//    scripts Next.js emitted for that page (by SHA-256 hash) — no 'unsafe-inline' for scripts.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const OUT = 'out';
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// --- 1. service worker precache ---
const assets = walk(join(OUT, '_next', 'static')).map((p) => '/' + relative(OUT, p).split('\\').join('/'));
const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 10);
const swPath = join(OUT, 'sw.js');
const sw = readFileSync(swPath, 'utf8')
  .replace("'__BUILD_VERSION__'", JSON.stringify(version))
  .replace('[] /*__PRECACHE__*/', JSON.stringify(assets));
if (sw.includes('__PRECACHE__') || sw.includes('__BUILD_VERSION__')) throw new Error('sw.js placeholders not replaced');
writeFileSync(swPath, sw);
console.log(`[postbuild] sw.js: ${assets.length} assets precached, version ${version}`);

// --- 2. CSP meta with inline-script hashes ---
const html = walk(OUT).filter((p) => p.endsWith('.html') && !p.endsWith('offline.html'));
const INLINE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
for (const file of html) {
  let src = readFileSync(file, 'utf8');
  if (src.includes('http-equiv="Content-Security-Policy"')) continue;
  const hashes = new Set();
  for (const m of src.matchAll(INLINE)) {
    if (!m[1]) continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", // React/Framer Motion set inline style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  src = src.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${csp}"/>`);
  writeFileSync(file, src);
}
console.log(`[postbuild] CSP meta injected into ${html.length} pages`);
