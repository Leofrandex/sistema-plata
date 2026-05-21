# Reunión: Software Planta 3 (Demo + Seguimiento)

**Fecha:** 18 de mayo de 2026
**Duración:** ~1h 51m
**Cliente:** PTDP (Planta de Tratamiento de Desechos Peligrosos)
**Participantes:**
- Sebastián Castro (oito) — Desarrollador
- Francesca Labella (PTDP) — Líder operativa / decisiones de negocio
- Karolyne Murray (PTDP) — Operaciones y reportería
- Marely / Equipo Planta PTDP — Operación en planta
**Tipo:** Seguimiento de proyecto + Demo iterativa
**Enlace:** https://app.fireflies.ai/view/01KRY7B3TXQ8JYJJ7ZT52VH66Y

---

## 1. Resumen ejecutivo

La reunión cubrió la segunda demo del software de trazabilidad de desechos clínicos para PTDP. Sebastián presentó tres módulos principales —**recorridos, pesaje y reportería**— junto con el dashboard inicial. La sesión se enfocó en validar funcionalidades existentes, recoger ajustes operativos y, sobre todo, **definir el plan de lanzamiento oficial el 1 de junio de 2026**.

El equipo PTDP confirmó que el software reemplazará el actual flujo manual con Excel + plataforma Mantis de Riga (proveedor externo). Se acordó una prueba piloto con un operador el jueves 21 de mayo, una semana de ajustes finales (semana del 26 de mayo), y arranque oficial el lunes 1 de junio en paralelo con el sistema actual.

Quedaron dos bloques pendientes importantes: (1) la **integración con el software de la balanza** —que sigue sin definirse técnicamente y depende de información que tiene que conseguir Francesca con el proveedor externo—, y (2) una **fase 2** ambiciosa que incluye validaciones, checklists de operadores, base instalada de equipos y cronograma de mantenimiento.

---

## 2. Hallazgos clave

### 2.1 Hallazgos técnicos
- **El Dashboard mostraba data inconsistente:** decía 194 envases en planta + 1 en tránsito + 4 sin registro = 199, pero PTDP solo tiene **189 envases reales de 240L** registrados. Los 10 extra eran datos de demo que Sebastián había agregado manualmente.
- **El Excel base que se está usando como fuente de datos no está actualizado.** Karolyne envió un archivo cuya última fecha de despacho es 25 de noviembre de 2025. La data de enero a marzo 2026 **no existe**; la data de abril está incompleta porque Marely tuvo que hacer un corte antes de cerrar el mes.
- **La balanza actual solo soporta envases de 240L.** Para envases más grandes (660L "picantos", 750L, 1100L "Yaris") el operador debe vaciar manualmente en envases de 240L y pesar varias veces. Esto es un cuello de botella operativo conocido pero que **no estaba contemplado en el software actual**.
- **La nomenclatura de horarios solo cubre recorridos de andén** (desechos peligrosos infecciosos + citotóxicos). No contempla recolección de Morgue (cada 15 días, sin horario fijo). Requiere un primer paso en el menú: seleccionar tipo de desecho antes de seleccionar ruta.
- **El reporte de salida está restringido por un tercero externo.** PTDP debe entregar reportes en un formato específico exigido por una institución pública vía un proveedor tercero (Riga/Mantis). No hay margen para modificar la estructura visual; hay que replicarla lo más fiel posible.

### 2.2 Hallazgos operativos
- **El "papel" de la balanza ya se eliminó.** Hoy la planta lee el peso directamente del software de la balanza y lo transcribe al Excel. Esto significa que **el pesaje manual en el nuevo software es un paso atrás operativo** hasta que se integre vía API.
- **Hay dos empresas dentro del mismo cliente "Ciudad de la Salud":** ION y Erken. El cliente final espera ver reportes consolidados de Ciudad de la Salud, no separados por empresa. El software ya soporta esto pero falta validar que el consolidado funcione bien.
- **Existe un desfase de información:** Marely tiene que cerrar abril, Karolyne se compromete a cerrar mayo en paralelo, para que Sebastián tenga data oficial el lunes 25 de mayo.
- **Riga (proveedor actual) tiene que ser notificado** del cambio de plataforma. Francesca asume esta comunicación.

### 2.3 Hallazgo crítico de proceso
**El proyecto está corriendo con datos incompletos y validaciones que se descubren en cada demo.** Esta fue la tercera sesión y siguen apareciendo casos no contemplados (Morgue, Yaris sin tara registrada, envases grandes que no caben en la balanza). Esto indica que **el levantamiento de requisitos inicial fue insuficiente** y sigue habiendo zonas grises operativas. Vale la pena hacer un side note al final sobre esto.

---

## 3. Cambios solicitados al software (para implementar antes del jueves 21 de mayo)

