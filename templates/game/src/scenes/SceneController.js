// src/scenes/SceneController.js
// Perpetual top-level scene — wires GBEngine's managers and launches the main menu.
// There is no login screen: the game opens on the menu; a player signs in (Google) or
// claims a name+PIN from Settings → Game (BaseSettingsScene._buildAccountSection).
import {
    BaseSceneController,
    GameFlowManager,
    AdService,
    Debug,
    firebaseService,
    initSession,
    recordDeviceInfo,
} from '@gamebase/gbengine';
import { isProdBuild } from '../config/firebaseConfig.js';
import { resetGuestProgress } from '../systems/progress.js';

export default class SceneController extends BaseSceneController {
    constructor() {
        super('SceneController');
    }

    _buildFlowManager(ctrl, state, modal, transition) {
        return new GameFlowManager(ctrl, state, modal, transition, { adService: AdService });
    }

    create() {
        super.create();
        Debug.attachScene(this);
        if (isProdBuild) return; // debug hotkeys are development-only
        this.input.keyboard.on('keydown-F1', (event) => {
            if (event.ctrlKey) { event.preventDefault(); Debug.toggle(); }
        });
    }

    update() {
        Debug.update(this.scene.isActive('GameScene') ? this.scene.get('GameScene') : null);
    }

    async _onReady() {
        // Restored Google / name+PIN session → kept. Otherwise a local guest: no name, and
        // progress from an account that signed out is dropped.
        await initSession({ onGuestStart: resetGuestProgress });
        if (firebaseService.getUser()) recordDeviceInfo(); // device model/OS saved with the account
        this.scene.launch('MainMenuScene');
    }
}
