# {{NAME}} – Claude Code Reference

Started from GBEngine's `templates/game` (see the GBEngine README → "Starting a new game"). Shared
framework: `@gamebase/gbengine` (Phaser 4 / Vite / Capacitor / Firebase). Version source of truth:
`package.json` (`npm run build` bumps the patch number).

## Accounts, guests and scores (already wired — keep it this way)
- **No login screen.** The game opens on the main menu. `SceneController._onReady()` runs
  `initSession()`: a restored Google / name+PIN session is kept, otherwise the player is a **local guest**
  (no Firebase account, no player name, progress in localStorage only).
- **No account ⇒ no player name.** A name only exists with an account. Sign in with Google or claim a
  name+PIN in **Settings → Game** (`BaseSettingsScene._buildAccountSection`).
- **Guest progress merges into the account** that signs in (best score wins); another account's progress is
  never inherited (`AccountScopedStore` in `src/systems/progress.js`).
- **Leaderboard**: readable without an account; a score is posted only with an account + player name.
  `publishLocalScores()` posts scores earned as a guest once a name/sign-in exists.
- **Names are unique** (`playerNames` index, claimed at sign-in / registration). Never submit a raw Google
  display name — `ensureGooglePlayerName()` claims one.
- **Device info** (`settings.deviceInfo`) is saved for signed-in players — declare it in the Play Data safety form.

## Environments & release
- Two Firebase projects: `{{SLUG}}-dev`, `{{SLUG}}-prod` (`.firebaserc` aliases `dev`/`prod`). The Vite mode picks the
  config (`src/config/firebaseConfig.js`): production build → prod, `npm run dev` / `--mode development` → dev.
- `npm run deploy:dev|deploy:prod` (these run `npm run build`, which **bumps the version**). Redeploy without a bump:
  `npx vite build [--mode development]` then `firebase deploy -P <env>`. Deploying hosting does not deploy rules:
  `firebase deploy --only database -P <env>`.
- Android is scripted (`android/` is gitignored): `npm run android:release` = signed AAB + version bump;
  customizations live in `config/android/overlay/`. Needs `android/keystore.properties` (never commit it; template in
  `config/android/keystore.properties.example`) and JDK 21+.
- Clear prod test data before launch: `npm run reset:prod` is a dry run; add `-- --yes` to delete (backs up first).
- In Git Bash prefix Realtime Database paths with `MSYS_NO_PATHCONV=1`.
- Play Console: Data safety must match the app (see GBEngine README), and the privacy policy is
  GBEngine `legal/privacy-policy.html` (generic, shared by every app).
