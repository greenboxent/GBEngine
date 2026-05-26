/**
 * On-screen virtual controls for Android and iOS: virtual joystick, fire
 * joystick, and action buttons. No-ops on desktop.
 * @module systems/TouchControls
 */
import { Settings } from './SettingsManager.js';

/**
 * On-screen virtual controls for Android and iOS.
 *
 * Renders a fixed virtual joystick in the bottom-left quadrant, a fire
 * joystick (aim + continuous fire) in the bottom-right, and action buttons
 * (Fire, Dash, weapon cycle, Pause) on the right side.
 *
 * Only activates when `navigator.maxTouchPoints > 0`; silently no-ops on
 * desktop.  Integrates with {@link InputController} — each frame call
 * `update(inputController)` after `inputController.update()` so the IC's
 * stick and aim values are overwritten with the touch state.
 */
export class TouchControls {

    /** @param {Phaser.Scene} scene */
    constructor(scene) {
        this.scene  = scene;
        this.active = false;

        // Only activate on real touch devices
        if (navigator.maxTouchPoints < 1) return;

        this.active   = true;
        this._visible = true;

        /** Button hit-test definitions { x, y, r } — set by _layout */
        this._BTN = {};

        // ── Fixed joystick geometry (set by _layout) ────────────────────────
        this._joyX   = 0;   // fixed center X
        this._joyY   = 0;   // fixed center Y
        this._outerR = 0;   // outer ring radius (= max knob travel)
        this._knobR  = 0;   // knob draw radius
        this._joystickZoneW = 0;  // x boundary of joystick zone

        // ── Joystick state ──────────────────────────────────────────────────
        this._joystickPointerId = null;
        this._knobDX = 0;   // knob offset from fixed center
        this._knobDY = 0;
        this._stickX = 0;   // normalised -1..1
        this._stickY = 0;

        // ── Button state ────────────────────────────────────────────────────
        this._buttonPointerMap = {};
        this._btnDown = { weaponPrev: false, weaponNext: false, pause: false, zoom: false };
        this._btnPrev = { weaponPrev: false, weaponNext: false, pause: false, zoom: false };
        this._zoomActive = false;

        // ── Fire joystick state (right-side aim + fire stick) ────────────
        this._firePointerId = null;
        this._fireCX        = 0;   // fixed ring center X
        this._fireCY        = 0;   // fixed ring center Y
        this._fireR         = 0;   // ring radius
        this._fireKnobDX    = 0;   // knob offset from center
        this._fireKnobDY    = 0;
        this._fireActive    = false;
        this._fireAimAngle  = null; // degrees, null when no drag

        // ── Visuals ─────────────────────────────────────────────────────────
        this._staticGfx = scene.add.graphics().setScrollFactor(0).setDepth(99990);
        this._stickGfx  = scene.add.graphics().setScrollFactor(0).setDepth(99992);
        // Add to the stable uiLayer so they are rendered by the UI camera (zoom=1)
        // and ignored by the main camera (which has world zoom applied).
        scene.uiLayer?.add([this._staticGfx, this._stickGfx]);
        this._labels = {};

        this._layout();

        scene.scale.on('resize', this._onResize, this);
        this._setupPointerListeners();
    }

    // =========================================================================
    // Layout
    // =========================================================================

