# Plan de Implementación: Corrección de Carga de Órdenes (IW39) y Sincronización

Ya revisé todo el flujo desde que subes el Excel hasta que termina la automatización, y encontré la verdadera raíz del problema. Tienes toda la razón, sigue fallando, y aquí está el porqué:

1. **Problema con la Carga de Órdenes en la Automatización**: Cuando subes el Excel de Trabajo Planificado, la librería que lee el archivo (`pandas`) detecta la columna de "Orden" como un número y le añade el sufijo `.0` (ej: `123456` se convierte en `123456.0`). Al intentar subir esta lista al portapapeles en SAP, el script verifica si el valor es un dígito válido (usando `.isdigit()`), lo cual falla porque `.0` no es considerado un dígito. Como resultado, **lee 0 órdenes** y la automatización procede sin el filtro.
2. **Problema con la Sincronización de Grupo de Planificación**: En el consolidador, al intentar unir las órdenes extraídas de SAP IW39 con las del Excel Trabajo Planificado, ocurre exactamente el mismo problema. Al comparar `'123456.0'` con `'123456'`, la comparación falla y la sincronización no enlaza los datos, dejando los grupos de planificación vacíos o como "N/A".

## Proposed Changes

### [backend/utils/proyeccion_ots_handler.py]
- **Limpieza de ".0"**: En la función `_leer_ordenes_de_excel`, añadiré un parche lógico para detectar si el número de la orden termina en `.0` y eliminárselo antes de validarlo.
- Además, aumentaré el rango de búsqueda dinámica de encabezados en el Excel a 4 filas, por si los encabezados de tu Excel bajan más de la fila 1.
#### [MODIFY] [proyeccion_ots_handler.py](file:///c:/Users/drake/OneDrive%20-%20Monitoring%20SPA/Apps/Monitoring%20KPI%202/backend/utils/proyeccion_ots_handler.py)

### [backend/main.py]
- **Limpieza de ".0" en ots_mapping**: En el proceso que construye el diccionario `ots_mapping` tras descargar el Proy_ots de SAP, limpiaré cualquier terminación en `.0` para asegurar que las órdenes tengan una llave numérica exacta.
#### [MODIFY] [main.py](file:///c:/Users/drake/OneDrive%20-%20Monitoring%20SPA/Apps/Monitoring%20KPI%202/backend/main.py)

### [backend/utils/kpi_excel_processor.py]
- **Limpieza de ".0" en Trabajo Planificado**: Modificar `extract_trabajo_planificado` para quitar los sufijos `.0` antes de hacer la búsqueda en `ots_mapping` y `sap_ots_df`.
#### [MODIFY] [kpi_excel_processor.py](file:///c:/Users/drake/OneDrive%20-%20Monitoring%20SPA/Apps/Monitoring%20KPI%202/backend/utils/kpi_excel_processor.py)

## Verification Plan
1. Haré estos cambios y probaré el sistema compilando nuevamente.
2. Al ejecutar, las órdenes se parsearán siempre como enteros perfectos, por lo que la automatización logrará subir la lista a SAP y la sincronización será 100% precisa.