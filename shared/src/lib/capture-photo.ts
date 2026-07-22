/**
 * Captura de foto. En el APK (Capacitor) usa la cámara nativa: fuerza SOLO
 * cámara (sin galería) y devuelve un JPEG ya redimensionado — evita el HEIC del
 * teléfono, que el WebView no decodifica y colgaba la app. En web, el llamador
 * cae al `<input type=file capture>` de siempre.
 */

/** ¿Corremos dentro del APK nativo? En web devuelve false (y no rompe el build). */
export async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * Abre la cámara nativa y devuelve un data URL JPEG, o `null` si el usuario
 * cancela. Solo llamar cuando `isNativeApp()` es true.
 */
export async function getCameraPhoto(): Promise<string | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera, // solo cámara, sin galería
      resultType: CameraResultType.DataUrl,
      quality: 70,
      width: 1920,
      correctOrientation: true,
      saveToGallery: false,
      // format por defecto = jpeg
    })
    return photo.dataUrl ?? null
  } catch {
    // El usuario canceló la cámara (o error): no es un fallo que deba propagarse.
    return null
  }
}
