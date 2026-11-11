/**
 * @module scenes/BaseSettingsScene
 */

import * as Phaser from 'phaser';
import ModalBase from '../systems/scene/ModalBase.js';
import { createMenuButton, createTabs, createSlider, createSelector, createToggle, UIScrollablePanel } from '../ui/ui.js';
import { InputController } from '../systems/InputController.js';
import { Keybindings } from '../systems/KeybindingManager.js';
import { Settings } from '../systems/SettingsManager.js';
import { firebaseService } from '../systems/FirebaseService.js';
import { containsProfanity } from '../systems/ProfanityFilter.js';
import { SoundManager } from '../systems/SoundManager.js';
import { ButtonTheme } from '../ui/styles/buttonTheme.js';
import GamepadTestPanel from '../ui/GamepadTestPanel.js';
import { ensureGooglePlayerName } from '../ui/PlayerNameDialog.js';
import { showDeleteAccountDialog } from '../ui/DeleteAccountDialog.js';
import { recordDeviceInfo } from '../systems/DeviceInfo.js';

/**
 * Tabbed settings modal covering Game, Audio, Help, Controls, Gamepad, and About.
 * Backed by {@link SettingsManager} and {@link KeybindingManager}.
 *
 * Override hooks:
 * - `_buildGameTab(scrollPanel, panelW, tabFs, cfs)` — populate the Game tab
 * - `_getHelpTextKey()` — cache key for the help text asset
 * - `_getAboutTextKey()` — cache key for the about text asset
 * - `_getKeybindingsSceneKey()` — scene key to open from the Controls tab
 * - `_buildAccountSection()` / `_buildLegalLinks()` — call from `_buildGameTab` for the
 *   Google sign-in / player name / Sign Out / Delete Account block and the legal links;
 *   hooks `_getAccountData()`, `_getPrivacyUrl()`, `_getTermsUrl()`, `_onAccountChanged()`,
 *   `_afterGoogleSignIn()`, `_signOut()`
 *
 * @example
 * export default class SettingsScene extends BaseSettingsScene {
 *   constructor() { super('SettingsScene', 'SceneController'); }
 *   _buildGameTab(sp, pw, tf, cf) { ... }
 * }
 */
export default class BaseSettingsScene extends Phaser.Scene {
    /**
     * @param {string} [key='SettingsScene']
     * @param {string} [controllerKey='SceneController']  Key of the SceneController scene.
     */
    constructor(key = 'SettingsScene', controllerKey = 'SceneController') {
        super(key);
        this._controllerKey    = controllerKey;
        this.modal             = null;
        this.activeTab         = 'Game';
        this.tabContent        = null;
        this.tabsContainer     = null;
        this.buttons           = [];
        this.selectedIndex     = 0;
        this.inputController   = null;
        this.inputCooldown     = 0;
        this._gameScrollPanel    = null;
        this._helpScrollPanel    = null;
        this._aboutScrollPanel   = null;
        this._contentScrollPanel = null;
        this._tabsRowHeight      = 48;
        this._tabsFontSize       = 20;
        this._updateCounter      = 0;
        this.gamepadPanel        = null;
    }

    /**
     * Builds the settings modal with tab bar, content area, and Back button.
     * @override
     */
    create() {
        const { width, height } = this.scale;

        this.inputController = InputController.getInstance(this);

        this.modal = new ModalBase(this, {
            layout: 'panel',
            width:   Math.min(width  * 0.95, 820),
            height:  Math.min(height * 0.92, height * 0.75 + 60),
            padding: 32,
            transparentPanel: true,
            showBorder: false,
            ...(this._getBackgroundKey() ? { overlayBackgroundImage: this._getBackgroundKey() } : {}),
        });

        this.modal.createTitle('Settings');

        const cx   = this.modal.getCenterX();
        const topY = this.modal.getContentStartY();

        const tabNames = ['Game', 'Audio', 'Help', 'Controls', 'Gamepad', 'About'];

        this.tabsContainer = createTabs(
            this, 0, 0, tabNames, this.activeTab,
            tab => { this.activeTab = tab; this.refreshTabContent(); },
            { panelWidth: this.modal.panelWidth, rowGap: 48 }
        );
        this.tabsContainer.x = cx;
        this.tabsContainer.y = topY;
        this._tabsRowHeight  = this.tabsContainer.tabsHeight   || 48;
        this._tabsFontSize   = this.tabsContainer.tabsFontSize || 20;
        this.modal.container.add(this.tabsContainer);

        this.tabContent = this.add.container(0, 0);
        this.modal.container.add(this.tabContent);

        this.refreshTabContent();

        // Back button
        const backBtn = createMenuButton(this, cx, this.modal.getBottomY(), 'Back', () => {
            const ctrl = this.scene.get(this._controllerKey);
            ctrl?.flow?.modal?.closeModal(this.sys.settings.key);
        });
        this.buttons.push(backBtn);

        this.time.delayedCall(500, () => this._updateSelection());

        this.events.on('wake', () => {
            this.selectedIndex = 0;
            if (this.inputController) this.inputController.resetMenuState();
            this.inputCooldown = 3;
            this.refreshTabContent();
            this._updateSelection();
        });

        this.events.on('sleep', () => this._destroyScrollPanels());
    }

