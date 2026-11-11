// src/config/adConfig.js
// AdMob ad units for {{NAME}} (AdMob app {{ADMOB_APP_ID}}, set in AndroidManifest.xml /
// capacitor.config.json). Used by production builds only — everything else keeps
// GBEngine's Google test units, so developing and testing never generates real
// impressions or clicks on the live ads. Create the units in the AdMob console.
export const PROD_AD_UNITS = {
    interstitial: 'REPLACE_WITH_INTERSTITIAL_UNIT_ID', // ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN
    rewarded:     'REPLACE_WITH_REWARDED_UNIT_ID',
};
