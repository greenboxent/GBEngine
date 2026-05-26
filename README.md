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