    /** @override */
    update() {
        this._updateCounter++;
        if (this._updateCounter === 2) this._updateSelection();

        if (this.inputCooldown > 0) {
            this.inputCooldown--;
            if (this.inputController) {
                this.inputController.update();
                this.inputController.menuUp     = false;
                this.inputController.menuDown   = false;
                this.inputController.menuSelect = false;
                this.inputController.menuBack   = false;
            }
            return;
        }

        if (this.inputController) this.inputController.update();

        // Update gamepad test panel — use raw browser API to bypass Phaser timestamp guard
        if (this.activeTab === 'Gamepad' && this.gamepadPanel) {
            const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
            const rawPad  = Array.from(rawPads).find(p => p !== null) || null;
            const padForPanel = rawPad ? {
                axes:    Array.from(rawPad.axes).map(v => ({ getValue: () => v })),
                buttons: rawPad.buttons,
            } : null;
            this.gamepadPanel.update(padForPanel);
            // On Gamepad tab: eat all gamepad nav so buttons don't trigger UI actions
            if (this.inputController) {
                this.inputController.menuUp       = false;
                this.inputController.menuDown     = false;
                this.inputController.menuSelect   = false;
                this.inputController.menuTabLeft  = false;
                this.inputController.menuTabRight = false;
                this.inputController.menuBack     = false;
            }
            return;
        }

        const cursors  = this.input.keyboard.createCursorKeys();
        const enterKey = this.input.keyboard.addKey('ENTER');

        // Tab navigation: left/right arrows or gamepad LB/RB
        if (Phaser.Input.Keyboard.JustDown(cursors.left)  || this.inputController?.menuTabLeft)  this._navigateTab(-1);
        if (Phaser.Input.Keyboard.JustDown(cursors.right) || this.inputController?.menuTabRight) this._navigateTab(1);

        // Button focus: up/down
        if (Phaser.Input.Keyboard.JustDown(cursors.down) || this.inputController?.menuDown) {
            this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
            this._updateSelection();
        }
        if (Phaser.Input.Keyboard.JustDown(cursors.up) || this.inputController?.menuUp) {
            this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
            this._updateSelection();
        }

        // Activate selected button
        if (Phaser.Input.Keyboard.JustDown(enterKey) || this.inputController?.menuSelect) {
            this.buttons[this.selectedIndex]?.emit('pointerdown');
        }

        // ESC / B button: close
        if (this.inputController?.menuBack) {
            const ctrl = this.scene.get(this._controllerKey);
            ctrl?.flow?.modal?.closeModal(this.sys.settings.key);
        }

        // Reset per-frame menu actions
        if (this.inputController) {
            this.inputController.menuUp       = false;
            this.inputController.menuDown     = false;
            this.inputController.menuSelect   = false;
            this.inputController.menuTabLeft  = false;
            this.inputController.menuTabRight = false;
            this.inputController.menuBack     = false;
        }
    }

    // -------------------------------------------------------------------------
    // Hooks — override in subclass
    // -------------------------------------------------------------------------

    /**
     * Populate the Game tab. Add items to scrollPanel.
     * @param {object} scrollPanel  UIScrollablePanel instance.
     * @param {number} panelW       Panel pixel width.
     * @param {number} tabFs        Tab font size in px (number).
     * @param {string} cfs          Tab font size as CSS string e.g. '20px'.
     */
    _buildGameTab(_scrollPanel, _panelW, _tabFs, _cfs) {
        // Override in subclass to add game-specific settings.
    }

    /** Cache key for help text file. Override to use a different key. */
    _getHelpTextKey()  { return 'help-text'; }

    /** Return the app version string to stamp into the About tab. Override in subclasses.
     *  By default returns '' — version is expected to already be in about.txt
     *  (written by the bump-version.js build script).
     *  @returns {string}
     */
    _getAppVersion() { return ''; }

    /** Cache key for about text file. Override to use a different key. */
    _getAboutTextKey() { return 'about-text'; }

    /**
     * Scene key to open when "Edit Keybindings" is pressed in the Controls tab.
     * Return null (default) to hide the button.
     */
    _getKeybindingsSceneKey() { return null; }

    /**
     * Texture key for the background image shown behind the settings panel.
     * Return null (default) for no background image.
     */
    _getBackgroundKey() { return null; }

    // -------------------------------------------------------------------------
    // Tab rendering
    // -------------------------------------------------------------------------

