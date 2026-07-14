import asyncio
import base64
import json
import os
import sys
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory # Se removió  por no estar definida ni en uso en Flask.
from werkzeug.utils import secure_filename
from flask_cors import CORS
import webview

# Agregar el directorio raíz del proyecto al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Solucionar error de Playwright/asyncio en PyInstaller --windowed (WinError 6: Handle is invalid)
if sys.platform == "win32":
    if sys.stdout is None:
        sys.stdout = open(r'error.log', "w")
    if sys.stderr is None:
        sys.stderr = open(r'error.log', "w")
    if sys.stdin is None:
        sys.stdin = open(r'error.log', "r")

# (Hack de PLAYWRIGHT_BROWSERS_PATH para PyInstaller)
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"

from backend.auth_ms import EntraIDAuth
from backend.modules.iw29_module import IW29Module
from backend.modules.proy_module import ProyMacroModule
from backend.modules.proy_auto_module import ProyAutoModule
from backend.modules.powerbi_module import PowerBIModule
from backend.modules.kpi_auto_module import KpiAutoModule
from backend.utils.kpi_excel_processor import process_kpi_excels, process_ready_excel, preview_file
from backend.utils.kpi_email_sender import send_kpi_report_email
from backend.utils.supabase_client import supabase, set_log_fn

if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
else:
    bundle_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Inicializar Flask
app = Flask(__name__, static_folder=os.path.join(bundle_dir, "frontend", "dist"))
CORS(app)

if getattr(sys, 'frozen', False):
    # App is frozen (compiled)
    appdata_dir = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), "MonitoringKPIsCorporativos")
    os.makedirs(appdata_dir, exist_ok=True)
    CONFIG_PATH = os.path.join(appdata_dir, "config.json")
    OUTPUT_DIR = os.path.join(appdata_dir, "output")
    os.environ["_MONITORING_OUTPUT_DIR"] = OUTPUT_DIR
    # Si no existe config.json en AppData, copiar el default del bundle
    if not os.path.exists(CONFIG_PATH):
        bundled_config = os.path.join(bundle_dir, "config.json")
        if os.path.exists(bundled_config):
            import shutil
            try:
                shutil.copy2(bundled_config, CONFIG_PATH)
            except Exception as e:
                print(f"[startup] Error al copiar config por defecto: {e}")
else:
    CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")
    OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.environ["_MONITORING_OUTPUT_DIR"] = OUTPUT_DIR

# Estado global HUD y automatizaciones (compartido por módulos)
class AppState:
    def __init__(self):
        self.config_data = self._cargar_config()
        
        # Inicializar MSAL Auth
        auth_cfg = self.config_data.get("auth_entra", {})
        self.auth = EntraIDAuth(
            client_id=auth_cfg.get("client_id", ""),
            tenant_id=auth_cfg.get("tenant_id", ""),
            authority=auth_cfg.get("authority", ""),
            redirect_uri=auth_cfg.get("redirect_uri", "http://localhost:5000"),
            scopes=auth_cfg.get("scopes", ["User.Read"])
        )
        
        # Loop asíncrono permanente en hilo secundario para Playwright
        self.loop = asyncio.new_event_loop()
        self.loop_thread = threading.Thread(target=self._run_asyncio_loop, daemon=True)
        self.loop_thread.start()
        
        # Registros de módulos SAP y Power BI
        self.modulos = {
            "iw29": IW29Module(self),
            "proy_macro": ProyMacroModule(self),
            "proy_auto": ProyAutoModule(self),
            "powerbi": PowerBIModule(self),
            "kpi_auto": KpiAutoModule(self)
        }
        
        # Estado HUD separado por módulo (KPIs vs Proyecciones)
        self.hud_kpi = {"logs": [], "progreso": 0.0, "texto": "Inactivo", "visor": "", "solicitar_mfa": False}
        self.hud_proy = {"logs": [], "progreso": 0.0, "texto": "Inactivo", "visor": "", "solicitar_mfa": False}
        
        # Backwards-compat: HUD consolidado (para powerbi/iw29)
        self.logs_hud = []
        self.progreso_modulo = 0.0
        self.progreso_texto = "Inactivo"
        self.visor_base64 = ""
        self.solicitar_mfa_flag = False
        
        self.mfa_code = None
        self.mfa_event = asyncio.Event()
        # MFA separados por contexto
        self.mfa_code_kpi = None
        self.mfa_event_kpi = asyncio.Event()
        self.mfa_code_proy = None
        self.mfa_event_proy = asyncio.Event()

    def _run_asyncio_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def _cargar_config(self):
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def guardar_config(self):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(self.config_data, f, indent=4, ensure_ascii=False)

    # Métodos Bridge adaptados para heredar iw29_module y proy_module de Monitoring Suite sin cambiarlos
    def emit_log(self, modulo_id, mensaje, nivel="info"):
        """
        Registra un mensaje de log en el HUD en memoria e intenta imprimirlo de forma segura en la consola de Windows.
        """
        log_entry = {"time": datetime.now().strftime("%H:%M:%S"), "text": mensaje, "level": nivel}
        self.logs_hud.append(log_entry)
        # Limitar logs en memoria
        if len(self.logs_hud) > 100:
            self.logs_hud.pop(0)
        try:
            print(f"[{modulo_id.upper()}] [{nivel.upper()}] {mensaje}")
        except UnicodeEncodeError:
            # Reemplazar emojis no soportados por el charmap de la consola en Windows
            mensaje_seguro = mensaje.encode('ascii', errors='replace').decode('ascii')
            print(f"[{modulo_id.upper()}] [{nivel.upper()}] {mensaje_seguro}")

    def emit_progress(self, modulo_id, valor):
        self.progreso_modulo = valor
        if valor >= 1.0: self.progreso_texto = "Completado"
        elif valor <= 0.0: self.progreso_texto = "Error"
        else: self.progreso_texto = "Procesando"

    def emit_visor(self, modulo_id, base64_img):
        self.visor_base64 = base64_img

    def emit_solicitar_mfa(self):
        self.solicitar_mfa_flag = True
        self.emit_log("auth", "🔑 MFA Requerido. Por favor ingrese el código OTP en la interfaz.", "warn")

    # ─── HUD específico KPIs ───
    def emit_log_kpi(self, mensaje, nivel="info"):
        log_entry = {"time": datetime.now().strftime("%H:%M:%S"), "text": mensaje, "level": nivel}
        self.hud_kpi["logs"].append(log_entry)
        if len(self.hud_kpi["logs"]) > 100: self.hud_kpi["logs"].pop(0)
        try: print(f"[KPI] [{nivel.upper()}] {mensaje}")
        except UnicodeEncodeError:
            print(f"[KPI] [{nivel.upper()}] {mensaje.encode('ascii', errors='replace').decode('ascii')}")

    def emit_progress_kpi(self, valor):
        self.hud_kpi["progreso"] = valor
        if valor >= 1.0: self.hud_kpi["texto"] = "Completado"
        elif valor <= 0.0: self.hud_kpi["texto"] = "Error"
        else: self.hud_kpi["texto"] = "Procesando"

    def emit_visor_kpi(self, base64_img):
        self.hud_kpi["visor"] = base64_img

    def emit_solicitar_mfa_kpi(self):
        self.hud_kpi["solicitar_mfa"] = True
        self.emit_log_kpi("🔑 MFA Requerido para KPIs. Ingrese código OTP.", "warn")

    # ─── HUD específico Proyecciones ───
    def emit_log_proy(self, mensaje, nivel="info"):
        log_entry = {"time": datetime.now().strftime("%H:%M:%S"), "text": mensaje, "level": nivel}
        self.hud_proy["logs"].append(log_entry)
        if len(self.hud_proy["logs"]) > 100: self.hud_proy["logs"].pop(0)
        try: print(f"[PROY] [{nivel.upper()}] {mensaje}")
        except UnicodeEncodeError:
            print(f"[PROY] [{nivel.upper()}] {mensaje.encode('ascii', errors='replace').decode('ascii')}")

    def emit_progress_proy(self, valor):
        self.hud_proy["progreso"] = valor
        if valor >= 1.0: self.hud_proy["texto"] = "Completado"
        elif valor <= 0.0: self.hud_proy["texto"] = "Error"
        else: self.hud_proy["texto"] = "Procesando"

    def emit_visor_proy(self, base64_img):
        self.hud_proy["visor"] = base64_img

    def emit_solicitar_mfa_proy(self):
        self.hud_proy["solicitar_mfa"] = True
        self.emit_log_proy("🔑 MFA Requerido para Proyecciones. Ingrese código OTP.", "warn")

