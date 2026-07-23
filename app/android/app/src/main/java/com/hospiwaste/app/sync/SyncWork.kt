package com.hospiwaste.app.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        // `DrainOutcome.pending == -1` es un marcador sobrecargado de "no corrió" (sin
        // credenciales, lock ocupado, falló el refresh de token, o contención de SQLite).
        // Heurística de reintento:
        //   pending == 0                      -> success (nada pendiente)
        //   pending == -1                      -> retry (transitorio: lock/refresh; el próximo
        //                                         ciclo periódico es barato si de verdad no hay
        //                                         credenciales)
        //   pending > 0 && pushed > 0          -> success (hubo progreso; el resto sigue en el
        //                                         próximo ciclo)
        //   pending > 0 && pushed == 0         -> retry (nada se movió; probablemente la red
        //                                         cayó a mitad de la pasada)
        val outcome = try {
            SyncEngine.drain(applicationContext)
        } catch (_: Exception) {
            return Result.retry()
        }
        return when {
            outcome.pending == 0 -> Result.success()
            outcome.pending == -1 -> Result.retry()
            outcome.pushed > 0 -> Result.success()
            else -> Result.retry()
        }
    }
}

object SyncWork {
    private const val UNIQUE_WORK_NAME = "hospiwaste-sync"

    fun schedule(ctx: Context) {
        val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(ctx)
            .enqueueUniquePeriodicWork(UNIQUE_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
    }
}