    /**
     * Clears and rebuilds the active tab's content.
     * Called on tab switch and on scene wake.
     */
    refreshTabContent() {
        this.tabContent.removeAll(true);
        this._destroyScrollPanels();

        const cx      = this.modal.getCenterX();
        const isTouch = navigator.maxTouchPoints > 0;
        const tabFs   = this._tabsFontSize || 20;
        const cfs     = `${tabFs}px`;
        const y       = this.modal.getContentStartY() + (this._tabsRowHeight || 50) + 28;

        if (this.activeTab === 'Game') {
            const panelW = this.modal.panelWidth - 20;
            const panelX = cx - panelW / 2;
            const panelH = this.modal.getBottomY() - 64 - y;

            const scrollPanel = UIScrollablePanel(
                this, panelX, y, panelW, panelH,
                { showScrollbar: !isTouch, transparentBackground: true, showFrame: false, autoHideScrollbar: true }
            );
            scrollPanel.setDepth(99999);
            this._gameScrollPanel = scrollPanel;

            this._buildGameTab(scrollPanel, panelW, tabFs, cfs);
        }

        if (this.activeTab === 'Audio') {
            const panelW = this.modal.panelWidth - 20;
            const panelX = cx - panelW / 2;
            const panelH = this.modal.getBottomY() - 64 - y;
            const slW    = Math.min(300, panelW - 60);
            const px     = panelW / 2;

            const scrollPanel = UIScrollablePanel(
                this, panelX, y, panelW, panelH,
                { showScrollbar: !isTouch, transparentBackground: true, showFrame: false, autoHideScrollbar: true }
            );
            scrollPanel.setDepth(99999);
            this._contentScrollPanel = scrollPanel;

            const slStep = Math.max(112, Math.round(tabFs * 5.6));
            let cy = 16;

            scrollPanel.addItem(
                createSlider(this, px, cy, 'Music Volume', Settings.musicVolume * 100,
                    value => {
                        Settings.musicVolume = value / 100;
                        const sm = SoundManager.getInstance();
                        if (sm) sm.updateMusicVolume();
                    }, { fontSize: cfs, sliderWidth: slW })
            );
            cy += slStep;

            scrollPanel.addItem(
                createSlider(this, px, cy, 'SFX Volume', Settings.sfxVolume * 100,
                    value => { Settings.sfxVolume = value / 100; },
                    { fontSize: cfs, sliderWidth: slW })
            );
            cy += slStep;

            scrollPanel.addItem(this.add.rectangle(px, cy, 4, 16, 0x000000, 0));
        }

        if (this.activeTab === 'Help') {
            this._buildTextScrollTab(cx, y, this._getHelpTextKey(), '_helpScrollPanel');
        }

        if (this.activeTab === 'Controls') {
            this._buildControlsTab(cx, y, tabFs, cfs);
        }

        if (this.activeTab === 'Gamepad') {
            this._buildGamepadTab(cx, y);
        }

        if (this.activeTab === 'About') {
            this._buildAboutTab(cx, y, this._getAboutTextKey());
        }
    }

    /**
     * Renders the Controls tab (keyboard layout, gamepad layout, keybindings).
     * @private
     * @param {number} cx     Centre X.
     * @param {number} y      Content start Y.
     * @param {number} tabFs  Tab font size (number).
     * @param {string} cfs    Tab font size as CSS string.
     */
    _buildControlsTab(cx, y, tabFs, cfs) {
        const isTouch = navigator.maxTouchPoints > 0;
        const panelW  = this.modal.panelWidth - 20;
        const panelX  = cx - panelW / 2;
        const panelH  = this.modal.getBottomY() - 64 - y;
        const px      = panelW / 2;

        const scrollPanel = UIScrollablePanel(
            this, panelX, y, panelW, panelH,
            { showScrollbar: !isTouch, transparentBackground: true, showFrame: false, autoHideScrollbar: true }
        );
        scrollPanel.setDepth(99999);
        this._contentScrollPanel = scrollPanel;

        const sStep = Math.max(96,  Math.round(tabFs * 4.8));
        const bStep = Math.max(55,  Math.round(tabFs * 3.0));
        let cy = 16;

        scrollPanel.addItem(
            createToggle(this, px, cy, 'Controller Enabled', Settings.controllerEnabled,
                value => { Settings.controllerEnabled = value; },
                { fontSize: cfs })
        );
        cy += sStep;

        const currentLayout = this._detectKeyboardLayout();
        scrollPanel.addItem(
            createSelector(this, px, cy, 'Keyboard Layout', ['WASD', 'Arrow Keys', 'Custom'], currentLayout,
                value => {
                    if (value === 'WASD') {
                        Settings.keyboardLayout = value;
                        Keybindings.set('moveUp', 'W'); Keybindings.set('moveDown', 'S');
                        Keybindings.set('moveLeft', 'A'); Keybindings.set('moveRight', 'D');
                    } else if (value === 'Arrow Keys') {
                        Settings.keyboardLayout = value;
                        Keybindings.set('moveUp', 'UP'); Keybindings.set('moveDown', 'DOWN');
                        Keybindings.set('moveLeft', 'LEFT'); Keybindings.set('moveRight', 'RIGHT');
                    }
                    if (this.inputController) this.inputController.refresh();
                },
                { fontSize: cfs })
        );
        cy += sStep;

        scrollPanel.addItem(
            createSelector(this, px, cy, 'Gamepad Layout', ['Xbox', 'PlayStation'],
                Settings.gamepadLayout,
                value => { Settings.gamepadLayout = value; },
                { fontSize: cfs })
        );
        cy += sStep;

        const kbsKey = this._getKeybindingsSceneKey();
        if (kbsKey) {
            scrollPanel.addItem(
                createMenuButton(this, px, cy, 'Edit Keybindings', () => {
                    const ctrl = this.scene.get(this._controllerKey);
                    ctrl?.flow?.modal?.openModal(kbsKey, {}, this.sys.settings.key);
                }, { fontSize: cfs })
            );
            cy += bStep;
        }

        scrollPanel.addItem(
            createMenuButton(this, px, cy, 'Reset to Defaults', () => {
                Settings.resetToDefaults?.();
                this.scene.restart();
            }, { fontSize: cfs })
        );
        cy += bStep;

        scrollPanel.addItem(this.add.rectangle(px, cy, 4, 16, 0x000000, 0));
    }

