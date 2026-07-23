package com.hospiwaste.app.sync

import android.database.sqlite.SQLiteDatabase

/**
 * Lock cooperativo JS/nativo sobre la fila `meta` (key='flush_lock', value='owner:expiresAtEpochMs').
 * Mismo formato que usaría un futuro mutex del lado JS: cualquiera de los dos procesos que
 * intente drenar primero gana, y el lock expira solo (TTL) si el dueño muere sin liberar.
 */
object SyncLock {
    private const val KEY = "flush_lock"
    private const val TTL_MS = 120_000L

    /** true si adquirió. */
    fun acquire(db: SQLiteDatabase, owner: String): Boolean {
        db.beginTransaction()
        try {
            val now = System.currentTimeMillis()
            val cur = db.rawQuery("SELECT value FROM meta WHERE key=?", arrayOf(KEY)).use {
                if (it.moveToFirst()) it.getString(0) else null
            }
            if (cur != null) {
                val parts = cur.split(":")
                val expires = parts.getOrNull(1)?.toLongOrNull() ?: 0L
                if (expires > now && parts[0] != owner) return false
            }
            db.execSQL(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
                arrayOf(KEY, "$owner:${now + TTL_MS}"),
            )
            db.setTransactionSuccessful()
            return true
        } finally {
            db.endTransaction()
        }
    }

    /** No-throw: si falla (p.ej. contención con el WebView), el TTL de 120s acota el lock huérfano (I2). */
    fun release(db: SQLiteDatabase, owner: String) {
        try {
            db.execSQL("DELETE FROM meta WHERE key=? AND value LIKE ?", arrayOf(KEY, "$owner:%"))
        } catch (_: Exception) {
            // swallow: TTL_MS acota el lock si no se pudo liberar.
        }
    }
}
