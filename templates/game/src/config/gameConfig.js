// src/config/gameConfig.js
import * as Phaser from 'phaser';

export function createGameConfig(scenes) {
    return {
        type: Phaser.AUTO,
        parent: 'game-container',
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#1d1d1d',
        pixelArt: false,
        antialias: true,
        scale: {
            mode: Phaser.Scale.NONE,
            autoCenter: Phaser.Scale.NO_CENTER,
        },
        input: {
            keyboard: true,
            gamepad: true,
            mouse: true,
            touch: true,
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
        },
        scene: scenes,
    };
}