# Instanciar estado
state = AppState()

# Inyectar sistema de logs en supabase_client
set_log_fn(state.emit_log)

# =============================================================================
# API ENDPOINTS DE DASHBOARD Y MÉTRICAS
# =============================================================================

@app.route('/api/db/tables', methods=['GET'])
def get_db_tables():
    """Retorna la definición de las tablas para el CRUD."""
    tables_meta = {
        "divisiones": {
            "name": "Divisiones",
            "columns": [{"key": "nombre", "label": "Nombre", "type": "text", "required": True}]
        },
        "gerencias": {
            "name": "Gerencias",
            "columns": [
                {"key": "nombre", "label": "Nombre", "type": "text", "required": True},
                {"key": "division_id", "label": "ID División", "type": "text", "required": True}
            ]
        },
        "areas": {
            "name": "Áreas (Superintendencias)",
            "columns": [
                {"key": "nombre", "label": "Nombre", "type": "text", "required": True},
                {"key": "gerencia_id", "label": "ID Gerencia", "type": "text", "required": True}
            ]
        },
        "procesos": {
            "name": "Procesos",
            "columns": [
                {"key": "nombre", "label": "Nombre", "type": "text", "required": True},
                {"key": "area_id", "label": "ID Área", "type": "text", "required": True}
            ]
        }
    }
    return jsonify({"success": True, "tables": tables_meta})

ALLOWED_CRUD_TABLES = {"divisiones", "gerencias", "areas", "procesos"}

