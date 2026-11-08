# @gamebase/gbengine

Shared Phaser 4 game framework for Greenbox Entertainment games.

## What's included

### Engine

| Export | Description |
|--------|-------------|
| `Debug` | Unified debug facade (overlay, inspector, perf graph) |
| `DebugCore` | Shared debug state and logging hub |
| `DebugOverlay` | On-screen overlay and expandable debug panel |
| `DebugPerf` | FPS + memory usage performance graph |
| `DebugInspector` | Click-to-inspect entity debugger and hitbox visualiser |

### Systems

| Export | Description |
|--------|-------------|
| `firebaseService` | Firebase init + auth singleton |
| `LeaderboardService` | Firebase-backed leaderboard (class, not singleton) |
| `PersonalScores` | Per-level high scores in Firebase + localStorage |
| `ScoreManager` | Score calculation with injectable enemy-points table |
| `BaseSettingsManager` | Settings persistence base class (Firebase → localStorage) |
| `Settings` / `registerSettings` | Global settings proxy; call `registerSettings()` at boot |
| `AdService` | AdMob interstitial wrapper |
| `IAPService` | Capacitor non-consumable IAP wrapper |
| `InputController` | Unified keyboard / gamepad input |
| `KeybindingManager` / `Keybindings` | Key binding storage and persistence; `Keybindings` is the singleton |
| `TouchControls` | On-screen virtual joystick and action buttons (mobile) |
| `SoundManager` | Centralized music and SFX manager |
| `WaveManager` | Wave progression and level-complete signalling |
| `spawnDamageText` | Floating damage number visual effect |
| `findPath` | A* pathfinding for grid/maze navigation |
| `createAnimations` / `debugAnimations` | Spritesheet animation loader |
| `containsProfanity` | Player-name vulgarity/slur check (leetspeak-aware); used by the Settings name dialog |

### Scene management

| Export | Description |
|--------|-------------|
| `GameFlowManager` | High-level scene orchestration (levels, menus, modals) |
| `ModalManager` | Modal scene lifecycle (launch, fade, input management) |
| `SceneStateManager` | Active scene tracking, pause/resume, input toggle |
| `TransitionManager` | Per-scene camera fade-in / fade-out helpers |
| `ModalBase` | Base class for building modal UI panels |

### Base scenes

| Export | Description |
|--------|-------------|
| `BaseBootScene` | Loading screen with progress bar and Firebase init |
| `BaseSceneController` | Perpetual top-level controller scene |
| `BaseMainMenuScene` | Main menu scaffold |
| `BaseGameOverScene` | Game-over modal |
| `BasePauseScene` | Pause modal |
| `BaseLevelCompleteScene` | Level-complete modal |
| `BaseSettingsScene` | Settings modal |
| `BaseLeaderboardScene` | Leaderboard table |
| `BaseNarrativeScene` | Cutscene / narrative scene |
| `BaseLoginScene` | Firebase auth screen |
| `BaseStoreScene` | IAP shop |
| `BaseKeybindingsScene` | Key-remapping UI |
| `BaseLevelSelectScene` | Level-grid picker |

### UI

| Export | Description |
|--------|-------------|
| `createButton` | Base button with hover and scale behaviour |
| `createMenuButton` | Styled menu button (rounded rect + glow) |
| `createSlider` | Horizontal 0–100 slider |
| `createSelector` | Horizontal option-cycling selector |
| `createTabs` | Horizontal tab bar |
| `createToggle` | Labeled ON/OFF toggle |
| `createPanel` | Styled background panel |
| `createText` | Styled text helper |
| `createLayout` | Layout utility |
| `UIScrollablePanel` | Scrollable viewport with optional scrollbar |
| `ButtonTheme` | Default button theme config object |
| `TitleTheme` | Default title/subtitle theme config object |
| `GamepadTestPanel` | Interactive Xbox-style gamepad diagnostic panel |

## Quick start for a new game

