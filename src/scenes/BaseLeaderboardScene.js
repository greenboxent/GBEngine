/**
 * @module scenes/BaseLeaderboardScene
 */

import * as Phaser from 'phaser';
import ModalBase       from '../systems/scene/ModalBase.js';
import { UIScrollablePanel } from '../ui/components/uiScrollablePanel.js';
import { createMenuButton, createText } from '../ui/ui.js';
import { ButtonTheme } from '../ui/styles/buttonTheme.js';
import { InputController } from '../systems/InputController.js';
import { PersonalScores }  from '../systems/PersonalScores.js';

/**
 * Game-agnostic leaderboard scene.
 *
 * Shows a global high-score table and a personal-scores panel with left/right
 * toggle arrows and full keyboard/gamepad navigation.
 * Backed by {@link LeaderboardService} and {@link PersonalScores}.
 *
 * Override hooks:
 * - `_getControllerKey()` — SceneController key (default `'SceneController'`)
 * - `_getGlobalTitle()` / `_getPersonalTitle()` — column heading strings
 * - `_renderGlobalRow(panel, entry, y, sw, fsSm, fsMd, showDate)` — custom global row
 * - `_renderPersonalRow(panel, entry, y, entryH, sw, fsSm, fsMd)` — custom personal row
 * - `_onBack()` — called just before `closeModal` for cleanup
 */
export default class BaseLeaderboardScene extends Phaser.Scene {
    /**
     * @param {string} [key='LeaderboardScene']
     * @param {object} leaderboardService  LeaderboardService instance.
     */
    constructor(key = 'LeaderboardScene', leaderboardService = null) {
        super(key);
        this._lb              = leaderboardService;
        this.modal            = null;
        this.inputController  = null;
        this.cooldownFrames   = 0;
        this.horizontalCooldown = 0;
        this.leaderboardData  = [];
        this.viewMode         = 'personal';   // 'global' | 'personal'
        this.contentContainer = null;
        this.leftArrow        = null;
        this.rightArrow       = null;
        this.titleText        = null;
        this.previousScene    = null;
        this.activeScrollPanel = null;
        this.isClosing        = false;
    }

    /**
     * Inject the leaderboard service after construction.
     * @param {LeaderboardService} service  Configured LeaderboardService instance.
     */
    setLeaderboardService(service) { this._lb = service; }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Receives navigation context.
     * @param {object} data
     * @param {string} [data.from]  Scene key to return to when Back is pressed.
     */
    init(data) {
        this.previousScene  = data?.from ?? null;
        this.cooldownFrames = 10;
        this.isClosing      = false;
    }