    /**
     * Renders the Gamepad tab with the interactive gamepad test panel.
     * @private
     * @param {number} cx  Centre X.
     * @param {number} y   Content start Y.
     */
    _buildGamepadTab(cx, y) {
        const panelY = this.modal.getContentStartY() + 40;
        const panelWidth = this.modal.panelWidth * 0.8;

        try {
            this.gamepadPanel = new GamepadTestPanel(
                this,
                cx,
                panelY + (this.modal.panelHeight * 0.25),
                panelWidth
            );
        } catch (err) {
            console.warn('[BaseSettingsScene] GamepadTestPanel error:', err);
            return;
        }

        this.tabContent.add(this.gamepadPanel.container);
    }

    /**
     * Reads the current keybindings to determine whether the layout is WASD,
     * Arrow Keys, or Custom.
     * @private
     * @returns {'WASD'|'Arrow Keys'|'Custom'}
     */
    _detectKeyboardLayout() {
        const up    = Keybindings.get('moveUp');
        const down  = Keybindings.get('moveDown');
        const left  = Keybindings.get('moveLeft');
        const right = Keybindings.get('moveRight');
        if (up === 'W'  && down === 'S'    && left === 'A'    && right === 'D')     return 'WASD';
        if (up === 'UP' && down === 'DOWN' && left === 'LEFT' && right === 'RIGHT') return 'Arrow Keys';
        return 'Custom';
    }

    /** Render a plain text cache entry as a scrollable panel. */
    _buildTextScrollTab(cx, y, cacheKey, panelProp) {
        const text  = this.cache.text.get(cacheKey);
        const lines = text ? text.split('\n') : ['(no content)'];

        const panelW = this.modal.panelWidth - 8;
        const panelX = cx - panelW / 2;
        const panelH = this.modal.getBottomY() - 64 - y;
        const bodyFs  = this._tabsFontSize || 18;
        const titleFs = Math.min(Math.round(bodyFs * 1.4), 28);

        const scrollPanel = UIScrollablePanel(
            this, panelX, y, panelW, panelH,
            { showScrollbar: false, transparentBackground: true, showFrame: false }
        );
        scrollPanel.setDepth(99999);
        this[panelProp] = scrollPanel;

        let contentY = 8;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) { contentY += Math.round(bodyFs * 0.7); continue; }

            const fontSize  = i === 0 ? titleFs : bodyFs;
            const color     = i === 0 ? '#ffffff' : line.includes('©') ? '#888888' : '#cccccc';
            const fontStyle = i === 0 ? 'bold' : 'normal';

            const t = this.add.text(panelW / 2, contentY, line, {
                fontFamily: 'Arial', fontSize, color, fontStyle,
                align: 'center', wordWrap: { width: panelW - 16 },
            }).setOrigin(0.5, 0);

