/**
 * Helper base class for building modal-style UI panels inside a Phaser scene.
 * Provides a dimmed background overlay, centered panel, consistent padding,
 * title creation, layout helpers, and depth management.
 * @module systems/scene/ModalBase
 */

import { TitleTheme } from '../../ui/styles/titleTheme.js';

/**
 * Helper class for building modal UI panels inside a Phaser scene.
 */
export default class ModalBase {

    /**
     * Creates a new ModalBase instance.
     *
     * @param {Phaser.Scene} scene - The scene that owns this modal.
     * @param {Object} config - Configuration options.
     * @param {number} config.width - Width of the modal panel.
     * @param {number} config.height - Height of the modal panel.
     * @param {number} config.padding - Inner padding for layout.
     * @param {string} [config.layout='panel'] - Layout style.
     * @param {string} [config.backgroundImage] - Optional background image key for panel.
     * @param {string} [config.overlayBackgroundImage] - Optional background image key for overlay.
     * @param {boolean} [config.transparentPanel=false] - Make panel rectangle transparent.
     * @param {boolean} [config.showBorder=true] - Show panel border.
     * @param {number} [config.alpha] - Custom alpha value for panel (0-1).
     */
    constructor(scene, config = {}) {
        this.scene = scene;

        /** @type {number} */
        this.panelWidth = config.width || 600;

        /** @type {number} */
        this.panelHeight = config.height || 400;

        /** @type {number} */
        this.padding = config.padding || 32;

        /** @type {string} */
        this.layout = config.layout || 'panel';

        /** @type {string|null} */
        this.backgroundImage = config.backgroundImage || null;

        /** @type {string|null} */
        this.overlayBackgroundImage = config.overlayBackgroundImage || null;

        /** @type {boolean} */
        this.transparentPanel = config.transparentPanel === true;

        /** @type {boolean} */
        this.showBorder = config.showBorder !== false;

        /** @type {number|null} */
        this.customAlpha = config.alpha !== undefined ? config.alpha : null;

        /** @type {Phaser.GameObjects.Container} */
        this.container = this.scene.add.container(0, 0).setDepth(99998);

        this._createOverlay();
        this._createPanel();
        this._setupResizeRestart();
    }

    // -------------------------------------------------------------------------
    // Internal Builders
    // -------------------------------------------------------------------------

    /**
     * Restarts the owning scene when the screen size changes significantly.
     * Handles fold phones, window resize on web, etc.
     * @private
     */
    _setupResizeRestart() {
        const scene = this.scene;
        // Dimensions at the time this scene's create() ran
        const builtW = scene.scale.width;
        const builtH = scene.scale.height;

        let _resizeTimer = null;
        let _lastW = builtW;
        let _lastH = builtH;

        // Track current screen size even while sleeping.
        // Only restart on WIDTH changes — height-only changes are caused by the
        // soft keyboard appearing/disappearing and must not trigger a rebuild.
        const onResize = (gameSize) => {
            if (Math.abs(gameSize.width - _lastW) < 30) return;
            _lastW = gameSize.width;
            _lastH = gameSize.height;

            // If active right now, restart immediately (debounced)
            if (scene.scene.isActive() && !scene.scene.isSleeping()) {
                clearTimeout(_resizeTimer);
                _resizeTimer = setTimeout(() => {
                    // Read data at restart time — sys.settings.data is populated by Phaser
                    // when the scene was started via scene.start(key, data).
                    const d = scene.sys.settings.data;
                    scene.scene.restart(d && Object.keys(d).length ? d : undefined);
                }, 400);
            }
            // If sleeping, the wake handler below will catch it
        };

        // When woken from sleep, check if screen WIDTH has changed since create()
        const onWake = () => {
            if (Math.abs(scene.scale.width - _lastW) >= 30) {
                _lastW = scene.scale.width;
                _lastH = scene.scale.height;
            }
            if (Math.abs(scene.scale.width - builtW) >= 30) {
                // Screen width changed while we were sleeping — rebuild
                const d = scene.sys.settings.data;
                setTimeout(() => scene.scene.restart(d && Object.keys(d).length ? d : undefined), 50);
            }
        };

        scene.scale.on('resize', onResize);
        scene.events.on('wake', onWake);

        scene.events.once('shutdown', () => {
            scene.scale.off('resize', onResize);
            scene.events.off('wake', onWake);
            clearTimeout(_resizeTimer);
        });
    }

