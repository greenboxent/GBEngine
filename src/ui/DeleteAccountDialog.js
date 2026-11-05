/**
 * In-game "Delete Account" confirmation. A DOM overlay (like the Settings name/PIN
 * dialog) so it gets a real password field and soft keyboard. On success the page
 * is reloaded: the account, local storage and every in-memory singleton are gone,
 * so the game restarts cleanly at its sign-in screen.
 * @module ui/DeleteAccountDialog
 */

import { Capacitor } from '@capacitor/core';
import { firebaseService } from '../systems/FirebaseService.js';
import {
    authProviderId,
    deleteAccount,
    deletionErrorMessage,
    reauthWithPin,
    reauthWithGooglePopup,
} from '../systems/AccountDeletion.js';

async function reauthWithGoogle(user) {
    if (!Capacitor.isNativePlatform()) return reauthWithGooglePopup(user);
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const { GoogleAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result?.credential?.idToken;
    if (!idToken) throw new Error('Google sign-in was cancelled.');
    return reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
}

const el = (tag, css, text) => {
    const e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
};

/**
 * Show the confirmation dialog for the signed-in player. No-op when signed out.
 *
 * @param {Phaser.Scene} scene  The scene showing the dialog (its keyboard capture is paused meanwhile).
 * @param {import('../systems/AccountDeletion.js').AccountDataConfig} config  Where the game keeps player data.
 */
export function showDeleteAccountDialog(scene, config) {
    const user = firebaseService.getUser();
    const provider = authProviderId(user);
    if (!provider) return;

    document.getElementById('delete-account-overlay')?.remove();
    scene.input.keyboard?.disableGlobalCapture();

    const overlay = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:99999;');
    overlay.id = 'delete-account-overlay';
    const box = el('div', 'background:#2a2a2a;border:2px solid #ff5555;border-radius:8px;padding:26px 30px;display:flex;flex-direction:column;align-items:center;gap:14px;width:340px;max-width:90vw;box-sizing:border-box;');

    const title = el('div', 'color:#fff;font-family:Arial;font-size:20px;font-weight:bold;', 'Delete Account');
    const how = {
        'google.com': 'You will be asked to confirm with your Google account.',
        password:     'Enter your PIN to confirm.',
        anonymous:    'This removes the guest data saved for this device.',
    }[provider] ?? '';
    const warning = el('div', 'color:#ddd;font-family:Arial;font-size:14px;text-align:center;line-height:1.4;',
        'This permanently deletes your account, scores, progress and settings, and removes your name from the leaderboard. This cannot be undone.');
    const hint = el('div', 'color:#888;font-family:Arial;font-size:13px;text-align:center;', how);

    const pinInput = el('input', 'background:#1a1a1a;border:1px solid #555;border-radius:4px;color:#fff;font-family:Arial;font-size:18px;padding:8px 14px;width:200px;text-align:center;outline:none;box-sizing:border-box;');
    pinInput.type = 'password';
    pinInput.inputMode = 'numeric';
    pinInput.maxLength = 12;
    pinInput.placeholder = 'PIN';
    pinInput.setAttribute('autocomplete', 'off');

    const status = el('div', 'color:#ff6666;font-family:Arial;font-size:13px;min-height:16px;text-align:center;');
    const row = el('div', 'display:flex;gap:16px;margin-top:4px;');
    const deleteBtn = el('button', 'background:#ff5555;color:#fff;border:none;border-radius:4px;padding:9px 22px;font-family:Arial;font-size:16px;cursor:pointer;', 'Delete Forever');
    const cancelBtn = el('button', 'background:#555;color:#fff;border:none;border-radius:4px;padding:9px 22px;font-family:Arial;font-size:16px;cursor:pointer;', 'Cancel');

    let busy = false;
    const close = () => {
        if (busy) return;
        pinInput.blur();
        scene.input.keyboard?.enableGlobalCapture();
        overlay.remove();
        const fixScale = () => { window.scrollTo(0, 0); window.dispatchEvent(new Event('resize')); };
        setTimeout(fixScale, 450);
        if (scene.input) scene.input.enabled = false; // swallow ghost touches from the keyboard dismissing
        scene.time.delayedCall(900, () => { if (scene.input) scene.input.enabled = true; });
    };

    const doDelete = async () => {
        if (busy) return;
        const pin = pinInput.value.trim();
        if (provider === 'password' && !/^\d{6,12}$/.test(pin)) { status.textContent = 'PIN must be 6-12 digits'; return; }
        busy = true;
        deleteBtn.disabled = cancelBtn.disabled = true;
        status.style.color = '#aaa';
        status.textContent = 'Deleting…';
        try {
            await deleteAccount(firebaseService.getAuth(), firebaseService.getDatabase(), config, {
                reauthenticate: u => (authProviderId(u) === 'password' ? reauthWithPin(u, pin) : reauthWithGoogle(u)),
            });
            localStorage.clear();
            location.reload();
        } catch (e) {
            busy = false;
            deleteBtn.disabled = cancelBtn.disabled = false;
            status.style.color = '#ff6666';
            status.textContent = deletionErrorMessage(e);
        }
    };

    box.addEventListener('pointerdown', e => e.stopPropagation());
    box.addEventListener('touchstart', e => e.stopPropagation());
    deleteBtn.addEventListener('click', doDelete);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') doDelete(); if (e.key === 'Escape') close(); });
    pinInput.addEventListener('input', () => { status.textContent = ''; });

    row.append(deleteBtn, cancelBtn);
    box.append(title, warning, hint);
    if (provider === 'password') box.append(pinInput);
    box.append(status, row);
    overlay.append(box);
    document.body.append(overlay);
    if (provider === 'password') pinInput.focus();
}
