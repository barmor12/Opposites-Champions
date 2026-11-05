// Dev-only runtime resolver for `nest start --watch`, where scripts/fix-aliases.mjs does not run.
// Maps require("@oc/shared") / require("@oc/content") to the compiled copies under dist/packages.
// Production builds do not need this: `pnpm build` rewrites the requires statically.
const Module = require('node:module');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const distRoot = join(__dirname, '..', 'dist');
const targets = {
  '@oc/shared': join(distRoot, 'packages', 'shared', 'src', 'index.js'),
  '@oc/content': join(distRoot, 'packages', 'content', 'src', 'index.js'),
};

const original = Module._resolveFilename;
Module._resolveFilename = function resolveWithAliases(request, ...rest) {
  const target = targets[request];
  if (target && existsSync(target)) return target;
  return original.call(this, request, ...rest);
};
