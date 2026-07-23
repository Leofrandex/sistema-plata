package com.hospiwaste.app.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.File
import kotlin.concurrent.thread

/**
 * Foreground service que drena la cola de sync nativa una vez y se apaga (START_NOT_STICKY).
 * Sin retry/backoff propio: eso es responsabilidad de quien lo dispara (kick() / WorkManager en Task 5).
 */
class SyncService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, buildNotification("Sincronizando registros pendientes…"))
        thread {
            try {
                SyncEngine.drain(this)
            } catch (e: Exception) {
                // openDatabase/SyncLock.acquire pueden lanzar SQLiteException bajo contención con
                // la conexión del WebView (I2); nunca debe tumbar el servicio.
                Log.w(TAG, "drain() falló", e)
            } finally {
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun buildNotification(text: String): Notification {
        val channelId = "hospiwaste_sync"
        if (Build.VERSION.SDK_INT >= 26) {
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
                NotificationChannel(channelId, "Sincronización", NotificationManager.IMPORTANCE_LOW),
            )
        }
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Hospiwaste").setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true).build()
    }

    companion object {
        private const val TAG = "SyncService"
        private const val NOTIF_ID = 41
        private const val DB_FILE = "hospiwasteSQLite.db"

        fun hasNetwork(ctx: Context): Boolean {
            val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }

        /**
         * Chequeo barato de "¿hay algo pendiente?" antes de levantar el foreground service.
         * Cualquier error al leer la DB hace que erremos hacia arrancar el servicio: drain() es
         * un no-op seguro si no hay nada que hacer.
         */
        private fun hasPendingWork(ctx: Context): Boolean {
            val dbFile = ctx.getDatabasePath(DB_FILE)
            if (!dbFile.exists()) return false
            return try {
                SQLiteDatabase.openDatabase(
                    dbFile.absolutePath,
                    null,
                    SQLiteDatabase.OPEN_READONLY,
                ).use { db ->
                    db.rawQuery(
                        "SELECT EXISTS(SELECT 1 FROM local_rows WHERE synced=0 UNION SELECT 1 FROM local_photos WHERE synced=0)",
                        null,
                    ).use { c -> c.moveToFirst() && c.getInt(0) == 1 }
                }
            } catch (e: Exception) {
                Log.w(TAG, "hasPendingWork() falló, arrancando igual", e)
                true
            }
        }

        fun startIfPending(ctx: Context) {
            if (!hasNetwork(ctx)) return
            if (SyncCredentials.load(ctx) == null) return
            if (!hasPendingWork(ctx)) return
            val intent = Intent(ctx, SyncService::class.java)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent) else ctx.startService(intent)
        }
    }
}