    /**
     * Builds the leaderboard modal, loads global data, and renders the initial view.
     * @override
     */
    async create() {
        this.leaderboardData = [];

        const { width, height } = this.scale;

        this.inputController = InputController.getInstance(this);

        // When the scene is woken from sleep (re-opened via openModal),
        // init() is NOT called again by Phaser, so reset state here.
        this.events.on('wake', (_sys, data) => {
            this.isClosing      = false;
            this.cooldownFrames = 10;
            if (data?.from) this.previousScene = data.from;
        }, this);

        const modalW = Math.min(width  * 0.95, 900);
        const modalH = Math.min(height * 0.92, 650);

        this.modal = new ModalBase(this, {
            layout:  'panel',
            width:   modalW,
            height:  modalH,
            padding: 28,
            overlayBackgroundImage: 'main_menu',
            transparentPanel: true,
            showBorder: false,
        });

        this._panelW  = this.modal.panelWidth;
        this._panelH  = this.modal.panelHeight;
        this._cx      = this.modal.getCenterX();
        this._scrollW = this._panelW - 44;

        /** Scale a base font size up on wide panels. */
        this._fs = (base) => {
            const scale = Math.max(1.0, Math.min(1.4, this._panelW / 550));
            return `${Math.round(base * scale)}px`;
        };

        // Title
        this.titleText = this.modal.createTitle(this._getPersonalTitle());
        this.titleText.setFontSize('29px');

        const cx     = this._cx;
        const titleY = this.modal.getContentStartY();

        // Content container (cleared on each view switch)
        this.contentContainer = this.add.container(0, 0);
        this.modal.container.add(this.contentContainer);

        // Left / right arrows flanking the title
        const arrowY  = titleY - 18;
        const arrowFs = this._fs(32);

        this.leftArrow = createText(this, cx - this._panelW * 0.44, arrowY, '◄', {
            fontSize: arrowFs, color: ButtonTheme.color.normal,
        }).setOrigin(0.5).setPadding(24, 20, 24, 20).setInteractive({ useHandCursor: true });
        this.leftArrow.on('pointerdown', () => this.toggleView());
        this.leftArrow.on('pointerover', () => this.leftArrow.setColor(ButtonTheme.color.hover));
        this.leftArrow.on('pointerout',  () => this.leftArrow.setColor(ButtonTheme.color.normal));
        this.modal.container.add(this.leftArrow);

        this.rightArrow = createText(this, cx + this._panelW * 0.44, arrowY, '►', {
            fontSize: arrowFs, color: ButtonTheme.color.normal,
        }).setOrigin(0.5).setPadding(24, 20, 24, 20).setInteractive({ useHandCursor: true });
        this.rightArrow.on('pointerdown', () => this.toggleView());
        this.rightArrow.on('pointerover', () => this.rightArrow.setColor(ButtonTheme.color.hover));
        this.rightArrow.on('pointerout',  () => this.rightArrow.setColor(ButtonTheme.color.normal));
        this.modal.container.add(this.rightArrow);

        // Load global data in background
        await this._loadGlobalData();

        // Render initial (personal) view
        await this.renderView();

        // Back button
        const bottomY = this.modal.getBottomY();
        const backBtn = createMenuButton(this, cx, bottomY, 'BACK', () => this.handleBack());
        this.modal.container.add(backBtn);
    }

    // -------------------------------------------------------------------------
    // Data loading
    // -------------------------------------------------------------------------

    /**
     * Fetches the global top-score list from LeaderboardService.
     * Silently clears the list on timeout or error.
     * @private
     * @returns {Promise<void>}
     */
    async _loadGlobalData() {
        if (!this._lb) { this.leaderboardData = []; return; }
        try {
            const timeout  = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
            const fetching = this._lb.getTopScores(100);
            this.leaderboardData = await Promise.race([fetching, timeout]);
        } catch {
            this.leaderboardData = [];
        }
    }

    // -------------------------------------------------------------------------
    // View switching
    // -------------------------------------------------------------------------

    /**
     * Switches between global and personal views.
     * @returns {Promise<void>}
     */
    async toggleView() {
        await this.switchView(this.viewMode === 'global' ? 'personal' : 'global');
    }

    /**
     * Switches to the given view mode and re-renders content.
     * @param {'global'|'personal'} mode  The view to switch to.
     * @returns {Promise<void>}
     */
    async switchView(mode) {
        if (mode === this.viewMode) return;
        this.viewMode = mode;
        await this.renderView();
    }

    /**
     * Clears content and re-renders the current view.
     * @returns {Promise<void>}
     */
    async renderView() {
        this.contentContainer.removeAll(true);
        this.activeScrollPanel = null;

        if (this.titleText?.setText) {
            this.titleText.setText(
                this.viewMode === 'global' ? this._getGlobalTitle() : this._getPersonalTitle()
            );
        }

        const cx     = this._cx;
        const startY = this.modal.getContentStartY() + 10;

        if (this.viewMode === 'global') {
            this._renderGlobalView(cx, startY);
        } else {
            await this._renderPersonalView(cx, startY);
        }
    }

    // -------------------------------------------------------------------------
    // Global view
    // -------------------------------------------------------------------------