    /**
     * Computes and stores all positions (joystick, fire ring, buttons) based
     * on current screen dimensions and user settings.
     * @private
     */
    _layout() {
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;

        // Scale relative to shorter dimension, but never exceed 1× (small screen size is max)
        const s = Math.min(1.0, Math.min(W, H) / 600);

        // Joystick + fire joystick: scale with screen; user can tune size in Settings → Game.
        const userScale = (Settings.touchControlScale ?? 100) / 100;
        const shortSide = Math.min(W, H);
        const sizeScale = Math.max(0.60, Math.min(1.0, 1.0 - 0.30 * (shortSide - 345) / (806 - 345)));
        const stickR = Math.max(30, Math.round(shortSide * 0.156 * sizeScale * userScale));
        const actnR  = Math.round(Math.min(32, shortSide * 0.055));
        const weaponScale = (Settings.weaponBtnScale ?? 100) / 100;
        const weaponR = Math.round(actnR * weaponScale);

        // --- Compute everything in SCREEN space first ---
        const outerR_s = stickR;
        const knobR_s  = Math.round(outerR_s * 0.38);
        const jPad     = Math.round(16 * s);
        const hInset   = Settings.fireStickInset ?? 30;
        const joyX_s   = outerR_s + jPad + 10 + hInset;

        const yPct     = (Settings.touchControlY ?? 0) / 100;
        const wGapEst  = Math.round(8 * s);
        const wReserve = wGapEst + 2 * weaponR + jPad;
        const baseY    = H - outerR_s - Math.max(jPad, wReserve);
        const joyY_s   = Math.round(baseY + (H / 2 - baseY) * yPct);

        const fireR_s  = stickR;
        const fireCX_s = W - fireR_s - jPad - hInset;
        const fireCY_s = joyY_s;

        const wGap     = Math.round(8 * s) + 20;
        const wPrevY_s = Math.min(H - weaponR - 4, joyY_s   + outerR_s + wGap + weaponR);
        const wNextY_s = Math.min(H - weaponR - 4, fireCY_s + fireR_s  + wGap + weaponR);

        const hPad    = Math.max(8, Math.round(W * 0.025));
        const titleFs = Math.max(14, Math.min(22, Math.round(W * 0.042)));
        const statFs  = Math.max(12, Math.min(18, Math.round(W * 0.038)));
        const row1Y   = hPad + Math.round(titleFs / 2);
        const row2Y   = row1Y + titleFs + Math.round(hPad * 0.8);
        const row3Y   = row2Y + statFs  + Math.round(hPad * 0.6);
        const row4Y   = row3Y + statFs  + Math.round(hPad * 0.5);
        const pauseY_s = row4Y + Math.round(statFs / 2) + actnR + hPad;
        const pauseX_s = W - actnR - hPad;

        // Store positions in plain screen/canvas coords so they match ptr.x/ptr.y
        // and render correctly through the UI camera (zoom=1).
        this._outerR = outerR_s;
        this._knobR  = knobR_s;
        this._joyX   = joyX_s;
        this._joyY   = joyY_s;
        this._joystickZoneW = W * 0.45;

        this._fireR  = fireR_s;
        this._fireCX = fireCX_s;
        this._fireCY = fireCY_s;

        const zoomY_s = Math.min(H - actnR - 4, pauseY_s + 2 * actnR + 6);
        this._BTN = {
            weaponPrev: { x: joyX_s,   y: wPrevY_s, r: weaponR },
            weaponNext: { x: fireCX_s, y: wNextY_s, r: weaponR },
            pause:      { x: pauseX_s, y: pauseY_s, r: actnR },
            zoom:       { x: pauseX_s, y: zoomY_s,  r: actnR },
        };

        this._drawStaticButtons();
        this._rebuildLabels(s);
    }

    /**
     * Destroys and recreates all overlay text labels at the new scale.
     * @private
     * @param {number} s  Uniform scale factor derived from screen size.
     */
    _rebuildLabels(s) {
        Object.values(this._labels).forEach(t => t.destroy());
        this._labels = {};

        const BTN   = this._BTN;
        const scene = this.scene;
        const vis   = this._visible;

        const mkLabel = (cfg, txt, sz) =>
            scene.add.text(cfg.x, cfg.y, txt, {
                fontSize:        `${Math.round(sz * s)}px`,
                fontFamily:      'Arial Black, Arial',
                color:           '#ffffff',
                stroke:          '#000000',
                strokeThickness: 3,
            }).setOrigin(0.5).setScrollFactor(0).setDepth(99995).setVisible(vis);

        // Fire joystick label at ring center (positioned via instance vars)
        this._labels.fire = mkLabel(
            { x: this._fireCX, y: this._fireCY },
            'FIRE', 18,
        );
        this._labels.weaponPrev = mkLabel(BTN.weaponPrev, '◀ WPN', 14);
        this._labels.weaponNext = mkLabel(BTN.weaponNext, 'WPN ▶', 14);
        this._labels.pause      = mkLabel(BTN.pause,      '❚❚', 16);
        this._labels.zoom       = mkLabel(BTN.zoom,       '🔍', 14);

        // Add labels to uiLayer so the UI camera renders them at zoom=1.
        this.scene.uiLayer?.add(Object.values(this._labels));
    }