### Prioridad alta (bloquean prueba piloto)
1. **Reporte:** mover fotos de pesaje + tacho a formato **vertical compacto** (una arriba de la otra, no en galería lado a lado), siguiendo el estándar del reporte Mantis actual.
2. **Reporte:** aceptar **logos en formato PNG/JPG** (Karolyne entrega los logos de PTDP; los de Riga los pedirá).
3. **Reporte:** permitir generar reporte con **rango de fechas seleccionable** (no solo semanal). Incluir opciones mensual y rango personalizado.
4. **Reporte:** exportar data de pesaje a **Excel editable** (no solo PDF).
5. **Pesaje:** agregar **campo de comentarios/observaciones** al lado del peso bruto en el módulo de pesaje. Sirve para anotar manualmente el número de Yaris/Picanto mientras no haya tara registrada.
6. **Pesaje:** mover peso bruto y observaciones arriba (más visible), mantener orden: número de envase → peso bruto → observaciones (formato tipo columnas).
7. **Recorridos:** agregar primer paso en menú = **seleccionar tipo de desecho** (peligroso infeccioso/citotóxico vs. Morgue u otros). Esto cambia el flujo según si hay rutas predefinidas o no.
8. **Administración de envases:** habilitar **carga masiva de envases con taras distintas** (sin tener que dar de alta uno por uno). Sebastián confirmó que es viable sin programación.
9. **Administración de envases:** habilitar **edición de envases existentes** (por ejemplo, si se reemplaza un tacho dañado y cambia la tara).

### Prioridad media (deseables pero no bloquean piloto)
10. **Dashboard:** agregar vista de **tendencia anual** (no solo mensual). Permitir ver enero–mes actual en una sola gráfica para evaluar comportamiento.
11. **Dashboard:** consolidar kilos por **cliente padre** (Ciudad de la Salud = ION + Erken sumados), no solo por empresa hija.
12. **Limpieza:** quitar la opción "cámara fría" del dashboard. Ya no aplica al proceso (se va directo de recorrido a pesaje).

---

## 4. Pendientes por persona

### 4.1 Pendientes para Sebastián (tú)

**Esta semana — antes del jueves 21 de mayo (prueba piloto):**
- [ ] Implementar los **9 cambios de prioridad alta** del software listados arriba.
- [ ] Revisar y modificar el reporte para aceptar logos PNG/JPG con formato compacto y fotos organizadas (referencia min 29:06).
- [ ] Habilitar campo editable de comentarios/observaciones al lado del peso bruto en pesaje (min 1:14:33).
- [ ] Implementar carga masiva de envases con sus taras y datos editables (min 57:27).
- [ ] Decidir qué formato es mejor para el entregable de reporte: Word, PowerPoint o Excel. **Recomendación honesta:** considerá Excel si lo que se va a hacer luego es manual; Word si lo importante es la fidelidad visual con el formato Mantis.

**Mañana, martes 19 de mayo — 9:30 AM hora Colombia (10:30 AM Panamá):**
- [ ] **Reunión 1-a-1 con Karolyne** para revisar el reporte de Mantis y el software OSP Waste/Siber en detalle. Pedirle acceso a su usuario para ver la plataforma actual.

**Esta semana — preparar piloto:**
- [ ] **Coordinar la prueba piloto con un operador real el jueves 21 de mayo, 10:00 AM hora Panamá** (11:00 AM tu hora). Karolyne y Marely envían la invitación.
- [ ] Preparar la presentación visual y los ajustes para la prueba piloto (min 1:16:22).

**Bloque de integración con balanza:**
- [ ] Contactar a la persona que Francesca te pasó como referencia del **software de la balanza**.
- [ ] Consultar específicamente: ¿el software de la balanza tiene **API**? ¿tiene **endpoint** documentado para extraer pesos? ¿se puede acceder remotamente?
- [ ] Reportar de vuelta a Francesca para que ella valide con el proveedor si hay margen de integración.

**Próxima reunión (semana del 25 de mayo, lunes 25 a las 2 PM):**
- [ ] Llegar con los 9 cambios listos, el reporte ajustado, y idealmente con respuesta sobre la API de balanza.

---

### 4.2 Pendientes para Karolyne Murray (PTDP)
- Verificar y actualizar Excel con data oficial hasta marzo/abril, cerrar meses incompletos para despacho correcto.
- Enviar Excel oficial actualizado a Sebastián para su incorporación al sistema.
- Entregar logos en PNG/JPG (PTDP y solicitar a Riga los suyos).
- Preparar lista actualizada de contenedores para sincronizar con sistema y corroborar rotación.
- Cerrar mayo en paralelo con Marely (Marely cierra abril, Karolyne cierra mayo).
- Gestionar accesos y usuarios para inicio oficial el 1 de junio.
- Coordinar con Sebastián la videollamada del martes 19 a las 10:30 AM Panamá para revisar Mantis.

