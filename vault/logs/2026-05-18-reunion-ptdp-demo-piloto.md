---
title: Reunión PTDP — Demo 2 + Plan de lanzamiento
tags:
  - log
  - reunion
  - ptdp
  - lanzamiento
fecha_reunion: 2026-05-18
updated: 2026-05-21
participantes:
  - Sebastián Castro (oito)
  - Francesca Labella (PTDP)
  - Karolyne Murray (PTDP)
  - Marely / Equipo Planta PTDP
fireflies: https://app.fireflies.ai/view/01KRY7B3TXQ8JYJJ7ZT52VH66Y
---

# Reunión PTDP — Demo 2 + Plan de lanzamiento (2026-05-18)

## Resumen ejecutivo

Segunda demo del software a PTDP. Se presentaron **recorridos, pesaje, reportería y dashboard**. PTDP confirmó que el software reemplazará el flujo manual (Excel + plataforma **Mantis de Riga**, proveedor externo).

**Plan de lanzamiento acordado:**
- **Piloto con operador real:** jueves **2026-05-21**, 10:00 AM Panamá.
- **Semana de ajustes:** 2026-05-26 al 2026-05-31 (operación en paralelo con sistema actual).
- **Arranque oficial:** lunes **2026-06-01**.

Quedan dos bloques abiertos: (1) integración con software de la balanza (depende de info que consigue Francesca con proveedor), y (2) Fase 2 ambiciosa (validaciones, checklists, base instalada de equipos, mantenimiento preventivo).

---

## Hallazgos técnicos

- **Dashboard inconsistente:** mostraba 194 envases en planta + 1 en tránsito + 4 sin registro = 199, pero PTDP tiene **189 envases reales de 240L**. Los 10 extra eran data de demo agregada manualmente.
- **Excel base desactualizado:** última fecha de despacho 25-nov-2025. Ene–mar 2026 no existe; abril incompleto (Marely no cerró el mes).
- **Balanza solo soporta envases de 240L.** Envases más grandes (660L "picantos", 750L, 1100L "Yaris") obligan a vaciado manual y múltiples pesajes. Cuello de botella conocido **no contemplado en el software actual**.
- **Nomenclatura de horarios solo cubre andén** (peligroso infeccioso + citotóxico). No contempla **Morgue** (cada 15 días, sin horario fijo). Requiere primer paso en menú: seleccionar tipo de desecho antes de la ruta.
- **Reporte de salida tiene formato impuesto por institución pública vía Riga/Mantis.** Sin margen para modificar estructura visual — hay que replicarla lo más fiel posible.

## Hallazgos operativos

- **El "papel" de la balanza ya se eliminó.** Hoy la planta lee el peso directo del software de balanza y lo transcribe al Excel. El pesaje manual en el nuevo software es un **paso atrás operativo** hasta que se integre vía API.
- **Cliente "Ciudad de la Salud" agrupa dos empresas:** ION y Erken. El cliente final espera reportes consolidados, no separados por empresa. El software ya lo soporta pero falta validar el consolidado.
- **Desfase de información:** Marely cierra abril, Karolyne cierra mayo en paralelo, data oficial debe estar el lunes 2026-05-25.
- **Riga debe ser notificado** del cambio de plataforma. Francesca asume la comunicación.

## Hallazgo crítico de proceso

Tercera demo y siguen apareciendo casos no contemplados (Morgue, Yaris sin tara, envases 660/750/1100L). **El levantamiento inicial fue insuficiente.** Antes de Fase 2 conviene hacer un levantamiento formal y exhaustivo con Karolyne y Marely.

---

## Cambios al software acordados

### División en sesiones (acordado 2026-05-21)

> [!info] Plan de implementación
> **Sesión 1 (2026-05-21):** Pesaje + Recorridos + quitar "cámara fría" del Dashboard (reemplazar por otra métrica disponible). Integración Supabase, deploy a GitHub y hosting para piloto del jueves.
> **Sesión 2 (próxima):** Reportes + Dashboard (tendencia anual, consolidación cliente padre) + Admin de envases (carga masiva + edición).

### Prioridad alta — bloquean piloto

| # | Módulo | Cambio | Sesión |
|---|--------|--------|--------|
| 1 | Reporte | Fotos pesaje+tacho en formato vertical compacto (estilo Mantis), no galería lado a lado | 2 |
| 2 | Reporte | Aceptar logos PNG/JPG (PTDP + Riga) | 2 |
| 3 | Reporte | Generar por rango de fechas seleccionable (semanal, mensual, personalizado) | 2 |
| 4 | Reporte | Exportar pesaje a Excel editable, no solo PDF | 2 |
| 5 | Pesaje | Campo de comentarios/observaciones al lado del peso bruto (para Yaris/Picanto sin tara) | 1 |
| 6 | Pesaje | Reordenar: envase → peso bruto → observaciones, con peso/observaciones arriba/más visibles | 1 |
| 7 | Recorridos | Primer paso del menú = seleccionar tipo de desecho (peligroso infeccioso/citotóxico vs Morgue) antes de la ruta | 1 |
| 8 | Admin envases | Carga masiva con taras distintas | 2 |
| 9 | Admin envases | Edición de envases existentes (ej. cambio de tara por reemplazo de tacho) | 2 |