    /**
     * Renders the global top-scores list inside a scrollable panel.
     * @private
     * @param {number} cx      Centre X.
     * @param {number} startY  Top Y for content.
     */
    _renderGlobalView(cx, startY) {
        if (this.leaderboardData.length === 0) {
            const t = createText(this, cx, startY + 100,
                'No scores yet.\nBe the first!', {
                    fontSize: this._fs(22), color: '#AAAAAA', align: 'center'
                }).setOrigin(0.5);
            this.contentContainer.add(t);
            return;
        }

        const sw      = this._scrollW;
        const scrollH = Math.max(80, this.modal.getBottomY() - this.modal.getContentStartY() - 80);
        const panel   = UIScrollablePanel(
            this, cx - sw / 2, startY, sw, scrollH,
            { showScrollbar: true, transparentBackground: true, showFrame: false, autoHideScrollbar: true }
        );
        this.activeScrollPanel = panel;

        const showDate = sw >= 480;
        const fsSm = this._fs(15);
        const fsMd = this._fs(18);
        const entryH = Math.round(Math.min(42, this._panelH * 0.058));
        let contentY = 10;

        this.leaderboardData.forEach(entry => {
            this._renderGlobalRow(panel, entry, contentY, sw, fsSm, fsMd, showDate);
            contentY += entryH;
        });

        panel.addItem(this.add.rectangle(0, contentY + 20, 1, 1, 0x000000, 0));
        this.contentContainer.add(panel);
    }

    // -------------------------------------------------------------------------
    // Personal view
    // -------------------------------------------------------------------------

    /**
     * Renders the personal scores list inside a scrollable panel.
     * @private
     * @param {number} cx      Centre X.
     * @param {number} startY  Top Y for content.
     * @returns {Promise<void>}
     */
    async _renderPersonalView(cx, startY) {
        let scores = [];
        try { scores = await PersonalScores.getAllSorted(); } catch { scores = []; }

        if (scores.length === 0) {
            const t = createText(this, cx, startY + 100,
                'No personal scores yet.\nComplete some levels!', {
                    fontSize: this._fs(22), color: '#AAAAAA', align: 'center'
                }).setOrigin(0.5);
            this.contentContainer.add(t);
            return;
        }

        const sw      = this._scrollW;
        const scrollH = Math.max(80, this.modal.getBottomY() - this.modal.getContentStartY() - 80);
        const panel   = UIScrollablePanel(
            this, cx - sw / 2, startY, sw, scrollH,
            { showScrollbar: true, transparentBackground: true, showFrame: false, autoHideScrollbar: true }
        );
        this.activeScrollPanel = panel;

        const fsSm   = this._fs(14);
        const fsMd   = this._fs(19);
        const entryH = Math.round(Math.min(80, this._panelH * 0.11));
        let contentY = 10;

        scores.forEach(entry => {
            this._renderPersonalRow(panel, entry, contentY, entryH, sw, fsSm, fsMd);
            contentY += entryH;
        });

        panel.addItem(this.add.rectangle(0, contentY + 20, 1, 1, 0x000000, 0));
        this.contentContainer.add(panel);
    }

    // -------------------------------------------------------------------------
    // Hooks — override in subclass
    // -------------------------------------------------------------------------

    /** @returns {string} Scene key of the SceneController. */
    _getControllerKey() { return 'SceneController'; }

    /** @returns {string} Title shown in global view. */
    _getGlobalTitle() { return 'LEADERBOARD'; }

    /** @returns {string} Title shown in personal view. */
    _getPersonalTitle() { return 'MY SCORES'; }