### 4.3 Pendientes para Francesca Labella (PTDP)
- Definir cronograma de carga e inicio oficial.
- Coordinar capacitación a operadores antes del 1 de junio.
- Solicitar al **proveedor del software de la balanza** la información técnica (API/endpoint) que pidió Sebastián.
- Supervisar el cierre de abril y mayo con Karolyne y Marely.
- Notificar a Riga del cambio de plataforma.

### 4.4 Pendientes para Marely / Equipo PTDP
- Actualizar Excel con datos reales de rotación 2026 (cerrar abril completo).
- Entregar datos oficiales de envases y peso a Sebastián.

---

## 5. Pendientes para la próxima reunión

**Reunión de seguimiento: lunes 25 de mayo, 2:00 PM hora Panamá** (3:00 PM tu hora).

**Agenda esperada:**
1. Validación de los 9 cambios de prioridad alta implementados.
2. Resultados de la prueba piloto del jueves 21 con el operador.
3. Estado de la integración con balanza (API/endpoint).
4. Confirmación de cierre de abril (Marely) y mayo (Karolyne).
5. Plan definitivo de capacitación a operadores antes del 1 de junio.
6. Confirmar fecha de carga de data oficial.

**Después del 1 de junio, en reunión separada, se discutirá Fase 2:**
- Digitalización de validaciones de ciclo de esterilización.
- Checklists de inicio y fin de turno de operadores (con fotos).
- KPIs de operadores (cumplimiento, completitud de reportes).
- Base instalada de equipos de planta + cronograma de mantenimiento preventivo (alarmas).
- Posible módulo de compras de insumos no-SAP (lentes, guantes, etc.).
- Reporte de limpieza profunda y uso de camiones.

---

## 6. Acuerdos clave de la reunión

1. **Inicio oficial del software:** lunes **1 de junio de 2026**.
2. **Prueba piloto con operador:** jueves **21 de mayo** a las 10:00 AM Panamá.
3. **Última semana de mayo (26-31):** operación en paralelo (software nuevo + sistema actual) sin descuidar cierre manual.
4. **Reunión técnica entre Sebastián y Karolyne:** martes **19 de mayo, 9:30 AM** hora Colombia.
5. **Próxima reunión de seguimiento general:** lunes **25 de mayo, 2:00 PM** Panamá.
6. **Fase 1 = funcionalidad actual + ajustes acordados.** Fase 2 (validaciones, checklists, mantenimiento) se planifica después del lanzamiento, con maduración de uso primero.
7. **Pesaje manual con foto de balanza es aceptable como solución temporal** mientras se evalúa integración API.

---

## 7. Nota de mentor — Riesgos que veo en el proyecto

Te dejo esto aparte porque me pediste honestidad, no aplausos:

**Riesgo 1 — La fecha del 1 de junio es muy ajustada.** Tenés 13 días corridos para: hacer 9 cambios al software, validar con un operador real, esperar feedback, recoger la data oficial (que aún no está cerrada), capacitar operadores que nunca usaron el sistema, y notificar a Riga. Si la prueba piloto del jueves 21 sale con problemas, tenés muy poco margen para reaccionar. Considerá si tiene sentido proponer un buffer de una semana (lanzamiento 8 de junio) en lugar de comprometerte al 1.

**Riesgo 2 — La integración con la balanza la estás dejando pasiva.** Vos dependés de que Francesca le pregunte al proveedor por la API. Si no hay API o no dan acceso, el operador tiene que **tipear peso manualmente** en cada pesaje. Eso ya lo aceptaron como temporal, pero si se vuelve permanente vas a tener un cliente frustrado. Sugerencia: ponete vos en contacto directo con el proveedor (Francesca dijo que te pasaría el contacto). No esperés.

**Riesgo 3 — La data base que estás usando está sucia y desactualizada.** Subiste un Excel que tenía hasta noviembre 2025 y no abril 2026. El cliente lo descubrió en vivo. Antes del piloto del jueves, **asegurate de tener la data oficial cargada y validada**, no de demo. Si no, vas a tener el mismo problema delante del operador real.

**Riesgo 4 — Cada reunión aparecen casos no contemplados.** Morgue, Yaris sin tara, envases de 750L/1100L. Es señal de que el levantamiento inicial no cubrió bien la operación real. Antes de Fase 2, hacé un **levantamiento formal y exhaustivo** con Karolyne y Marely —no en formato reunión de demo, sino una sesión dedicada solo a mapear procesos. Te ahorrarás tres reuniones futuras.

**Riesgo 5 — Estás absorbiendo scope creep silenciosamente.** Francesca tiró Fase 2 con 5-6 módulos nuevos (validaciones, checklists, mantenimiento, base instalada, compras). Vos dijiste "me parece interesante, pero hay que hablarlo más claro." Bien dicho, pero asegurate de **cotizar Fase 2 por separado** y no dejar que se filtre en Fase 1 por la puerta de atrás.

---

*Documento generado a partir de la transcripción de Fireflies (ID: 01KRY7B3TXQ8JYJJ7ZT52VH66Y).*
