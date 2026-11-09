/**
 * @module scenes/BaseLoginScene
 */

import * as Phaser from 'phaser';
import ModalBase     from '../systems/scene/ModalBase.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';
import { ensureGooglePlayerName } from '../ui/PlayerNameDialog.js';
import { Settings } from '../systems/SettingsManager.js';

/**
 * Firebase authentication screen.
 *
 * Presents Sign in with Google and Play as Guest. A guest is an anonymous
 * Firebase account by default; a game can override `_guestUsesAccount()` to
 * keep guests fully local until they claim a name (see below).
 * Calls `_onLoginComplete(user)` after a successful sign-in.
 *
 * Override hooks:
 * - `_onLoginComplete(user)` — navigate forward after sign-in (`null` for a local guest)
 * - `_guestUsesAccount()` — whether Play as Guest creates an anonymous account (default `true`)
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
                    await ensureGooglePlayerName(this, result.user);
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

        // Guest — no prompt. Players who want their data to persist across
        // devices/reinstalls claim a name+PIN identity later, from Settings >
        // Player Name (see BaseSettingsScene._showNameInput).
        createMenuButton(this, cx, y, 'Play as Guest', async () => {
            if (!this._guestUsesAccount()) {
                await this._playAsLocalGuest();
                return;
            }
            this.statusText?.setText('Signing in as guest...');
            try {
                const result = await this._fb?.signInAnonymously();
                if (result?.success) {
                    await this._onLoginComplete(result.user);
                } else {
                    await this._onLoginComplete(null);
                }
            } catch (err) {
                await this._onLoginComplete(null);
            }
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

    /**
     * Whether "Play as Guest" creates an anonymous Firebase account. Default
     * `true`. Return `false` for a guest that exists only on the device —
     * no account, no cloud data — until the player claims a name+PIN or signs
     * in with Google. The game then runs signed out (`firebaseService.isReady()`
     * is false), so it must keep settings/progress in localStorage meanwhile.
     * @returns {boolean}
     */
    _guestUsesAccount() { return true; }

    /**
     * Guest without an account: signs out of any restored session (so the
     * guest can't end up playing as, or saving into, a previous account) and
     * drops a player name left on the device by an earlier identity — a guest
     * has no name. Nothing is created in Firebase.
     * @private
     */
    async _playAsLocalGuest() {
        try {
            if (this._fb?.getUser()) await this._fb.signOut();
            localStorage.removeItem('playerName');
            Settings.playerName = ''; // signed out now, so this only saves locally
        } catch { /* proceed as a guest regardless */ }
        await this._onLoginComplete(null);
    }

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
}
