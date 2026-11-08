/**
 * Player-name dialog for Google-signed-in players, plus the sign-in-time
 * claim flow that uses it.
 *
 * A Google player's leaderboard name comes from their Google profile, which
 * nobody else is stopped from using. So right after sign-in the name is
 * claimed in the shared `playerNames` index; if it is invalid or someone else
 * already owns it, the player is asked for a different one.
 *
 * (Name+PIN / guest players are handled by the Settings name dialog.)
 * @module ui/PlayerNameDialog
 */

import { Settings } from '../systems/SettingsManager.js';
import { containsProfanity } from '../systems/ProfanityFilter.js';

/**
 * Validation message for a player name, or '' if it is acceptable.
 * Same rules as the Settings name dialog.
 * @param {string} name
 * @returns {string}
 */
export function validatePlayerName(name) {
    if (!name) return '';
    if ((name.match(/@/g) || []).length > 1) return 'Only one @ sign is allowed';
    if (!/^[a-zA-Z0-9._@-]+$/.test(name)) return 'Only letters, numbers, . - _ and @ are allowed';
    if (name.length < 2) return 'Name must be at least 2 characters';
    if (containsProfanity(name)) return 'Please choose a different name';
    return '';
}

/**
 * A valid player-name suggestion from a Firebase user's Google profile
 * (display name, else email prefix), or '' if nothing usable can be derived.
 * @param {object|null} user  Firebase user.
 * @returns {string}
 */
export function suggestGoogleName(user) {
    if (!user) return '';
    for (const raw of [user.displayName, (user.email || '').split('@')[0]]) {
        const name = (raw || '').trim()
            .normalize('NFD').replace(/[̀-ͯ]/g, '') // Zoë → Zoe
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '')
            .slice(0, 30);
        if (name && !validatePlayerName(name)) return name;
    }
    return '';
}

/**
 * Stores `name` as this player's name locally and in settings, and claims it
 * in the `playerNames` index (releasing the previous name).
 * @param {string} name
 */
function commitPlayerName(name) {
    const oldName = localStorage.getItem('playerName') || '';
    localStorage.setItem('playerName', name);
    Settings.playerName = name; // persists to Firebase via save()
    Settings.claimPlayerName?.(name, oldName || null);
}

/**
 * Makes sure a Google-signed-in player has a validated, claimed player name.
 * Call after a successful Google sign-in.
 *
 * Uses the name already saved for the account, else one suggested from their
 * Google profile. If that is free (or already theirs) it is claimed silently;
 * if it is invalid or taken, the name dialog opens. Skipping the dialog leaves
 * the player without a name (no leaderboard scores until they set one in Settings).
 *
 * @param {Phaser.Scene} scene
 * @param {object} user  Firebase user just signed in.
 * @returns {Promise<string>} The claimed name, or '' if the player skipped.
 */
export async function ensureGooglePlayerName(scene, user) {
    try {
        await Settings.load?.(); // restore the name saved on this account (cloud)
    } catch { /* settings fall back to what is already loaded */ }

    const saved     = (Settings.playerName || localStorage.getItem('playerName') || '').trim();
    const candidate = saved || suggestGoogleName(user);

    let notice = '';
    if (candidate) {
        const invalid = validatePlayerName(candidate);
        if (invalid) {
            notice = invalid;
        } else if (await Settings.checkPlayerNameAvailable?.(candidate) ?? true) {
            commitPlayerName(candidate);
            return candidate;
        } else {
            notice = `"${candidate}" is already taken. Please choose another name.`;
        }
    }
    return showGooglePlayerNameDialog(scene, { initialName: candidate, notice });
}

/**
 * HTML overlay asking a Google player for a unique player name. On Save the
 * name is validated, checked against the `playerNames` index and claimed.
 *
 * @param {Phaser.Scene} scene
 * @param {object} [opts]
 * @param {string} [opts.initialName='']  Pre-filled name.
 * @param {string} [opts.notice='']       Message shown above the field (e.g. why the name was rejected).
 * @returns {Promise<string>} The claimed name, or '' if the player skipped.
 */
