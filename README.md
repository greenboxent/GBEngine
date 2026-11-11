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
| `initSession` | Start-of-app identity for games with **no login screen**: keep a restored account, else start a local guest (see "Accounts, guests & leaderboard") |
| `AccountScopedStore` | Local progress mirrored to the signed-in account: guest data merges in, another account's data is never inherited, once per account, with a timeout |
| `LeaderboardService.publishMissingScores()` | Posts local bests the board doesn't have yet (scores earned as a guest / before a name existed); idempotent |
| `recordDeviceInfo` | Saves device model/OS/app version/timezone with the account's settings (needs `@capacitor/device`) |
| `guarded` | Lets boot continue past a hung service (no network, no Google Play services) instead of a black screen |
| `detectPlatform` / `isPlayGamesPC` | Google Play Games on PC: reports no touch support + bridges Android controllers to the Gamepad API |
| `createWebLimit` | Web-demo level limit (first N levels, then "get the Android app") |
| `@gamebase/gbengine/vite` | `singlePhaserGuard()` + `readAppVersion()` for the game's `vite.config.js` |

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
| `BaseWebLimitScene` | "Keep playing on Android" dialog for the web demo limit |

`BaseSettingsScene` also provides the **account block** for the Game tab — `_buildAccountSection()` (Google sign-in, "or", player name, Sign Out, Delete Account), `_buildLegalLinks()` and `_signInWithGoogle()` — see below.

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
| `createPlayerNameLabel` | Main-menu line showing the player name, or a hint to set one (`label.refreshPlayerName()` from `update()`) |
| `createNoPlayerNameNote` | Level-select note "no playername — scores not recorded"; returns `null` when the player has a name |
| `getPlayerName` | The saved player name, trimmed |

## Minimal boot scene (manual setup)

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

## Starting a new game

```bash
node D:/dev/gamebase/GBEngine/scripts/init-game.mjs D:/dev/gamebase/MyGame --name "My Game" --slug mygame
cd D:/dev/gamebase/MyGame && git init && npm install && npm run dev
```

`templates/game` is a working starter (Vite + Phaser 4 + Capacitor) with everything below already wired: boot guards, the
no-login-screen account flow, public leaderboard, Delete Account (in-app + web page), Android overlay + signing scripts,
Firebase dev/prod config and database rules, version on the loading screen, Play Games on PC support. Read the generated
`CLAUDE.md`; then work through the checklist the script prints:

1. **Firebase**: create `<slug>-dev` and `<slug>-prod` (Realtime Database; Authentication → Google + Email/Password). Fill
   `src/config/firebaseConfig.dev.js` / `.prod.js`; `firebase deploy --only database -P dev|prod` (rules are **not** deployed by hosting deploys).
2. **Google sign-in on Android**: add the Android app to each project with your SHA-1/SHA-256 (the upload key now, and the
   **Play App Signing** SHA-1/256 from Play Console → App integrity once the first bundle is uploaded —
   `firebase apps:android:sha:create`), put `google-services.json` in `config/android/dev|prod/`, set the web OAuth client id in
   `capacitor.config.json`.
3. **AdMob**: create the app and units; set the app id in `capacitor.config.json` + `AndroidManifest.xml`, unit ids in `src/config/adConfig.js`.
   Create the consent (UMP) message in the AdMob console (Privacy & messaging) — the engine runs it before ads start. Link the app to its
   Play listing after it is published.
4. **Android build**: `config/android/keystore.properties.example` → `android/keystore.properties` (never committed), icons via
   `@capacitor/assets`, then `npm run android:release` (bumps the version, builds the signed AAB). JDK 21+ is required.
5. **Play Console**: privacy policy URL (`legal/privacy-policy.html`, published on the website), **Data safety** (see below),
   deletion URL `https://<slug>-prod.web.app/delete-account`, content rating, ads declaration, in-app product for ad removal.
6. Before launch clear prod test data: `npm run reset:prod` (dry run; backs up first) then `npm run reset:prod -- --yes`.

**Data safety form** — what the account flow collects: Name (optional — player name / Google name), Email (optional — Google
sign-in), User IDs, Crash logs + Diagnostics (device model/OS/app version saved by `recordDeviceInfo`; purposes Analytics and
Fraud prevention), Device or other IDs (AdMob). Consider App activity → App interactions for scores/progress. Keep the privacy
policy saying the same thing.

**Release gotchas** learned the hard way: `npm update @gamebase/gbengine` can run before GitHub has your new commit and leave
`node_modules` half-updated — retry until `package-lock.json` pins the new commit; `npm run build` / `android:release` bump the
version (use `npx vite build [--mode development]` + `firebase deploy -P <env>` to redeploy without a bump); in Git Bash set
`MSYS_NO_PATHCONV=1` for Realtime Database paths; Play serves the release you promoted, so show the version on the loading screen
(done by default) when testing on devices.

