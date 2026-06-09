#!/usr/bin/env node
// scripts/bump-version.js
// Increments the patch (third) number of the version in package.json,
// then updates that version string in:
//   • public/assets/data/about.txt  (if it exists)
//   • android/app/build.gradle      (if it exists — bumps versionCode too)
//
// Usage (from the game root):
//   node node_modules/@gamebase/gbengine/scripts/bump-version.js
// Or via npm script "bump": "node node_modules/@gamebase/gbengine/scripts/bump-version.js"

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve paths relative to the CWD (the game root, not GBEngine)
const cwd = process.cwd();

// ── 1. Bump package.json ──────────────────────────────────────────────────────
const pkgPath = resolve(cwd, 'package.json');
if (!existsSync(pkgPath)) {
    console.error('ERROR: package.json not found at', pkgPath);
    process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const oldVersion = pkg.version ?? '0.0.0';
const parts = oldVersion.split('.').map(Number);
if (parts.length < 3 || parts.some(isNaN)) {
    console.error('ERROR: version in package.json is not semver:', oldVersion);
    process.exit(1);
}
parts[2] += 1;
const newVersion = parts.join('.');
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n', 'utf-8');
console.log(`package.json: ${oldVersion} → ${newVersion}`);

// ── 2. Update about.txt ───────────────────────────────────────────────────────
const aboutPath = resolve(cwd, 'public/assets/data/about.txt');
if (existsSync(aboutPath)) {
    const text = readFileSync(aboutPath, 'utf-8');
    const updated = text.replace(/Version \d+\.\d+\.\d+\S*/i, `Version ${newVersion}`);
    if (updated !== text) {
        writeFileSync(aboutPath, updated, 'utf-8');
        console.log(`about.txt:    updated to Version ${newVersion}`);
    } else {
        console.log(`about.txt:    no "Version x.y.z" line found — skipped`);
    }
} else {
    console.log(`about.txt:    not found — skipped`);
}

// ── 3. Update android/app/build.gradle ───────────────────────────────────────
const gradlePath = resolve(cwd, 'android/app/build.gradle');
if (existsSync(gradlePath)) {
    let gradle = readFileSync(gradlePath, 'utf-8');

    // Bump versionCode by 1
    gradle = gradle.replace(/versionCode\s+(\d+)/, (_, n) => {
        const next = parseInt(n, 10) + 1;
        console.log(`build.gradle: versionCode ${n} → ${next}`);
        return `versionCode ${next}`;
    });

    // Replace versionName with new semver
    gradle = gradle.replace(/versionName\s+"[^"]+"/, () => {
        console.log(`build.gradle: versionName → "${newVersion}"`);
        return `versionName "${newVersion}"`;
    });

    writeFileSync(gradlePath, gradle, 'utf-8');
} else {
    console.log(`build.gradle: not found — skipped`);
}

console.log('Done.');
