# Drag and Drop para Reordenar Filas de Tablas KPI Corporativos - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reordenar filas (drag and drop) en las 5 tablas de indicadores de la pestaña KPI Corporativos, mientras el modo "Modificar Valores" está activo, de forma que el nuevo orden se refleje en la previsualización del correo y en el correo real enviado.

**Architecture:** Todo el cambio vive en el frontend. Cada fila agrupada recibe un `_rowId` estable (su clave de agrupación existente). Se usa `@dnd-kit` para hacer arrastrables las filas de `<tbody>` solo cuando `isEditing === true`; en modo lectura las tablas se renderizan exactamente igual que hoy. El reordenamiento solo muta el array en el estado React `kpiData`; como `EmailPreview.jsx` y el backend (`kpi_email_sender.py`) ya respetan el orden del array recibido, no se requiere ningún cambio de backend.

**Tech Stack:** React 18 (Vite), `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

## Global Constraints

- Alcance limitado a `frontend/src/components/KpiCorporativosTab.jsx` (y un componente nuevo `SortableRow.jsx`). No tocar `ProyeccionesTab.jsx`, `emailTemplate.jsx`, ni ningún archivo `backend/` — quedó explícitamente fuera de alcance en el spec.
- El proyecto frontend no tiene framework de tests (no hay `jest`/`vitest` en `frontend/package.json`, no hay carpeta `tests/`). La verificación de cada tarea es: `npm run build` (compila sin errores) más, en la última tarea, una prueba manual end-to-end con el dev server. No introducir un framework de testing nuevo — está fuera de alcance.
- El reordenamiento no debe persistir entre sesiones (no tocar `config.json`, `supabase_client.py`, ni añadir llamadas nuevas a `/api/config`).
- No modificar `handleTableChange` ni `handleTotalChange` (edición de valores de celda) — deben seguir funcionando igual tras estos cambios.
- Dependencias nuevas permitidas: únicamente `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

---

## Task 1: Instalar dependencias dnd-kit

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: paquetes `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` disponibles para import en tareas siguientes.

- [ ] **Step 1: Agregar dependencias a package.json**

En `frontend/package.json`, dentro de `"dependencies"`, agregar antes de `"@supabase/supabase-js"` (orden alfabético):

```json
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@supabase/supabase-js": "^2.108.2",
```

- [ ] **Step 2: Instalar**

Run (desde `frontend/`): `npm install`
Expected: instala los 3 paquetes nuevos sin errores, actualiza `frontend/package-lock.json`.

- [ ] **Step 3: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: build termina sin errores (los paquetes nuevos no se usan aún, pero confirma que la instalación no rompió nada).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: agregar dnd-kit para drag and drop de tablas KPI"
```

---

## Task 2: Componente SortableRow

**Files:**
- Create: `frontend/src/components/SortableRow.jsx`

**Interfaces:**
- Consumes: `@dnd-kit/sortable` (`useSortable`), `@dnd-kit/utilities` (`CSS`).
- Produces: `export default function SortableRow({ id, children })` donde `children` es una función `(listeners) => JSX` que recibe los `listeners` de arrastre de dnd-kit para atarlos al ícono de handle. Renderiza un `<tr>`.

- [ ] **Step 1: Crear el componente**

```jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'rgba(59,130,246,0.08)' : undefined
  };
  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </tr>
  );
}
```

- [ ] **Step 2: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores (componente aún no tiene consumidores, pero el JSX/import debe ser válido).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SortableRow.jsx
git commit -m "feat: agregar componente SortableRow reutilizable"
```

---

## Task 3: Asignar _rowId estable en agruparKpiData

**Files:**
- Modify: `frontend/src/components/KpiCorporativosTab.jsx:44-56`

**Interfaces:**
- Produces: cada objeto de fila dentro de `kpiData.resumenAvisos.distribucion`, `kpiData.resumenOrdenes.distribucion`, `kpiData.trabajoPlanificado.grupos`, `kpiData.programaSemanal.grupos`, `kpiData.planMatriz.grupos` tiene un campo `_rowId` (string) estable, igual a su clave de agrupación.

- [ ] **Step 1: Modificar agruparArray**

Bloque actual (`KpiCorporativosTab.jsx:44-56`):

