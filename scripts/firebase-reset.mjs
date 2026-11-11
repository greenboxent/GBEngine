#!/usr/bin/env node
// Wipes a Firebase project's TEST DATA: every Auth user and the listed Realtime
// Database paths, after saving a backup. The Firebase CLI has no "delete all
// users" command, so this calls the Identity Toolkit batchDelete API with the
// CLI's own login (needs a global `firebase-tools` and `firebase login`).
//
// DESTRUCTIVE — meant for clearing a prod project of test accounts right before
// a release. It is a dry run unless you pass --yes.
//
//   node node_modules/@gamebase/gbengine/scripts/firebase-reset.mjs \
//        --project my-game-prod --paths playerNames,my-game-leaderboard,my-game-settings,games/my-game/personalScores \
//        [--backup <dir>] [--yes]
//
// Backups (auth.json + db.json) go to --backup, default ./firebase-backups/<project>-<timestamp>.
// In Git Bash set MSYS_NO_PATHCONV=1 so database paths are not rewritten.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : def;
};
const project = arg('project');
const paths   = (arg('paths', '') || '').split(',').map(p => p.trim().replace(/^\/?/, '/')).filter(p => p !== '/');
const yes     = process.argv.includes('--yes');
if (!project || !paths.length) {
    console.error('Usage: firebase-reset.mjs --project <id> --paths a,b,c [--backup <dir>] [--yes]');
    process.exit(1);
}
const stamp  = new Date().toISOString().replace(/[:.]/g, '-');
const backup = arg('backup', join('firebase-backups', `${project}-${stamp}`));

const firebase = (args, opts = {}) => spawnSync('firebase', [...args, '-P', project], {
    shell: true, encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' }, maxBuffer: 256 * 1024 * 1024, ...opts,
});

// 1. Backup (always, even for a dry run — it is read-only).
mkdirSync(backup, { recursive: true });
const authFile = join(backup, 'auth.json');
const exp = firebase(['auth:export', authFile, '--format=json']);
if (exp.status !== 0) { console.error('auth:export failed:\n' + exp.stderr + exp.stdout); process.exit(1); }
const db = firebase(['database:get', '/']);
writeFileSync(join(backup, 'db.json'), db.stdout || 'null');
const users = JSON.parse(readFileSync(authFile, 'utf8')).users ?? [];
console.log(`Project ${project}: ${users.length} account(s); backup saved to ${backup}`);
users.slice(0, 20).forEach(u => console.log('  ', u.email || u.localId, u.displayName || ''));
if (users.length > 20) console.log(`   … and ${users.length - 20} more`);
console.log('Database paths to remove:', paths.join(', '));

if (!yes) {
    console.log('\nDry run — nothing deleted. Re-run with --yes to delete the accounts and paths above.');
    process.exit(0);
}

// 2. Delete Auth users (Identity Toolkit batchDelete with force, using the CLI login).
if (users.length) {
    const npmRoot = spawnSync('npm', ['root', '-g'], { shell: true, encoding: 'utf8' }).stdout.trim();
    const auth = createRequire(join(npmRoot, 'firebase-tools', 'package.json'))('./lib/auth.js');
    const account = auth.getGlobalDefaultAccount();
    const tok = await auth.getAccessToken(account.tokens.refresh_token, []);
    const token = tok.access_token ?? tok;
    for (let i = 0; i < users.length; i += 1000) { // batchDelete accepts up to 1000 ids
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchDelete`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ localIds: users.slice(i, i + 1000).map(u => u.localId), force: true }),
        });
        if (!r.ok) { console.error('batchDelete failed:', r.status, await r.text()); process.exit(1); }
    }
    console.log(`Deleted ${users.length} account(s).`);
}

// 3. Remove the database paths.
for (const p of paths) {
    const r = firebase(['database:remove', p, '--force']);
    console.log(`${p}: ${r.status === 0 ? 'removed' : 'FAILED ' + r.stderr}`);
}

// 4. Verify.
firebase(['auth:export', authFile + '.after', '--format=json']);
const left = JSON.parse(readFileSync(authFile + '.after', 'utf8')).users ?? [];
console.log(`After: ${left.length} account(s); database: ${(firebase(['database:get', '/']).stdout || '').trim() || 'null'}`);
