/**
 * Visual, interactive Xbox-style gamepad diagnostic panel using Bézier
 * silhouette geometry. Compatible with Phaser 3.9+.
 * @module ui/GamepadTestPanel
 */

/**
 * A visual, interactive Xbox-style controller diagnostic panel.
 * Displays sticks, buttons, triggers, bumpers, and D-pad states in real time.
 *
 * @class GamepadTestPanel
 * @param {Phaser.Scene} scene - The scene that owns this panel.
 * @param {number} x - The center X coordinate of the panel.
 * @param {number} y - The center Y coordinate of the panel.
 * @param {number} width - The total width of the controller layout.
 */
export default class GamepadTestPanel {

    constructor(scene, x, y, width) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;

        this.container = scene.add.container(0, 0);
        this.gfx = scene.add.graphics();
        this.container.add(this.gfx);

        this.sticks = {};
        this.buttons = {};
        this.dpad = {};
        this.triggers = {};
        this.bumpers = {};
        this.misc = {};

        this._build();
    }

    /** @private Builds and positions all controller sub-components. */
    _build() {
        const cx = this.x;
        const cy = this.y;
        const w = this.width;
        const h = w * 0.55;

        const temp = this._getTempHeight(w);
        const originalWidth = temp.width;
        const originalHeight = temp.height;

        const tabCenterX = 678;
        const tabCenterY = 187;
        const scale = w / originalWidth;
        const imageCenterX = cx;
        const imageCenterY = cy - (tabCenterY - originalHeight / 2) * scale;

        this._addSilhouetteImage(cx, cy, w, imageCenterX, imageCenterY);

        const top = cy - h / 2;
        const bottom = cy + h / 2;

        const getPos = (origX, origY) => ({
            x: imageCenterX + (origX - originalWidth / 2) * scale,
            y: imageCenterY + (origY - originalHeight / 2) * scale
        });

        this._createControls(cx, cy, w, getPos);
        this._createTriggers(cx, cy, w, h, top, originalWidth, originalHeight, getPos);
        this._createBumpers(cx, cy, w, h, top, originalWidth, originalHeight, getPos);
        this._createCenterButtons(cx, cy, w, h, top);

        this.statusLabel = this._label(cx, bottom + 20, "No gamepad detected");
    }

    /**
     * Returns the original image dimensions of the silhouette (without placing it).
     * @private
     * @param {number} w - Target display width.
     * @returns {{width:number,height:number,scaledHeight:number}}
     */
    _getTempHeight(w) {
        const img = this.scene.add.image(0, 0, 'xbox_silhouette');
        const originalWidth = img.texture.source[0].width;
        const originalHeight = img.texture.source[0].height;
        const scaledHeight = originalHeight * (w / originalWidth);
        img.destroy();
        return { width: originalWidth, height: originalHeight, scaledHeight };
    }

    /**
     * Adds the Xbox controller silhouette image as a background layer.
     * @private
     */
    _addSilhouetteImage(cx, cy, w, imageCenterX, imageCenterY) {
        const img = this.scene.add.image(imageCenterX, imageCenterY, 'xbox_silhouette');
        img.setOrigin(0.5);

        this.originalWidth = img.texture.source[0].width;
        this.originalHeight = img.texture.source[0].height;
        const scale = w / this.originalWidth;
        img.setScale(scale);

        this.container.addAt(img, 0);
        this.silhouette = img;
    }

    /**
     * Creates the analog sticks, D-pad, face buttons, and right stick.
     * @private
     */
    _createControls(cx, cy, w, getPos) {
        const stickR = w * 0.09;
        const btnR = w * 0.035;

        // left stick
        const leftStickPos = getPos(268, 167);
        this._createStick(leftStickPos.x + 1, leftStickPos.y + 2, stickR, "left");

        // dpad
        const dpadPos = getPos(367, 315);
        this._createDpad(dpadPos.x, dpadPos.y, w);

        // buttons
        this.buttons.A = this._button(getPos(707, 244).x, getPos(707, 244).y, btnR, 0x00aa00, "A");
        this.buttons.B = this._button(getPos(762, 186).x, getPos(762, 186).y, btnR, 0xaa0000, "B");
        this.buttons.X = this._button(getPos(650, 186).x, getPos(650, 186).y, btnR, 0x0044aa, "X");
        this.buttons.Y = this._button(getPos(707, 130).x, getPos(707, 130).y, btnR, 0xaaaa00, "Y");

        // right stick
        const rightStickPos = getPos(600, 298);
        this._createStick(rightStickPos.x + 1, rightStickPos.y + 2, stickR, "right");
    }

    /**
     * Creates a single analog stick indicator with a movable dot.
     * @private
     * @param {number} x @param {number} y @param {number} r - Ring radius.
     * @param {string} name - `'left'` or `'right'`.
     */
    _createStick(x, y, r, name) {
        this.gfx.lineStyle(2, 0x444444, 1);
        this.gfx.strokeCircle(x, y, r);

        const dot = this.scene.add.circle(x, y, r * 0.3, 0xcccccc);
        this.container.add(dot);

        const labelX = name === "left" ? x - 30 : x;
        const label = this._label(labelX, y + r + 18, "(0.00, 0.00)");

        this.sticks[name] = { baseX: x, baseY: y, radius: r, dot, label };
    }

    /**
     * Creates the four directional D-pad buttons.
     * @private
     */
    _createDpad(x, y, w) {
        const size = w * 0.025;
        const offset = size * 2 - 5;

        this.dpad.up = this._dpad(x, y - offset, size, "↑");
        this.dpad.down = this._dpad(x, y + offset, size, "↓");
        this.dpad.left = this._dpad(x - offset, y, size, "←");
        this.dpad.right = this._dpad(x + offset, y, size, "→");

        this.gfx.fillStyle(0x303030, 1);
        this.gfx.fillRect(x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6);
    }

    /**
     * Creates the LT and RT trigger indicators with fill bars.
     * @private
     */
    _createTriggers(cx, cy, w, h, top, originalWidth, originalHeight, getPos) {
        const trigW = w * 0.16;
        const trigH = h * 0.06;

        // Position LT based on original image coordinates
        const trigW_orig = 0.16 * originalWidth;
        const trigH_orig = 0.06 * originalHeight;
        const ltOrigX = 154 - trigW_orig / 2;
        const ltOrigY = 82 + trigH_orig / 2;
        const ltPos = getPos(ltOrigX, ltOrigY);
        ltPos.x += 5;

        this.triggers.LT = this._trigger(ltPos.x, ltPos.y, trigW, trigH, "LT");

        // Position RT based on original image coordinates
        const rtOrigX = 821 + trigW_orig / 2;
        const rtOrigY = 82 + trigH_orig / 2;
        const rtPos = getPos(rtOrigX, rtOrigY);

        this.triggers.RT = this._trigger(rtPos.x, rtPos.y, trigW, trigH, "RT");
    }

    /**
     * Creates the LB and RB bumper indicators.
     * @private
     */
    _createBumpers(cx, cy, w, h, top, originalWidth, originalHeight, getPos) {
        const bumpW = w * 0.16;
        const bumpH = h * 0.045;

        // Position LB closer to LT
        const trigH_orig = 0.06 * originalHeight;
        const lbOrigX = 154 - (0.16 * originalWidth) / 2;
        const lbOrigY = 82 + trigH_orig / 2 + 0.05 * originalHeight;
        const lbPos = getPos(lbOrigX, lbOrigY);
        lbPos.x += 5;

        this.bumpers.LB = this._bumper(lbPos.x, lbPos.y, bumpW, bumpH, "LB");

        // Position RB below RT
        const rbOrigX = 821 + (0.16 * originalWidth) / 2;
        const rbOrigY = 82 + trigH_orig / 2 + 0.05 * originalHeight;
        const rbPos = getPos(rbOrigX, rbOrigY);

        this.bumpers.RB = this._bumper(rbPos.x, rbPos.y, bumpW, bumpH, "RB");
    }

    /**
     * Creates the Xbox, View, and Menu center buttons.
     * @private
     */
    _createCenterButtons(cx, cy, w, h, top) {
        const xboxR = w * 0.03;
        const smallR = w * 0.018;

        // Centered on the panel, moved up 3 pixels
        const y = cy - 3;

        const xbox = this.scene.add.circle(cx, y, xboxR, 0x333333);
        const xboxInner = this.scene.add.circle(cx, y, xboxR * 0.6, 0xffffff);
        this.container.add(xbox);
        this.container.add(xboxInner);
        this.misc.XBOX = { outer: xbox, inner: xboxInner };

        const leftX = cx - w * 0.06;
        const rightX = cx + w * 0.06;

        const leftBase = this.scene.add.circle(leftX, y, smallR + 1, 0x111111);
        const leftBtn = this.scene.add.circle(leftX, y, smallR * 0.9, 0x333333);
        const leftIcon = this.scene.add.rectangle(leftX, y, smallR * 0.9, smallR * 0.6, 0xffffff);
        this.container.add(leftBase);
        this.container.add(leftBtn);
        this.container.add(leftIcon);
        this.misc.VIEW = { outer: leftBase, base: leftBtn, icon: leftIcon };

        const rightBase = this.scene.add.circle(rightX, y, smallR + 1, 0x111111);
        const rightBtn = this.scene.add.circle(rightX, y, smallR * 0.9, 0x333333);
        const rightIcon = this.scene.add.rectangle(rightX, y, smallR * 0.9, smallR * 0.6, 0xffffff);
        this.container.add(rightBase);
        this.container.add(rightBtn);
        this.container.add(rightIcon);
        this.misc.MENU = { outer: rightBase, base: rightBtn, icon: rightIcon };
    }
    /**
     * Creates and adds a text label.
     * @private
     * @returns {Phaser.GameObjects.Text}
     */
    _label(x, y, text) {
        const t = this.scene.add.text(x, y, text, {
            fontSize: "16px",
            color: "#dddddd"
        }).setOrigin(0.5);

        this.container.add(t);
        return t;
    }

    /**
     * Creates a colored face button (A, B, X, or Y).
     * @private
     * @returns {{base,circle,text}}
     */
    _button(x, y, r, color, label) {
        const base = this.scene.add.circle(x, y, r, 0x111111);
        const circle = this.scene.add.circle(x, y, r * 0.9, color);
        const text = this.scene.add.text(x, y, label, {
            fontSize: `${Math.floor(r * 1.1)}px`,
            color: "#ffffff"
        }).setOrigin(0.5);

        this.container.add(base);
        this.container.add(circle);
        this.container.add(text);

        return { base, circle, text };
    }

    /**
     * Creates a single D-pad direction button.
     * @private
     * @returns {{rect,text}}
     */
    _dpad(x, y, size, label) {
        const rect = this.scene.add.rectangle(x, y, size * 1.4, size * 1.4, 0x202020);
        const text = this.scene.add.text(x, y, label, {
            fontSize: `${Math.floor(size)}px`,
            color: "#ffffff"
        }).setOrigin(0.5);

        this.container.add(rect);
        this.container.add(text);

        return { rect, text };
    }

    /**
     * Creates a trigger indicator with a horizontal fill bar.
     * @private
     * @returns {{bg,fill,text}}
     */
    _trigger(x, y, w, h, label) {
        const bg = this.scene.add.rectangle(x, y, w, h, 0x202020).setOrigin(0.5);

        // Fill bar grows horizontally with trigger value
        const fill = this.scene.add.rectangle(
            x - w / 2,
            y,
            0,
            h * 0.6,
            0x8888ff
        ).setOrigin(0, 0.5);

        const text = this.scene.add.text(x, y, label, {
            fontSize: `${Math.floor(h * 0.6)}px`,
            color: "#ffffff"
        }).setOrigin(0.5);

        this.container.add(bg);
        this.container.add(fill);
        this.container.add(text);

        return { bg, fill, text };
    }

    /**
     * Creates a bumper indicator (LB or RB).
     * @private
     * @returns {{bg,text}}
     */
    _bumper(x, y, w, h, label) {
        const bg = this.scene.add.rectangle(x, y, w, h, 0x252525).setOrigin(0.5);
        const text = this.scene.add.text(x, y, label, {
            fontSize: `${Math.floor(h * 0.6)}px`,
            color: "#ffffff"
        }).setOrigin(0.5);

        this.container.add(bg);
        this.container.add(text);

        return { bg, text };
    }

    // -------------------------------------------------------------------------
    // UPDATE
    // -------------------------------------------------------------------------

    /**
     * Updates the visual state of all controller elements based on the
     * current gamepad input. Stick positions, button presses, triggers,
     * bumpers, and D-pad states are refreshed every frame.
     *
     * @param {Phaser.Input.Gamepad.Gamepad} pad - The active gamepad instance.
     */
    update(pad) {
        if (!pad) {
            this.statusLabel.setText("No gamepad detected");
            return;
        }

        this.statusLabel.setText("Xbox Controller Connected");

        // Sticks
        this._updateStick(this.sticks.left, pad.axes[0], pad.axes[1]);
        this._updateStick(this.sticks.right, pad.axes[2], pad.axes[3]);

        // Face buttons
        this._updateButton(this.buttons.A, pad.buttons[0]);
        this._updateButton(this.buttons.B, pad.buttons[1]);
        this._updateButton(this.buttons.X, pad.buttons[2]);
        this._updateButton(this.buttons.Y, pad.buttons[3]);

        // D-pad
        this._updateDpad(this.dpad.up, pad.buttons[12] && pad.buttons[12].pressed);
        this._updateDpad(this.dpad.down, pad.buttons[13] && pad.buttons[13].pressed);
        this._updateDpad(this.dpad.left, pad.buttons[14] && pad.buttons[14].pressed);
        this._updateDpad(this.dpad.right, pad.buttons[15] && pad.buttons[15].pressed);

        // Triggers
        this._updateTrigger(this.triggers.LT, pad.buttons[6]);
        this._updateTrigger(this.triggers.RT, pad.buttons[7]);

        // Bumpers
        this._updateBumper(this.bumpers.LB, pad.buttons[4]);
        this._updateBumper(this.bumpers.RB, pad.buttons[5]);

        // View / Menu
        this._updatePill(this.misc.VIEW, pad.buttons[8]);
        this._updatePill(this.misc.MENU, pad.buttons[9]);
    }

    /**
     * Updates the analog stick dot position and axis readout label.
     * @private
     * @param {object} stick                     Stick state object from `this.sticks`.
     * @param {Phaser.Input.Gamepad.Axis} axisX  Horizontal axis for this stick.
     * @param {Phaser.Input.Gamepad.Axis} axisY  Vertical axis for this stick.
     */
    _updateStick(stick, axisX, axisY) {
        const x = axisX ? axisX.getValue() : 0;
        const y = axisY ? axisY.getValue() : 0;

        stick.dot.x = stick.baseX + x * stick.radius;
        stick.dot.y = stick.baseY + y * stick.radius;

        stick.label.setText(`(${x.toFixed(2)}, ${y.toFixed(2)})`);
    }

    /**
     * Updates face button scale and alpha to reflect pressed state.
     * @private
     */
    _updateButton(btn, button) {
        const pressed = button && button.pressed;
        btn.circle.setScale(pressed ? 1.15 : 1.0);
        btn.circle.setAlpha(pressed ? 1.0 : 0.7);
    }

    /**
     * Updates D-pad direction highlight.
     * @private
     */
    _updateDpad(d, pressed) {
        d.rect.setFillStyle(pressed ? 0xffffff : 0x202020, 1);
        d.text.setColor(pressed ? '#000000' : '#ffffff');
    }

    /**
     * Updates the trigger fill bar to reflect the analogue trigger value.
     * @private
     */
    _updateTrigger(trig, button) {
        const value = button ? button.value : 0;
        trig.fill.width = trig.bg.width * value;
        trig.fill.setFillStyle(value > 0.5 ? 0xaaaaff : 0x8888ff, 1);
    }

    /**
     * Updates bumper shading to reflect pressed state.
     * @private
     */
    _updateBumper(bump, button) {
        const pressed = button && button.pressed;
        bump.bg.setFillStyle(pressed ? 0x444444 : 0x252525, 1);
    }

    /**
     * Updates the View / Menu pill button shading.
     * @private
     */
    _updatePill(pill, button) {
        if (!pill) return;

        const pressed = button && button.pressed;
        pill.base.setFillStyle(pressed ? 0x555555 : 0x333333, 1);
        pill.icon.setFillStyle(0xffffff, 1);
    }

    // -------------------------------------------------------------------------
    // DESTROY
    // -------------------------------------------------------------------------

    /**
     * Destroys the entire controller panel and all of its display objects.
     * Cleans up the container and prevents memory leaks when switching scenes.
     */
    destroy() {
        if (this.container) {
            this.container.destroy(true);
        }
    }
}
