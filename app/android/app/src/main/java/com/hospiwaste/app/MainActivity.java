package com.hospiwaste.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.hospiwaste.app.sync.SyncPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
