package com.hospiwaste.app.sync

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * `rotatedAt` (epoch ms): 0 si el refresh token vigente vino del handoff JS (setCredentials);
 * timestamp de la última rotación nativa (refreshAccessToken) en caso contrario. Le permite
 * al lado JS detectar al volver a foreground que el nativo rotó la familia de tokens y
 * re-adoptar la sesión antes de que su propio RT viejo quede inválido (C1).
 */
data class Credentials(
    val url: String,
    val anonKey: String,
    val refreshToken: String,
    val rotatedAt: Long = 0L,
)

object SyncCredentials {
    private const val FILE = "hospiwaste_sync"

    private fun prefs(ctx: Context) = EncryptedSharedPreferences.create(
        ctx, FILE,
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun save(ctx: Context, c: Credentials) = prefs(ctx).edit()
        .putString("url", c.url).putString("anon", c.anonKey).putString("rt", c.refreshToken)
        .putLong("rotated_at", c.rotatedAt)
        .apply()

    fun load(ctx: Context): Credentials? {
        val p = prefs(ctx)
        val url = p.getString("url", null) ?: return null
        val anon = p.getString("anon", null) ?: return null
        val rt = p.getString("rt", null) ?: return null
        return Credentials(url, anon, rt, p.getLong("rotated_at", 0L))
    }

    fun clear(ctx: Context) = prefs(ctx).edit().clear().apply()
}