    /**
     * Resets all pointer state and re-runs `_layout` after a resize event.
     * @private
     */
    _onResize() {
        if (!this.active) return;
        this._joystickPointerId = null;
        this._knobDX = 0; this._knobDY = 0;
        this._stickX = 0; this._stickY = 0;
        this._firePointerId = null;
        this._fireActive    = false;
        this._fireKnobDX    = 0;
        this._fireKnobDY    = 0;
        this._fireAimAngle  = null;
        for (const k of Object.keys(this._btnDown)) this._btnDown[k] = false;
        for (const k of Object.keys(this._btnPrev)) this._btnPrev[k] = false;
        this._buttonPointerMap = {};
        this._stickGfx.clear();
        this._layout();
    }

    // =========================================================================
    // Drawing
    // =========================================================================

    /**
     * Clears and redraws all fixed button circles (joystick bases, weapon, pause, zoom).
     * @private
     */
    _drawStaticButtons() {
        if (!this.active) return;

        const g   = this._staticGfx;
        const BTN = this._BTN;
        g.clear();

        if (!this._visible) return;

        const circle = (cfg, fill, stroke, alpha = 0.70) => {
            g.fillStyle(fill, alpha);
            g.fillCircle(cfg.x, cfg.y, cfg.r);
            g.lineStyle(2.5, stroke, 0.90);
            g.strokeCircle(cfg.x, cfg.y, cfg.r);
        };

        // ── Fixed joystick base (always visible) ──────────────────────────
        const jx = this._joyX;
        const jy = this._joyY;
        const or = this._outerR;
        // Outer ring
        g.fillStyle(0x000000, 0.30);
        g.fillCircle(jx, jy, or);
        g.lineStyle(3, 0xffffff, 0.35);
        g.strokeCircle(jx, jy, or);
        // Center dot
        g.fillStyle(0xffffff, 0.25);
        g.fillCircle(jx, jy, this._knobR);

        // ── Fire joystick base (always visible, bottom-right) ─────────────
        const fx = this._fireCX;
        const fy = this._fireCY;
        const fr = this._fireR;
        g.fillStyle(0x330000, 0.30);
        g.fillCircle(fx, fy, fr);
        g.lineStyle(3, 0xff6666, 0.45);
        g.strokeCircle(fx, fy, fr);
        // Resting knob hint
        g.fillStyle(0xff4444, 0.35);
        g.fillCircle(fx, fy, this._knobR);

        // ── Right-side buttons ─────────────────────────────────────────────
        circle(BTN.weaponPrev, 0x334433, 0x88cc88);
        circle(BTN.weaponNext, 0x334433, 0x88cc88);
        circle(BTN.pause,      0x222222, 0x888888, 0.60);
        circle(BTN.zoom,
            this._zoomActive ? 0x112233 : 0x222222,
            this._zoomActive ? 0x44aaff : 0x666688, 0.60);
    }