    /**
     * Render one row in the global leaderboard.
     * Default: rank (left), name (col 13%), score (right).
     */
    _renderGlobalRow(panel, entry, contentY, sw, fsSm, fsMd, showDate) {
        const colRank  = 4;
        const colName  = Math.round(sw * 0.13);
        const colScore = sw - 20;

        let rankColor = '#FFFFFF';
        if (entry.rank === 1) rankColor = '#FFD700';
        else if (entry.rank === 2) rankColor = '#C0C0C0';
        else if (entry.rank === 3) rankColor = '#CD7F32';

        const isPlayer  = entry.isCurrentPlayer === true;
        const nameColor = isPlayer ? '#00FF00' : '#FFFFFF';
        const bold      = isPlayer ? 'bold' : 'normal';

        panel.addItem(createText(this, colRank, contentY, `#${entry.rank}`, {
            fontSize: fsMd, color: rankColor, fontStyle: entry.rank <= 3 ? 'bold' : 'normal',
        }).setOrigin(0, 0.5));

        panel.addItem(createText(this, colName, contentY, entry.playerName ?? 'Anonymous', {
            fontSize: fsMd, color: nameColor, fontStyle: bold,
        }).setOrigin(0, 0.5));

        panel.addItem(createText(this, colScore, contentY,
            (entry.score ?? 0).toLocaleString(), {
                fontSize: fsMd, color: nameColor, fontStyle: bold,
            }).setOrigin(1, 0.5));
    }

    /**
     * Render one row in the personal scores list.
     * Default: level (top-left), score (top-right), date (mid-left).
     */
    _renderPersonalRow(panel, entry, contentY, entryH, sw, fsSm, fsMd) {
        const row0 = Math.round(entryH * 0.25);
        const row1 = Math.round(entryH * 0.70);
        const colL = 10;
        const colR = sw - 20;

        panel.addItem(createText(this, colL, contentY + row0, `Level ${entry.level ?? '-'}`, {
            fontSize: fsMd, color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0, 0.5));

        panel.addItem(createText(this, colR, contentY + row0,
            (entry.score ?? 0).toLocaleString(), {
                fontSize: fsMd, color: '#00FF00',
            }).setOrigin(1, 0.5));

        const d = new Date(entry.date ?? Date.now());
        const dateStr = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}` +
            (entry.difficulty ? `  •  ${entry.difficulty}` : '');
        panel.addItem(createText(this, colL, contentY + row1, dateStr, {
            fontSize: fsSm, color: '#888888',
        }).setOrigin(0, 0.5));
    }

    /** Called just before closeModal — use for any pre-close cleanup. */
    _onBack() {}

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    /**
     * Closes the leaderboard modal.  Guards against double-close.
     */
    handleBack() {
        if (this.isClosing) return;
        this.isClosing = true;
        this._onBack();
        const ctrl = this.scene.get(this._getControllerKey());
        ctrl?.flow?.modal?.closeModal(this.sys.settings.key);
    }

    /** @override */
    update() {
        if (!this.inputController) return;

        if (this.cooldownFrames > 0) {
            this.cooldownFrames--;
            this.inputController.update();
            this.inputController.menuBack   = false;
            this.inputController.menuSelect = false;
            return;
        }

        this.inputController.update();

        if (this.inputController.menuBack) {
            this.inputController.menuBack = false;
            this.handleBack();
            return;
        }

        if (this.inputController.menuSelect) {
            this.inputController.menuSelect = false;
            this.handleBack();
            return;
        }

        // Scroll with left stick / d-pad
        if (this.activeScrollPanel) {
            if (this.inputController.moveY !== 0) {
                this.activeScrollPanel.scrollBy(-this.inputController.moveY * 15);
            }
            const pad = this.inputController.pad;
            if (pad) {
                if (pad.buttons[13]?.pressed) this.activeScrollPanel.scrollBy(-20);
                if (pad.buttons[12]?.pressed) this.activeScrollPanel.scrollBy(20);
            }
        }

        // Horizontal: switch views
        if (this.horizontalCooldown > 0) {
            this.horizontalCooldown--;
        } else if (this.inputController.moveX !== 0 ||
                   this.inputController.menuTabLeft ||
                   this.inputController.menuTabRight) {
            this.toggleView();
            this.horizontalCooldown = 15;
            this.inputController.menuTabLeft  = false;
            this.inputController.menuTabRight = false;
        }
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Resets all state when the scene is stopped.
     * @override
     */
    shutdown() {
        this.inputController  = null;
        this.modal            = null;
        this.leaderboardData  = [];
        this.activeScrollPanel = null;
        this.cooldownFrames   = 0;
        this.horizontalCooldown = 0;
        this.isClosing        = false;
    }
}
