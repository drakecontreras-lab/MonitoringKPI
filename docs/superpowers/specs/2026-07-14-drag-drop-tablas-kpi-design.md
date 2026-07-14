# Drag and drop para reordenar filas de tablas en KPI Corporativos

## Contexto

En la pestaña "KPI Corporativos" (`frontend/src/components/KpiCorporativosTab.jsx`), el botón "Modificar Valores" activa un modo de edición (`isEditing`) que permite editar valores de celda en 5 tablas de indicadores. Se pidió agregar la capacidad de reordenar filas (drag and drop) dentro de ese mismo modo de edición, de forma que el nuevo orden se refleje tanto en la previsualización del correo (`EmailPreview.jsx`) como en el correo real enviado (`POST /api/send-report` → `backend/utils/kpi_email_sender.py`).

Investigación previa confirmó que:
- El orden de las filas es puramente la posición en el array JS (`kpiData.resumenAvisos.distribucion`, `kpiData.resumenOrdenes.distribucion`, `kpiData.trabajoPlanificado.grupos`, `kpiData.programaSemanal.grupos`, `kpiData.planMatriz.grupos`).
- El backend (`kpi_email_sender.py`) y el frontend (`emailTemplate.jsx`, usado por `EmailPreview.jsx`) iteran esos arrays con `.map()`/`for` respetando el orden recibido — no hay ningún `sorted()` que lo deshaga.
- `EmailPreview.jsx` construye el HTML de previsualización a partir del mismo estado `kpiData` del componente padre.
- El envío real manda `kpiData` completo (tal cual está en el estado React) al backend vía `POST /api/send-report`.

Conclusión: **basta con reordenar el array en el estado React `kpiData`** — ni el preview ni el correo real necesitan cambios de backend.

## Alcance

- Aplica **solo** a la pestaña KPI Corporativos, a las 5 tablas ya editables:
  1. Avisos Pendientes (`kpiData.resumenAvisos.distribucion`)
  2. Órdenes Pendientes (`kpiData.resumenOrdenes.distribucion`)
  3. % Trabajo Planificado (`kpiData.trabajoPlanificado.grupos`)
  4. Programa Semanal (`kpiData.programaSemanal.grupos`)
  5. Plan Matriz (`kpiData.planMatriz.grupos`)
- **Fuera de alcance** (decidido explícitamente): pestaña Proyecciones. Sus tablas son de solo lectura, no tiene botón de edición, y su backend (`proy_email_sender.py`) reconstruye el orden con `sorted()` alfabético ignorando el array recibido — llevarla al mismo comportamiento requeriría trabajo adicional no cubierto por este spec.
- El reordenamiento solo persiste durante la sesión actual del informe abierto en pantalla. Al reprocesar KPIs o recargar la página, el orden vuelve al original (alfabético, generado por `sorted()` en `backend/utils/kpi_excel_processor.py`). No se persiste en `config.json` ni Supabase.
- Si el usuario reordena filas y luego cambia el toggle "Agrupar por Puesto de Trabajo", el orden custom se pierde (las tablas se reconstruyen desde cero vía `agruparKpiData`). Comportamiento aceptado explícitamente — cambiar la agrupación es un cambio estructural.

## Diseño

### Identidad estable de fila

Cada fila agrupada ya tiene una clave única natural, generada en `agruparKpiData` (`KpiCorporativosTab.jsx:47-49`): `${proceso}||${grPlanif}||${grPlanifPM}` o `${proceso}||${ptoTrabajo}` según el toggle activo. Esa clave (variable `clave` dentro de `agruparArray`) se asigna como campo `_rowId` a cada objeto de fila resultante. Se usa como `id` estable para dnd-kit — no requiere librería de generación de UUID.

`_rowId` se asigna una sola vez, en el punto donde `agruparArray` construye `Object.values(mapa)`. Como `agruparKpiData` se ejecuta tanto al recibir datos frescos del backend como cada vez que cambia el toggle de agrupación, el campo siempre queda consistente con el array vigente.

### Librería

