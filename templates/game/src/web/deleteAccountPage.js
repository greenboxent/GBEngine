// src/web/deleteAccountPage.js
// Standalone delete-account page (delete-account.html) — the URL given to Google Play
// ("Delete account URL" in the Data safety form). The UI and logic live in GBEngine;
// this only supplies {{NAME}}'s config.

import { mountDeleteAccountPage } from '@gamebase/gbengine/delete-account-page';
import { firebaseConfig } from '../config/firebaseConfig.js';
import { ACCOUNT_DATA } from '../config/accountData.js';

mountDeleteAccountPage({ firebaseConfig, appName: '{{NAME}}', data: ACCOUNT_DATA });
