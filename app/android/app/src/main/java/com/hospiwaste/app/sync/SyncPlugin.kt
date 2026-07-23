package com.hospiwaste.app.sync

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeSync")
class SyncPlugin : Plugin() {

    @PluginMethod
    fun setCredentials(call: PluginCall) {
        val url = call.getString("url"); val anon = call.getString("anonKey")
        val rt = call.getString("refreshToken")
        if (url == null || anon == null || rt == null) { call.reject("faltan campos"); return }
        SyncCredentials.save(context, Credentials(url, anon, rt))
        // TODO(Task 5): SyncWork.schedule(context)
        call.resolve()
    }

    @PluginMethod
    fun clearCredentials(call: PluginCall) {
        SyncCredentials.clear(context)
        call.resolve()
    }

    @PluginMethod
    fun kick(call: PluginCall) {
        SyncService.startIfPending(context)
        call.resolve()
    }
}
