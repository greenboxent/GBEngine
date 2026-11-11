// src/main.js
// Entry point for {{NAME}}.
import * as Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import SceneController from './scenes/SceneController.js';
import { isProdBuild } from './config/firebaseConfig.js';

// Eagerly import every scene in ./scenes except BootScene and SceneController.
// (Keep only Phaser scenes in that folder — everything in it is registered.)
const sceneModules = import.meta.glob('./scenes/*.js', { eager: true });
const allScenes = Object.entries(sceneModules)
    .filter(([path]) => !path.includes('BootScene.js') && !path.includes('SceneController.js'))
    .map(([_, mod]) => mod.default)
    .filter(Boolean)
    .sort((a, b) => ((a.name ?? '') > (b.name ?? '') ? 1 : -1));

const game = new Phaser.Game(createGameConfig([BootScene, SceneController, ...allScenes]));
if (!isProdBuild) window.game = game; // manual QA hook — not exposed in production builds

// Keep the canvas matched to the window.
const fit = () => {
    const canvas = game.canvas;
    if (canvas) {
        canvas.style.width  = window.innerWidth  + 'px';
        canvas.style.height = window.innerHeight + 'px';
    }
};
game.events.once('ready', fit);
window.addEventListener('resize', fit);
