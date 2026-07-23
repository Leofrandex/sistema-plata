package com.hospiwaste.app.sync

import com.getcapacitor.JSObject
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
        // rotatedAt=0: el token que entrega el JS es el más fresco de la familia (C1).
        SyncCredentials.save(context, Credentials(url, anon, rt, rotatedAt = 0L))
        SyncWork.schedule(context)
        call.resolve()
    }

    /**
     * Estado de credenciales para el lado JS (C1): `rotatedAt > 0` significa que el motor
     * nativo rotó el refresh token desde el último handoff y el JS debe re-adoptar la sesión.
     * El `refreshToken` viaja en el payload solo para ese re-adopt (queda en memoria del
     * WebView, nunca loguearlo).
     */
    @PluginMethod
    fun getCredentials(call: PluginCall) {
        val creds = SyncCredentials.load(context)
        val ret = JSObject()
        ret.put("hasCredentials", creds != null)
        ret.put("rotatedAt", creds?.rotatedAt ?: 0L)
        if (creds != null) ret.put("refreshToken", creds.refreshToken)
        call.resolve(ret)
    }

    @PluginMethod
    fun clearCredentials(call: PluginCall) {
        SyncCredentials.clear(context)
        // Sin credenciales el worker periódico solo quema batería: cancelarlo (I4).
        SyncWork.cancel(context)
        call.resolve()
    }

    @PluginMethod
    fun kick(call: PluginCall) {
        SyncService.startIfPending(context)
        call.resolve()
    }
}