    /**
     * Creates the dimmed background overlay.
     * @private
     */
    _createOverlay() {
        const { width, height } = this.scene.scale;

        // Add fullscreen background image if specified
        if (this.overlayBackgroundImage) {
            this.overlayBg = this.scene.add.image(
                width / 2,
                height / 2,
                this.overlayBackgroundImage
            )
            .setDepth(99996);

            // Cover scale: fill the screen while preserving aspect ratio
            const imgW = this.overlayBg.width  || 1280;
            const imgH = this.overlayBg.height || 1024;
            const coverScale = Math.max(width / imgW, height / imgH);
            this.overlayBg.setScale(coverScale);

            this.container.add(this.overlayBg);
        }

        this.overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.55
        )
        .setDepth(99997);

        this.container.add(this.overlay);
    }

    /**
     * Creates the centered modal panel.
     * @private
     */
    _createPanel() {
        const { width, height } = this.scene.scale;

        // Add background image if specified
        if (this.backgroundImage) {
            this.panelBg = this.scene.add.image(
                width / 2,
                height / 2,
                this.backgroundImage
            )
            .setDisplaySize(this.panelWidth, this.panelHeight)
            .setTint(0x808080)
            .setDepth(99998);

            this.container.add(this.panelBg);
        }

        // Determine panel alpha
        let panelAlpha = 1.0;
        if (this.customAlpha !== null) {
            panelAlpha = this.customAlpha;
        } else if (this.transparentPanel) {
            panelAlpha = 0.0;
        } else if (this.backgroundImage) {
            panelAlpha = 0.0;
        }

        this.panel = this.scene.add.rectangle(
            width / 2,
            height / 2,
            this.panelWidth,
            this.panelHeight,
            0x1a1a1a,
            panelAlpha
        );

        if (this.showBorder) {
            this.panel.setStrokeStyle(3, 0xffffff);
        }

        this.panel.setDepth(99999);

        this.container.add(this.panel);
    }

    // -------------------------------------------------------------------------
    // Public Helpers
    // -------------------------------------------------------------------------

    /**
     * Creates a title text centered at the top of the modal panel.
     *
     * @param {string} text - The title text.
     */
    createTitle(text) {
        const { width, height } = this.scene.scale;
        // Scale title font: 42px at 900px tall, clamp 24–42px
        const titleFs = Math.max(24, Math.min(42, Math.round(height * 0.047)));
        const title = this.scene.add.text(
            width / 2,
            height / 2 - this.panelHeight / 2 + this.padding,
            text,
            {
                fontFamily: TitleTheme.fontFamily,
                fontSize: `${titleFs}px`,
                fontStyle: TitleTheme.fontStyle,
                color: TitleTheme.color,
                align: TitleTheme.align,
                stroke: TitleTheme.stroke,
                strokeThickness: TitleTheme.strokeThickness
            }
        )
        .setOrigin(0.5)
        .setDepth(99999);

        this.container.add(title);
        return title;
    }

    /**
     * Returns the X coordinate of the panel center.
     * @returns {number}
     */
    getCenterX() {
        return this.scene.scale.width / 2;
    }

    /**
     * Returns the Y coordinate where content should begin (below the title).
     * @returns {number}
     */
    getContentStartY() {
        return (
            this.scene.scale.height / 2 -
            this.panelHeight / 2 +
            this.padding +
            60
        );
    }

    /**
     * Returns the Y coordinate near the bottom of the modal panel.
     * Useful for placing bottom-aligned UI elements like Back buttons.
     *
     * @returns {number}
     */
    getBottomY() {
        return (
            this.scene.scale.height / 2 +
            this.panelHeight / 2 -
            this.padding -
            20
        );
    }
}
