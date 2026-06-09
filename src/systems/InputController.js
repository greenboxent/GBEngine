/**
 * @module systems/InputController
 */
import * as Phaser from 'phaser';
import { Keybindings } from './KeybindingManager.js';
import { Debug } from '../engine/Debug.js';

/**
 * A unified runtime input system that reads bindings from {@link KeybindingManager},
 * converts them into Phaser Key objects, and exposes high-level movement and
 * action state (`moveX`, `moveY`, `shoot`, `dash`, `pause`, `settings`).
 *
 * - Handles gamepad START/BACK
 * - Automatically rebuilds keys when bindings change
 * - Singleton pattern — one instance is shared across all scenes
 *
 * Gameplay scenes access the shared instance via `InputController.getInstance()`.
 * This is the only place in the codebase that creates Phaser key objects.
 */
export class InputController {

    /** @private @static */
    static _instance = null;

    /**
     * Gets the singleton instance of InputController.
     * If a scene is provided, always rebinds to that scene.
     * @param {Phaser.Scene} [scene] - The scene to bind to (required on first call).
     * @returns {InputController}
     */
    static getInstance(scene) {
        if (!InputController._instance) {
            if (!scene) {
                throw new Error('InputController: scene required for first getInstance call');
            }
            InputController._instance = new InputController(scene);
        } else if (scene) {
            // Always rebind when a scene is provided to avoid timing issues
            InputController._instance.bindToScene(scene);
        }
        return InputController._instance;
    }

    /**
     * Resets the singleton instance (useful for testing or scene cleanup).
     * @static
     */
    static reset() {
        InputController._instance = null;
    }

    /**
     * Creates a new InputController.
     * @private
     * @param {Phaser.Scene} scene - The scene that owns this controller.
     */
    constructor(scene) {
        this.scene = scene;

        // Phaser Key objects
        this.keys = {};

        // High-level state exposed to gameplay
        this.moveX = 0;
        this.moveY = 0;
        this.shoot = false;
        this.dash = false;
        this.pause = false;
        this.settings = false;
        this.weaponPrev = false;
        this.weaponNext = false;

        // Menu navigation state
        this.menuUp = false;
        this.menuDown = false;
        this.menuSelect = false;
        this.menuBack = false;
        this.menuTabLeft = false;
        this.menuTabRight = false;

        // Touch joystick aim override (degrees). Set by TouchControls; null = use mouse/gamepad default.
        this.aimAngle = null;

        // True while touch FIRE button is held — allows continuous firing (weapon cooldown limits rate).
        this.continuousFire = false;

        /** @type {Phaser.Input.Gamepad.Gamepad|null} */
        this.pad = null;

        this.prevLB = false;
        this.prevRB = false;
        this.prevStartPressed = false;
        this.prevBackPressed = false;

        // Menu navigation tracking
        this.prevLeftY = 0;
        this.prevDpadDown = false;
        this.prevDpadUp = false;
        this.prevAPressed = false;
        this.prevDpadLeft = false;
        this.prevDpadRight = false;

        // Debug: track RT trigger
        this.debugRTCount = 0;
        this.prevRTPressed = false;

        // Build keys from current bindings
        this._buildKeys();

        // Gamepad connection — listen at window level so it fires regardless of active scene
        window.addEventListener('gamepadconnected', (e) => {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            this._rawPad = Array.from(pads).find(p => p !== null) || null;
        });
        window.addEventListener('gamepaddisconnected', () => {
            this._rawPad = null;
        });

        // Release cached pad when tab loses focus so other tabs can grab it cleanly.
        // Re-seed when tab regains focus.
        window.addEventListener('blur', () => {
            this._rawPad = null;
            this.moveX = 0; this.moveY = 0;
            this.shoot = false; this.pause = false; this.settings = false;
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._rawPad = null;
                this.moveX = 0; this.moveY = 0;
                this.shoot = false; this.pause = false; this.settings = false;
            } else {
                this._seedRawPad();
            }
        });

        // Seed from any already-active pad
        this._rawPad = null;
        this._seedRawPad();

        scene.input.gamepad.once('connected', pad => {
            this.pad = pad;
        });