```js
// BootScene.js
import {
    BaseBootScene,
    firebaseService,
    registerSettings,
    PersonalScores,
    ScoreManager,
} from '@gamebase/gbengine';
import { MyGameSettings } from './MyGameSettings.js';

export default class BootScene extends BaseBootScene {
    constructor() { super('BootScene', { firebaseService, settings: MyGameSettings }); }

    _getLoadingText() { return 'Loading My Game…'; }

    _loadGameAssets() {
        this.load.image('logo',  'assets/logo.png');
        this.load.audio('music', 'assets/audio/menu.mp3');
    }

    async _onAllReady() {
        registerSettings(MyGameSettings);
        PersonalScores.configure('my-game', firebaseService);
        ScoreManager.configure({ grunt: 100, boss: 1000 });
        this.scene.start('SceneController');
    }
}
```

## Player names (`playerNames` index)

Names are unique per Firebase project. Name+PIN accounts are unique through Firebase Auth (`<name>@players.gbent`); Google players' display names and name+PIN names share the `playerNames/<sanitised name>` → uid index, which `FirebaseService.signInWithNamePin()` and the Settings name dialog check and write. `BaseLoginScene` claims a Google player's name right after sign-in (`ensureGooglePlayerName` in `ui/PlayerNameDialog.js`): the saved name, else one derived from their Google profile; if it is taken or invalid the player is asked for another. `LeaderboardService.submitScore()` only uses the saved `playerName` — it never falls back to the raw Google display name. Each game's database rules must include it, or the checks silently fail open:

```json
"playerNames": {
  ".read": "auth != null",
  "$key": { ".write": "auth != null && (!data.exists() || data.val() === auth.uid) && (!newData.exists() || newData.val() === auth.uid)" }
}
```

## Account deletion

Google Play requires apps with accounts to offer deletion **in the app and at a web URL**. The engine provides both; a game only says where its data lives:

```js
// src/config/accountData.js — shared by the in-game button and the web page
export const ACCOUNT_DATA = {
    perUserPaths: ['my-game-settings', 'games/my-game/personalScores'], // <path>/<uid> is removed
    leaderboards: ['my-game-leaderboard'],                              // entries whose playerId == uid are removed
    // ownerField: 'playerId', nameIndex: 'playerNames'                 // defaults
};
```

**In the game** — add a button (signed-in players only) in Settings:

```js
import { showDeleteAccountDialog } from '@gamebase/gbengine';
createMenuButton(this, x, y, 'Delete Account', () => showDeleteAccountDialog(this, ACCOUNT_DATA));
```

It re-authenticates (PIN or Google), deletes the data, then the Firebase Auth account, clears local storage and reloads the game.

**On the web** — a second Vite entry served at `/delete-account` (add a Firebase Hosting rewrite for it before the catch-all). Use this URL in Play Console → App content → Data safety → Delete account URL:

```html
<!-- delete-account.html -->
<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body><script type="module" src="/src/web/deleteAccountPage.js"></script></body></html>
```
```js
// src/web/deleteAccountPage.js
import { mountDeleteAccountPage } from '@gamebase/gbengine/delete-account-page'; // not the main barrel: no Phaser
import { firebaseConfig } from '../config/firebaseConfig.js';
import { ACCOUNT_DATA } from '../config/accountData.js';
mountDeleteAccountPage({ firebaseConfig, appName: 'My Game', data: ACCOUNT_DATA });
```
```js
// vite.config.js → build.rollupOptions
input: { main: 'index.html', deleteAccount: 'delete-account.html' },
```

**Database rules** — players must be able to delete their own records, and the two lookups need indexes:

```json
"playerNames": { ".indexOn": ".value", ... },                       // find this uid's names
"my-game-leaderboard": {
  ".indexOn": ["score", "playerId"],                                 // find this uid's entries
  "$entryId": { ".write": "auth != null && ((!data.exists() && newData.exists()) || (data.exists() && !newData.exists() && data.child('playerId').val() === auth.uid))" }
}
```
(The per-user paths — settings, personal scores — are normally already `auth.uid == $uid` read/write.)

## Publishing a new version

```bash
git tag v1.0.0
git push origin v1.0.0   # GitHub Actions publishes automatically
```

## Installing in a game repo

```bash
# .npmrc must contain:  @gamebase:registry=https://npm.pkg.github.com
npm install @gamebase/gbengine@latest
```

`phaser` and the Capacitor plugins are **peer dependencies** — the game repo must install them separately.