    /** Redraw the knob each frame over the fixed base ring. */
    _drawJoystick() {
        const g = this._stickGfx;
        g.clear();

        if (!this._visible) return;

        const jx = this._joyX;
        const jy = this._joyY;
        const or = this._outerR;
        const kr = this._knobR;

        if (this._joystickPointerId !== null) {
            // Active: bright outer ring + moving knob
            g.lineStyle(3, 0xffffff, 0.60);
            g.strokeCircle(jx, jy, or);
            g.fillStyle(0xffffff, 0.12);
            g.fillCircle(jx, jy, or);

            const kx = jx + this._knobDX;
            const ky = jy + this._knobDY;
            g.fillStyle(0xffffff, 0.80);
            g.fillCircle(kx, ky, kr);
            g.lineStyle(2, 0xcccccc, 1.0);
            g.strokeCircle(kx, ky, kr);
        } else {
            // Idle: draw the resting knob at center
            g.fillStyle(0xffffff, 0.45);
            g.fillCircle(jx, jy, kr);
        }

        // ── Fire joystick knob ────────────────────────────────────────────
        if (this._fireActive) {
            const fkx = this._fireCX + this._fireKnobDX;
            const fky = this._fireCY + this._fireKnobDY;
            g.fillStyle(0xff4444, 0.90);
            g.fillCircle(fkx, fky, this._knobR);
            g.lineStyle(2, 0xff9999, 1.0);
            g.strokeCircle(fkx, fky, this._knobR);
        }
    }

    // =========================================================================
    // Pointer plumbing
    // =========================================================================

    /**
     * Registers pointerdown / pointermove / pointerup / pointercancel listeners.
     * @private
     */
    _setupPointerListeners() {
        this.scene.input.addPointer(4);

        this.scene.input.on('pointerdown',   this._onDown, this);
        this.scene.input.on('pointermove',   this._onMove, this);
        this.scene.input.on('pointerup',     this._onUp,   this);
        this.scene.input.on('pointercancel', this._onUp,   this);
    }

    /**
     * Handles a new touch point: routes to fire ring, buttons, or joystick.
     * @private
     * @param {Phaser.Input.Pointer} ptr  The Phaser pointer that triggered the event.
     */
    _onDown(ptr) {
        if (!this.active || !this._visible) return;

        // ptr.x/ptr.y are canvas (screen) coords; _joyX etc. are also in screen coords
        // because the UI camera renders them at zoom=1.
        const px = ptr.x;
        const py = ptr.y;

        // ── Fire joystick (right zone) — checked first to take priority ──
        if (px > this._joystickZoneW && this._firePointerId === null) {
            const fdx = px - this._fireCX;
            const fdy = py - this._fireCY;
            // Generous hit area: 1.5× radius so the whole bottom-right corner works
            if (fdx * fdx + fdy * fdy <= (this._fireR * 1.5) * (this._fireR * 1.5)) {
                this._firePointerId = ptr.id;
                this._fireActive    = true;
                this._updateFireKnob(px, py);
                return;
            }
        }

        // ── Other buttons (weapon prev/next, pause) ───────────────────────
        for (const [name, cfg] of Object.entries(this._BTN)) {
            const dx = px - cfg.x;
            const dy = py - cfg.y;
            if (dx * dx + dy * dy <= cfg.r * cfg.r) {
                this._btnDown[name]            = true;
                this._buttonPointerMap[ptr.id] = name;
                return;
            }
        }

        // ── Joystick (left zone, one touch at a time) ─────────────────────
        if (px < this._joystickZoneW && this._joystickPointerId === null) {
            this._joystickPointerId = ptr.id;
            // Compute initial knob offset from FIXED center (not touch point)
            this._updateKnob(px, py);
        }
    }

    /**
     * Routes pointer-move events to the active joystick or fire ring.
     * @private
     * @param {Phaser.Input.Pointer} ptr  The Phaser pointer that triggered the event.
     */
    _onMove(ptr) {
        if (!this.active || !this._visible) return;
        if (ptr.id === this._joystickPointerId) {
            this._updateKnob(ptr.x, ptr.y);
        } else if (ptr.id === this._firePointerId) {
            this._updateFireKnob(ptr.x, ptr.y);
        }
    }

    /**
     * Compute knob offset and normalised stick values from absolute finger position.
     * The knob is clamped to outerR from the FIXED joystick center.
     * @private
     */
    _updateKnob(fx, fy) {
        const dx   = fx - this._joyX;
        const dy   = fy - this._joyY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = this._outerR;

        if (dist > maxR) {
            const s      = maxR / dist;
            this._knobDX = dx * s;
            this._knobDY = dy * s;
        } else {
            this._knobDX = dx;
            this._knobDY = dy;
        }

        this._stickX = this._knobDX / maxR;
        this._stickY = this._knobDY / maxR;
    }