@app.route('/api/db/tables/<table_name>', methods=['GET'])
def get_table_rows(table_name):
    if not supabase:
        return jsonify({"success": False, "error": "Supabase no configurado"}), 500
    if table_name not in ALLOWED_CRUD_TABLES:
        return jsonify({"success": False, "error": "Tabla no permitida"}), 400
    try:
        res = supabase.table(table_name).select("*").order("created_at", desc=True).execute()
        return jsonify({"success": True, "rows": res.data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/db/tables/<table_name>', methods=['POST'])
def create_table_row(table_name):
    if not supabase: return jsonify({"success": False, "error": "No Supabase"}), 500
    if table_name not in ALLOWED_CRUD_TABLES:
        return jsonify({"success": False, "error": "Tabla no permitida"}), 400
    data = request.json
    try:
        # Excluir el campo id si viene vacío
        if "id" in data and not data["id"]: del data["id"]
        res = supabase.table(table_name).insert(data).execute()
        return jsonify({"success": True, "data": res.data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/db/tables/<table_name>/<row_id>', methods=['PUT'])
def update_table_row(table_name, row_id):
    if not supabase: return jsonify({"success": False, "error": "No Supabase"}), 500
    if table_name not in ALLOWED_CRUD_TABLES:
        return jsonify({"success": False, "error": "Tabla no permitida"}), 400
    data = request.json
    try:
        if "id" in data: del data["id"]
        if "created_at" in data: del data["created_at"]
        res = supabase.table(table_name).update(data).eq("id", row_id).execute()
        return jsonify({"success": True, "data": res.data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/db/tables/<table_name>/<row_id>', methods=['DELETE'])
def delete_table_row(table_name, row_id):
    if not supabase: return jsonify({"success": False, "error": "No Supabase"}), 500
    if table_name not in ALLOWED_CRUD_TABLES:
        return jsonify({"success": False, "error": "Tabla no permitida"}), 400
    try:
        res = supabase.table(table_name).delete().eq("id", row_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    """
    Sirve los archivos estáticos compilados de la SPA de React.
    """
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # SPA routing: redirigir a index.html
        return send_from_directory(app.static_folder, "index.html")

@app.route("/reports/<path:filename>")
def serve_reports(filename):
    """
    Sirve los archivos consolidados y reportes generados.
    """
    return send_from_directory(OUTPUT_DIR, filename, as_attachment=True)

# --- Autenticación ---

@app.route("/api/auth/usuario", methods=["GET"])
def get_user():
    user = state.auth.obtener_usuario_actual()
    if user:
        user_clean = {
            "name": user.get("name", user.get("preferred_username", "Operador Codelco")),
            "preferred_username": user.get("preferred_username", "")
        }
        return jsonify({"logged": True, "user": user_clean})
    return jsonify({"logged": False})

@app.route("/api/auth/login", methods=["POST"])
def do_login():
    def execute_login():
        try:
            res = state.auth.login()
            if res:
                state.emit_log("auth", "🔐 Login exitoso con Microsoft Entra ID.", "ok")
        except Exception as e:
            state.emit_log("auth", f"❌ Error en login corporativo: {e}", "error")
            
    threading.Thread(target=execute_login, daemon=True).start()
    return jsonify({"success": True, "message": "Autenticación iniciada en el navegador."})

@app.route("/api/auth/logout", methods=["POST"])
def do_logout():
    state.auth.logout()
    state.emit_log("auth", "🔒 Sesión cerrada correctamente.", "info")
    return jsonify({"success": True})

# --- Configuración ---

@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify(state.config_data)

@app.route("/api/config", methods=["POST"])
def post_config():
    try:
        req_data = request.json
        # Actualizar secciones críticas
        if "credenciales" in req_data:
            state.config_data["credenciales"] = req_data["credenciales"]
        if "navegador" in req_data:
            state.config_data["navegador"] = req_data["navegador"]
        if "smtp" in req_data:
            state.config_data["smtp"] = req_data["smtp"]
        if "recipients" in req_data:
            state.config_data["recipients"] = req_data["recipients"]
        if "cc" in req_data:
            state.config_data["cc"] = req_data["cc"]
        if "email_settings" in req_data:
            state.config_data["email_settings"] = req_data["email_settings"]
        if "recipient_lists" in req_data:
            state.config_data["recipient_lists"] = req_data["recipient_lists"]
        if "email_layouts" in req_data:
            state.config_data["email_layouts"] = req_data["email_layouts"]

        state.guardar_config()
        return jsonify({"success": True, "message": "Configuración guardada correctamente."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# --- Procesador de KPIs Corporativos ---

@app.route("/api/process-kpis", methods=["POST"])
def api_process_kpis():
    try:
        semana = request.form.get("semana")
        if not semana or not semana.isdigit():
            return jsonify({"success": False, "error": "Debe ingresar una semana válida."}), 400
        semana_num = int(semana)

        # Validar subidas — archivos opcionales, aceptar los que vengan
        optional = ['avisos', 'ordenes', 'trabajoPlanificado', 'programaSemanal', 'planMatriz']
        file_paths = {}
        
        for key in optional:
            if key in request.files:
                f = request.files[key]
                ext = os.path.splitext(f.filename or 'file.xlsx')[1] or '.xlsx'
                temp_path = os.path.join(OUTPUT_DIR, f"temp_{key}_{int(datetime.now().timestamp())}{ext}")
                f.save(temp_path)
                file_paths[key] = temp_path

        if not file_paths:
            return jsonify({"success": False, "error": "Debe subir al menos un archivo."}), 400

        import asyncio
        import glob
        from backend.main import state
        from backend.utils.kpi_excel_processor import read_raw_sap_file, PLANNING_GROUP_MAP

        import shutil

        # Conservar trabajoPlanificado y planMatriz con nombre fijo para la automatización SAP.
        # Se usa extensión fija .xlsx como fallback si el archivo no fue subido.
        tp_ext  = os.path.splitext(file_paths['trabajoPlanificado'])[1] if 'trabajoPlanificado' in file_paths else '.xlsx'
        pm_ext  = os.path.splitext(file_paths['planMatriz'])[1] if 'planMatriz' in file_paths else '.xlsx'
        SAVED_TRAB_PLAN   = os.path.join(OUTPUT_DIR, f"saved_trab_plan{tp_ext}")
        SAVED_PLAN_MATRIZ = os.path.join(OUTPUT_DIR, f"saved_plan_matriz{pm_ext}")

        # Copiar archivos a rutas fijas ANTES de lanzar la automatización
        if 'trabajoPlanificado' in file_paths:
            shutil.copy2(file_paths['trabajoPlanificado'], SAVED_TRAB_PLAN)
        if 'planMatriz' in file_paths:
            shutil.copy2(file_paths['planMatriz'], SAVED_PLAN_MATRIZ)

        # 1. Guardar archivos manuales de IW39 e IW37N (subidos antes de la automatización)
        fecha_f = datetime.now().strftime("%d%m%Y")
        manual_ots_saved = "proy_ots" in request.files
        manual_37n_saved = "proy_37n" in request.files

        # Sufijo "_KPI" evita colisión con los archivos "Proy_ots"/"Proy_37N" que
        # también genera la automatización de Proyecciones (mismo OUTPUT_DIR,
        # mismo handler). Sin distinguir el nombre, el glob de más abajo podía
        # tomar por error el archivo de la otra automatización.
        if manual_ots_saved:
            f_ots = request.files["proy_ots"]
            nombre_ots = f"{fecha_f}_Proy_ots_KPI.xlsx"
            ruta_ots = os.path.join(OUTPUT_DIR, nombre_ots)
            f_ots.save(ruta_ots)
            state.emit_log("api", f"📎 Proy_ots guardado manualmente: {nombre_ots}", "info")

        if manual_37n_saved:
            f_37n = request.files["proy_37n"]
            nombre_37n = f"{fecha_f}_Proy_37N_KPI.xlsx"
            ruta_37n = os.path.join(OUTPUT_DIR, nombre_37n)
            f_37n.save(ruta_37n)
            state.emit_log("api", f"📎 Proy_37N guardado manualmente: {nombre_37n}", "info")

        # 2. Ejecutar automatización SAP en modo best-effort:
        #    - IW39 (trabajo planificado): solo si trabajoPlanificado fue subido
        #    - IW37N (plan matriz): solo si planMatriz fue subido
        #    - El timeout es de 360s. Si falla o se cancela el MFA, se continúa igual
        #      con los archivos subidos manualmente (sin ots_mapping ni export_ops_mapping).
        ejecutar_sap_iw39 = 'trabajoPlanificado' in file_paths and not manual_ots_saved
        ejecutar_sap_iw37n = 'planMatriz' in file_paths and not manual_37n_saved

        if ejecutar_sap_iw39 or ejecutar_sap_iw37n:
            state.emit_log("api", "Iniciando descarga automatizada de KPIs SAP (best-effort)...", "info")
            state.emit_progress("kpi_auto", 0.05)
            try:
                # Pasar SAVED_TRAB_PLAN solo si fue subido y necesita IW39
                excel_tp_param   = SAVED_TRAB_PLAN   if (os.path.exists(SAVED_TRAB_PLAN) and ejecutar_sap_iw39) else None
                excel_pm_param   = SAVED_PLAN_MATRIZ  if (os.path.exists(SAVED_PLAN_MATRIZ) and ejecutar_sap_iw37n) else None
                future_batch = asyncio.run_coroutine_threadsafe(
                    state.modulos["kpi_auto"].ejecutar({
                        "excel_trab_plan":  excel_tp_param,
                        "excel_plan_matriz": excel_pm_param
                    }),
                    state.loop
                )
                future_batch.result(timeout=360)
                state.emit_log("api", "✅ Automatización SAP de KPIs completada.", "ok")
            except Exception as e:
                # La automatización falló o fue cancelada: continuar con archivos subidos
                print(f"ERROR AUTOMATIZACION: {e}")
                import traceback
                traceback.print_exc()
                state.emit_log("api", f"⚠️ Automatización SAP omitida o cancelada ({e}). Procesando con archivos disponibles.", "warning")
        else:
            state.emit_log("api", "⏭️ Ambos archivos SAP subidos manualmente. Se omite la automatización.", "info")

        # ──────────────────────────────────────────────────────────────────────
        # 3. Construir mappings desde los archivos Proy_ots y Proy_37N
        # ──────────────────────────────────────────────────────────────────────
        ots_mapping = {}
        export_ops_mapping = {}

        # 3a. Construir ots_mapping desde Proy_ots
        ots_files = glob.glob(os.path.join(OUTPUT_DIR, "*Proy_ots_KPI*.*"))
        if ots_files:
            latest_ots = max(ots_files, key=os.path.getctime)
            try:
                import pandas as pd
                df_ots = pd.read_excel(latest_ots, header=0)
                cols_ots = [str(c).strip().lower() for c in df_ots.columns]
                idx_orden = -1
                idx_grp = -1
                for i, h in enumerate(cols_ots):
                    if h == 'orden' or h.startswith('orden'):
                        idx_orden = i
                    elif 'grupo planif' in h or 'gr. planif' in h or 'gr.planif' in h:
                        idx_grp = i
                
                if idx_orden >= 0 and idx_grp >= 0:
                    orden_num = pd.to_numeric(df_ots.iloc[:, idx_orden], errors='coerce')
                    grp_col = df_ots.iloc[:, idx_grp].astype(str).str.strip()
                    valid_mask = orden_num.notna()
                    ordenes_validas = orden_num[valid_mask].astype(int).astype(str)
                    grupos_validos = grp_col[valid_mask]
                    for orden_val, grp_code in zip(ordenes_validas, grupos_validos):
                        grp_pm = PLANNING_GROUP_MAP.get(grp_code, grp_code)
                        ots_mapping[orden_val] = (grp_code, grp_pm)
                    state.emit_log("api", f"📦 ots_mapping construido: {len(ots_mapping)} órdenes ({os.path.basename(latest_ots)})", "info")
                else:
                    state.emit_log("api", f"⚠️ Archivo Proy_ots no tiene columnas 'Orden' o 'Grupo planif' reconocibles.", "warn")
            except Exception as e:
                state.emit_log("api", f"Error leyendo Proy_ots: {e}", "error")

        # 3b. Construir export_ops_mapping desde Proy_37N
        p37n_files = glob.glob(os.path.join(OUTPUT_DIR, "*Proy_37N_KPI*.*"))
        if p37n_files:
            latest_37n = max(p37n_files, key=os.path.getctime)
            try:
                import pandas as pd
                df_37n = pd.read_excel(latest_37n, header=0)
                cols_37n = [str(c).strip().lower() for c in df_37n.columns]
                idx_orden_ep = next((i for i, c in enumerate(cols_37n) if c == 'orden' or c.startswith('orden')), -1)
                
                if idx_orden_ep >= 0:
                    orden_num_ep = pd.to_numeric(df_37n.iloc[:, idx_orden_ep], errors='coerce')
                    ordenes_validas_ep = orden_num_ep.dropna().astype(int).astype(str)
                    export_ops_mapping = ordenes_validas_ep.value_counts().to_dict()
                    state.emit_log("api", f"📦 export_ops_mapping construido: {len(export_ops_mapping)} órdenes ({os.path.basename(latest_37n)})", "info")
                else:
                    state.emit_log("api", "⚠️ Archivo Proy_37N no tiene columna 'Orden' reconocible.", "warn")
            except Exception as e:
                state.emit_log("api", f"Error leyendo Proy_37N: {e}", "error")
        else:
            state.emit_log("api", "⚠️ No se encontró archivo Proy_37N. Los totales de Plan Matriz usarán los valores del PATTERN.", "warn")

        # 4. Consolidar usando los mappings
        filename = f"KPI GSYS SEM{semana_num}.xlsx"
        output_path = os.path.join(OUTPUT_DIR, filename)
        
        div_name = str(request.form.get('division', 'Sin División')).strip() or 'Sin División'
        ger_name = str(request.form.get('gerencia', 'Sin Gerencia')).strip() or 'Sin Gerencia'
        sup_name = str(request.form.get('superintendencia', '')).strip()
        user_email = str(request.form.get('user_email', 'sistema@monitoring.cl')).strip() or 'sistema@monitoring.cl'

        metadata = {
            "division": div_name,
            "gerencia": ger_name,
            "superintendencia": sup_name,
            "user_email": user_email
        }
        puestos_mapping = {}
        if supabase:
            try:
                res = supabase.table("puestos_trabajo").select("puesto_trabajo,descripcion").execute()
                if hasattr(res, 'data') and res.data:
                    puestos_mapping = {str(item.get("puesto_trabajo", "")).strip(): str(item.get("descripcion", "")).strip() for item in res.data if item.get("puesto_trabajo")}
            except Exception as e:
                state.emit_log("api", f"Error obteniendo puestos_trabajo de DB: {e}", "warn")

        use_pto_trabajo = str(request.form.get('use_pto_trabajo', 'false')).lower() == 'true'

        summary_data = process_kpi_excels(
            file_paths, semana_num, output_path,
            ots_mapping=ots_mapping,
            export_ops_mapping=export_ops_mapping,
            puestos_mapping=puestos_mapping,
            metadata=metadata,
            use_pto_trabajo=use_pto_trabajo
        )

        # Eliminar temporales
        for key, path in file_paths.items():
            try: os.remove(path)
            except: pass

        # Agregar URLs de descarga para React
        summary_data["downloadUrl"] = f"/reports/{filename}"
        summary_data["filename"] = filename
        
        # --- Guardar en Supabase ---
        from backend.utils.supabase_client import sync_hierarchy, save_kpi_to_supabase

        if not sup_name:
            area_name = "Nivel Gerencia"
        else:
            area_name = sup_name
        
        anio = datetime.now().year
        
        # Obtener o crear jerarquía
        area_id = sync_hierarchy(div_name, ger_name, area_name)
        if area_id:
            # Upsert de datos
            save_kpi_to_supabase(area_id, anio, semana_num, summary_data, user_email)

        summary_data["use_pto_trabajo"] = use_pto_trabajo


        return jsonify({"success": True, "data": summary_data})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Error al procesar: {str(e)}"}), 500

@app.route("/api/preview-file", methods=["POST"])
def api_preview_file():
    """
    Previsualización rápida de un archivo SAP al momento de subirlo.
    Propósito: Dar feedback inmediato al usuario sobre el contenido del archivo
    antes de ejecutar el proceso completo.
    """
    try:
        file_type = request.form.get('fileType', '')
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No se recibió archivo.'}), 400

        f = request.files['file']
        ext = os.path.splitext(f.filename or 'file.xlsx')[1] or '.xlsx'
        temp_path = os.path.join(OUTPUT_DIR, f"prev_{file_type}_{int(datetime.now().timestamp())}{ext}")
        f.save(temp_path)

        result = preview_file(temp_path, file_type)

        try:
            os.remove(temp_path)
        except Exception:
            pass

        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 422
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route("/api/process-ready-excel", methods=["POST"])
def api_process_ready_excel():
    try:
        semana = request.form.get("semana")
        if not semana or not semana.isdigit():
            return jsonify({"success": False, "error": "semana inválida."}), 400
        semana_num = int(semana)

        if "readyExcel" not in request.files:
            return jsonify({"success": False, "error": "Falta el Excel Consolidado."}), 400

        f = request.files["readyExcel"]
        filename = secure_filename(f.filename) or f"KPI GSYS SEM{semana_num}.xlsx"
        
        # Guardar en output
        output_path = os.path.join(OUTPUT_DIR, filename)
        f.save(output_path)

        # Cargar mapping de puestos de trabajo desde Supabase
        puestos_mapping = {}
        if supabase:
            try:
                res = supabase.table("puestos_trabajo").select("puesto_trabajo,descripcion").execute()
                if hasattr(res, 'data') and res.data:
                    puestos_mapping = {str(item.get("puesto_trabajo", "")).strip(): str(item.get("descripcion", "")).strip() for item in res.data if item.get("puesto_trabajo")}
            except Exception as e:
                state.emit_log("api", f"Error obteniendo puestos_trabajo de DB: {e}", "warn")

        # Extraer estadísticas
        summary_data = process_ready_excel(output_path, semana_num, puestos_mapping=puestos_mapping)
        summary_data["downloadUrl"] = f"/reports/{filename}"
        summary_data["filename"] = filename

        return jsonify({"success": True, "data": summary_data})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/send-report", methods=["POST"])
def api_send_report():
    try:
        req = request.json
        recipients = req.get("recipients")
        cc = req.get("cc")
        subject = req.get("subject")
        kpi_data = req.get("kpiData")
        template_id = req.get("templateId", 7)
        email_settings = req.get("emailSettings") or req.get("email_settings")

        if not all([recipients, subject, kpi_data]):
            return jsonify({"success": False, "error": "Faltan parámetros obligatorios."}), 400

        access_token = state.auth.obtener_access_token()
        if not access_token:
            return jsonify({"success": False, "error": "Debe iniciar sesión con su cuenta Microsoft en la app antes de enviar correos."}), 401

        if email_settings and isinstance(kpi_data, dict):
            kpi_data["email_settings"] = email_settings

        filename = kpi_data.get("filename")
        attachment_path = os.path.join(OUTPUT_DIR, filename) if filename else None
        
        # Determinar si adjuntar también la captura de Power BI
        adjuntos = []
        if attachment_path:
            adjuntos.append(attachment_path)
            
        if req.get("includePowerBI"):
            modulo_pbi = state.modulos.get("powerbi")
            if modulo_pbi and modulo_pbi.ultimo_screenshot and os.path.exists(modulo_pbi.ultimo_screenshot):
                adjuntos.append(modulo_pbi.ultimo_screenshot)
        
        # Mandar correo
        enviados = send_kpi_report_email(access_token, recipients, subject, kpi_data, adjuntos, template_id, cc=cc)
        
        # Guardar en Supabase tras envío exitoso
        try:
            from backend.utils.supabase_client import sync_hierarchy, save_kpi_to_supabase
            div_name = str(req.get("division", "")).strip() or "Sin División"
            ger_name = str(req.get("gerencia", "")).strip() or "Sin Gerencia"
            sup_name = str(req.get("superintendencia", "")).strip()
            user_email_db = str(req.get("user_email", "sistema@monitoring.cl")).strip() or "sistema@monitoring.cl"
            area_name = sup_name if sup_name else "Nivel Gerencia"
            anio = datetime.now().year
            semana_num = int(kpi_data.get("semana", 0)) if kpi_data.get("semana") else 0
            if semana_num > 0:
                area_id = sync_hierarchy(div_name, ger_name, area_name)
                if area_id:
                    save_kpi_to_supabase(area_id, anio, semana_num, kpi_data, user_email_db)
                    state.emit_log("api", f"💾 Reporte guardado en BD tras envío de correo.", "ok")
        except Exception as e:
            state.emit_log("api", f"⚠️ No se pudo guardar en BD tras envío: {e}", "warn")
        
        return jsonify({"success": True, "message": f"El informe KPI ha sido enviado con éxito a {enviados} destinatario(s) y guardado en BD."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/save-kpi-report", methods=["POST"])
def api_save_kpi_report():
    """Guarda el reporte KPI en Supabase sin enviar correo."""
    try:
        req = request.json
        kpi_data = req.get("kpiData")
        if not kpi_data:
            return jsonify({"success": False, "error": "Faltan datos del KPI."}), 400
        
        from backend.utils.supabase_client import sync_hierarchy, save_kpi_to_supabase
        div_name = str(req.get("division", "Sin División")).strip() or "Sin División"
        ger_name = str(req.get("gerencia", "Sin Gerencia")).strip() or "Sin Gerencia"
        sup_name = str(req.get("superintendencia", "")).strip()
        user_email_db = str(req.get("user_email", "sistema@monitoring.cl")).strip() or "sistema@monitoring.cl"
        area_name = sup_name if sup_name else "Nivel Gerencia"
        anio = datetime.now().year
        semana_num = int(kpi_data.get("semana", 0)) if kpi_data.get("semana") else 0
        
        if semana_num <= 0:
            return jsonify({"success": False, "error": "Semana inválida en los datos."}), 400
        
        area_id = sync_hierarchy(div_name, ger_name, area_name)
        if not area_id:
            return jsonify({"success": False, "error": "No se pudo sincronizar la jerarquía en BD."}), 500
        
        ok = save_kpi_to_supabase(area_id, anio, semana_num, kpi_data, user_email_db)
        if ok:
            return jsonify({"success": True, "message": f"Reporte Semana {semana_num} guardado en BD correctamente."})
        else:
            return jsonify({"success": False, "error": "Error al guardar métricas en BD."}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/powerbi/capture", methods=["POST"])
def api_powerbi_capture():
    """
    Endpoint para capturar el reporte de Power BI.
    Propósito: Lanzar la ejecución asíncrona del robot de Power BI con la semana provista.
    """
    try:
        req = request.json or {}
        semana = req.get("semana", "P10")
        
        modulo = state.modulos.get("powerbi")
        if not modulo:
            return jsonify({"success": False, "error": "Módulo Power BI no registrado."}), 500
            
        if modulo.running:
            return jsonify({"success": False, "error": "Ya hay una captura de Power BI en ejecución."}), 400

        # Reiniciar HUD
        state.logs_hud = []
        state.progreso_modulo = 0.05
        state.progreso_texto = "Iniciando"
        state.visor_base64 = ""
        state.solicitar_mfa_flag = False

        asyncio.run_coroutine_threadsafe(modulo.ejecutar({"semana": semana}), state.loop)
        return jsonify({"success": True, "message": "Captura de Power BI iniciada."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/powerbi/latest", methods=["GET"])
def api_powerbi_latest():
    """
    Endpoint para obtener la última captura del Power BI codificada en Base64.
    Propósito: Permitir al frontend visualizar la última captura realizada.
    """
    try:
        modulo = state.modulos.get("powerbi")
        if not modulo or not modulo.ultimo_screenshot or not os.path.exists(modulo.ultimo_screenshot):
            return jsonify({"success": False, "error": "No hay capturas disponibles."}), 404
            
        with open(modulo.ultimo_screenshot, "rb") as f:
            encoded_img = base64.b64encode(f.read()).decode("utf-8")
            
        return jsonify({
            "success": True,
            "filename": os.path.basename(modulo.ultimo_screenshot),
            "image": f"data:image/png;base64,{encoded_img}"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/proy/default-dates", methods=["GET"])
def get_default_dates():
    """
    Calcula y devuelve la semana actual (calendario ISO) y la fecha del próximo lunes en formato dd-mm-yyyy.
    Propósito: Permitir que el frontend obtenga las fechas de proyección calculadas según la lógica del robot original.
    """
    from datetime import date, timedelta
    hoy = date.today()
    semana_calc = hoy.isocalendar()[1] - 1
    if semana_calc <= 0:
        semana_calc = 52
    semana_actual = str(semana_calc)
    proximo_lunes = hoy + timedelta(days=(7 - hoy.weekday()) if hoy.weekday() < 7 else 7)
    fecha_base = proximo_lunes.strftime("%d-%m-%Y")
    return jsonify({
        "semana": semana_actual,
        "fecha_base": fecha_base
    })

@app.route("/api/proy/avisos-p1", methods=["GET"])
def api_proy_avisos_p1():
    """Retorna avisos de prioridad 1 del Excel más reciente."""
    import glob, pandas as pd
    try:
        avisos_files = glob.glob(os.path.join(OUTPUT_DIR, "*Proy_avi*.xlsx"))
        avisos_files = [f for f in avisos_files if "_DIEA" not in f and "_ST" not in f]
        if not avisos_files:
            return jsonify({"success": False, "error": "No hay archivos de avisos."}), 404
        latest = max(avisos_files, key=os.path.getctime)
        df = pd.read_excel(latest, header=0)
        cols = [str(c).strip().lower() for c in df.columns]
        idx_pri = idx_aviso = idx_ut = idx_desc = idx_fecha = -1
        for i, h in enumerate(cols):
            if h == 'prioridad' or h.startswith('prioridad'): idx_pri = i
            elif h == 'aviso' or h.startswith('aviso'): idx_aviso = i
            elif 'ubicaci' in h and 'téc' in h.lower(): idx_ut = i
            elif 'ubicacion tecnica' in h: idx_ut = i
            elif h == 'descripción' or h.startswith('descrip'): idx_desc = i
            elif 'creado el' in h or 'fecha de aviso' in h or 'fecha aviso' in h: idx_fecha = i
        if idx_pri < 0:
            return jsonify({"success": False, "error": "Columna Prioridad no encontrada."}), 422
        avisos_p1 = []
        from datetime import date
        fecha_base = request.args.get('fecha_base', '')

        # Parsear fecha_base una sola vez (antes se reparseaba en cada fila)
        fb = None
        if fecha_base:
            try:
                partes = fecha_base.replace("/", "-").replace(".", "-").split("-")
                fb = date(int(partes[2]), int(partes[1]), int(partes[0]))
            except Exception:
                fb = None

        # Filtrar prioridad==1 de forma vectorizada antes de iterar (subset, no todo el archivo)
        pri_col = pd.to_numeric(df.iloc[:, idx_pri], errors='coerce')
        df_p1 = df[pri_col == 1]

        for _, row in df_p1.iterrows():
            try:
                dias_trans = None
                if idx_fecha >= 0 and fb:
                    try:
                        fecha_aviso = pd.to_datetime(row.iloc[idx_fecha], dayfirst=True, errors='coerce')
                        if pd.notna(fecha_aviso):
                            dias_trans = (fb - fecha_aviso.date()).days
                    except Exception:
                        pass
                avisos_p1.append({
                    "aviso": str(row.iloc[idx_aviso]).strip() if idx_aviso >= 0 else "",
                    "prioridad": 1,
                    "ut": str(row.iloc[idx_ut]).strip() if idx_ut >= 0 else "",
                    "descripcion": str(row.iloc[idx_desc]).strip() if idx_desc >= 0 else "",
                    "fecha_aviso": str(row.iloc[idx_fecha]).strip()[:10] if idx_fecha >= 0 else "",
                    "dias_transcurridos": dias_trans if dias_trans is not None else 0,
                    "estado": "Vencido"
                })
            except Exception:
                continue
        return jsonify({"success": True, "avisos": avisos_p1, "total": len(avisos_p1)})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/proy/generate-excel", methods=["POST"])
def api_proy_generate_excel():
    """Genera Excel consolidado de proyecciones."""
    try:
        req = request.json
        semana = req.get("semana", "")
        fecha_base = req.get("fecha_base", "")
        dias_venc_avisos = int(req.get("dias_venc_avisos", 7))
        dias_venc_ordenes = int(req.get("dias_venc_ordenes", 21))
        use_pto_trabajo = str(req.get("use_pto_trabajo", False)).lower() in ("true", "1")
        import glob
        fecha_str = datetime.now().strftime("%d%m%Y")
        def buscar(patron, excluir=None):
            files = [f for f in os.listdir(OUTPUT_DIR) if patron in f and f.endswith(".xlsx") and not f.startswith("~$")]
            if excluir:
                excluir_list = excluir if isinstance(excluir, (list, tuple)) else [excluir]
                files = [f for f in files if all(ex not in f for ex in excluir_list)]
            if not files: return None
            full = [os.path.join(OUTPUT_DIR, f) for f in files]
            return sorted(full, key=os.path.getmtime, reverse=True)[0]
        # "_KPI" excluye los archivos generados por la automatización de KPIs
        # Corporativos (mismo patrón de nombre, mismo OUTPUT_DIR): sin esta
        # exclusión, Proyecciones podía tomar por error el archivo del otro módulo.
        excl_normal = ["_DIEA", "_KPI"]
        rutas = {
            "avisos": [buscar("Proy_avi", excluir=excl_normal), buscar("Proy_avi_DIEA")],
            "ordenes": [buscar("Proy_ots", excluir=excl_normal), buscar("Proy_ots_DIEA")],
            "trabajo": [buscar("Proy_37N", excluir=excl_normal), buscar("Proy_37N_DIEA")]
        }
        if not rutas["avisos"][0] or not rutas["ordenes"][0] or not rutas["trabajo"][0]:
            return jsonify({"success": False, "error": "Faltan archivos base. Ejecute descargas primero."}), 400
        from backend.utils.post_procesador import PostProcesador
        post = PostProcesador(log_fn=state.emit_log_proy)
        summary = post.ejecutar(semana, fecha_base, rutas, dias_venc_avisos=dias_venc_avisos,
                                dias_venc_ordenes=dias_venc_ordenes, use_pto_trabajo=use_pto_trabajo)
        if isinstance(summary, dict) and summary.get("filename"):
            summary["success"] = True
            summary["message"] = f"Reporte {summary['filename']} generado."
            return jsonify(summary)
        return jsonify({"success": False, "error": "Error al generar Excel."}), 500
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/proy/latest-summary", methods=["GET"])
def api_proy_latest_summary():
    """Devuelve el resumen estructurado del reporte de proyecciones más reciente,
    leyendo el JSON persistido junto al Excel (flujo robot: FASE 3 lo generó)."""
    try:
        import glob, json as _json
        jsons = glob.glob(os.path.join(OUTPUT_DIR, "Reporte_Consolidado_S*.summary.json"))
        if not jsons:
            return jsonify({"success": False, "error": "No hay resumen disponible."}), 404
        latest = max(jsons, key=os.path.getmtime)
        with open(latest, "r", encoding="utf-8") as jf:
            summary = _json.load(jf)
        summary["success"] = True
        return jsonify(summary)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/proy/send-report", methods=["POST"])
def api_proy_send_report():
    """Envía reporte de proyecciones por correo."""
    try:
        req = request.json
        recipients = req.get("recipients"); cc = req.get("cc")
        subject = req.get("subject")
        proy_data = req.get("proyData")
        filename = proy_data.get("filename") if proy_data else None
        if not all([recipients, subject]):
            return jsonify({"success": False, "error": "Faltan parámetros obligatorios."}), 400
        access_token = state.auth.obtener_access_token()
        if not access_token:
            return jsonify({"success": False, "error": "Debe iniciar sesión con su cuenta Microsoft en la app antes de enviar correos."}), 401
        attachment_path = os.path.join(OUTPUT_DIR, filename) if filename else None
        adjuntos = []
        if attachment_path and os.path.exists(attachment_path):
            adjuntos.append(attachment_path)
        from backend.utils.proy_email_sender import send_proy_report_email
        enviados = send_proy_report_email(access_token, recipients, subject, proy_data, adjuntos, cc=cc)
        return jsonify({"success": True, "message": f"Reporte de proyecciones enviado a {enviados} destinatario(s)."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# --- Orquestación de Módulos Modulares Playwright ---

@app.route("/api/ejecutar-modulo", methods=["POST"])
def api_ejecutar_modulo():
    try:
        req = request.json
        modulo_id = req.get("modulo_id")
        params = req.get("params", {})
        
        modulo = state.modulos.get(modulo_id)
        if not modulo:
            return jsonify({"success": False, "error": "Módulo no encontrado."}), 400
            
        if modulo.running:
            return jsonify({"success": False, "error": "Ya hay una automatización activa para este módulo."}), 400

        # Reiniciar HUD
        state.logs_hud = []
        state.progreso_modulo = 0.05
        state.progreso_texto = "Iniciando"
        state.visor_base64 = ""
        state.solicitar_mfa_flag = False

        if modulo_id == "kpi_auto":
            state.hud_kpi = {"logs": [], "progreso": 0.05, "texto": "Iniciando", "visor": "", "solicitar_mfa": False}
        elif modulo_id == "proy_auto":
            state.hud_proy = {"logs": [], "progreso": 0.05, "texto": "Iniciando", "visor": "", "solicitar_mfa": False}
        
        # Ejecutar corutina en hilo de background asíncrono
        asyncio.run_coroutine_threadsafe(modulo.ejecutar(params), state.loop)
        return jsonify({"success": True, "message": f"Módulo {modulo_id.upper()} iniciado."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/status-modulos", methods=["GET"])
def api_status_modulos():
    return jsonify({
        "progreso": state.progreso_modulo,
        "progreso_texto": state.progreso_texto,
        "logs": state.logs_hud,
        "visor": state.visor_base64,
        "solicitar_mfa": state.solicitar_mfa_flag,
        "kpi": {
            "progreso": state.hud_kpi["progreso"],
            "progreso_texto": state.hud_kpi["texto"],
            "logs": state.hud_kpi["logs"],
            "visor": state.hud_kpi["visor"],
            "solicitar_mfa": state.hud_kpi["solicitar_mfa"]
        },
        "proy": {
            "progreso": state.hud_proy["progreso"],
            "progreso_texto": state.hud_proy["texto"],
            "logs": state.hud_proy["logs"],
            "visor": state.hud_proy["visor"],
            "solicitar_mfa": state.hud_proy["solicitar_mfa"]
        }
    })

@app.route("/api/pausar-modulo", methods=["POST"])
def api_pausar_modulo():
    req = request.json
    modulo_id = req.get("modulo_id")
    modulo = state.modulos.get(modulo_id)
    if modulo and modulo.running:
        if modulo.paused:
            modulo.reanudar()
            state.emit_log(modulo_id, "▶️ Robot reanudado por el usuario.", "info")
            return jsonify({"success": True, "paused": False})
        else:
            modulo.pausar()
            state.emit_log(modulo_id, "⏸️ Robot pausado por el usuario.", "warn")
            return jsonify({"success": True, "paused": True})
    return jsonify({"success": False, "error": "Módulo inactivo."}), 400

@app.route("/api/detener-modulo", methods=["POST"])
def api_detener_modulo():
    req = request.json
    modulo_id = req.get("modulo_id")
    modulo = state.modulos.get(modulo_id)
    if modulo and modulo.running:
        modulo.detener()
        state.emit_log(modulo_id, "⏹️ Robot detenido de forma manual.", "error")
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Módulo inactivo."}), 400


@app.route("/api/enviar-mfa", methods=["POST"])
def api_enviar_mfa():
    try:
        req = request.json
        codigo = req.get("codigo")
        contexto = req.get("contexto", "legacy")
        if not codigo:
            return jsonify({"success": False, "error": "Código vacío."}), 400
            
        codigo_str = str(codigo).strip()
        
        if contexto == "kpi":
            state.mfa_code_kpi = codigo_str
            state.hud_kpi["solicitar_mfa"] = False
            state.loop.call_soon_threadsafe(state.mfa_event_kpi.set)
            state.emit_log_kpi("🔑 Código OTP MFA enviado al navegador.", "info")
        elif contexto == "proy":
            state.mfa_code_proy = codigo_str
            state.hud_proy["solicitar_mfa"] = False
            state.loop.call_soon_threadsafe(state.mfa_event_proy.set)
            state.emit_log_proy("🔑 Código OTP MFA enviado al navegador.", "info")
        else:
            state.mfa_code = codigo_str
            state.solicitar_mfa_flag = False
            state.loop.call_soon_threadsafe(state.mfa_event.set)
            state.emit_log("auth", "🔑 Código OTP MFA enviado al navegador.", "info")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/org-structure", methods=["GET"])
def api_get_org_structure():
    from backend.utils.supabase_client import supabase
    if not supabase:
        return jsonify({"success": False, "error": "Supabase no configurado"}), 500
    try:
        div_res = supabase.table("divisiones").select("*").execute()
        ger_res = supabase.table("gerencias").select("*").execute()
        area_res = supabase.table("areas").select("*").execute()
        
        return jsonify({
            "success": True,
            "divisiones": div_res.data if hasattr(div_res, 'data') else [],
            "gerencias": ger_res.data if hasattr(ger_res, 'data') else [],
            "superintendencias": area_res.data if hasattr(area_res, 'data') else []
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# --- Endpoints CRUD de Base de Datos (Supabase) ---
@app.route("/api/db/tables", methods=["GET"])
def api_get_db_tables():
    from backend.utils.supabase_client import supabase
    if not supabase:
        return jsonify({"success": False, "error": "Cliente de Supabase no inicializado."}), 500
        
    tables_meta = {
        "puestos_trabajo": {
            "name": "Puestos de Trabajo",
            "columns": [
                {"key": "puesto_trabajo", "label": "Puesto de Trabajo", "type": "text", "required": True},
                {"key": "centro", "label": "Centro", "type": "text", "required": True},
                {"key": "tipo", "label": "Tipo", "type": "text", "required": True},
                {"key": "responsable", "label": "Responsable", "type": "text", "required": True},
                {"key": "descripcion", "label": "Descripción", "type": "text", "required": False},
                {"key": "almacen", "label": "Almacén", "type": "text", "required": False}
            ]
        },
        "grupos_planificacion": {
            "name": "Grupos de Planificación",
            "columns": [
                {"key": "gp", "label": "Gr. Planif (Código)", "type": "text", "required": True},
                {"key": "nombre", "label": "Nombre del Grupo", "type": "text", "required": True}
            ]
        }
    }
    return jsonify({"success": True, "tables": tables_meta})

@app.route("/api/db/tables/<table_name>", methods=["GET"])
def api_get_table_rows(table_name):
    from backend.utils.supabase_client import supabase
    if not supabase:
        return jsonify({"success": False, "error": "Cliente de Supabase no inicializado."}), 500
        
    if table_name not in ["puestos_trabajo", "grupos_planificacion"]:
        return jsonify({"success": False, "error": "Tabla no permitida o inexistente."}), 400
        
    try:
        res = supabase.table(table_name).select("*").order("id", desc=True).execute()
        return jsonify({"success": True, "rows": res.data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/db/tables/<table_name>", methods=["POST"])
def api_create_table_row(table_name):
    from backend.utils.supabase_client import supabase
    if not supabase:
        return jsonify({"success": False, "error": "Cliente de Supabase no inicializado."}), 500
        
    if table_name not in ["puestos_trabajo", "grupos_planificacion"]:
        return jsonify({"success": False, "error": "Tabla no permitida o inexistente."}), 400
        
    try:
        data = request.json
        # Remover ID y created_at si vienen
        data.pop("id", None)
        data.pop("created_at", None)
        
        res = supabase.table(table_name).insert(data).execute()
        return jsonify({"success": True, "row": res.data[0] if res.data else None})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/db/tables/<table_name>/<row_id>", methods=["PUT"])
def api_update_table_row(table_name, row_id):
    from backend.utils.supabase_client import supabase
    if not supabase:
        return jsonify({"success": False, "error": "Cliente de Supabase no inicializado."}), 500
        
    if table_name not in ["puestos_trabajo", "grupos_planificacion"]:
        return jsonify({"success": False, "error": "Tabla no permitida o inexistente."}), 400
        
    try:
        data = request.json
        # Remover ID y created_at si vienen para evitar cambiar PK
        data.pop("id", None)
        data.pop("created_at", None)
        
        res = supabase.table(table_name).update(data).eq("id", row_id).execute()
        return jsonify({"success": True, "row": res.data[0] if res.data else None})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/db/tables/<table_name>/<row_id>", methods=["DELETE"])
def api_delete_table_row(table_name, row_id):
    from backend.utils.supabase_client import supabase
    if not supabase:
        return jsonify({"success": False, "error": "Cliente de Supabase no inicializado."}), 500
        
    if table_name not in ["puestos_trabajo", "grupos_planificacion"]:
        return jsonify({"success": False, "error": "Tabla no permitida o inexistente."}), 400
        
    try:
        res = supabase.table(table_name).delete().eq("id", row_id).execute()
        return jsonify({"success": True, "deleted": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ============================================================
# PYWEBVIEW JS API
# ============================================================
class NativeApi:
    def save_excel(self, filename):
        import webview
        import shutil
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.SAVE_DIALOG, 
            directory='', 
            save_filename=filename, 
            file_types=('Excel Files (*.xlsx)', 'All files (*.*)')
        )
        if result:
            dest_path = result if isinstance(result, str) else result[0]
            src_path = os.path.join(OUTPUT_DIR, filename)
            if os.path.exists(src_path):
                shutil.copy2(src_path, dest_path)
                return True
        return False

# ============================================================
# ARRANCAR SERVIDOR FLASK + PYWEBVIEW
# ============================================================

def run_flask():
    print("[Flask] Iniciando servidor local en el puerto 3001...")
    # Ejecutar en modo no-debug para evitar levantar subprocesos duplicados con pywebview
    app.run(host="127.0.0.1", port=3001, debug=False, threaded=True)

def main(flask_only=False):
    if flask_only:
        run_flask()
        return
    """
    Función de entrada principal de la aplicación.
    Levanta el servidor Flask en background y abre la ventana nativa de escritorio (maximizada) usando pywebview.
    """
    # 1. Levantar servidor Flask en un hilo background
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # 2. Levantar la ventana de escritorio pywebview apuntando al servidor local
    entry_url = "http://127.0.0.1:3001"
    
    print("[pywebview] Abriendo ventana nativa de escritorio...")
    api = NativeApi()
    window = webview.create_window(
        title="Monitoring KPI's Corporativos",
        url=entry_url,
        js_api=api,
        width=1280,
        height=800,
        min_size=(1100, 700),
        resizable=True,
        maximized=True
    )
    
    # Iniciar pywebview en modo debug para poder depurar errores del frontend
    webview.start(debug=True)

if __name__ == "__main__":
    main()
