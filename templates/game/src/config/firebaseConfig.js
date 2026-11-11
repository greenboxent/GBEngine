// src/config/firebaseConfig.js
// Picks the Firebase project from the Vite mode: `vite build` (production) →
// {{SLUG}}-prod; the `vite` dev server and `vite build --mode development`
// (npm run build:dev) → {{SLUG}}-dev. Leaderboards, progress and accounts live in
// separate databases, so a dev build never touches production data.
import { firebaseConfig as devConfig }  from './firebaseConfig.dev.js';
import { firebaseConfig as prodConfig } from './firebaseConfig.prod.js';

export const isProdBuild = import.meta.env.MODE === 'production';
export const firebaseConfig = isProdBuild ? prodConfig : devConfig;
