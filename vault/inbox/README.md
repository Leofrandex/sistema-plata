---
title: Inbox — Zona de Procesamiento
tags:
  - meta
  - inbox
updated: 2026-05-02
---

# Inbox

Zona de aterrizaje para información cruda. Todo lo que llega aquí debe ser procesado y distribuido al vault.

## Qué va aquí

- Transcripts de reuniones (exportados de Fireflies o pegados como markdown)
- Notas sueltas, ideas, dumps de contexto
- Documentos de requisitos sin procesar
- Capturas de conversaciones relevantes

## Protocolo de procesamiento

Cuando Claude procesa un archivo de este inbox:

1. Lee el archivo completo
2. Extrae decisiones, requisitos, entidades, flujos, stakeholders
3. Distribuye la información a los archivos del vault correspondientes
4. Actualiza `vault/_index.md` si el estado del proyecto cambia
5. Reporta al usuario: qué archivos tocó y qué información extrajo
6. Mueve el archivo a `inbox/procesado/` (o elimina, según preferencia del usuario)

## Archivos pendientes de procesar

*(Ninguno aún — depositar archivos en esta carpeta para procesarlos)*

## Archivos procesados

*(Se mueven a `inbox/procesado/` tras el procesamiento)*