        if (scene.input.gamepad.total > 0) {
            this.pad = scene.input.gamepad.getPad(0);
        }
    }

    /**
     * Seeds _rawPad from navigator.getGamepads() — finds first non-null entry.
     * @private
     */
    _seedRawPad() {
        if (!navigator.getGamepads) return;
        const pads = navigator.getGamepads();
        this._rawPad = Array.from(pads).find(p => p !== null) || null;
    }

    // -------------------------------------------------------------------------
    // Key Construction
    // -------------------------------------------------------------------------

    /**
     * Converts a binding (string or keycode) into a Phaser Key object.
     * @private
     */
    _resolveKey(actionName) {
        const raw = Keybindings.get(actionName);

        // If KeybindingsManager returned a number, it's already a keycode
        if (typeof raw === 'number') {
            return this.scene.input.keyboard.addKey(raw);
        }

        // Otherwise convert string → keycode
        const code = Phaser.Input.Keyboard.KeyCodes[raw];
        return this.scene.input.keyboard.addKey(code);
    }

    /**
     * Builds all Phaser Key objects from the current bindings.
     * @private
     */
    _buildKeys() {
        this.keys = {
            up:       this._resolveKey('moveUp'),
            down:     this._resolveKey('moveDown'),
            left:     this._resolveKey('moveLeft'),
            right:    this._resolveKey('moveRight'),
            shoot:    this._resolveKey('shoot'),
            dash:     this._resolveKey('dash'),
            pause:    this._resolveKey('pause'),
            settings: this._resolveKey('settings'),
            weaponPrev: this._resolveKey('weaponPrev'),
            weaponNext: this._resolveKey('weaponNext')
        };
    }

    /**
     * Rebuilds all keys after a binding change.
     * Call this after Keybindings.set().
     */
    refresh() {
        this._buildKeys();
    }

    /**
     * Binds the InputController to a different scene.
     * Call this when switching between scenes.
     * @param {Phaser.Scene} scene - The new scene to bind to.
     */
    bindToScene(scene) {
        Debug.log('InputController', `Binding to scene: ${scene.scene.key}, input.enabled: ${scene.input.enabled}, gamepad.total: ${scene.input.gamepad.total}`, 2);
        
        this.scene = scene;
        
        // Rebuild keys for the new scene
        this._buildKeys();
        
        // Update gamepad reference
        if (scene.input.gamepad.total > 0) {
            this.pad = scene.input.gamepad.getPad(0);
            Debug.log('InputController', `Gamepad connected: ${this.pad ? 'YES' : 'NO'}`, 2);
        } else {
            Debug.log('InputController', 'No gamepad detected', 2);
        }
        
        // Listen for gamepad connection on new scene
        scene.input.gamepad.once('connected', pad => {
            this.pad = pad;
            Debug.log('InputController', 'Gamepad connected event fired', 2);
        });
    }

    // -------------------------------------------------------------------------
    // Update Loop
    // -------------------------------------------------------------------------

    /**
     * Updates high-level input state.
     * Call this once per frame from the owning scene's update().
     */
    update() {
        const k = this.keys;

        // Reset touch aim override — TouchControls.update() will set this if joystick is active
        this.aimAngle = null;
        this.continuousFire = false;

        // Movement axes
        this.moveX = (k.left.isDown ? -1 : 0) + (k.right.isDown ? 1 : 0);
        this.moveY = (k.up.isDown ? -1 : 0) + (k.down.isDown ? 1 : 0);

        // Actions (shoot is edge-triggered, dash is level-triggered)
        this.shoot = Phaser.Input.Keyboard.JustDown(k.shoot);
        this.dash = k.dash.isDown;

        // Pause + Settings (edge-triggered)
        this.pause = Phaser.Input.Keyboard.JustDown(k.pause);
        this.settings = Phaser.Input.Keyboard.JustDown(k.settings);
        
        // Menu back with ESC key
        const escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.menuBack = Phaser.Input.Keyboard.JustDown(escKey);

        // Weapon switching (edge-triggered)
        this.weaponPrev = Phaser.Input.Keyboard.JustDown(k.weaponPrev);
        this.weaponNext = Phaser.Input.Keyboard.JustDown(k.weaponNext);

        // Gamepad support — use window-level cached raw pad (_rawPad) which bypasses
        // Phaser's per-scene timestamp guard and Chrome's index-0 assumption.
        // _rawPad is kept fresh by window gamepadconnected/disconnected listeners.
        this.pad = this.scene.input.gamepad.getPad(0); // keep Phaser ref for events
        // Refresh from raw API every frame (handles reconnects and index changes)
        const freshPads = navigator.getGamepads ? navigator.getGamepads() : [];
        const rawPad = Array.from(freshPads).find(p => p !== null) || this._rawPad || null;
        if (rawPad) this._rawPad = rawPad;

        if (rawPad) {
            const xbox = Phaser.Input.Gamepad.Configs.XBOX_360;

            const startPressed = rawPad.buttons[xbox.START]?.pressed || false;
            const backPressed  = rawPad.buttons[xbox.BACK]?.pressed  || false;

            if (backPressed  && !this.prevBackPressed)  this.pause    = true;
            if (startPressed && !this.prevStartPressed) this.settings = true;

            this.prevStartPressed = startPressed;
            this.prevBackPressed  = backPressed;

            // Gamepad movement (left analog stick, raw axis values)
            const ax = rawPad.axes[0] || 0;
            const ay = rawPad.axes[1] || 0;

            if (Math.abs(ax) > 0.2) this.moveX = ax;
            if (Math.abs(ay) > 0.2) this.moveY = ay;

            // Gamepad shoot (RT) — edge-triggered
            const rtValue   = rawPad.buttons[7]?.value || 0;
            const rtPressed = rtValue > 0.1;
            if (rtPressed && !this.prevRTPressed) {
                this.shoot = true;
                this.debugRTCount++;
            }
            this.prevRTPressed = rtPressed;

            // Weapon switching / tab navigation (LB/RB) — edge-triggered
            const lbPressed = rawPad.buttons[4]?.pressed || false;
            const rbPressed = rawPad.buttons[5]?.pressed || false;

            if (lbPressed && !this.prevLB) { this.weaponPrev = true; this.menuTabLeft  = true; }
            if (rbPressed && !this.prevRB) { this.weaponNext = true; this.menuTabRight = true; }

            this.prevLB = lbPressed;
            this.prevRB = rbPressed;

            // Menu navigation (left stick Y + D-pad + face buttons) — edge-triggered
            const leftY     = rawPad.axes[1] || 0;
            const dpadDown  = rawPad.buttons[13]?.pressed || false;
            const dpadUp    = rawPad.buttons[12]?.pressed || false;
            const aPressed  = rawPad.buttons[0]?.pressed  || false;
            const bPressed  = rawPad.buttons[1]?.pressed  || false;
            const dpadLeft  = rawPad.buttons[14]?.pressed || false;
            const dpadRight = rawPad.buttons[15]?.pressed || false;

            if ((this.prevLeftY <= 0.5  && leftY > 0.5)  || (dpadDown  && !this.prevDpadDown))  this.menuDown   = true;
            if ((this.prevLeftY >= -0.5 && leftY < -0.5) || (dpadUp    && !this.prevDpadUp))    this.menuUp     = true;
            if (aPressed && !this.prevAPressed) this.menuSelect = true;
            if (bPressed && !this.prevBPressed) this.menuBack   = true;
            if (dpadLeft  && !this.prevDpadLeft)  this.menuTabLeft  = true;
            if (dpadRight && !this.prevDpadRight) this.menuTabRight = true;

            this.prevBPressed  = bPressed;
            this.prevLeftY     = leftY;
            this.prevDpadDown  = dpadDown;
            this.prevDpadUp    = dpadUp;
            this.prevAPressed  = aPressed;
            this.prevDpadLeft  = dpadLeft;
            this.prevDpadRight = dpadRight;
        }

        if (Debug.isLevel3Active() && (this.moveX !== 0 || this.moveY !== 0)) {
            console.log('[InputController] state:', { moveX: this.moveX, moveY: this.moveY });
        }
    }

    /**
     * Resets menu navigation state. Call this when a scene wakes.
     */
    resetMenuState() {
        this.menuUp = false;
        this.menuDown = false;
        this.menuSelect = false;
        this.menuBack = false;
        this.menuTabLeft = false;
        this.menuTabRight = false;

        // Sample current raw gamepad state to prevent false edge triggers on wake
        this._seedRawPad();
        const rawPad  = this._rawPad;
        this.pad = this.scene.input.gamepad.getPad(0);
        if (rawPad) {
            this.prevLeftY     = rawPad.axes[1] || 0;
            this.prevDpadDown  = rawPad.buttons[13]?.pressed || false;
            this.prevDpadUp    = rawPad.buttons[12]?.pressed || false;
            this.prevBPressed  = rawPad.buttons[1]?.pressed  || false;
            this.prevAPressed  = rawPad.buttons[0]?.pressed  || false;
            this.prevDpadLeft  = rawPad.buttons[14]?.pressed || false;
            this.prevDpadRight = rawPad.buttons[15]?.pressed || false;
        }
    }
}
