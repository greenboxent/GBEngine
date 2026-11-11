// src/scenes/BootScene.js
// Loads assets, initialises services, then hands over to SceneController.
import {
    BaseBootScene,
    firebaseService,
    registerSettings,
    PersonalScores,
    AdService,
    IAPService,
    guarded,
    detectPlatform,
} from '@gamebase/gbengine';

import { GameSettings } from '../systems/GameSettings.js';
import { firebaseConfig, isProdBuild } from '../config/firebaseConfig.js';
import { PROD_AD_UNITS } from '../config/adConfig.js';

export default class BootScene extends BaseBootScene {
    constructor() {
        super('BootScene', { firebaseService, settings: GameSettings });
    }

    _getLoadingText() { return 'Loading {{NAME}}…'; }
    // The version ("v0.0.1") shows under the label by default — see BaseBootScene._getLoadingSubtext().

    _loadGameAssets() {
        this.load.text('about-text', 'assets/data/about.txt');
        this.load.text('help-text',  'assets/data/help.txt');
        // this.load.image('player', 'assets/images/player.png');
    }

    async _onAllReady() {
        // Every await below is guarded so a hung service (no network, no Google Play services,
        // Play Games on PC) can't leave a black screen.
        await guarded('detectPlatform', detectPlatform(), 3000); // Play Games on PC: no touch UI + controller bridge
        await guarded('firebaseService.init', firebaseService.init(firebaseConfig), 10000);

        registerSettings(GameSettings);
        await guarded('Settings.load', GameSettings.load(), 10000);

        PersonalScores.configure('{{SLUG}}', firebaseService);
        await guarded('PersonalScores.init', PersonalScores.init(), 10000);

        // Ads: production builds use the live units; everything else Google's test units.
        if (isProdBuild) AdService.configure(PROD_AD_UNITS);
        await guarded('AdService.initialize', AdService.initialize(), 10000); // runs the UMP consent form first
        await guarded('IAPService.restorePurchases', IAPService.restorePurchases(), 8000);

        this.scene.start('SceneController');
    }
}
