/**
 * Standalone "delete my account" web page — the URL Google Play asks for. Import
 * it from the `@gamebase/gbengine/delete-account-page` subpath (it deliberately
 * avoids the main barrel, which would pull Phaser into a plain HTML page).
 *
 * A game's page is just:
 * ```html
 * <!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
 * <body><script type="module" src="/src/web/deleteAccountPage.js"></script></body></html>
 * ```
 * ```js
 * import { mountDeleteAccountPage } from '@gamebase/gbengine/delete-account-page';
 * mountDeleteAccountPage({ firebaseConfig, appName: 'My Game', data: ACCOUNT_DATA });
 * ```
 * Host it at a stable URL (e.g. a `/delete-account` Firebase Hosting rewrite).
 * @module web/DeleteAccountPage
 */

import { deleteAccount, deletionErrorMessage } from '../systems/AccountDeletion.js';
import { NAME_AUTH_DOMAIN, sanitizeNameKey } from '../systems/nameKey.js';

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; padding: 32px 16px;
       background: #0f0f1a; color: #c8c8d4; font: 16px/1.5 Arial, Helvetica, sans-serif; }
main { width: 100%; max-width: 520px; background: #1a1a2e; border: 1px solid #2c2c48; border-radius: 14px; padding: 28px; }
h1 { margin: 0 0 4px; color: #ff6b6b; font-size: 28px; }
.sub { margin: 0 0 22px; color: #888; font-size: 14px; }
h2 { margin: 22px 0 8px; font-size: 16px; color: #e8e8f0; }
ul { margin: 0; padding-left: 22px; }
li { margin: 4px 0; }
.box { background: #11111f; border: 1px solid #2c2c48; border-radius: 10px; padding: 16px; margin-top: 12px; }
button, input { font: inherit; border-radius: 8px; }
input { width: 100%; padding: 11px 12px; margin: 6px 0; background: #0c0c16; border: 1px solid #3a3a58; color: #fff; }
button { width: 100%; padding: 12px; margin-top: 8px; border: 0; cursor: pointer; font-weight: bold; }
button:disabled { opacity: .5; cursor: default; }
.google { background: #fff; color: #222; }
.danger { background: #e04848; color: #fff; }
.secondary { background: #3a3a58; color: #fff; }
.or { text-align: center; color: #666; margin: 14px 0 4px; font-size: 13px; }
#msg { min-height: 22px; margin-top: 12px; font-size: 14px; }
#msg.err { color: #ff7777; } #msg.ok { color: #6ee7a0; }
[hidden] { display: none !important; }
`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Render the page into `document.body` and wire it to Firebase.
 *
 * @param {object} options
 * @param {object} options.firebaseConfig  The game's Firebase web config (for the right dev/prod project).
 * @param {string} options.appName         Game name shown to the player (Play wants it on this page).
 * @param {import('../systems/AccountDeletion.js').AccountDataConfig} options.data  Where the game keeps player data.
 * @param {string} [options.developer='Green Box Games']
 * @param {string} [options.inAppPath='Settings → Game → Delete Account']  Where the in-game button lives.
 * @returns {Promise<void>}
 */
export async function mountDeleteAccountPage({ firebaseConfig, appName, data, developer = 'Green Box Games', inAppPath = 'Settings → Game → Delete Account' }) {
    document.title = `Delete Your ${appName} Account`;
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex';
    document.head.append(meta);
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);

    document.body.innerHTML = `
<main>
  <h1>Delete Your Account</h1>
  <p class="sub">${esc(appName)} &middot; ${esc(developer)}</p>
  <p>Use this page to permanently delete your ${esc(appName)} account and the data stored with it.</p>
  <h2>What gets deleted</h2>
  <ul>
    <li>Your account (Google or name + PIN sign-in)</li>
    <li>Your level progress, personal best scores and saved settings</li>
    <li>Your leaderboard entries and your reserved player name</li>
  </ul>
  <p>Deletion happens immediately and cannot be undone. Nothing is kept afterwards. Data stored only on your own device is removed by uninstalling the app or clearing its data.</p>
  <h2>In the app</h2>
  <p>Open <strong>${esc(inAppPath)}</strong>.</p>
  <h2>On this page</h2>
  <div id="signin" class="box">
    <p style="margin-top:0">Sign in the way you play ${esc(appName)} to confirm it is your account.</p>
    <button id="google" class="google">Sign in with Google</button>
    <div class="or">or use your name and PIN</div>
    <input id="name" type="text" placeholder="Player name" autocomplete="off" autocapitalize="none" spellcheck="false" />
    <input id="pin" type="password" inputmode="numeric" maxlength="12" placeholder="PIN" autocomplete="off" />
    <button id="pinSignin" class="secondary">Sign in with name + PIN</button>
  </div>
  <div id="confirm" class="box" hidden>
    <p style="margin-top:0">Signed in as <strong id="who"></strong>.</p>
    <p>This will permanently delete this account and all of its data.</p>
    <button id="delete" class="danger">Delete my account forever</button>
    <button id="cancel" class="secondary">Cancel</button>
  </div>
  <div id="msg" role="status"></div>
</main>`;

    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithPopup, signInWithEmailAndPassword, signOut, GoogleAuthProvider } = await import('firebase/auth');
    const { getDatabase } = await import('firebase/database');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);

    const $ = id => document.getElementById(id);
    const say = (text, kind = '') => { $('msg').textContent = text; $('msg').className = kind; };

    const showConfirm = user => {
        $('who').textContent = user.email?.endsWith('@' + NAME_AUTH_DOMAIN)
            ? user.email.split('@')[0]
            : (user.email || 'your account');
        $('signin').hidden = true;
        $('confirm').hidden = false;
        say('');
    };

    const busy = on => document.querySelectorAll('button').forEach(b => { b.disabled = on; });
    async function run(task) {
        busy(true);
        try { await task(); } catch (e) { say(deletionErrorMessage(e), 'err'); } finally { busy(false); }
    }

    $('google').addEventListener('click', () => run(async () => {
        say('');
        showConfirm((await signInWithPopup(auth, new GoogleAuthProvider())).user);
    }));

    $('pinSignin').addEventListener('click', () => run(async () => {
        const name = $('name').value.trim();
        const pin = $('pin').value.trim();
        if (!name || !/^\d{6,12}$/.test(pin)) { say('Enter your player name and a 6-12 digit PIN.', 'err'); return; }
        showConfirm((await signInWithEmailAndPassword(auth, `${sanitizeNameKey(name)}@${NAME_AUTH_DOMAIN}`, pin)).user);
    }));

    $('delete').addEventListener('click', () => run(async () => {
        say('Deleting…');
        await deleteAccount(auth, db, data); // just signed in, so no re-authentication step
        $('confirm').hidden = true;
        say('Your account and its data have been permanently deleted.', 'ok');
    }));

    $('cancel').addEventListener('click', () => run(async () => {
        await signOut(auth);
        $('confirm').hidden = true;
        $('signin').hidden = false;
        say('');
    }));
}
