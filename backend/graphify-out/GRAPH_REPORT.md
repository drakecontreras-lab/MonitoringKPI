# Graph Report - backend  (2026-07-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 442 nodes · 743 edges · 31 communities (23 shown, 8 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7dcbdafc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `IW29Handler` - 37 edges
2. `SAPNavigator` - 37 edges
3. `procesar_planificacion()` - 26 edges
4. `AppState` - 24 edges
5. `ProyAutoModule` - 24 edges
6. `BaseModule` - 16 edges
7. `LoginManager` - 16 edges
8. `KpiAutoModule` - 15 edges
9. `BrowserManager` - 15 edges
10. `read_raw_sap_file()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `AppState` --uses--> `EntraIDAuth`  [INFERRED]
  main.py → auth_ms.py
- `NativeApi` --uses--> `EntraIDAuth`  [INFERRED]
  main.py → auth_ms.py
- `AppState` --uses--> `IW29Module`  [INFERRED]
  main.py → modules/iw29_module.py
- `AppState` --uses--> `KpiAutoModule`  [INFERRED]
  main.py → modules/kpi_auto_module.py
- `AppState` --uses--> `PowerBIModule`  [INFERRED]
  main.py → modules/powerbi_module.py

## Import Cycles
- None detected.

## Communities (31 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (61): DataFrame, date, agregar_columna_areas(), agregar_columna_porcentaje_com(), agregar_horizonte_criterio(), aplicar_formato_encabezado(), aplicar_formato_estado_columnaA(), aplicar_formato_pivot() (+53 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (61): api_process_ready_excel(), aplicar_formato_tabla_openpyxl(), clean_cumplimiento_val(), clean_pto_trabajo(), extract_avisos(), extract_ordenes(), extract_plan_matriz(), extract_programa_semanal() (+53 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (22): Any, callable, Inicia la ejecución asíncrona de la descarga de avisos.         Propósito: Ejecu, KpiAutoModule, Módulo KPIs Corporativos. HUD propio separado de Proyecciones., Ejecuta la descarga batch de OTs (IW39) y Órdenes (IW37N)., Inicia la ejecución del módulo de captura de Power BI.         Propósito: Orques, BrowserManager (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (14): api_powerbi_capture(), api_powerbi_latest(), api_preview_file(), api_proy_avisos_p1(), get_db_tables(), get_default_dates(), Retorna la definición de las tablas para el CRUD., Sirve los archivos estáticos compilados de la SPA de React. (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (25): Client, api_save_kpi_report(), api_send_report(), Guarda el reporte KPI en Supabase sin enviar correo., format_value(), generate_kpi_email_template(), generate_template_6(), get_codelco_badge_prog_matriz() (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (11): BaseModule, Inicializa el módulo modular independiente.         Propósito: Configurar el ID, Envía un mensaje de registro al frontend en tiempo real.         Propósito: Perm, Envía el porcentaje de progreso de la tarea (0.0 a 1.0) al frontend.         Pro, Envía un fotograma en Base64 para actualizar el visor del navegador en tiempo re, Método abstracto de ejecución principal del módulo.         Propósito: Debe ser, Verifica el estado de pausa y detiene la ejecución del módulo hasta que se reanu, Clase Base Abstracta para todos los módulos de automatización de la suite.     D (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (6): IW29Handler, Page, Gestiona la transacción IW29 de SAP PM., Prepara el contexto del iFrame de SAP., ProyeccionOtsStHandler, Maneja la exportación robusta desde la pantalla de resultados.

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (3): api_enviar_mfa(), AppState, post_config()

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (8): ProyeccionOtsHandler, Page, Usa la barra de búsqueda del launchpad Fiori para buscar una app/transacción., Hace clic en un tile/mosaico del launchpad Fiori por nombre., Detecta si hay un iframe de SAPGUI Web/HTML5 embebido., Navega al launchpad de SAP Fiori., Espera a que el launchpad de Fiori esté listo., SAPNavigator

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (8): Page, Inicializa las credenciales y el contexto de página.         Propósito: Configur, Proporciona métodos reutilizables para navegar por SAP Fiori y sus transacciones, Inicializa el navegador con la página y URL.         Propósito: Guardar la refer, Navega directamente a la URL de Fiori que inicializa una transacción GUI., Detecta y presiona botones de popups informativos o de advertencia de SAP., Busca y retorna el iframe donde corre el SAP GUI HTML5.         Propósito: Traba, SAPNavigator

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (8): EntraIDAuth, _make_msal_http_client(), Elimina las cuentas del caché del cliente de MSAL.         Propósito: Cerrar la, Clase para interactuar con la Autenticación de Microsoft Entra ID.     Utiliza, Inicializa la instancia de MSAL PublicClientApplication.         Propósito: Con, Intenta obtener el usuario autenticado de la sesión cacheada silenciosamente., Crea una sesión HTTP con timeout corto para MSAL.     Evita que la inicializaci, Realiza el login interactivo abriendo el navegador.         Propósito: Obtener

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (3): ProyAutoModule, Módulo Proyecciones. HUD propio separado de KPIs Corporativos., ProyeccionOtsDieaHandler

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (3): iw29_handler.py - Automatización de la transacción IW29 (Notificaciones PM), ProyeccionOtsHandler, sap_navigator.py - Navegación dentro de SAP Fiori / GUI SAP

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (7): api_proy_send_report(), Envía reporte de proyecciones por correo., generate_proy_email_template(), Email sender específico para reportes de Proyecciones. Separado de kpi_email_sen, Envía el reporte de proyecciones por correo SMTP., Genera HTML del reporte de proyecciones., send_proy_report_email()

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (6): main(), NativeApi, Función de entrada principal de la aplicación.     Levanta el servidor Flask en, PowerBIModule, Módulo para realizar captura de pantalla de un informe de Power BI.     Propósit, Inicializa el módulo con el ID 'powerbi'.         Propósito: Configurar el ident

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (5): ProyMacroModule, Inicializa el módulo con el ID 'proy_macro'., Inicia la ejecución del módulo de planificación según el modo solicitado., Ejecuta la macro de consolidación y procesamiento de Excel en segundo plano., Módulo para consolidar los reportes de planificación (Macros de Excel).     Oper

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (5): api_detener_modulo(), api_pausar_modulo(), api_process_kpis(), do_logout(), Registra un mensaje de log en el HUD en memoria e intenta imprimirlo de forma se

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (3): Obtiene el frame interno del SAP GUI Web si existe., Abre una transacción SAP GUI directamente vía URL de Fiori., Busca y cierra popups comunes de SAP con reintentos optimizados.

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (3): api_proy_generate_excel(), Genera Excel consolidado de proyecciones., PostProcesador

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): IW29Module, Módulo para automatizar la extracción de Avisos Pendientes en la transacción SAP, Inicializa el módulo con el ID 'iw29'.         Propósito: Configurar el identifi

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ProyAutoModule` connect `Community 11` to `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 12`, `Community 14`, `Community 17`, `Community 18`, `Community 20`, `Community 22`, `Community 23`, `Community 24`?**
  _High betweenness centrality (0.318) - this node is a cross-community bridge._
- **Why does `PostProcesador` connect `Community 20` to `Community 0`, `Community 7`, `Community 11`, `Community 14`, `Community 15`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `AppState` connect `Community 7` to `Community 2`, `Community 3`, `Community 10`, `Community 11`, `Community 14`, `Community 15`, `Community 16`, `Community 20`, `Community 21`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `IW29Handler` (e.g. with `ProyeccionAvisosDieaHandler` and `ProyeccionAvisosHandler`) actually correct?**
  _`IW29Handler` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `SAPNavigator` (e.g. with `ProyeccionAvisosDieaHandler` and `ProyeccionAvisosHandler`) actually correct?**
  _`SAPNavigator` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `AppState` (e.g. with `EntraIDAuth` and `IW29Module`) actually correct?**
  _`AppState` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `ProyAutoModule` (e.g. with `AppState` and `.__init__()`) actually correct?**
  _`ProyAutoModule` has 16 INFERRED edges - model-reasoned connections that need verification._