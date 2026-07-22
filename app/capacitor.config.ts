import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hospiwaste.app',
  appName: 'Hospiwaste',
  webDir: 'out',
  android: {
    // Permite inspeccionar el WebView con chrome://inspect para depurar en campo.
    webContentsDebuggingEnabled: true,
  },
}

export default config