    /**
     * Compute fire-joystick knob offset and aim angle from finger position.
     * The knob is clamped to _fireR from the fixed fire ring center.
     * @private
     */
    _updateFireKnob(fx, fy) {
        const dx   = fx - this._fireCX;
        const dy   = fy - this._fireCY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = this._fireR;

        if (dist > maxR) {
            const sc         = maxR / dist;
            this._fireKnobDX = dx * sc;
            this._fireKnobDY = dy * sc;
        } else {
            this._fireKnobDX = dx;
            this._fireKnobDY = dy;
        }

        // Only update aim angle when the drag exceeds a small deadzone
        if (dist > 10) {
            this._fireAimAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        }
    }

    /**
     * Handles pointer-up/cancel: releases joystick, fire ring, or button state.
     * @private
     * @param {Phaser.Input.Pointer} ptr  The Phaser pointer that triggered the event.
     */
    _onUp(ptr) {
        if (!this.active) return;

        if (ptr.id === this._joystickPointerId) {
            this._joystickPointerId = null;
            this._knobDX = 0; this._knobDY = 0;
            this._stickX = 0; this._stickY = 0;
            return;
        }

        if (ptr.id === this._firePointerId) {
            this._firePointerId = null;
            this._fireActive    = false;
            this._fireKnobDX    = 0;
            this._fireKnobDY    = 0;
            this._fireAimAngle  = null;
            return;
        }

        const btnName = this._buttonPointerMap[ptr.id];
        if (btnName) {
            this._btnDown[btnName] = false;
            delete this._buttonPointerMap[ptr.id];
        }
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Merge touch state into the InputController.
     * Call this AFTER inputController.update() each frame.
     * @param {InputController} ic  The InputController whose state will be updated.
     */
    update(ic) {
        if (!this.active) return;

        // ── Movement (joystick wins over keyboard if stronger) ────────────
        if (Math.abs(this._stickX) > Math.abs(ic.moveX)) ic.moveX = this._stickX;
        if (Math.abs(this._stickY) > Math.abs(ic.moveY)) ic.moveY = this._stickY;

        // ── Aim angle: make hero face the direction the stick points ───────
        // This overrides the default mouse-cursor aiming on touch devices so
        // the hero doesn't snap to the bottom-left when you use the joystick.
        if (this._joystickPointerId !== null &&
            (Math.abs(this._stickX) > 0.15 || Math.abs(this._stickY) > 0.15)) {
            ic.aimAngle = Math.atan2(this._stickY, this._stickX) * (180 / Math.PI);
        }

        // ── Fire joystick (aim + continuous fire while held) —————————
        // When the player drags the fire stick, aim overrides movement direction
        // so they can shoot backwards while running the other way.
        if (this._fireActive) {
            ic.shoot = true;
            ic.continuousFire = true;   // bypass edge-trigger in Player.js
            if (this._fireAimAngle !== null) {
                ic.aimAngle = this._fireAimAngle;   // dragged direction wins
            }
        }

        // —— Aim assist (snap toward nearest enemy within a 30° cone) ————————
        if (this._fireActive) this._applyAimAssist(ic);

        // ── Pause (edge-triggered) ────────────────────────────────────────
        if (this._btnDown.pause && !this._btnPrev.pause) ic.pause = true;

        // ── Zoom toggle (edge-triggered) ──────────────────────────────────
        if (this._btnDown.zoom && !this._btnPrev.zoom) {
            this._zoomActive = !this._zoomActive;
            this._drawStaticButtons();
            if (this.scene._toggleZoom) this.scene._toggleZoom(this._zoomActive);
        }

        // ── Weapon switch (edge-triggered) ────────────────────────────────
        if (this._btnDown.weaponPrev && !this._btnPrev.weaponPrev) ic.weaponPrev = true;
        if (this._btnDown.weaponNext && !this._btnPrev.weaponNext) ic.weaponNext = true;

        this._btnPrev.pause      = this._btnDown.pause;
        this._btnPrev.weaponPrev = this._btnDown.weaponPrev;
        this._btnPrev.weaponNext = this._btnDown.weaponNext;
        this._btnPrev.zoom       = this._btnDown.zoom;

        // ── Redraw knob ───────────────────────────────────────────────────
        this._drawJoystick();
    }

    // =========================================================================
    // Aim assist
    // =========================================================================

    /**
     * Gently bends ic.aimAngle toward the nearest living enemy within a 30°
     * cone of the current aim direction.  Uses a 30 % blend per frame so the
     * assist feels magnetic rather than snappy.
     * @param {InputController} ic  The InputController to modify.
     */
    _applyAimAssist(ic) {
        const scene = this.scene;
        if (!scene.player || !scene.enemySpawner?.enemiesGroup) return;

        const px      = scene.player.x;
        const py      = scene.player.y;
        const aimRad  = ic.aimAngle * (Math.PI / 180);
        const CONE_R  = Math.PI / 6; // 30° half-cone in radians

        let bestAngleRad = null;
        let bestDist     = Infinity;

        scene.enemySpawner.enemiesGroup.children.forEach(enemy => {
            if (!enemy?.active || enemy.state === 'death' || (enemy.hp !== undefined && enemy.hp <= 0)) return;
            const dx   = enemy.x - px;
            const dy   = enemy.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 30) return; // skip point-blank

            const toEnemy = Math.atan2(dy, dx);
            let   delta   = toEnemy - aimRad;
            // Normalise to −π..π
            while (delta >  Math.PI) delta -= 2 * Math.PI;
            while (delta < -Math.PI) delta += 2 * Math.PI;

            if (Math.abs(delta) < CONE_R && dist < bestDist) {
                bestDist     = dist;
                bestAngleRad = toEnemy;
            }
        });

        if (bestAngleRad === null) return;

        // Blend ic.aimAngle toward target (30 % per frame → smooth magnetic pull)
        let bestDeg  = bestAngleRad * (180 / Math.PI);
        let diffDeg  = bestDeg - ic.aimAngle;
        while (diffDeg >  180) diffDeg -= 360;
        while (diffDeg < -180) diffDeg += 360;
        ic.aimAngle += diffDeg * 0.30;
    }