```js
    const agruparArray = (arr, propsNum, isCump = false) => {
      const mapa = {};
      arr.forEach(item => {
        let clave = agruparPorPto 
          ? `${item.proceso}||${item.ptoTrabajo}` 
          : `${item.proceso}||${item.grPlanif}||${item.grPlanifPM}`;
        if (!mapa[clave]) {
          mapa[clave] = { ...item };
          propsNum.forEach(p => mapa[clave][p] = 0);
        }
        propsNum.forEach(p => mapa[clave][p] += (Number(item[p]) || 0));
      });
      const res = Object.values(mapa);
```

Reemplazar por:

```js
    const agruparArray = (arr, propsNum, isCump = false) => {
      const mapa = {};
      arr.forEach(item => {
        let clave = agruparPorPto 
          ? `${item.proceso}||${item.ptoTrabajo}` 
          : `${item.proceso}||${item.grPlanif}||${item.grPlanifPM}`;
        if (!mapa[clave]) {
          mapa[clave] = { ...item, _rowId: clave };
          propsNum.forEach(p => mapa[clave][p] = 0);
        }
        propsNum.forEach(p => mapa[clave][p] += (Number(item[p]) || 0));
      });
      const res = Object.values(mapa);
```

(único cambio: `{ ...item }` → `{ ...item, _rowId: clave }`)

- [ ] **Step 2: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/KpiCorporativosTab.jsx
git commit -m "feat: asignar _rowId estable a filas agrupadas de KPI"
```

---

## Task 4: handleDragEnd genérico + imports + sensores

**Files:**
- Modify: `frontend/src/components/KpiCorporativosTab.jsx:1-5` (imports)
- Modify: `frontend/src/components/KpiCorporativosTab.jsx:549` (después de `handleTotalChange`, antes de `renderCumpPill`)

**Interfaces:**
- Consumes: `SortableRow` (Task 2), `kpiData`/`setKpiData` (estado existente del componente).
- Produces: `dndSensors` (objeto de sensores dnd-kit), `handleDragEnd(section, subKey, event)` — función que reordena `kpiData[section][subKey]` (donde `subKey` es `'distribucion'` o `'grupos'`) y llama `setKpiData`. Usada por las Tasks 5-7.

- [ ] **Step 1: Agregar imports**

Bloque actual (`KpiCorporativosTab.jsx:1-5`):

```js
import React, { useState, useEffect } from 'react';
import EmailPreview from './EmailPreview';
import SettingsModal from './SettingsModal';
import { createPortal } from 'react-dom';
import KpiDashboardCharts from './KpiDashboardCharts';
```

Reemplazar por:

```js
import React, { useState, useEffect } from 'react';
import EmailPreview from './EmailPreview';
import SettingsModal from './SettingsModal';
import { createPortal } from 'react-dom';
import KpiDashboardCharts from './KpiDashboardCharts';
import SortableRow from './SortableRow';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
```

- [ ] **Step 2: Agregar sensores y handleDragEnd**

Bloque actual (`KpiCorporativosTab.jsx:530-549`, termina con `handleTotalChange`):

```js
  const handleTotalChange = (section, field, value) => {
    const newData = JSON.parse(JSON.stringify(kpiData));
    if (section === 'resumenAvisos' || section === 'resumenOrdenes') {
      const val = Math.max(0, Number(value) || 0);
      newData[section].total = val;
      const indKey = section === 'resumenAvisos' ? 'avisosPendientes' : 'ordenesPendientes';
      newData.indicadores[indKey] = val;
    } else {
      if (field === 'cumplimiento') {
        const pctVal = Math.max(0, Number(value) || 0) / 100;
        newData[section].total.cumplimiento = pctVal;
        newData.indicadores[section] = Math.round(pctVal * 100);
      } else if (field === 'total') {
        newData[section].total.total = Math.max(0, Number(value) || 0);
      } else {
        newData[section].total[field] = Math.max(0, Number(value) || 0);
      }
    }
    setKpiData(newData);
  };