            scrollPanel.addItem(t);
            contentY += t.getBounds().height + 12;
        }
        scrollPanel.addItem(this.add.rectangle(0, contentY, panelW, 28, 0x000000, 0));
    }

    /** Privacy Policy URL. Override in subclass for child-directed apps. */
    _getPrivacyUrl() { return 'https://www.greenboxgames.com/privacy-policy'; }

    /** About tab — same as help but with clickable Privacy/Terms links. */
    _buildAboutTab(cx, y, cacheKey) {
        const raw     = this.cache.text.get(cacheKey);
        const version = this._getAppVersion();
        const stamped = (raw && version)
            ? raw.replace(/Version \d+\.\d+\.\d+\S*/i, `Version ${version}`)
            : raw;
        const text  = stamped;
        const lines = text ? text.split('\n') : ['(no content)'];

        const panelW  = this.modal.panelWidth - 8;
        const panelX  = cx - panelW / 2;
        const panelH  = this.modal.getBottomY() - 64 - y;
        const bodyFs  = this._tabsFontSize || 18;
        const titleFs = Math.min(Math.round(bodyFs * 1.4), 28);
        const subFs   = Math.min(Math.round(bodyFs * 1.1), 20);

        const scrollPanel = UIScrollablePanel(
            this, panelX, y, panelW, panelH,
            { showScrollbar: false, transparentBackground: true, showFrame: false }
        );
        scrollPanel.setDepth(99999);
        this._aboutScrollPanel = scrollPanel;

        let contentY = 8;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) { contentY += Math.round(bodyFs * 0.7); continue; }

            let fontSize    = bodyFs;
            let color       = '#cccccc';
            let fontStyle   = 'normal';
            let isClickable = false;

            if (i === 0)                                          { fontSize = titleFs; color = '#ffffff'; fontStyle = 'bold'; }
            else if (line.includes('Version'))                    { fontSize = subFs;   color = '#aaaaaa'; }
            else if (line.includes('Privacy Policy:') ||
                     line.includes('Terms & Conditions:'))        { color = '#4A9EFF';  fontStyle = 'underline'; isClickable = true; }
            else if (line.includes('©'))                         { color = '#888888'; }

            const displayLine = isClickable
                ? (line.includes('Privacy Policy') ? 'Privacy Policy' : 'Terms & Conditions')
                : line;

            const t = this.add.text(panelW / 2, contentY, displayLine, {
                fontFamily: 'Arial', fontSize, color, fontStyle,
                align: 'center', wordWrap: { width: panelW - 16 },
            }).setOrigin(0.5, 0);

            if (isClickable) {
                t.setInteractive({ useHandCursor: true });
                t.on('pointerdown', () => {
                    const url = line.includes('Privacy Policy')
                        ? this._getPrivacyUrl()
                        : 'https://www.greenboxgames.com/terms-and-conditions';
                    window.open(url, '_blank');
                });
                t.on('pointerover', () => t.setColor('#6BB6FF'));
                t.on('pointerout',  () => t.setColor('#4A9EFF'));
            }

            scrollPanel.addItem(t);
            contentY += t.getBounds().height + 12;
        }
        scrollPanel.addItem(this.add.rectangle(0, contentY, panelW, 28, 0x000000, 0));
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /**
     * Destroys all active scroll panels so they can be rebuilt on the next
     * tab render or scene wake.
     * @private
     */
    _destroyScrollPanels() {
        ['_gameScrollPanel', '_helpScrollPanel', '_aboutScrollPanel', '_contentScrollPanel'].forEach(k => {
            if (this[k]) { this[k].destroy(); this[k] = null; }
        });
        if (this.gamepadPanel) { this.gamepadPanel.destroy(); this.gamepadPanel = null; }
    }

    /**
     * Updates the visual highlight on the focused button.
     * @private
     */
    _updateSelection() {
        this.buttons.forEach((btn, i) => {
            try {
                if (i === this.selectedIndex) {
                    btn.setColor?.(ButtonTheme.color.selected);
                    btn.setScale?.(ButtonTheme.scale.selected);
                } else {
                    btn.setColor?.(ButtonTheme.color.normal);
                    btn.setScale?.(ButtonTheme.scale.normal);
                }
            } catch (_) { /* ignore if not ready */ }
        });
    }

    /**
     * Moves the active tab by `direction` steps and triggers a re-render.
     * @private
     * @param {number} direction  +1 for right, -1 for left.
     */
    _navigateTab(direction) {
        const tabNames = ['Game', 'Audio', 'Help', 'Controls', 'Gamepad', 'About'];
        const idx    = tabNames.indexOf(this.activeTab);
        const newTab = tabNames[(idx + direction + tabNames.length) % tabNames.length];
        // Emit pointerdown on the matching tab label so createTabs refreshes its own highlight too
        if (this.tabsContainer) {
            this.tabsContainer.iterate(child => {
                if (child.isTabLabel && child.tabName === newTab) child.emit('pointerdown');
            });
        }
    }

    // -------------------------------------------------------------------------
    // Account section (Game tab) — Google sign-in, player name, sign out, delete
    // -------------------------------------------------------------------------

    /**
     * Builds the account block of the Game tab, for a game with no login screen
     * (see `systems/Session.js`):
     *
     * - signed out (guest): **Sign in with Google**, "or", then the player-name field
     *   (entering a name + PIN claims or signs in to a name account);
     * - signed in: the player-name field, then **Sign Out** (reloads the app as a
     *   guest) and **Delete Account** (if `_getAccountData()` is set).
     *
     * Call from `_buildGameTab` and continue laying out from the returned Y.
     *
     * @param {object} scrollPanel  The Game tab's UIScrollablePanel.
     * @param {number} startY       Y to start at (panel coordinates).
     * @param {{panelW:number, tabFs:number, cfs:string}} layout  Same values `_buildGameTab` receives.
     * @returns {number} Y below the block.
     */
    _buildAccountSection(scrollPanel, startY, { panelW, tabFs, cfs }) {
        const px     = panelW / 2;
        const sStep  = Math.max(96, Math.round(tabFs * 4.8));
        const descH  = Math.max(28, Math.round(tabFs * 1.4));
        const pad    = Math.max(16, Math.round(tabFs * 0.8));
        const labelH = Math.max(36, Math.round(tabFs * 1.8));
        const valueH = Math.max(44, Math.round(tabFs * 2.2));
        let   cy     = startY;

        const provider      = firebaseService.getAuthProvider();
        const savedName     = localStorage.getItem('playerName') || '';
        const isGoogle      = provider === 'google';
        const googleUser    = isGoogle ? firebaseService.getUser() : null;
        const googleDerived = googleUser
            ? (googleUser.email || '').split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '')
            : '';
        const effectiveName = savedName || googleDerived;

        let nameHint = '';
        if (isGoogle && googleUser) {
            nameHint = savedName ? `Google: ${googleUser.email || ''}` : 'Suggested from email — tap to change';
        }

        // ── No name yet: say what that means ────────────────────────────────
        if (!effectiveName) {
            scrollPanel.addItem(
                this.add.text(px, cy, this._getNoNameWarning(), {
                    fontFamily: 'Arial',
                    fontSize: Math.max(13, Math.round(tabFs * 0.78)),
                    color: '#ff4444',
                    wordWrap: { width: panelW - 60 },
                    align: 'center',
                }).setOrigin(0.5, 0.0)
            );
            cy += Math.max(44, Math.round(tabFs * 2.2));
        }

        // ── Google sign-in (signed-out players only), then "or" the name field ─
        if (provider === 'none' || provider === 'anonymous') {
            const googleStatus = this.add.text(px, cy + sStep - 12, '', {
                fontFamily: 'Arial', fontSize: Math.max(13, Math.round(tabFs * 0.75)), color: '#ffaa00',
            }).setOrigin(0.5, 0.5);
            scrollPanel.addItem(
                createMenuButton(this, px, cy + Math.round(sStep / 2) - 8, 'Sign in with Google', () => {
                    this._signInWithGoogle(googleStatus);
                }, { fontSize: cfs })
            );
            scrollPanel.addItem(googleStatus);
            cy += sStep;
            scrollPanel.addItem(
                this.add.text(px, cy, 'or', {
                    fontFamily: 'Arial', fontSize: cfs, color: '#aaaaaa',
                }).setOrigin(0.5, 0.5)
            );
            cy += labelH;
        }

        // ── Player name ──────────────────────────────────────────────────────
        scrollPanel.addItem(
            this.add.text(px, cy, 'Player Name', {
                fontFamily: 'Arial', fontSize: cfs, color: '#ffffff', fontStyle: 'bold',
            }).setOrigin(0.5, 0.5)
        );
        cy += labelH;

        const nameValueTxt = this.add.text(
            px, cy,
            effectiveName || '[ Tap to set name ]', {
                fontFamily: 'Arial', fontSize: cfs,
                color: effectiveName ? '#00ffcc' : '#888888',
                backgroundColor: '#333333',
                padding: { x: 14, y: 6 },
            }
        ).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
        nameValueTxt.on('pointerdown', () => this._showNameInput(nameValueTxt, googleDerived));
        scrollPanel.addItem(nameValueTxt);
        cy += valueH;

        if (nameHint) {
            scrollPanel.addItem(
                this.add.text(px, cy, nameHint, {
                    fontFamily: 'Arial', fontSize: Math.max(13, Math.round(tabFs * 0.75)), color: '#888888',
                }).setOrigin(0.5, 0.5)
            );
            cy += descH;
        }

        // ── Sign Out / Delete Account (signed-in players only) ───────────────
        if (provider !== 'none') {
            cy += pad;
            scrollPanel.addItem(this.add.rectangle(px, cy, panelW - 40, 1, 0x444444));
            cy += pad;

            const signOutCy = cy + Math.round(sStep / 2);
            const confirmMsg = (provider === 'anonymous' && !savedName.trim())
                ? 'No data has been saved to an account. You will start fresh.'
                : 'Sign out and play as a guest?';
            // The Yes/No buttons must be made non-interactive whenever they're
            // hidden, not just invisible — Phaser containers stay hit-testable
            // when setVisible(false), so a stray tap landing on their fixed screen
            // coordinates could silently trigger "sign out" with nothing visible there.
            const signOutBtn = createMenuButton(this, px, signOutCy, 'Sign Out', () => {
                signOutConfirm.setVisible(true);
                signOutBtn.setVisible(false);
                signOutBtn.disableInteractive();
                yesBtn.setInteractive({ useHandCursor: true });
                noBtn.setInteractive({ useHandCursor: true });
            }, { fontSize: cfs });
            scrollPanel.addItem(signOutBtn);

            const signOutConfirm = this.add.container(0, 0);
            const confirmTxt = this.add.text(px, signOutCy - 16, confirmMsg, {
                fontFamily: 'Arial', fontSize: cfs, color: '#ff8888',
            }).setOrigin(0.5);
            const yesBtn = createMenuButton(this, px - 70, signOutCy + 24, 'Yes', () => this._signOut(), { fontSize: cfs });
            const noBtn = createMenuButton(this, px + 70, signOutCy + 24, 'No', () => {
                signOutConfirm.setVisible(false);
                signOutBtn.setVisible(true);
                signOutBtn.setInteractive({ useHandCursor: true });
                yesBtn.disableInteractive();
                noBtn.disableInteractive();
            }, { fontSize: cfs });
            signOutConfirm.add([confirmTxt, yesBtn, noBtn]);
            signOutConfirm.setVisible(false);
            yesBtn.disableInteractive();
            noBtn.disableInteractive();
            scrollPanel.addItem(signOutConfirm);
            cy += sStep;

            // Google Play requires an in-app account-deletion path.
            const accountData = this._getAccountData();
            if (accountData) {
                scrollPanel.addItem(
                    createMenuButton(this, px, cy + Math.round(sStep / 2), 'Delete Account', () => {
                        showDeleteAccountDialog(this, accountData);
                    }, { fontSize: cfs })
                );
                cy += sStep;
            }
        }

        return cy;
    }

    /**
     * Privacy Policy and Terms links (the Play listing's policy should also be
     * reachable inside the app). Returns the Y below them.
     * @param {object} scrollPanel
     * @param {number} startY
     * @param {{panelW:number, tabFs:number}} layout
     * @returns {number}
     */
    _buildLegalLinks(scrollPanel, startY, { panelW, tabFs }) {
        const px      = panelW / 2;
        const pad     = Math.max(16, Math.round(tabFs * 0.8));
        const descH   = Math.max(28, Math.round(tabFs * 1.4));
        const legalFs = Math.max(13, Math.round(tabFs * 0.8));
        let cy = startY + pad;
        scrollPanel.addItem(this.add.rectangle(px, cy, panelW - 40, 1, 0x444444));
        cy += pad;
        [['Privacy Policy', this._getPrivacyUrl()], ['Terms & Conditions', this._getTermsUrl()]].forEach(([label, url]) => {
            const link = this.add.text(px, cy, label, {
                fontFamily: 'Arial', fontSize: legalFs, color: '#4A9EFF',
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            link.on('pointerdown', () => window.open(url, '_blank'));
            link.on('pointerover', () => link.setColor('#6BB6FF'));
            link.on('pointerout',  () => link.setColor('#4A9EFF'));
            scrollPanel.addItem(link);
            cy += descH;
        });
        return cy;
    }

    /**
     * Google sign-in from the Game tab: signs in, claims a player name (a dialog
     * asks for another if the Google name is taken), runs `_onAccountChanged()`
     * (re-key game data) and `_afterGoogleSignIn()`, then redraws the tab.
     * @param {Phaser.GameObjects.Text} [status]  Line under the button for progress/errors.
     */
    async _signInWithGoogle(status) {
        if (this._googleBusy) return;
        this._googleBusy = true;
        const show = (msg) => { if (status?.active) status.setText(msg.length > 60 ? msg.substring(0, 60) : msg); };
        try {
            show('Signing in...');
            const result = await firebaseService.signInWithGoogle();
            if (!result?.success) { show(result?.error || 'Sign-in failed'); return; }
            show('Loading your data...');
            await ensureGooglePlayerName(this, result.user);
            await this._onAccountChanged(false);
            recordDeviceInfo();
            await this._afterGoogleSignIn();
            this.refreshTabContent?.();
        } catch (err) {
            show(err?.message || String(err));
        } finally {
            this._googleBusy = false;
        }
    }

    /**
     * Signs out and reloads the app, which then starts as a local guest
     * (`initSession()`). Override to do more first.
     * @returns {Promise<void>}
     */
    async _signOut() {
        localStorage.removeItem('playerName');
        await firebaseService.signOut();
        window.location.reload();
    }

    /** Hook: runs after a Google sign-in completed and the name is claimed (e.g. publish local scores). */
    async _afterGoogleSignIn() {}

    /** `AccountDataConfig` (where this game stores per-player data) for Delete Account, or null to hide the button. */
    _getAccountData() { return null; }

    /** Text shown in red above the sign-in block while there is no player name. */
    _getNoNameWarning() { return '⚠  Scores and progress are not saved online without a Player Name'; }

    /** Privacy Policy URL. */
    _getPrivacyUrl() { return 'https://www.greenboxgames.com/privacy-policy'; }

    /** Terms & Conditions URL. */
    _getTermsUrl() { return 'https://www.greenboxgames.com/terms-and-conditions'; }

    // -------------------------------------------------------------------------
    // Player Name Input Overlay
    // -------------------------------------------------------------------------

    /**
     * Show an HTML overlay for the player to set their display name.
     *
     * Signed-in-with-Google players just edit a cosmetic display label (their
     * UID is already a stable, real identity). Everyone else (anonymous/
     * name+PIN players) also gets a PIN field — entering a name here signs
     * out of the current identity and signs into that name+PIN pair via
     * `firebaseService.signInWithNamePin()` (Firebase Auth's Email/Password
     * provider under the hood), so it doubles as "claim this identity" (new
     * name) or "switch to this identity" (existing name, matching PIN).
     *
     * Subclasses can override these hooks:
     *   _checkPlayerNameAvailable(name)  → Promise<boolean>  (default: always true; Google path only)
     *   _claimPlayerName(name, oldName)  → void              (default: no-op)
     *   _onAccountChanged(isNew)         → Promise<void>     (after a name+PIN sign-in; default: no-op)
     *
     * @param {Phaser.GameObjects.Text} displayText - Phaser text object showing current name (unused by base, kept for compat).
     * @param {string} [googleDerivedName=''] - Default name suggested from Google account.
     */
    _showNameInput(displayText, googleDerivedName = '') {
        const isGoogle = firebaseService.getAuthProvider() === 'google';

        const existing = document.getElementById('player-name-input-overlay');
        if (existing) existing.remove();

        this.input.keyboard.disableGlobalCapture();

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
        title.textContent = isGoogle ? 'Enter Player Name' : 'Enter Name & PIN';
        title.style.cssText = 'color:#ffffff;font-family:Arial;font-size:20px;font-weight:bold;';

        const hint = document.createElement('div');
        hint.textContent = isGoogle
            ? 'Letters, numbers, . - _ and at most one @ allowed'
            : 'New name? This claims it. Returning to a name you have used before? Enter its matching PIN.';
        hint.style.cssText = 'color:#888888;font-family:Arial;font-size:13px;text-align:center;';

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 30;
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocapitalize', 'none');
        input.setAttribute('spellcheck', 'false');
        input.value = localStorage.getItem('playerName') || googleDerivedName;
        input.placeholder = isGoogle ? 'Enter name (leave empty to opt out)' : 'Player name';
        const fieldStyle = [
            'background:#1a1a1a', 'border:1px solid #555', 'border-radius:4px',
            'color:#ffffff', 'font-family:Arial', 'font-size:18px',
            'padding:8px 14px', 'width:240px', 'text-align:center',
            'outline:none', 'box-sizing:border-box',
        ].join(';');
        input.style.cssText = fieldStyle;

        const pinInput = document.createElement('input');
        pinInput.type = 'password';
        pinInput.inputMode = 'numeric';
        pinInput.maxLength = 12;
        pinInput.setAttribute('autocomplete', 'off');
        pinInput.placeholder = 'PIN (6+ digits)';
        pinInput.style.cssText = fieldStyle;

        const googleNote = document.createElement('div');
        if (googleDerivedName && !localStorage.getItem('playerName')) {
            googleNote.textContent = 'Suggested from your Google email prefix — edit or clear as you wish';
            googleNote.style.cssText = 'color:#4A9EFF;font-family:Arial;font-size:12px;text-align:center;';
        }

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color:#ff6666;font-family:Arial;font-size:13px;min-height:16px;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:16px;margin-top:4px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = isGoogle ? 'Save' : 'Continue';
        saveBtn.style.cssText = 'background:#00ffcc;color:#000;border:none;border-radius:4px;padding:9px 28px;font-family:Arial;font-size:16px;cursor:pointer;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'background:#555;color:#fff;border:none;border-radius:4px;padding:9px 28px;font-family:Arial;font-size:16px;cursor:pointer;';

        const validate = (name) => {
            if (!name) return '';
            if ((name.match(/@/g) || []).length > 1) return 'Only one @ sign is allowed';
            if (!/^[a-zA-Z0-9._@-]+$/.test(name)) return 'Only letters, numbers, . - _ and @ are allowed';
            if (name.length < 2) return 'Name must be at least 2 characters';
            if (containsProfanity(name)) return 'Please choose a different name';
            return '';
        };
        const validatePin = (pin) => (/^\d{6,12}$/.test(pin) ? '' : 'PIN must be 6-12 digits');

        const closeOverlay = () => {
            input.blur();
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

        let saved = false;
        const doSave = async () => {
            if (saved) return;
            saved = true;
            const name = input.value.trim();
            const err  = validate(name);
            if (err) { errorMsg.textContent = err; saved = false; return; }

            if (isGoogle) {
                if (name) {
                    saveBtn.disabled = true;
                    const origText = saveBtn.textContent;
                    saveBtn.textContent = 'Checking\u2026';
                    const available = await this._checkPlayerNameAvailable(name);
                    saveBtn.disabled = false;
                    saveBtn.textContent = origText;
                    if (!available) {
                        errorMsg.textContent = 'That name is already taken. Please choose another.';
                        saved = false;
                        return;
                    }
                }
            } else if (name) {
                // Non-Google: a non-empty name is a real identity claim/switch,
                // verified server-side by Firebase Auth \u2014 no separate
                // availability pre-check (it would race against the uid this
                // is about to switch into).
                const pin    = pinInput.value.trim();
                const pinErr = validatePin(pin);
                if (pinErr) { errorMsg.textContent = pinErr; saved = false; return; }

                saveBtn.disabled = true;
                const origText = saveBtn.textContent;
                saveBtn.textContent = 'Signing in\u2026';
                const result = await firebaseService.signInWithNamePin(name, pin);
                saveBtn.disabled = false;
                saveBtn.textContent = origText;
                if (!result.success) {
                    errorMsg.textContent = result.error || 'Sign-in failed';
                    saved = false;
                    return;
                }
                // Re-key live settings/scores to the new identity before saving the name.
                await Settings.load();
                await this._onAccountChanged(result.isNew);
                recordDeviceInfo();
            }

            const oldName = localStorage.getItem('playerName') || '';
            localStorage.setItem('playerName', name);
            // Keep Settings._data.playerName in sync so save() will persist to Firebase.
            Settings.playerName = name;
            if (name) this._claimPlayerName(name, oldName || null);
            closeOverlay();
            setTimeout(() => this.refreshTabContent(), 0);
        };

        saveBtn.addEventListener('click', doSave);
        saveBtn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); doSave(); });
        cancelBtn.addEventListener('click', closeOverlay);
        cancelBtn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); closeOverlay(); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
        [input, pinInput].forEach((el) => {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter')  doSave();
                if (e.key === 'Escape') closeOverlay();
            });
            el.addEventListener('input', () => { errorMsg.textContent = ''; });
        });

        btnRow.append(saveBtn, cancelBtn);
        box.append(title, hint, input);
        if (!isGoogle) box.append(pinInput);
        box.append(googleNote, errorMsg, btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 50);
    }

    /**
     * Called after a name+PIN sign-in switched this device to another account,
     * once settings are re-keyed to it. Override to re-key game data (progress, …).
     * @param {boolean} _isNew  True if the account was just registered.
     * @returns {Promise<void>}
     */
    async _onAccountChanged(_isNew) {}

    /**
     * Whether a player name is free in the shared `playerNames` index (or
     * already this player's). Override in a subclass to change the check.
     * @param {string} name  Player name to test for availability.
     * @returns {Promise<boolean>}
     */
    async _checkPlayerNameAvailable(name) {
        return Settings.checkPlayerNameAvailable?.(name) ?? true;
    }

    /**
     * Registers a player name in the shared `playerNames` index, releasing
     * the old one. Override in a subclass to change it.
     * @param {string} newName          New display name to register.
     * @param {string|null} oldName     Previous name to release, or null.
     */
    _claimPlayerName(newName, oldName) {
        Settings.claimPlayerName?.(newName, oldName);
    }
}
