package {{PACKAGE}};

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Lets the web layer ask whether it is running inside Google Play Games on PC
// (the platform advertises the HPE_EXPERIENCE system feature). See GBEngine's
// src/systems/platform.js.
@CapacitorPlugin(name = "PlatformInfo")
public class PlatformInfoPlugin extends Plugin {
    private static final String PLAY_GAMES_PC_FEATURE = "com.google.android.play.feature.HPE_EXPERIENCE";

    @PluginMethod
    public void isPlayGamesPC(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", getContext().getPackageManager().hasSystemFeature(PLAY_GAMES_PC_FEATURE));
        call.resolve(result);
    }
}