### Prioridad media — no bloquean piloto

| # | Módulo | Cambio | Sesión |
|---|--------|--------|--------|
| 10 | Dashboard | Vista de tendencia anual (enero–mes actual) | 2 |
| 11 | Dashboard | Consolidación por cliente padre (Ciudad de la Salud = ION + Erken) | 2 |
| 12 | Dashboard | Quitar "cámara fría", reemplazar por otra métrica disponible | 1 |

---

## Pendientes por persona

### Sebastián
- **Sesión 1 (hoy):** cambios 5, 6, 7, 12 + integración Supabase + push GitHub + hosting para piloto.
- **Sesión 2:** cambios 1–4, 8–11.
- **Martes 2026-05-19, 9:30 AM Colombia:** 1-a-1 con Karolyne para revisar Mantis/OSP Waste/Siber. Pedir acceso a su usuario.
- **Jueves 2026-05-21, 10:00 AM Panamá:** piloto con operador real.
- **Balanza:** contactar directamente al proveedor del software de balanza (no esperar a Francesca). Preguntar por API, endpoint documentado, acceso remoto.
- **Lunes 2026-05-25, 2:00 PM Panamá:** llegar con los 9 cambios listos + respuesta sobre API balanza.
- **Decidir formato entregable de reporte:** Excel (si se edita manual después) vs Word (si lo crítico es fidelidad visual con Mantis).

### Karolyne Murray
- Actualizar Excel con data oficial hasta marzo/abril; cerrar meses incompletos.
- Enviar Excel oficial a Sebastián.
- Entregar logos PNG/JPG (PTDP + solicitar a Riga).
- Lista actualizada de contenedores para sincronizar y corroborar rotación.
- Cerrar mayo en paralelo con Marely (Marely cierra abril).
- Gestionar accesos y usuarios para 2026-06-01.
- Videollamada martes 19 a las 10:30 AM Panamá.

### Francesca Labella
- Definir cronograma de carga e inicio oficial.
- Coordinar capacitación a operadores antes del 2026-06-01.
- Solicitar al proveedor del software de balanza la info técnica (API/endpoint).
- Supervisar el cierre de abril y mayo con Karolyne y Marely.
- Notificar a Riga del cambio de plataforma.

### Marely / Equipo PTDP
- Actualizar Excel con rotación real 2026 (cerrar abril completo).
- Entregar datos oficiales de envases y peso a Sebastián.

---

## Próxima reunión

**Lunes 2026-05-25, 2:00 PM Panamá** (3:00 PM Colombia).

**Agenda:**
1. Validación de los 9 cambios de prioridad alta implementados.
2. Resultados de la prueba piloto del jueves 21.
3. Estado de integración con balanza (API/endpoint).
4. Confirmación de cierre de abril (Marely) y mayo (Karolyne).
5. Plan definitivo de capacitación a operadores antes del 2026-06-01.
6. Confirmar fecha de carga de data oficial.

## Fase 2 (post-lanzamiento — cotizar por separado)

- Digitalización de validaciones de ciclo de esterilización.
- Checklists de inicio y fin de turno de operadores (con fotos).
- KPIs de operadores (cumplimiento, completitud).
- Base instalada de equipos de planta + cronograma de mantenimiento preventivo (alarmas).
- Posible módulo de compras de insumos no-SAP (lentes, guantes, etc.).
- Reporte de limpieza profunda y uso de camiones.

---

## Acuerdos clave

1. Inicio oficial: **lunes 2026-06-01**.
2. Piloto: **jueves 2026-05-21**, 10:00 AM Panamá.
3. Última semana de mayo (26-31): operación en paralelo (nuevo + actual).
4. Reunión Sebastián ↔ Karolyne: **martes 2026-05-19**, 9:30 AM Colombia.
5. Próxima reunión general: **lunes 2026-05-25**, 2:00 PM Panamá.
6. Fase 1 = funcionalidad actual + ajustes acordados. Fase 2 se planifica post-lanzamiento, con maduración de uso primero.
7. Pesaje manual con foto de balanza es aceptable como **solución temporal** mientras se evalúa integración API.

---

## Riesgos identificados

1. **Fecha del 1 de junio es muy ajustada** (13 días corridos para 9 cambios + piloto + capacitación + data oficial). Si el piloto del jueves sale mal, queda muy poco margen. Considerar buffer al 2026-06-08.
2. **Integración balanza está pasiva.** Si no hay API, el operador tipea peso manualmente — aceptado como temporal pero riesgoso si se vuelve permanente. Contactar directo al proveedor.
3. **Data base sucia.** Excel hasta nov-2025 sin abril 2026. Antes del piloto del jueves, **data oficial cargada y validada**, no de demo.
4. **Cada reunión aparecen casos no contemplados** (Morgue, Yaris, 750/1100L). Levantamiento inicial insuficiente. Sesión dedicada de mapeo antes de Fase 2.
5. **Scope creep silencioso con Fase 2.** Cotizar por separado, no dejar filtrar en Fase 1.

---

*Fuente: transcripción Fireflies 01KRY7B3TXQ8JYJJ7ZT52VH66Y. Procesado al vault el 2026-05-21.*