## Accounts, guests & leaderboard

The design every game should use (Balloonatics is the reference implementation):

- **No login screen.** The game opens on the main menu (`SceneController._onReady()` → `initSession()`); a player signs in with
  Google or claims a name+PIN later from **Settings → Game** (`_buildAccountSection()`).
- **No account ⇒ no player name.** A name only exists together with an account. A signed-out player is a **local guest**: nothing is
  written to the database (`firebaseService.isReady()` is false, settings and progress stay in localStorage, no scores are posted).
  The main menu shows the name (or a hint to set one) via `createPlayerNameLabel`; level select explains that scores aren't recorded
  without a name (`createNoPlayerNameNote`).
- **Guest progress merges into the account** that signs in or is claimed — new or existing, best score wins — and **another
  account's progress is never inherited** on a shared device (`AccountScopedStore`; `initSession({ onGuestStart: () => store.resetForGuest() })`).
- **A slow session restore never wipes an account**: `FirebaseService.authRestoreTimedOut` makes `initSession()` leave the saved name and
  progress alone when "nobody is signed in" is only a guess.
- **Leaderboard**: readable without an account (rules `".read": true`; `getTopScores()` needs no sign-in); posting needs an account and a
  name. Scores earned as a guest are posted once a name/sign-in exists: `publishMissingScores()` — call it after a name is set, after
  Google sign-in, and when the leaderboard / level select opens.
- **Names are unique** per project (`playerNames` index, enforced by the database rules). A Google player's name is claimed at sign-in
  (`ensureGooglePlayerName`); a taken name opens a dialog. Only the saved `playerName` is ever submitted.
- **Delete Account** removes everything the account owns (in-app and at `/delete-account`); a deleted account leaves no orphan data.
- **Device info** is saved with the account's settings for diagnostics / spotting odd accounts (declare it in Data safety + the policy).

**Wiring (see `templates/game/src`)**: `BootScene` (guarded init) → `SceneController._onReady()` (`initSession`, `recordDeviceInfo`) →
`MainMenuScene` (`createPlayerNameLabel`) → `SettingsScene` (`_buildAccountSection`, `_buildLegalLinks`, hooks `_onAccountChanged` →
`store.sync()`, `_afterGoogleSignIn` / `_claimPlayerName` → `publishLocalScores()`, `_getAccountData`) → `progress.js` (`AccountScopedStore`) →
`leaderboardService.js`. The engine's `BaseLoginScene` (Google / Guest buttons) still exists for games that prefer a login screen:

`BaseLoginScene`'s "Play as Guest" creates an anonymous Firebase account by default. A game that wants guests to leave nothing in the database overrides `_guestUsesAccount() { return false; }`: the guest signs out of any restored session, loses any leftover local `playerName`, and plays signed out. `_onLoginComplete(null)` is called. An account is only created when the player claims a name+PIN (`FirebaseService.signInWithNamePin()`, which works signed out: it registers, then deletes the account again if the name is already taken) or signs in with Google.

## Tooling (`scripts/`, run from the game's root)

| Script | Purpose |
|---|---|
| `init-game.mjs <dir> --name …` | Scaffold a new game from `templates/game` |
| `bump-version.js` | Patch-bump `package.json`, `about.txt` and Android `versionCode`/`versionName` (`npm run bump`) |
| `android-config.mjs <dev\|prod> [--build]` | Generate/refresh `android/` from tracked files (overlay, signing, version) and optionally build the AAB/APK |
| `firebase-reset.mjs --project … --paths …` | Back up then wipe a project's Auth users + test data (dry run unless `--yes`) |

Unit tests for the account logic (guest merge, once-per-account sync, publish dedupe, session start) run in plain Node: `npm test`.

## Player names (`playerNames` index)

Names are unique per Firebase project. Name+PIN accounts are unique through Firebase Auth (`<name>@players.gbent`); Google players' display names and name+PIN names share the `playerNames/<sanitised name>` → uid index, which `FirebaseService.signInWithNamePin()` and the Settings name dialog check and write. `BaseLoginScene` / `BaseSettingsScene._signInWithGoogle()` claim a Google player's name right after sign-in (`ensureGooglePlayerName` in `ui/PlayerNameDialog.js`): the saved name, else one derived from their Google profile; if it is taken or invalid the player is asked for another. `LeaderboardService.submitScore()` only uses the saved `playerName` — it never falls back to the raw Google display name. Each game's database rules must include it, or the checks silently fail open:

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

## Privacy policy

`legal/privacy-policy.html` is the source of the Green Box Games privacy policy (https://www.greenboxgames.com/privacy-policy), shared by every app. Keep it generic — no app names or app-specific URLs — and update it, including the "Last updated" date, whenever an app changes what it collects (the Play Data safety form must match). It is published on the website by hand; this copy is only the editable source.

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