export function showGooglePlayerNameDialog(scene, { initialName = '', notice = '' } = {}) {
    return new Promise((resolve) => {
        document.getElementById('player-name-input-overlay')?.remove();
        scene.input.keyboard?.disableGlobalCapture();

        const overlay = document.createElement('div');
        overlay.id = 'player-name-input-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
            'background:rgba(0,0,0,0.78)',
            'display:flex', 'align-items:center', 'justify-content:center',
            'z-index:99999',
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'background:#2a2a2a', 'border:2px solid #00ffcc', 'border-radius:8px',
            'padding:28px 32px', 'display:flex', 'flex-direction:column',
            'align-items:center', 'gap:14px', 'min-width:300px', 'max-width:90vw',
        ].join(';');

        const title = document.createElement('div');
        title.textContent = 'Choose a Player Name';
        title.style.cssText = 'color:#ffffff;font-family:Arial;font-size:20px;font-weight:bold;';

        const hint = document.createElement('div');
        hint.textContent = 'Shown on the leaderboard. Letters, numbers, . - _ and at most one @ allowed.';
        hint.style.cssText = 'color:#888888;font-family:Arial;font-size:13px;text-align:center;max-width:300px;';

        const noticeMsg = document.createElement('div');
        noticeMsg.textContent = notice;
        noticeMsg.style.cssText = 'color:#ffaa00;font-family:Arial;font-size:14px;text-align:center;max-width:300px;';
        noticeMsg.style.display = notice ? 'block' : 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 30;
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocapitalize', 'none');
        input.setAttribute('spellcheck', 'false');
        input.value = initialName;
        input.placeholder = 'Player name';
        input.style.cssText = [
            'background:#1a1a1a', 'border:1px solid #555', 'border-radius:4px',
            'color:#ffffff', 'font-family:Arial', 'font-size:18px',
            'padding:8px 14px', 'width:240px', 'text-align:center',
            'outline:none', 'box-sizing:border-box',
        ].join(';');

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color:#ff6666;font-family:Arial;font-size:13px;min-height:16px;text-align:center;max-width:300px;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:16px;margin-top:4px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = 'background:#00ffcc;color:#000;border:none;border-radius:4px;padding:9px 28px;font-family:Arial;font-size:16px;cursor:pointer;';

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Skip';
        skipBtn.style.cssText = 'background:#555;color:#fff;border:none;border-radius:4px;padding:9px 28px;font-family:Arial;font-size:16px;cursor:pointer;';

        const skipNote = document.createElement('div');
        skipNote.textContent = 'Without a name your scores are not posted to the leaderboard. You can set one later in Settings.';
        skipNote.style.cssText = 'color:#666666;font-family:Arial;font-size:12px;text-align:center;max-width:300px;';

        const close = (result) => {
            input.blur(); // dismiss the soft keyboard before removing the overlay
            scene.input.keyboard?.enableGlobalCapture();
            overlay.remove();
            // Once the keyboard has animated out, make Phaser re-measure the canvas.
            const fixScale = () => {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                window.dispatchEvent(new Event('resize'));
            };
            setTimeout(fixScale, 450);
            setTimeout(fixScale, 800);
            // Ignore ghost touches on Phaser buttons for a moment.
            if (scene.input) scene.input.enabled = false;
            scene.time?.delayedCall(900, () => { if (scene.input) scene.input.enabled = true; });
            resolve(result);
        };

        let busy = false;
        const doSave = async () => {
            if (busy) return;
            const name = input.value.trim();
            const err  = !name ? 'Enter a name, or tap Skip' : validatePlayerName(name);
            if (err) { errorMsg.textContent = err; return; }

            busy = true;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Checking…';
            const available = await Settings.checkPlayerNameAvailable?.(name) ?? true;
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
            busy = false;
            if (!available) {
                errorMsg.textContent = 'That name is already taken. Please choose another.';
                return;
            }
            commitPlayerName(name);
            close(name);
        };
        const doSkip = () => { if (!busy) close(''); };

        // Taps inside the box must not reach whatever sits behind the overlay.
        box.addEventListener('pointerdown', (e) => e.stopPropagation());
        box.addEventListener('touchstart',  (e) => e.stopPropagation());

        saveBtn.addEventListener('click', doSave);
        saveBtn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); doSave(); });
        skipBtn.addEventListener('click', doSkip);
        skipBtn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); doSkip(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  doSave();
            if (e.key === 'Escape') doSkip();
        });
        input.addEventListener('input', () => { errorMsg.textContent = ''; });

        btnRow.append(saveBtn, skipBtn);
        box.append(title, hint, noticeMsg, input, errorMsg, btnRow, skipNote);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 50);
    });
}
