---
title: Editor del registro fotográfico
tags:
  - logs
  - reports
updated: 2026-10-02
---

# Editor del registro fotográfico

Botón "Editar reporte" en `/reports`: editor de pantalla completa para reacomodar el
registro antes de descargarlo. Pedido para que el equipo decida si le aporta valor.

## Decisiones
- **Sin persistencia.** Editan, descargan y listo; cerrar la pestaña pierde todo. Evita tabla nueva y conflictos de edición simultánea mientras no se sepa si el equipo lo usa.
- **Una maqueta, un PDF.** El PDF se dibuja desde la maqueta (días → cuadros → 8 recuadros). La descarga automática y la editada usan el mismo componente, así el diseño no se duplica.
- **Grilla única 4×2.** Recorrido y pesaje son la misma grilla (pesaje: balanza arriba, tacho abajo en la misma columna), así cualquier foto entra en cualquier recuadro.
- **Buscador solo de pesajes**, por día → sesión → tacho/contenedor. Las fotos de recorrido no están en él.
- **Cuadros solo dentro de su día**: la fecha de la hoja sigue siendo verdad.

Spec: `docs/superpowers/specs/2026-10-02-editor-registro-fotografico-design.md`.

## Pendiente
- Ver con coordinación si lo usan; si sí, evaluar guardar ediciones.
