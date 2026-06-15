#!/usr/bin/env node
// Patches stream-chat-react's ESM dist so Node.js ESM can load it.
// stream-chat-react v12 ships with:
//   1. Bare directory imports (./components → needs /index.js)
//   2. File imports without extensions (./Attachment → needs .js)
//   3. External subpath imports without extensions (dayjs/plugin/calendar → needs .js)
// All illegal in strict Node.js ESM. Runs automatically via postinstall.
const fs = require('fs');
const path = require('path');

const NODE_MODULES = path.join(__dirname, '../node_modules');

function fixFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);

  // Fix JSON imports missing `with { type: 'json' }` (required in Node.js ESM)
  let content = original.replace(
    /^(import\s+\S+\s+from\s+'[^']+\.json')(?!\s*with\s*\{)/gm,
    '$1 with { type: \'json\' }'
  );

  function patchSpecifier(importPath, quote) {
    // Skip if already has an extension
    if (/\.(js|ts|mjs|cjs|json|css|svg)$/.test(importPath)) return null;

    if (importPath.startsWith('.')) {
      // ── Relative imports ──────────────────────────────────────────────
      const resolved = path.resolve(dir, importPath);
      try {
        if (fs.statSync(resolved).isDirectory()) {
          const idx = path.join(resolved, 'index.js');
          if (fs.existsSync(idx)) return `${importPath}/index.js`;
        }
      } catch (_) {}
      if (fs.existsSync(resolved + '.js')) return `${importPath}.js`;
    } else {
      // ── External subpath imports (e.g. dayjs/plugin/calendar, dayjs/locale/de) ──
      const isScoped = importPath.startsWith('@');
      const slashCount = (importPath.match(/\//g) || []).length;
      const hasSubpath = isScoped ? slashCount >= 2 : slashCount >= 1;
      if (hasSubpath) {
        const candidate = path.join(NODE_MODULES, importPath + '.js');
        if (fs.existsSync(candidate)) return `${importPath}.js`;
      }
    }
    return null;
  }

  // Fix `from '...'` imports (named/default/namespace)
  const fixed = content
    .replace(/from '([^']+)'/g, (match, importPath) => {
      const patched = patchSpecifier(importPath);
      return patched ? `from '${patched}'` : match;
    })
    // Fix bare side-effect imports: import 'specifier'
    .replace(/^(import\s+)'([^']+)'(\s*;?)$/gm, (match, prefix, importPath, suffix) => {
      const patched = patchSpecifier(importPath);
      return patched ? `${prefix}'${patched}'${suffix}` : match;
    });

  if (fixed !== original) {
    fs.writeFileSync(filePath, fixed);
    return true;
  }
  return false;
}

function walk(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += walk(full);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.cjs')) {
      if (fixFile(full)) count++;
    }
  }
  return count;
}

const distDir = path.join(__dirname, '../node_modules/stream-chat-react/dist');
if (!fs.existsSync(distDir)) {
  console.log('stream-chat-react not found, skipping patch.');
  process.exit(0);
}

const count = walk(distDir);
console.log(`[fix-stream-esm] Patched ${count} files in stream-chat-react/dist`);
