/**
 * scripts/generate-docs.js
 *
 * Generates docs/index.html from GBEngine JSDoc comments.
 *
 * Usage:  node scripts/generate-docs.js
 * Or via: npm run docs
 *
 * Steps:
 *   1. Runs `jsdoc -X -r src` to dump raw doclets as JSON
 *   2. Groups module doclets by category (derived from @module path)
 *   3. Renders the sidebar HTML + injects doclet data into layout.tmpl
 *   4. Writes docs/index.html and copies docs/template/static/ assets
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ----------------------------------------------------------------
// CATEGORY ORDER  (controls left-nav order)
// ----------------------------------------------------------------
const CATEGORY_ORDER = [
  'engine',
  'scenes',
  'systems',
  'systems/scene',
  'ui',
  'ui/components',
  'ui/styles',
];

// ----------------------------------------------------------------
// 1. Dump doclets via jsdoc -X
// ----------------------------------------------------------------
console.log('Running jsdoc -X to collect doclets…');

const result = spawnSync(
  'node',
  [path.join(root, 'node_modules', 'jsdoc', 'jsdoc.js'), '-X', '-r', 'src'],
  { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
);

if (result.error) {
  console.error('Failed to run jsdoc:', result.error.message);
  process.exit(1);
}

// jsdoc -X writes JSON to stdout; warnings go to stderr
const lines = result.stdout.split('\n');
const jsonStart = lines.findIndex(l => l.trim().startsWith('['));
if (jsonStart === -1) {
  console.error('jsdoc produced no JSON output. stderr:\n', result.stderr);
  process.exit(1);
}
const jsonText = lines.slice(jsonStart).join('\n');

let allDoclets;
try {
  allDoclets = JSON.parse(jsonText);
} catch (e) {
  console.error('Failed to parse jsdoc output:', e.message);
  process.exit(1);
}

// ----------------------------------------------------------------
// 2. Filter to useful doclets
// ----------------------------------------------------------------
const doclets = allDoclets.filter(d =>
  !d.undocumented &&
  d.kind !== 'package' &&
  d.kind !== 'file' &&
  d.kind !== 'typedef'
);

console.log(`  ${doclets.length} relevant doclets (modules, classes, functions, members)`);

// ----------------------------------------------------------------
// 3. Derive category and display name from module path
//    @module engine/Debug  →  category: 'engine',  displayName: 'Debug'
//    @module systems/scene/GameFlowManager  →  category: 'systems/scene'
// ----------------------------------------------------------------
function getCategory(moduleName) {
  const parts = moduleName.split('/');
  return parts.length === 1 ? moduleName : parts.slice(0, -1).join('/');
}

function getDisplayName(moduleName) {
  return moduleName.split('/').pop();
}

// ----------------------------------------------------------------
// 4. Group module doclets by category (in preferred order)
// ----------------------------------------------------------------
const moduleDoclets = doclets.filter(d => d.kind === 'module');

const categoryMap = {};
for (const mod of moduleDoclets) {
  const cat = getCategory(mod.name);
  if (!categoryMap[cat]) categoryMap[cat] = [];
  categoryMap[cat].push(mod);
}

// Sort modules within each category alphabetically
for (const cat of Object.keys(categoryMap)) {
  categoryMap[cat].sort((a, b) => getDisplayName(a.name).localeCompare(getDisplayName(b.name)));
}

// Build ordered categories list
const orderedCategories = [];
for (const cat of CATEGORY_ORDER) {
  if (categoryMap[cat]) orderedCategories.push([cat, categoryMap[cat]]);
}
// Append any categories not in CATEGORY_ORDER
for (const [cat, mods] of Object.entries(categoryMap)) {
  if (!CATEGORY_ORDER.includes(cat)) orderedCategories.push([cat, mods]);
}

// ----------------------------------------------------------------
// 5. Build search index
// ----------------------------------------------------------------
const searchIndex = [];
for (const d of doclets) {
  if (d.kind === 'module') {
    searchIndex.push({
      type: 'module',
      name: getDisplayName(d.name),
      longname: d.longname,
      category: getCategory(d.name),
    });
  } else if (d.kind === 'class') {
    searchIndex.push({
      type: 'class',
      name: d.name,
      longname: d.longname,
      owner: d.memberof || '',
    });
  } else if (d.kind === 'function') {
    searchIndex.push({
      type: 'function',
      name: d.name,
      longname: d.longname,
      owner: d.memberof || '',
    });
  }
}

// ----------------------------------------------------------------
// 6. Render sidebar HTML
// ----------------------------------------------------------------
function renderSidebar(orderedCategories) {
  let html = `<div class="sidebar">`;

  html += `
    <div class="search-box">
      <input id="searchInput" type="text" placeholder="Search modules, classes, methods…" />
      <div id="searchResults" class="search-results"></div>
    </div>
  `;

  for (const [catName, mods] of orderedCategories) {
    html += `
      <div class="category collapsible">
        <div class="category-header">${catName}</div>
        <div class="category-body">
    `;
    for (const mod of mods) {
      const display = getDisplayName(mod.name);
      html += `
        <div class="nav-item module-item" data-longname="${mod.longname}">
          <a href="#${encodeURIComponent(mod.longname)}">${display}</a>
        </div>
      `;
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

// ----------------------------------------------------------------
// 7. Generate HTML
// ----------------------------------------------------------------
const outDir = path.join(root, 'docs');
fs.mkdirSync(outDir, { recursive: true });

const layoutPath = path.join(root, 'docs', 'template', 'layout.tmpl');
if (!fs.existsSync(layoutPath)) {
  console.error('Layout template not found:', layoutPath);
  process.exit(1);
}
const layout = fs.readFileSync(layoutPath, 'utf8');

const sidebarHtml = renderSidebar(orderedCategories);

const html = layout
  .replace('{{SIDEBAR}}', sidebarHtml)
  .replace('{{DOCLETS_JSON}}', JSON.stringify(doclets))
  .replace('{{SEARCH_INDEX}}', JSON.stringify(searchIndex));

const outFile = path.join(outDir, 'index.html');
fs.writeFileSync(outFile, html, 'utf8');

// ----------------------------------------------------------------
// 8. Copy static assets (style.css etc.)
// ----------------------------------------------------------------
const staticDir = path.join(root, 'docs', 'template', 'static');
if (fs.existsSync(staticDir)) {
  for (const file of fs.readdirSync(staticDir)) {
    fs.copyFileSync(path.join(staticDir, file), path.join(outDir, file));
  }
}

console.log(`\nDocs generated → ${outFile}`);
console.log(`Categories: ${orderedCategories.map(([c]) => c).join(', ')}`);
console.log(`Modules: ${moduleDoclets.length}, Classes: ${doclets.filter(d => d.kind === 'class').length}, Functions: ${doclets.filter(d => d.kind === 'function').length}`);