```

Agregar inmediatamente después (antes de `const renderCumpPill = ...`):

```js

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (section, subKey, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newData = JSON.parse(JSON.stringify(kpiData));
    const arr = newData[section][subKey];
    const oldIndex = arr.findIndex(g => g._rowId === active.id);
    const newIndex = arr.findIndex(g => g._rowId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    newData[section][subKey] = arrayMove(arr, oldIndex, newIndex);
    setKpiData(newData);
  };
```

- [ ] **Step 3: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores. `dndSensors`/`handleDragEnd` aún no se usan en el JSX (se conectan en las Tasks 5-7) — puede haber warning de variable no usada pero no error de build.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/KpiCorporativosTab.jsx
git commit -m "feat: agregar handleDragEnd generico y sensores dnd-kit"
```

---

## Task 5: Drag and drop en Avisos Pendientes y Órdenes Pendientes

**Files:**
- Modify: `frontend/src/components/KpiCorporativosTab.jsx:929-972`

**Interfaces:**
- Consumes: `SortableRow` (Task 2), `handleDragEnd`/`dndSensors` (Task 4), `_rowId` en cada fila (Task 3).

- [ ] **Step 1: Reemplazar tabla Avisos Pendientes**

Bloque actual (`KpiCorporativosTab.jsx:929-949`):

```jsx
                    {kpiData.resumenAvisos && (
                      <div className="table-subpanel">
                        <h3>Avisos Pendientes</h3>
                        <div className="responsive-table-wrapper">
                          <table className="premium-table">
                            <thead><tr><th>Proceso Mantenimiento</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cantidad</th></tr></thead>
                            <tbody>
                              {(kpiData.resumenAvisos.distribucion || []).map((g, idx) => (
                                <tr key={idx}>
                                  <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                  <td>{isEditing ? <input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajo : g.grPlanif) || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                  <td>{isEditing ? <input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM) || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                  <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center w-80" value={g.cantidad || 0} onChange={(e) => handleTableChange('resumenAvisos', idx, 'cantidad', e.target.value)} /> : Math.round(g.cantidad || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="footer-row"><td colSpan="3">TOTAL GENERAL</td><td className="text-center font-number font-bold">{isEditing ? <input type="number" className="cell-input text-center w-80 font-bold" value={kpiData.resumenAvisos.total || 0} onChange={(e) => handleTotalChange('resumenAvisos', 'total', e.target.value)} /> : Math.round(kpiData.resumenAvisos.total || 0)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}
```

Reemplazar por:

```jsx
                    {kpiData.resumenAvisos && (
                      <div className="table-subpanel">
                        <h3>Avisos Pendientes</h3>
                        <div className="responsive-table-wrapper">
                          <table className="premium-table">
                            <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso Mantenimiento</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cantidad</th></tr></thead>
                            {isEditing ? (
                              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('resumenAvisos', 'distribucion', e)}>
                                <SortableContext items={(kpiData.resumenAvisos.distribucion || []).map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                  <tbody>
                                    {(kpiData.resumenAvisos.distribucion || []).map((g, idx) => (
                                      <SortableRow key={g._rowId} id={g._rowId}>
                                        {(listeners) => (<>
                                          <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                          <td><input type="text" className="cell-input" value={g.proceso || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, 'proceso', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajo : g.grPlanif) || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM) || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                          <td className="text-center font-number"><input type="number" className="cell-input text-center w-80" value={g.cantidad || 0} onChange={(e) => handleTableChange('resumenAvisos', idx, 'cantidad', e.target.value)} /></td>
                                        </>)}
                                      </SortableRow>
                                    ))}
                                  </tbody>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <tbody>
                                {(kpiData.resumenAvisos.distribucion || []).map((g, idx) => (
                                  <tr key={g._rowId || idx}>
                                    <td>{g.proceso}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                    <td className="text-center font-number">{Math.round(g.cantidad || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            )}
                            <tfoot><tr className="footer-row"><td colSpan={isEditing ? 4 : 3}>TOTAL GENERAL</td><td className="text-center font-number font-bold">{isEditing ? <input type="number" className="cell-input text-center w-80 font-bold" value={kpiData.resumenAvisos.total || 0} onChange={(e) => handleTotalChange('resumenAvisos', 'total', e.target.value)} /> : Math.round(kpiData.resumenAvisos.total || 0)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}
```

- [ ] **Step 2: Reemplazar tabla Órdenes Pendientes**

Bloque actual (`KpiCorporativosTab.jsx:952-972`):

```jsx
                    {kpiData.resumenOrdenes && (
                      <div className="table-subpanel">
                        <h3>Órdenes Pendientes</h3>
                        <div className="responsive-table-wrapper">
                          <table className="premium-table">
                            <thead><tr><th>Proceso Mantenimiento</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cantidad</th></tr></thead>
                            <tbody>
                              {(kpiData.resumenOrdenes.distribucion || []).map((g, idx) => (
                                <tr key={idx}>
                                  <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                  <td>{isEditing ? <input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajo : g.grPlanif) || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                  <td>{isEditing ? <input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM) || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                  <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center w-80" value={g.cantidad || 0} onChange={(e) => handleTableChange('resumenOrdenes', idx, 'cantidad', e.target.value)} /> : Math.round(g.cantidad || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="footer-row"><td colSpan="3">TOTAL GENERAL</td><td className="text-center font-number font-bold">{isEditing ? <input type="number" className="cell-input text-center w-80 font-bold" value={kpiData.resumenOrdenes.total || 0} onChange={(e) => handleTotalChange('resumenOrdenes', 'total', e.target.value)} /> : Math.round(kpiData.resumenOrdenes.total || 0)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}
```

Reemplazar por:

```jsx
                    {kpiData.resumenOrdenes && (
                      <div className="table-subpanel">
                        <h3>Órdenes Pendientes</h3>
                        <div className="responsive-table-wrapper">
                          <table className="premium-table">
                            <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso Mantenimiento</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cantidad</th></tr></thead>
                            {isEditing ? (
                              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('resumenOrdenes', 'distribucion', e)}>
                                <SortableContext items={(kpiData.resumenOrdenes.distribucion || []).map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                  <tbody>
                                    {(kpiData.resumenOrdenes.distribucion || []).map((g, idx) => (
                                      <SortableRow key={g._rowId} id={g._rowId}>
                                        {(listeners) => (<>
                                          <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                          <td><input type="text" className="cell-input" value={g.proceso || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, 'proceso', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajo : g.grPlanif) || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM) || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                          <td className="text-center font-number"><input type="number" className="cell-input text-center w-80" value={g.cantidad || 0} onChange={(e) => handleTableChange('resumenOrdenes', idx, 'cantidad', e.target.value)} /></td>
                                        </>)}
                                      </SortableRow>
                                    ))}
                                  </tbody>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <tbody>
                                {(kpiData.resumenOrdenes.distribucion || []).map((g, idx) => (
                                  <tr key={g._rowId || idx}>
                                    <td>{g.proceso}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                    <td className="text-center font-number">{Math.round(g.cantidad || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            )}
                            <tfoot><tr className="footer-row"><td colSpan={isEditing ? 4 : 3}>TOTAL GENERAL</td><td className="text-center font-number font-bold">{isEditing ? <input type="number" className="cell-input text-center w-80 font-bold" value={kpiData.resumenOrdenes.total || 0} onChange={(e) => handleTotalChange('resumenOrdenes', 'total', e.target.value)} /> : Math.round(kpiData.resumenOrdenes.total || 0)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}
```

- [ ] **Step 3: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/KpiCorporativosTab.jsx
git commit -m "feat: drag and drop en tablas Avisos y Ordenes Pendientes"
```

---

## Task 6: Drag and drop en % Trabajo Planificado

**Files:**
- Modify: `frontend/src/components/KpiCorporativosTab.jsx:974-1008`

**Interfaces:**
- Consumes: igual que Task 5, sobre `kpiData.trabajoPlanificado.grupos`.

- [ ] **Step 1: Reemplazar tabla Trabajo Planificado**

Bloque actual (`KpiCorporativosTab.jsx:974-1008`):

```jsx
                    {/* Trabajo Planificado */}
                    <div className="table-subpanel">
                      <h3>% Trabajo Planificado (HH)</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr><th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-right">Planificado</th><th className="text-right">Sin HR</th><th className="text-right">Sin Hor.</th><th className="text-right">Imprevistos</th><th className="text-right">Total HH</th><th className="text-center">Cumplimiento</th></tr></thead>
                          <tbody>
                            {kpiData.trabajoPlanificado.grupos.map((g, idx) => (
                              <tr key={idx}>
                                <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('trabajoPlanificado', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('trabajoPlanificado', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.planificado} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'planificado', e.target.value)} /> : Math.round(g.planificado)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.sinHr} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'sinHr', e.target.value)} /> : Math.round(g.sinHr)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.sinHorizonte || 0} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'sinHorizonte', e.target.value)} /> : Math.round(g.sinHorizonte || 0)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.imprevistos} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'imprevistos', e.target.value)} /> : Math.round(g.imprevistos)}</td>
                                <td className="text-right font-number font-bold">{isEditing ? <input type="number" className="cell-input text-right" value={g.total} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'total', e.target.value)} /> : Math.round(g.total)}</td>
                                <td className="text-center">{isEditing ? <div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'cumplimiento', e.target.value)} /><span>%</span></div> : renderCumpPill(g.cumplimiento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="footer-row">
                              <td colSpan="3">TOTAL GENERAL</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.planificado)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.sinHr)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.sinHorizonte || 0)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.imprevistos)}</td>
                              <td className="text-right font-number font-bold">{Math.round(kpiData.trabajoPlanificado.total.total)}</td>
                              <td className="text-center">{renderCumpPill(kpiData.trabajoPlanificado.total.cumplimiento)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
```

Reemplazar por:

```jsx
                    {/* Trabajo Planificado */}
                    <div className="table-subpanel">
                      <h3>% Trabajo Planificado (HH)</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-right">Planificado</th><th className="text-right">Sin HR</th><th className="text-right">Sin Hor.</th><th className="text-right">Imprevistos</th><th className="text-right">Total HH</th><th className="text-center">Cumplimiento</th></tr></thead>
                          {isEditing ? (
                            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('trabajoPlanificado', 'grupos', e)}>
                              <SortableContext items={kpiData.trabajoPlanificado.grupos.map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                <tbody>
                                  {kpiData.trabajoPlanificado.grupos.map((g, idx) => (
                                    <SortableRow key={g._rowId} id={g._rowId}>
                                      {(listeners) => (<>
                                        <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                        <td><input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'proceso', e.target.value)} /></td>
                                        <td><input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('trabajoPlanificado', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                        <td><input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('trabajoPlanificado', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                        <td className="text-right font-number"><input type="number" className="cell-input text-right" value={g.planificado} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'planificado', e.target.value)} /></td>
                                        <td className="text-right font-number"><input type="number" className="cell-input text-right" value={g.sinHr} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'sinHr', e.target.value)} /></td>
                                        <td className="text-right font-number"><input type="number" className="cell-input text-right" value={g.sinHorizonte || 0} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'sinHorizonte', e.target.value)} /></td>
                                        <td className="text-right font-number"><input type="number" className="cell-input text-right" value={g.imprevistos} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'imprevistos', e.target.value)} /></td>
                                        <td className="text-right font-number font-bold"><input type="number" className="cell-input text-right" value={g.total} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'total', e.target.value)} /></td>
                                        <td className="text-center"><div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'cumplimiento', e.target.value)} /><span>%</span></div></td>
                                      </>)}
                                    </SortableRow>
                                  ))}
                                </tbody>
                              </SortableContext>
                            </DndContext>
                          ) : (
                            <tbody>
                              {kpiData.trabajoPlanificado.grupos.map((g, idx) => (
                                <tr key={g._rowId || idx}>
                                  <td>{g.proceso}</td>
                                  <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                  <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                  <td className="text-right font-number">{Math.round(g.planificado)}</td>
                                  <td className="text-right font-number">{Math.round(g.sinHr)}</td>
                                  <td className="text-right font-number">{Math.round(g.sinHorizonte || 0)}</td>
                                  <td className="text-right font-number">{Math.round(g.imprevistos)}</td>
                                  <td className="text-right font-number font-bold">{Math.round(g.total)}</td>
                                  <td className="text-center">{renderCumpPill(g.cumplimiento)}</td>
                                </tr>
                              ))}
                            </tbody>
                          )}
                          <tfoot>
                            <tr className="footer-row">
                              <td colSpan={isEditing ? 4 : 3}>TOTAL GENERAL</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.planificado)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.sinHr)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.sinHorizonte || 0)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.imprevistos)}</td>
                              <td className="text-right font-number font-bold">{Math.round(kpiData.trabajoPlanificado.total.total)}</td>
                              <td className="text-center">{renderCumpPill(kpiData.trabajoPlanificado.total.cumplimiento)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
```

- [ ] **Step 2: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/KpiCorporativosTab.jsx
git commit -m "feat: drag and drop en tabla Trabajo Planificado"
```

---

## Task 7: Drag and drop en Programa Semanal y Plan Matriz

**Files:**
- Modify: `frontend/src/components/KpiCorporativosTab.jsx:1010-1057`

**Interfaces:**
- Consumes: igual que Task 5/6, sobre `kpiData.programaSemanal.grupos` y `kpiData.planMatriz.grupos`.

- [ ] **Step 1: Reemplazar tabla Programa Semanal**

Bloque actual (`KpiCorporativosTab.jsx:1010-1032`):

```jsx
                    {/* Programa Semanal */}
                    <div className="table-subpanel">
                      <h3>Programa Semanal</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr><th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total Ops</th><th className="text-center">Cumplimiento</th></tr></thead>
                          <tbody>
                            {kpiData.programaSemanal.grupos.map((g, idx) => (
                              <tr key={idx}>
                                <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('programaSemanal', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('programaSemanal', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('programaSemanal', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.cumple} onChange={(e) => handleTableChange('programaSemanal', idx, 'cumple', e.target.value)} /> : Math.round(g.cumple)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.noCumple} onChange={(e) => handleTableChange('programaSemanal', idx, 'noCumple', e.target.value)} /> : Math.round(g.noCumple)}</td>
                                <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                <td className="text-center">{isEditing ? <div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('programaSemanal', idx, 'cumplimiento', e.target.value)} /><span>%</span></div> : renderCumpPill(g.cumplimiento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="footer-row"><td colSpan="3">TOTAL</td><td className="text-center font-number">{Math.round(kpiData.programaSemanal.total.cumple)}</td><td className="text-center font-number">{Math.round(kpiData.programaSemanal.total.noCumple)}</td><td className="text-center font-number font-bold">{Math.round(kpiData.programaSemanal.total.total)}</td><td className="text-center">{renderCumpPill(kpiData.programaSemanal.total.cumplimiento)}</td></tr></tfoot>
                        </table>
                      </div>
                    </div>
```

Reemplazar por:

```jsx
                    {/* Programa Semanal */}
                    <div className="table-subpanel">
                      <h3>Programa Semanal</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total Ops</th><th className="text-center">Cumplimiento</th></tr></thead>
                          {isEditing ? (
                            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('programaSemanal', 'grupos', e)}>
                              <SortableContext items={kpiData.programaSemanal.grupos.map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                <tbody>
                                  {kpiData.programaSemanal.grupos.map((g, idx) => (
                                    <SortableRow key={g._rowId} id={g._rowId}>
                                      {(listeners) => (<>
                                        <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                        <td><input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('programaSemanal', idx, 'proceso', e.target.value)} /></td>
                                        <td><input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('programaSemanal', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                        <td><input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('programaSemanal', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                        <td className="text-center font-number"><input type="number" className="cell-input text-center" value={g.cumple} onChange={(e) => handleTableChange('programaSemanal', idx, 'cumple', e.target.value)} /></td>
                                        <td className="text-center font-number"><input type="number" className="cell-input text-center" value={g.noCumple} onChange={(e) => handleTableChange('programaSemanal', idx, 'noCumple', e.target.value)} /></td>
                                        <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                        <td className="text-center"><div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('programaSemanal', idx, 'cumplimiento', e.target.value)} /><span>%</span></div></td>
                                      </>)}
                                    </SortableRow>
                                  ))}
                                </tbody>
                              </SortableContext>
                            </DndContext>
                          ) : (
                            <tbody>
                              {kpiData.programaSemanal.grupos.map((g, idx) => (
                                <tr key={g._rowId || idx}>
                                  <td>{g.proceso}</td>
                                  <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                  <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                  <td className="text-center font-number">{Math.round(g.cumple)}</td>
                                  <td className="text-center font-number">{Math.round(g.noCumple)}</td>
                                  <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                  <td className="text-center">{renderCumpPill(g.cumplimiento)}</td>
                                </tr>
                              ))}
                            </tbody>
                          )}
                          <tfoot><tr className="footer-row"><td colSpan={isEditing ? 4 : 3}>TOTAL</td><td className="text-center font-number">{Math.round(kpiData.programaSemanal.total.cumple)}</td><td className="text-center font-number">{Math.round(kpiData.programaSemanal.total.noCumple)}</td><td className="text-center font-number font-bold">{Math.round(kpiData.programaSemanal.total.total)}</td><td className="text-center">{renderCumpPill(kpiData.programaSemanal.total.cumplimiento)}</td></tr></tfoot>
                        </table>
                      </div>
                    </div>
```

- [ ] **Step 2: Reemplazar tabla Plan Matriz**

Bloque actual (`KpiCorporativosTab.jsx:1034-1057`):

```jsx
                    {/* Plan Matriz */}
                    <div className="table-subpanel">
                      <h3>Plan Matriz</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr><th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total Ops</th><th className="text-center">Cumplimiento</th></tr></thead>
                          <tbody>
                            {kpiData.planMatriz.grupos.map((g, idx) => (
                              <tr key={idx}>
                                <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('planMatriz', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('planMatriz', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('planMatriz', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.cumple} onChange={(e) => handleTableChange('planMatriz', idx, 'cumple', e.target.value)} /> : Math.round(g.cumple)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.noCumple} onChange={(e) => handleTableChange('planMatriz', idx, 'noCumple', e.target.value)} /> : Math.round(g.noCumple)}</td>
                                <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                <td className="text-center">{isEditing ? <div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('planMatriz', idx, 'cumplimiento', e.target.value)} /><span>%</span></div> : renderCumpPill(g.cumplimiento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="footer-row"><td colSpan="3">TOTAL</td><td className="text-center font-number">{Math.round(kpiData.planMatriz.total.cumple)}</td><td className="text-center font-number">{Math.round(kpiData.planMatriz.total.noCumple)}</td><td className="text-center font-number font-bold">{Math.round(kpiData.planMatriz.total.total)}</td><td className="text-center">{renderCumpPill(kpiData.planMatriz.total.cumplimiento)}</td></tr></tfoot>
                        </table>
                      </div>

                    </div>
```

Reemplazar por:

```jsx
                    {/* Plan Matriz */}
                    <div className="table-subpanel">
                      <h3>Plan Matriz</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total Ops</th><th className="text-center">Cumplimiento</th></tr></thead>
                          {isEditing ? (
                            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('planMatriz', 'grupos', e)}>
                              <SortableContext items={kpiData.planMatriz.grupos.map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                <tbody>
                                  {kpiData.planMatriz.grupos.map((g, idx) => (
                                    <SortableRow key={g._rowId} id={g._rowId}>
                                      {(listeners) => (<>
                                        <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                        <td><input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('planMatriz', idx, 'proceso', e.target.value)} /></td>
                                        <td><input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('planMatriz', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                        <td><input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('planMatriz', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                        <td className="text-center font-number"><input type="number" className="cell-input text-center" value={g.cumple} onChange={(e) => handleTableChange('planMatriz', idx, 'cumple', e.target.value)} /></td>
                                        <td className="text-center font-number"><input type="number" className="cell-input text-center" value={g.noCumple} onChange={(e) => handleTableChange('planMatriz', idx, 'noCumple', e.target.value)} /></td>
                                        <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                        <td className="text-center"><div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('planMatriz', idx, 'cumplimiento', e.target.value)} /><span>%</span></div></td>
                                      </>)}
                                    </SortableRow>
                                  ))}
                                </tbody>
                              </SortableContext>
                            </DndContext>
                          ) : (
                            <tbody>
                              {kpiData.planMatriz.grupos.map((g, idx) => (
                                <tr key={g._rowId || idx}>
                                  <td>{g.proceso}</td>
                                  <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                  <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                  <td className="text-center font-number">{Math.round(g.cumple)}</td>
                                  <td className="text-center font-number">{Math.round(g.noCumple)}</td>
                                  <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                  <td className="text-center">{renderCumpPill(g.cumplimiento)}</td>
                                </tr>
                              ))}
                            </tbody>
                          )}
                          <tfoot><tr className="footer-row"><td colSpan={isEditing ? 4 : 3}>TOTAL</td><td className="text-center font-number">{Math.round(kpiData.planMatriz.total.cumple)}</td><td className="text-center font-number">{Math.round(kpiData.planMatriz.total.noCumple)}</td><td className="text-center font-number font-bold">{Math.round(kpiData.planMatriz.total.total)}</td><td className="text-center">{renderCumpPill(kpiData.planMatriz.total.cumplimiento)}</td></tr></tfoot>
                        </table>
                      </div>

                    </div>
```

- [ ] **Step 3: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/KpiCorporativosTab.jsx
git commit -m "feat: drag and drop en tablas Programa Semanal y Plan Matriz"
```

---

## Task 8: Estilos CSS del handle de arrastre

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: clases `.drag-handle-col`, `.drag-handle-cell` usadas por las Tasks 5-7.

- [ ] **Step 1: Agregar reglas CSS**

Al final de `frontend/src/index.css`, agregar:

```css

.drag-handle-col {
  width: 32px;
}

.drag-handle-cell {
  width: 32px;
  text-align: center;
  cursor: grab;
  color: var(--text-muted);
  touch-action: none;
}

.drag-handle-cell:active {
  cursor: grabbing;
}
```

- [ ] **Step 2: Verificar build**

Run (desde `frontend/`): `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: estilos para columna de arrastre en tablas KPI"
```

---

## Task 9: Verificación manual end-to-end

**Files:** ninguno (solo verificación).

**Interfaces:** ninguna nueva — valida el comportamiento producido por las Tasks 1-8.

- [ ] **Step 1: Levantar backend**

Desde la raíz del repo: `python main.py`
Expected: servidor Flask arriba (puerto según config del proyecto).

- [ ] **Step 2: Levantar frontend**

Desde `frontend/`: `npm run dev`
Expected: Vite dev server arriba, URL local mostrada en consola.

- [ ] **Step 3: Cargar datos de KPI**

En el navegador, ir a la pestaña "KPI Corporativos", procesar o cargar un informe existente (semana con datos reales o de prueba) hasta que las 5 tablas muestren filas.

- [ ] **Step 4: Activar modo edición y arrastrar**

Click en "Modificar Valores". Verificar que aparece una columna con ícono `drag_indicator` a la izquierda en cada una de las 5 tablas. Arrastrar la fila 3 de "Avisos Pendientes" a la posición 1. Confirmar visualmente que la fila cambió de posición y el resto se reacomodó.

Repetir el arrastre en las otras 4 tablas (Órdenes Pendientes, % Trabajo Planificado, Programa Semanal, Plan Matriz).

Expected: en las 5 tablas el orden de filas cambia según el arrastre, sin errores en consola del navegador.

- [ ] **Step 5: Verificar que edición de valores sigue funcionando**

Con una fila ya reordenada, editar un valor numérico de celda (ej. "Cantidad" en Avisos Pendientes). Confirmar que el valor editado corresponde a la fila correcta (la que está visualmente en esa posición tras el arrastre), y que el total del pie de tabla se recalcula.

- [ ] **Step 6: Verificar previsualización**

Click en "Guardar Cambios" (sale de modo edición) y navegar a la sub-pestaña de previsualización de correo (`EmailPreview`). Confirmar que el orden de filas en el `<iframe>` de previsualización coincide con el orden reordenado en el paso 4.

- [ ] **Step 7: Verificar correo real**

Enviar un correo de prueba (botón de prueba, a la propia cuenta del usuario). Abrir el correo recibido y confirmar que el orden de filas en las 5 tablas coincide con el reordenado.

- [ ] **Step 8: Verificar modo lectura sin cambios**

Con `isEditing` desactivado, confirmar que las tablas no muestran columna de arrastre ni permiten iniciar un drag (comportamiento idéntico al existente antes de este cambio).

- [ ] **Step 9: Verificar reset al reprocesar**

Reprocesar KPIs (o cambiar el toggle "Agrupar por Puesto de Trabajo") y confirmar que el orden vuelve al original (alfabético) — comportamiento esperado según el spec.

- [ ] **Step 10: Commit final (si hubo ajustes)**

Si algún paso de verificación requirió un ajuste de código, commitear con mensaje descriptivo del fix puntual. Si todo pasó sin cambios, no hay commit adicional en esta tarea.
