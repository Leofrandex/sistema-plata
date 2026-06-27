# Guía de build y distribución del APK (sideload)

Esta guía documenta el ciclo completo para generar un APK firmado de Hospiwaste listo para instalar en dispositivos Android sin pasar por Google Play.

---

## Paso 1 (una sola vez): Generar el keystore de release

El keystore es el certificado que identifica a la app. **Piérdelo y no podrás distribuir actualizaciones sobre la app ya instalada.**

Ejecuta el siguiente comando en una terminal:

```bash
keytool -genkey -v \
  -keystore hospiwaste-release.keystore \
  -alias hospiwaste \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keytool te pedirá una contraseña para el keystore, datos de la organización (nombre, ciudad, país) y una contraseña para la clave. Anótalas en un gestor de contraseñas.

> **IMPORTANTE:** Guarda el archivo `hospiwaste-release.keystore` en una ubicación segura **fuera del repositorio** (por ejemplo, en una carpeta cifrada o en tu gestor de contraseñas con soporte de archivos). Nunca lo copies dentro de la carpeta del proyecto.

---

## Paso 2 (una sola vez): Configurar las credenciales de firma

1. Copia el archivo de ejemplo al archivo real (que no se versionará):

   ```bash
   cp android/keystore.properties.example android/keystore.properties
   ```

2. Edita `android/keystore.properties` con los valores reales:

   ```properties
   storeFile=/ruta/absoluta/fuera/del/repo/hospiwaste-release.keystore
   storePassword=TU_CONTRASENA_DEL_KEYSTORE
   keyAlias=hospiwaste
   keyPassword=TU_CONTRASENA_DE_LA_CLAVE
   ```

   En `storeFile` usa la ruta absoluta al keystore que guardaste en el paso anterior.

> `android/keystore.properties` está en `.gitignore` y nunca se versionará.

---

## Ciclo de build repetible (cada vez que quieras generar un APK)

### 1. Compilar la web

```bash
npm run build
```

Genera la carpeta `out/` con los assets estáticos de Next.js.

### 2. Sincronizar con Capacitor

```bash
npx cap sync android
```

Copia los assets compilados al proyecto Android y actualiza los plugins nativos.

### 3. Generar el APK firmado

```bash
cd android && ./gradlew assembleRelease
```

El APK resultante queda en:

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Distribución e instalación en el dispositivo

### En el dispositivo Android (una sola vez por dispositivo):

1. Ir a **Ajustes → Seguridad** (o **Ajustes → Aplicaciones → Instalar apps desconocidas**, según la versión de Android).
2. Habilitar **"Instalar aplicaciones de orígenes desconocidos"** para la app desde la que se instalará (por ejemplo, el gestor de archivos o el navegador).

### Instalar el APK:

- **Opción A — USB:** Conectar el dispositivo por USB, copiar el APK y abrirlo desde el gestor de archivos del dispositivo.
- **Opción B — Compartir por red/nube:** Enviar el APK por WhatsApp, correo, Google Drive, etc., descargarlo en el dispositivo y abrirlo.
- **Opción C — ADB (para técnicos):**
  ```bash
  adb install android/app/build/outputs/apk/release/app-release.apk
  ```

---

## Advertencias importantes

- **No pierdas el keystore.** Si lo pierdes, tendrás que desinstalar la app en todos los dispositivos antes de poder instalar una versión nueva con un keystore diferente. Android impide instalar una actualización firmada con una clave distinta.
- **No versiones el keystore ni `keystore.properties`.** Ambos están excluidos por `.gitignore`.
- **Las contraseñas son secretas.** Guárdalas junto al keystore en un lugar seguro.