    /**
     * Shows or hides all touch-control graphics and labels.
     * Automatically resets all joystick and button state when hiding.
     * @param {boolean} visible - True to show, false to hide.
     */
    setVisible(visible) {
        this._visible = visible;

        this._staticGfx.setVisible(visible);
        this._stickGfx.setVisible(visible);
        Object.values(this._labels).forEach(t => t.setVisible(visible));

        if (!visible) {
            this._joystickPointerId = null;
            this._knobDX = 0; this._knobDY = 0;
            this._stickX = 0; this._stickY = 0;
            this._firePointerId = null;
            this._fireActive    = false;
            this._fireKnobDX    = 0;
            this._fireKnobDY    = 0;
            this._fireAimAngle  = null;
            for (const k of Object.keys(this._btnDown)) this._btnDown[k] = false;
            for (const k of Object.keys(this._btnPrev)) this._btnPrev[k] = false;
            this._buttonPointerMap = {};
            this._stickGfx.clear();
        } else {
            this._drawStaticButtons();
        }
    }

    /**
     * Removes all touch controls and cleans up Phaser objects and event listeners.
     * Call this from GameScene.shutdown() / destroy().
     */
    destroy() {
        this.active = false;

        this.scene.scale.off('resize', this._onResize, this);
        this.scene.input.off('pointerdown',   this._onDown, this);
        this.scene.input.off('pointermove',   this._onMove, this);
        this.scene.input.off('pointerup',     this._onUp,   this);
        this.scene.input.off('pointercancel', this._onUp,   this);

        this._staticGfx.destroy();
        this._stickGfx.destroy();
        Object.values(this._labels).forEach(t => t.destroy());
    }
}