`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (nuevas dependencias en `frontend/package.json`). Elegida sobre HTML5 drag nativo por soporte de teclado/touch (accesibilidad) y API declarativa madura para listas ordenables.

### Componentes nuevos

- **`SortableRow`** (componente local dentro de `KpiCorporativosTab.jsx` o extraído a archivo propio si crece): wrapper de `<tr>` que usa `useSortable({ id })` de `@dnd-kit/sortable`, aplica `transform`/`transition` vía `CSS.Transform.toString` durante el arrastre, y expone `attributes`/`listeners` para el handle.
- **Columna "handle"**: nueva primera celda (`<td>`) con ícono `drag_indicator` (Material Icons), visible **solo cuando `isEditing === true`**. Los `listeners` de arrastre se atan únicamente al ícono, no a la fila completa, para no interferir con los `<input>` de edición de valores ya existentes.
- Fuera de modo edición (`isEditing === false`), las tablas se renderizan exactamente igual que hoy — sin `DndContext`, sin columna handle, sin overhead. Cero riesgo de regresión visual en modo lectura.

### Reordenamiento

Función genérica, reutilizada por las 5 tablas:

```js
const handleDragEnd = (section, subKey, event) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const newData = JSON.parse(JSON.stringify(kpiData));
  const arr = newData[section][subKey]; // 'distribucion' o 'grupos'
  const oldIndex = arr.findIndex(g => g._rowId === active.id);
  const newIndex = arr.findIndex(g => g._rowId === over.id);
  newData[section][subKey] = arrayMove(arr, oldIndex, newIndex);
  setKpiData(newData);
};
```

Cada una de las 5 tablas envuelve su `<tbody>` en:
```jsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('resumenAvisos', 'distribucion', e)}>
  <SortableContext items={distribucion.map(g => g._rowId)} strategy={verticalListSortingStrategy}>
    <tbody>...</tbody>
  </SortableContext>
</DndContext>
```
(solo cuando `isEditing`; en modo lectura, `<tbody>` plano como hoy).

Sensores: `PointerSensor` + `KeyboardSensor` (con `sortableKeyboardCoordinates`) para accesibilidad de teclado.

`handleTableChange`/`handleTotalChange` (edición de valores de celda) no cambian — siguen indexando por `idx` de la posición actual en el `.map()`, que sigue siendo válida tras cualquier reorden.

### Ajustes menores de layout

- `colSpan` de las filas TOTAL (`<tfoot>`) de las 5 tablas: +1 cuando `isEditing` (por la columna handle nueva).
- CSS nuevo en `frontend/src/index.css`: `.drag-handle-cell` (ancho fijo ~32px, `cursor: grab`), estado visual durante arrastre (opacidad reducida en la fila que se mueve).

### Backend

Sin cambios. `kpi_email_sender.py` y `emailTemplate.jsx` ya respetan el orden del array recibido. El campo extra `_rowId` viaja en el JSON enviado a `/api/send-report` pero es ignorado silenciosamente por ambos renderizadores (no se referencia, no rompe nada).

## Casos borde

- **Reprocesar KPIs**: `kpiDataOriginal` se reemplaza, `agruparKpiData` se ejecuta de nuevo → orden vuelve a alfabético, `_rowId` se regenera. Esperado.
- **Cambiar toggle "Agrupar por Puesto de Trabajo"**: mismo caso anterior — reset de orden aceptado.
- **Fila con clave duplicada** (no debería ocurrir, `mapa` en `agruparArray` ya deduplica por `clave`): no aplica, cada `clave` es única por construcción del `Object` `mapa`.
- **Arrastrar sin soltar sobre una fila válida** (`over` es `null`): no-op, `handleDragEnd` retorna temprano.

## Pruebas

- Manual: abrir tab KPI Corporativos con datos procesados, activar "Modificar Valores", arrastrar fila 3 a posición 1 en cada una de las 5 tablas, verificar que la previsualización de correo (`EmailPreview.jsx`) refleja el nuevo orden, y que el HTML generado por el backend en un envío de prueba (`/api/send-report`) también lo refleja.
- Verificar que en modo lectura (`isEditing === false`) las tablas se ven idénticas a antes del cambio (sin columna handle, sin comportamiento de arrastre).
- Verificar que editar un valor de celda después de reordenar sigue actualizando la fila correcta (no hay desfase de índice).
