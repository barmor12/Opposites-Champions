// Rewrites require("@oc/shared") / require("@oc/content") in dist/**/*.js
// to relative paths pointing at dist/packages/<pkg>/src/index.js.
// Needed because the workspace packages are TypeScript sources compiled into dist
// (rootDir = repo root) and Node cannot resolve the "@oc/*" workspace symlinks (.ts main).
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(serverRoot, 'dist');
const PACKAGES = ['shared', 'content'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split('\\').join('/');
}

if (!existsSync(distRoot)) {
  console.error(`[fix-aliases] dist not found at ${distRoot}`);
  process.exit(1);
}

let rewritten = 0;
for (const file of walk(distRoot)) {
  let src = readFileSync(file, 'utf8');
  let changed = false;
  for (const pkg of PACKAGES) {
    const target = join(distRoot, 'packages', pkg, 'src', 'index.js');
    if (!existsSync(target)) continue;
    let rel = toPosix(relative(dirname(file), target));
    if (!rel.startsWith('.')) rel = `./${rel}`;
    // Match require("@oc/pkg") with either quote style and optional subpath-less alias.
    const re = new RegExp(`require\\((['"])@oc/${pkg}\\1\\)`, 'g');
    if (re.test(src)) {
      src = src.replace(re, `require("${rel}")`);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(file, src);
    rewritten += 1;
  }
}
console.log(`[fix-aliases] rewrote ${rewritten} file(s)`);
