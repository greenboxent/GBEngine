/**
 * @module scenes/BaseLoginScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';

/**
 * Firebase authentication screen.
 *
 * Presents Sign in with Google, Play as Guest (anonymous sign-in), and
 * optionally a link-account flow for returning anonymous users.
 * Calls `_onLoginComplete(user)` after a successful sign-in.
 *
 * Override hooks:
 * - `_onLoginComplete(user)` — navigate forward after sign-in
 * - `_getTitle()` — heading string (default: `'Sign In'`)
 * - `_getPrivacyUrl()` / `_getTermsUrl()` — legal link URLs
 * - `_getModalConfig(width, height)` — panel size/style
 */
export default class BaseLoginScene extends Phaser.Scene {
    /**
     * @param {string} [key='LoginScene']
     * @param {object} firebaseService  FirebaseService singleton.
     */
    constructor(key = 'LoginScene', firebaseService = null) {
        super(key);
        this._fb           = firebaseService;
        this.modal         = null;
        this.inputController = null;
        this.inputCooldown = 0;
    }

    /** Inject FirebaseService after construction. */
    setFirebaseService(fb) { this._fb = fb; }

    /**
     * Builds the login modal with privacy links, sign-in buttons and status text.
     * @override
     */
    create() {
        const { width, height } = this.scale;

        const isAndroid = /Android/i.test(navigator.userAgent);
        const linkFs  = Math.max(14, Math.round(height * 0.025));
        const msgFs   = Math.max(13, Math.round(height * 0.022));
        const btnFs   = `${Math.max(18, Math.round(height * 0.038))}px`;
        const lineH   = Math.round(height * 0.055);
        const btnGap  = Math.round(height * 0.095);

        this.modal = new ModalBase(this, this._getModalConfig(width, height));

        const cx = this.modal.getCenterX();
        let y = this.modal.getContentStartY() + Math.round(height * 0.025);

        // Title
        createText(this, cx, y, this._getTitle(), {
            fontSize: `${Math.max(28, Math.round(height * 0.06))}px`,
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(100000);
        y += lineH * 1.5;

        // Privacy Policy
        const privacyText = this.add.text(cx, y, 'Privacy Policy', {
            fontSize: `${linkFs}px`, fontFamily: 'Arial', color: '#4A9EFF',
        }).setOrigin(0.5).setDepth(100000).setInteractive({ useHandCursor: true });
        privacyText.on('pointerdown', () => window.open(this._getPrivacyUrl(), '_blank'));
        privacyText.on('pointerover', () => privacyText.setColor('#6BB6FF'));
        privacyText.on('pointerout',  () => privacyText.setColor('#4A9EFF'));
        y += lineH;

        // Terms
        const termsText = this.add.text(cx, y, 'Terms & Conditions', {
            fontSize: `${linkFs}px`, fontFamily: 'Arial', color: '#4A9EFF',
        }).setOrigin(0.5).setDepth(100000).setInteractive({ useHandCursor: true });
        termsText.on('pointerdown', () => window.open(this._getTermsUrl(), '_blank'));
        termsText.on('pointerover', () => termsText.setColor('#6BB6FF'));
        termsText.on('pointerout',  () => termsText.setColor('#4A9EFF'));
        y += lineH;

        // Sign-in message
        const message = 'Sign in for cross-device scores & leaderboard';
        const messageText = this.add.text(cx, y, message, {
            fontSize: `${msgFs}px`, fontFamily: 'Arial', color: '#ffffff',
            align: 'center',
            wordWrap: { width: this.modal.panelWidth - this.modal.padding * 2, useAdvancedWrap: true },
        }).setOrigin(0.5).setDepth(100000);
        y += Math.max(btnGap, messageText.height + lineH * 0.5);

        // Google sign-in
        createMenuButton(this, cx, y, 'Sign in with Google', async () => {
            this.statusText?.setText('Signing in...');
            try {
                const result = await this._fb?.signInWithGoogle();
                if (result?.success) {
                    this.statusText?.setText('Loading your data...');
                    await this._onLoginComplete(result.user);
                } else {
                    const msg = result?.error || 'Sign-in failed';
                    this.statusText?.setText(msg.length > 80 ? msg.substring(0, 80) : msg);
                }
            } catch (err) {
                const msg = err?.message || String(err);
                this.statusText?.setText(msg.length > 80 ? msg.substring(0, 80) : msg);
            }
        }, { fontSize: btnFs, padding: 10 });
        y += btnGap;

        // Guest — name + PIN identity. Firebase Auth verifies the PIN
        // server-side (via a synthetic email/password credential), so the
        // resulting UID is stable across devices and reinstalls, unlike
        // plain anonymous sign-in.
        createMenuButton(this, cx, y, 'Play as Guest', async () => {
            const result = await this._showNamePinPrompt();
            if (!result) return; // cancelled
            localStorage.setItem('playerName', result.name);
            this.statusText?.setText('Loading your data...');
            await this._onLoginComplete(result.user);
        }, { fontSize: btnFs, padding: 10 });
        y += btnGap;

        // Status text
        this.statusText = this.add.text(cx, y, '', {
            fontSize: `${msgFs}px`, fontFamily: 'Arial', color: '#ffaa00',
        }).setOrigin(0.5).setDepth(100000);

        this._setupInput();
    }

    /** @override */
    update() {
        if (this.inputCooldown > 0) { this.inputCooldown--; return; }
        this.inputController?.update();
    }

    // -------------------------------------------------------------------------
    // Hooks — override in subclass
    // -------------------------------------------------------------------------

    /** Modal config. Override to set background image etc. */
    _getModalConfig(width, height) {
        return {
            layout: 'panel',
            width: width * 0.92,
            height: height * 0.82,
            padding: 24,
        };
    }

    /** Title text shown at the top of the login panel. */
    _getTitle() { return 'Sign In'; }

    /** Privacy Policy URL. */
    _getPrivacyUrl() { return 'https://www.greenboxgames.com/privacy-policy'; }

    /** Terms & Conditions URL. */
    _getTermsUrl() { return 'https://www.greenboxgames.com/terms-and-conditions'; }

    /**
     * Called after a sign-in attempt.
     * @param {object|null} user  Firebase user, or null if skipped.
     */
    _onLoginComplete(_user) {
        this.scene.start('MainMenuScene');
    }

    // -------------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------------

    /**
     * Wires up gamepad/keyboard back-button to close the panel.
     * @private
     */
    _setupInput() {
        this.inputController = new InputController(this, {});
    }

    // -------------------------------------------------------------------------
    // Name + PIN popup (Guest sign-in)
    // -------------------------------------------------------------------------

    /**
     * HTML overlay collecting a player name + PIN, then signing in via
     * `firebaseService.signInWithNamePin()`. On a new name it claims it; on
     * an existing name it verifies the PIN. Wrong-PIN and other failures are
     * shown inline and the prompt stays open for another attempt.
     *
     * Mirrors the DOM-overlay pattern used by `BaseSettingsScene._showNameInput`
     * (disable Phaser's global keyboard capture while the overlay is open,
     * append a fixed-position styled div to `document.body`, restore capture
     * and nudge the canvas scale back on close).
     *
     * @returns {Promise<{name: string, user: object}|null>}  null if cancelled.
     * @private
     */
    _showNamePinPrompt() {
        return new Promise((resolve) => {
            const existing = document.getElementById('name-pin-input-overlay');
            if (existing) existing.remove();

            this.input.keyboard.disableGlobalCapture();

            const overlay = document.createElement('div');
            overlay.id = 'name-pin-input-overlay';
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
            title.textContent = 'Enter Name & PIN';
            title.style.cssText = 'color:#ffffff;font-family:Arial;font-size:20px;font-weight:bold;';

            const hint = document.createElement('div');
            hint.textContent = 'New name? This claims it. Returning? Enter the same PIN to load your data.';
            hint.style.cssText = 'color:#888888;font-family:Arial;font-size:13px;text-align:center;';

            const fieldStyle = [
                'background:#1a1a1a', 'border:1px solid #555', 'border-radius:4px',
                'color:#ffffff', 'font-family:Arial', 'font-size:18px',
                'padding:8px 14px', 'width:240px', 'text-align:center',
                'outline:none', 'box-sizing:border-box',
            ].join(';');

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.maxLength = 30;
            nameInput.setAttribute('autocorrect', 'off');
            nameInput.setAttribute('autocomplete', 'off');
            nameInput.setAttribute('autocapitalize', 'none');
            nameInput.setAttribute('spellcheck', 'false');
            nameInput.value = localStorage.getItem('playerName') || '';
            nameInput.placeholder = 'Player name';
            nameInput.style.cssText = fieldStyle;

            const pinInput = document.createElement('input');
            pinInput.type = 'password';
            pinInput.inputMode = 'numeric';
            pinInput.maxLength = 12;
            pinInput.setAttribute('autocomplete', 'off');
            pinInput.placeholder = 'PIN (6+ digits)';
            pinInput.style.cssText = fieldStyle;

            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'color:#ff6666;font-family:Arial;font-size:13px;min-height:16px;';

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:16px;margin-top:4px;';

            const continueBtn = document.createElement('button');
            continueBtn.textContent = 'Continue';
            continueBtn.style.cssText = 'background:#00ffcc;color:#000;border:none;border-radius:4px;padding:9px 28px;font-family:Arial;font-size:16px;cursor:pointer;';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'background:#555;color:#fff;border:none;border-radius:4px;padding:9px 28px;font-family:Arial;font-size:16px;cursor:pointer;';

            const validateName = (name) => {
                if (!name) return 'Enter a name';
                if ((name.match(/@/g) || []).length > 1) return 'Only one @ sign is allowed';
                if (!/^[a-zA-Z0-9._@-]+$/.test(name)) return 'Only letters, numbers, . - _ and @ are allowed';
                if (name.length < 2) return 'Name must be at least 2 characters';
                return '';
            };
            const validatePin = (pin) => (/^\d{6,12}$/.test(pin) ? '' : 'PIN must be 6-12 digits');

            let closed = false;
            const closeOverlay = () => {
                if (closed) return;
                closed = true;
                nameInput.blur();
                pinInput.blur(); // dismiss keyboard before removing overlay
                this.input.keyboard.enableGlobalCapture();
                overlay.remove();
                // After the soft keyboard fully animates out (~400ms), nudge Phaser's
                // ScaleManager to re-measure window dimensions and snap the canvas back.
                const fixScale = () => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    window.dispatchEvent(new Event('resize'));
                };
                setTimeout(fixScale, 450);
                setTimeout(fixScale, 800);
                // Disable Phaser input briefly so ghost touches don't hit Phaser buttons.
                if (this.input) this.input.enabled = false;
                this.time.delayedCall(900, () => {
                    if (this.input) this.input.enabled = true;
                });
            };

            // Prevent taps inside the box from bubbling to the overlay dismiss handler
            box.addEventListener('pointerdown', (e) => e.stopPropagation());
            box.addEventListener('touchstart',  (e) => e.stopPropagation());

            let submitting = false;
            const doContinue = async () => {
                if (submitting) return;
                const name = nameInput.value.trim();
                const pin  = pinInput.value.trim();
                const nameErr = validateName(name);
                const pinErr  = validatePin(pin);
                if (nameErr || pinErr) { errorMsg.textContent = nameErr || pinErr; return; }

                submitting = true;
                continueBtn.disabled = true;
                const origText = continueBtn.textContent;
                continueBtn.textContent = 'Signing in…';
                errorMsg.textContent = '';

                const result = await this._fb?.signInWithNamePin(name, pin);

                submitting = false;
                continueBtn.disabled = false;
                continueBtn.textContent = origText;

                if (!result?.success) {
                    errorMsg.textContent = result?.error || 'Sign-in failed';
                    return;
                }
                closeOverlay();
                resolve({ name, user: result.user });
            };

            const doCancel = () => {
                closeOverlay();
                resolve(null);
            };

            continueBtn.addEventListener('click', doContinue);
            continueBtn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); doContinue(); });
            cancelBtn.addEventListener('click', doCancel);
            cancelBtn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); doCancel(); });
            overlay.addEventListener('click', (e) => { if (e.target === overlay) doCancel(); });
            [nameInput, pinInput].forEach((el) => {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter')  doContinue();
                    if (e.key === 'Escape') doCancel();
                });
                el.addEventListener('input', () => { errorMsg.textContent = ''; });
            });

            btnRow.append(continueBtn, cancelBtn);
            box.append(title, hint, nameInput, pinInput, errorMsg, btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            setTimeout(() => nameInput.focus(), 50);
        });
    }
}
