package com.hospiwaste.app.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
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

/**
 * Credenciales del sync nativo en `EncryptedSharedPreferences`.
 *
 * Abrirlas puede fallar, y no es raro: el Keystore de algunos Huawei/Honor
 * devuelve la llave maestra como "existente pero inutilizable", y tras un
 * backup/restore de Android el archivo cifrado y el keyset de Tink vuelven
 * pero la llave del Keystore no (`InvalidProtocolBufferException` /
 * `AEADBadTagException` en cada `create()` para siempre). Ese estado no se
 * recupera solo: hay que borrar el archivo y el keyset y arrancar de cero.
 * Perder las credenciales de sync es tolerable (el próximo login las vuelve
 * a entregar); tumbar la app no.
 */
object SyncCredentials {
    private const val TAG = "SyncCredentials"
    private const val FILE = "hospiwaste_sync"
    /** Nombre del archivo donde androidx.security guarda el keyset de Tink. */
    private const val KEYSET_FILE = "__androidx_security_crypto_encrypted_prefs__"

    private fun create(ctx: Context): SharedPreferences = EncryptedSharedPreferences.create(
        ctx, FILE,
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    /**
     * Abre las prefs cifradas. Si falla, descarta el archivo y el keyset (están
     * corruptos o cifrados con una llave que ya no existe) y reintenta una vez.
     * `null` si tampoco así se puede: el caller sigue sin credenciales.
     */
    @Synchronized
    private fun prefs(ctx: Context): SharedPreferences? {
        try {
            return create(ctx)
        } catch (first: Exception) {
            Log.w(TAG, "EncryptedSharedPreferences no abre; se descarta y se recrea", first)
            wipe(ctx)
        }
        return try {
            create(ctx)
        } catch (second: Exception) {
            Log.e(TAG, "EncryptedSharedPreferences sigue sin abrir; sync nativo sin credenciales", second)
            null
        }
    }

    private fun wipe(ctx: Context) {
        try {
            @Suppress("ApplySharedPref")
            ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().commit()
            @Suppress("ApplySharedPref")
            ctx.getSharedPreferences(KEYSET_FILE, Context.MODE_PRIVATE).edit().clear().commit()
            ctx.deleteSharedPreferences(FILE)
            ctx.deleteSharedPreferences(KEYSET_FILE)
        } catch (e: Exception) {
            Log.w(TAG, "no se pudo borrar el archivo cifrado", e)
        }
    }

    fun save(ctx: Context, c: Credentials) {
        prefs(ctx)?.edit()
            ?.putString("url", c.url)?.putString("anon", c.anonKey)?.putString("rt", c.refreshToken)
            ?.putLong("rotated_at", c.rotatedAt)
            ?.apply()
    }

    fun load(ctx: Context): Credentials? {
        val p = prefs(ctx) ?: return null
        return try {
            val url = p.getString("url", null) ?: return null
            val anon = p.getString("anon", null) ?: return null
            val rt = p.getString("rt", null) ?: return null
            Credentials(url, anon, rt, p.getLong("rotated_at", 0L))
        } catch (e: Exception) {
            // Un valor individual que no se puede descifrar: mismo tratamiento.
            Log.w(TAG, "credenciales ilegibles; se descartan", e)
            wipe(ctx)
            null
        }
    }

    fun clear(ctx: Context) {
        prefs(ctx)?.edit()?.clear()?.apply()
    }
}
