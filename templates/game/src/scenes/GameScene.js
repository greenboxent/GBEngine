// src/scenes/GameScene.js
// Placeholder gameplay scene: replace with your game. It shows the account flow end to end —
// completing a level records progress (saved locally; mirrored to the account when signed in)
// and posts the score to the leaderboard (needs an account and a player name).
import * as Phaser from 'phaser';
import { createMenuButton, createText } from '@gamebase/gbengine';
import { recordCompletion, highestCompleted } from '../systems/progress.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        const { width, height } = this.scale;
        const cx = width / 2;
        const level = highestCompleted() + 1;

        createText(this, cx, height * 0.25, `Your game goes here\nLevel ${level}`, { fontSize: '32px' });
        createMenuButton(this, cx, height * 0.5, `Complete level ${level} (score ${level * 100})`, () => {
            recordCompletion(level, level * 100);
            this.scene.restart();
        });
        createMenuButton(this, cx, height * 0.65, 'Back to menu', () => {
            this.scene.stop('GameScene');
            this.scene.wake('MainMenuScene');
        });
    }
}
