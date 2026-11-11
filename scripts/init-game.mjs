#!/usr/bin/env node
// Scaffolds a new Greenbox game from templates/game: Vite + Phaser + Capacitor project with the
// shared account flow already wired (no login screen, Google sign-in / name+PIN in Settings,
// guest progress that merges into the account, public leaderboard, Delete Account, Android
// overlay + signing scripts, Firebase dev/prod config, database rules).
//
//   node D:/dev/gamebase/GBEngine/scripts/init-game.mjs <targetDir> --name "Sky Pirates" \
//        [--slug skypirates] [--package com.greenboxent.skypirates] [--admob ca-app-pub-…~…] \
//        [--gbengine github:greenboxent/GBEngine#main] [--port 5176]
//
// Then follow the printed next steps (npm install, create the Firebase projects, fill the configs).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const templateDir = resolve(here, '..', 'templates', 'game');
const sharedImages = resolve(here, '..', 'assets', 'images');

const args = process.argv.slice(2);
const target = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const opt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const name = opt('name');
if (!target || !name) {
    console.error('Usage: init-game.mjs <targetDir> --name "Game Name" [--slug id] [--package com.x.y] [--admob appId] [--gbengine spec] [--port n]');
    process.exit(1);
}
const slug = opt('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, ''));
if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    console.error(`--slug must be lowercase letters/digits/hyphens starting with a letter (got "${slug}")`);
    process.exit(1);
}
const pkg = opt('package', `com.greenboxent.${slug.replace(/-/g, '')}`);
if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(pkg)) {
    console.error(`--package must look like com.greenboxent.mygame (got "${pkg}")`);
    process.exit(1);
}

const tokens = {
    NAME: name,
    SLUG: slug,
    PACKAGE: pkg,
    PACKAGE_PATH: pkg.split('.').join('/'),
    ADMOB_APP_ID: opt('admob', 'ca-app-pub-3940256099942544~3347511713'), // Google's sample app ID until you create the AdMob app
    GBENGINE_DEP: opt('gbengine', 'github:greenboxent/GBEngine#main'),
    PORT: opt('port', '5176'),
    YEAR: String(new Date().getFullYear()),
};
const fill = text => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));

const dest = resolve(target);
if (existsSync(dest) && readdirSync(dest).length) {
    console.error(`${dest} exists and is not empty — refusing to overwrite.`);
    process.exit(1);
}

let count = 0;
function copyTree(from, to) {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
        const src = join(from, entry);
        // PACKAGE_PATH expands to com/greenboxent/x, so a path segment can create several levels.
        const outName = entry === 'gitignore' ? '.gitignore' : fill(entry);
        const out = join(to, outName);
        if (statSync(src).isDirectory()) {
            copyTree(src, out);
        } else {
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, fill(readFileSync(src, 'utf8')));
            count++;
        }
    }
}
copyTree(templateDir, dest);

// Shared UI assets that BaseBootScene loads from /shared-assets/ (served from the game's public/ dir).
if (existsSync(sharedImages)) {
    cpSync(sharedImages, join(dest, 'public', 'shared-assets', 'images'), { recursive: true });
}

console.log(`Created ${name} (${slug}, ${pkg}) in ${dest} — ${count} files.\n`);
console.log(`Next steps:
  1. cd ${target} && git init && npm install
  2. Firebase: create projects ${slug}-dev and ${slug}-prod (Realtime Database + Authentication: Google, Email/Password,
     Anonymous not needed). Fill src/config/firebaseConfig.dev.js / .prod.js, then
       firebase deploy --only database -P dev   (and -P prod)      # database.rules.json
  3. Google sign-in: add the Android app (${pkg}) to each project, add your SHA-1/SHA-256, and put the
     downloaded google-services.json in config/android/dev/ and config/android/prod/. Set the web
     OAuth client id in capacitor.config.json (plugins.FirebaseAuthentication.clientId).
  4. AdMob: create the app + units, set the app id (capacitor.config.json, AndroidManifest.xml) and the
     unit ids in src/config/adConfig.js.
  5. Android: copy config/android/keystore.properties.example to android/keystore.properties and fill it in;
     generate icons with @capacitor/assets; then  npm run android:release.
  6. npm run dev — the starter opens on the main menu; Settings → Game has the account block.
  7. Play Console: Data safety (see GBEngine README → "Starting a new game"), privacy policy URL, deletion URL
     https://${slug}-prod.web.app/delete-account.`);
