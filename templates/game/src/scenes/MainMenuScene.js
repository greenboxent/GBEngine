// src/scenes/MainMenuScene.js
// Main menu: title, player name (or a hint to set one), and the menu buttons.
import * as Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { createMenuButton, createText, createPlayerNameLabel, highlightMenuButtons, InputController } from '@gamebase/gbengine';

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {
        const { width, height } = this.scale;
        const cx = width / 2;
        this.buttons = [];
        this.selectedIndex = 0;

        createText(this, cx, height * 0.14, '{{NAME}}', {
            fontSize: Math.round(Math.min(40, width * 0.08)) + 'px', color: '#ff6b35', fontStyle: 'bold',
        });

        // The player name, or "Go to Settings > Game tab and set a player name".
        this._name = createPlayerNameLabel(this, cx, height * 0.14 + 50, { width: Math.min(400, width * 0.85) - 40 });

        const ctrl = () => this.scene.get('SceneController');
        const defs = [
            ['PLAY',        () => { this.scene.sleep('MainMenuScene'); this.scene.launch('GameScene'); }],
            ['LEADERBOARD', () => ctrl()?.flow?.modal?.openModal('LeaderboardScene', { from: 'MainMenuScene' }, 'MainMenuScene')],
            ['SETTINGS',    () => ctrl()?.flow?.modal?.openModal('SettingsScene', {}, 'MainMenuScene')],
            ...(Capacitor.isNativePlatform() ? [['QUIT', () => App.exitApp()]] : []),
        ];
        defs.forEach(([label, action], i) => {
            this.buttons.push(createMenuButton(this, cx, height * 0.38 + i * 75, label, action, { depth: 99999 }));
        });

        this.inputController = InputController.getInstance(this);
        this._cursors  = this.input.keyboard?.createCursorKeys();
        this._enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this._cooldown = 0;
        this._highlight(0);
    }

    _highlight(index) {
        highlightMenuButtons(this.buttons, index, i => { this.selectedIndex = i; this._highlight(i); });
    }

    update(time, delta) {
        this._name.refreshPlayerName(); // follows a name set or changed in Settings
        const ic = this.inputController;
        ic?.update();
        this._cooldown -= delta;
        if (this._cooldown > 0) { if (ic) ic.menuUp = ic.menuDown = ic.menuSelect = false; return; }

        let moved = false;
        if (this._cursors?.up?.isDown || ic?.menuUp) { this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length; moved = true; }
        else if (this._cursors?.down?.isDown || ic?.menuDown) { this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length; moved = true; }
        if (moved) { this._highlight(this.selectedIndex); this._cooldown = 180; }

        if ((this._enterKey && Phaser.Input.Keyboard.JustDown(this._enterKey)) || ic?.menuSelect) {
            this.buttons[this.selectedIndex]?.emit('pointerdown');
        }
        if (ic) ic.menuUp = ic.menuDown = ic.menuSelect = false;
    }
}
