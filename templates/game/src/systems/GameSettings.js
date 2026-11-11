// src/systems/GameSettings.js
// {{NAME}}'s settings singleton: GBEngine's BaseSettingsManager (cloud when signed in,
// localStorage otherwise) plus this game's own fields.
import { BaseSettingsManager, firebaseService } from '@gamebase/gbengine';

class GameSettingsClass extends BaseSettingsManager {
    constructor() {
        super(firebaseService);
        this._storageKey   = '{{SLUG}}-settings';
        this._firebaseRoot = '{{SLUG}}-settings'; // database.rules.json: per-user read/write
        // Object.assign(this._defaults, { myField: 1 });
    }

    // get myField()  { return this._data.myField ?? 1; }
    // set myField(v) { this._data.myField = v; this.save(); }
}

export const GameSettings = new GameSettingsClass();
