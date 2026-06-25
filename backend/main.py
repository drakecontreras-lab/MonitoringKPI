import asyncio
import base64
import json
import os
import sys
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory # Se removió send_from_bytes por no estar definida ni en uso en Flask.
from flask_cors import CORS
import webview

# Agregar el directorio raíz del proyecto al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.auth_ms import EntraIDAuth
from backend.modules.iw29_module import IW29Module
from backend.modules.proy_module import ProyMacroModule
from backend.modules.proy_auto_module import ProyAutoModule
from backend.modules.powerbi_module import PowerBIModule
from backend.modules.kpi_auto_module import KpiAutoModule
from backend.utils.kpi_excel_processor import process_kpi_excels, process_ready_excel, preview_file
from backend.utils.kpi_email_sender import send_kpi_report_email
from backend.utils.supabase_client import supabase

# Inicializar Flask
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist"))
CORS(app)

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

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
        
        # Estado HUD consolidado en memoria
        self.logs_hud = []
        self.progreso_modulo = 0.0
        self.progreso_texto = "Inactivo"
        self.visor_base64 = ""
        self.solicitar_mfa_flag = False
        
        self.mfa_code = None
        self.mfa_event = asyncio.Event()

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

# Instanciar estado
state = AppState()

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

@app.route('/api/db/tables/<table_name>', methods=['GET'])
def get_table_rows(table_name):
    if not supabase:
        return jsonify({"success": False, "error": "Supabase no configurado"}), 500
    try:
        res = supabase.table(table_name).select("*").order("created_at", desc=True).execute()
        return jsonify({"success": True, "rows": res.data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/db/tables/<table_name>', methods=['POST'])
def create_table_row(table_name):
    if not supabase: return jsonify({"success": False, "error": "No Supabase"}), 500
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

        # Validar subidas (sin archivo 'data' — fue eliminado del flujo)
        required = ['avisos', 'ordenes', 'trabajoPlanificado', 'programaSemanal', 'planMatriz']
        file_paths = {}
        
        for key in required:
            if key not in request.files:
                return jsonify({"success": False, "error": f"Falta el archivo: {key}"}), 400
            
            f = request.files[key]
            # Guardar temporalmente en output
            ext = os.path.splitext(f.filename or 'file.xlsx')[1] or '.xlsx'
            temp_path = os.path.join(OUTPUT_DIR, f"temp_{key}_{int(datetime.now().timestamp())}{ext}")
            f.save(temp_path)
            file_paths[key] = temp_path

        import asyncio
        import glob
        from backend.main import state
        from backend.utils.kpi_excel_processor import read_raw_sap_file, PLANNING_GROUP_MAP

        # Conservar trabajoPlanificado y planMatriz con nombre fijo para que la automatización SAP los use
        SAVED_TRAB_PLAN  = os.path.join(OUTPUT_DIR, f"saved_trab_plan{os.path.splitext(file_paths.get('trabajoPlanificado','x.xlsx'))[1]}")
        SAVED_PLAN_MATRIZ = os.path.join(OUTPUT_DIR, f"saved_plan_matriz{os.path.splitext(file_paths.get('planMatriz','x.xlsx'))[1]}")

        for key, path in file_paths.items():
            if key == 'trabajoPlanificado':
                import shutil
                shutil.copy2(path, SAVED_TRAB_PLAN)
            elif key == 'planMatriz':
                import shutil
                shutil.copy2(path, SAVED_PLAN_MATRIZ)

        # 1. Guardar archivos manuales de IW39 e IW37N (subidos antes de la automatización)
        fecha_f = datetime.now().strftime("%d%m%Y")
        manual_ots_saved = "proy_ots" in request.files
        manual_37n_saved = "proy_37n" in request.files

        if manual_ots_saved:
            f_ots = request.files["proy_ots"]
            nombre_ots = f"{fecha_f}_Proy_ots.xlsx"
            ruta_ots = os.path.join(OUTPUT_DIR, nombre_ots)
            f_ots.save(ruta_ots)
            state.emit_log("api", f"📎 Proy_ots guardado manualmente: {nombre_ots}", "info")

        if manual_37n_saved:
            f_37n = request.files["proy_37n"]
            nombre_37n = f"{fecha_f}_Proy_37N.xlsx"
            ruta_37n = os.path.join(OUTPUT_DIR, nombre_37n)
            f_37n.save(ruta_37n)
            state.emit_log("api", f"📎 Proy_37N guardado manualmente: {nombre_37n}", "info")

        # 2. Ejecutar Automatización SAP solo si faltan archivos manuales
        ejecutar_sap = not (manual_ots_saved and manual_37n_saved)
        if ejecutar_sap:
            state.emit_log("api", "Iniciando descarga automatizada de KPIs SAP...", "info")
            state.emit_progress("kpi_auto", 0.05)
            try:
                future_batch = asyncio.run_coroutine_threadsafe(
                    state.modulos["kpi_auto"].ejecutar({
                        "excel_trab_plan": SAVED_TRAB_PLAN,
                        "excel_plan_matriz": SAVED_PLAN_MATRIZ
                    }),
                    state.loop
                )
                future_batch.result(timeout=400)
                state.emit_log("api", "Automatización SAP de KPIs completada con éxito.", "ok")
            except Exception as e:
                state.emit_log("api", f"Error o timeout en automatización SAP KPIs: {e}", "warning")
        else:
            state.emit_log("api", "⏭️ Ambos archivos SAP fueron subidos manualmente. Se omite la automatización.", "info")

        # ──────────────────────────────────────────────────────────────────────
        # 3. Construir mappings desde los archivos Proy_ots y Proy_37N
        # ──────────────────────────────────────────────────────────────────────
        ots_mapping = {}
        export_ops_mapping = {}

        # 3a. Construir ots_mapping desde Proy_ots
        ots_files = glob.glob(os.path.join(OUTPUT_DIR, "*Proy_ots*.*"))
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
                    for _, row in df_ots.iterrows():
                        try:
                            orden_val = str(int(float(row.iloc[idx_orden]))).strip()
                        except (ValueError, TypeError):
                            orden_val = str(row.iloc[idx_orden]).strip()
                        grp_code = str(row.iloc[idx_grp]).strip()
                        if orden_val and orden_val.isdigit():
                            grp_pm = PLANNING_GROUP_MAP.get(grp_code, grp_code)
                            ots_mapping[orden_val] = (grp_code, grp_pm)
                    state.emit_log("api", f"📦 ots_mapping construido: {len(ots_mapping)} órdenes ({os.path.basename(latest_ots)})", "info")
                else:
                    state.emit_log("api", f"⚠️ Archivo Proy_ots no tiene columnas 'Orden' o 'Grupo planif' reconocibles.", "warn")
            except Exception as e:
                state.emit_log("api", f"Error leyendo Proy_ots: {e}", "error")

        # 3b. Construir export_ops_mapping desde Proy_37N
        p37n_files = glob.glob(os.path.join(OUTPUT_DIR, "*Proy_37N*.*"))
        if p37n_files:
            latest_37n = max(p37n_files, key=os.path.getctime)
            try:
                import pandas as pd
                df_37n = pd.read_excel(latest_37n, header=0)
                cols_37n = [str(c).strip().lower() for c in df_37n.columns]
                idx_orden_ep = next((i for i, c in enumerate(cols_37n) if c == 'orden' or c.startswith('orden')), -1)
                
                if idx_orden_ep >= 0:
                    for _, row in df_37n.iterrows():
                        try:
                            orden_ep = str(int(float(row.iloc[idx_orden_ep]))).strip()
                        except (ValueError, TypeError):
                            orden_ep = str(row.iloc[idx_orden_ep]).strip()
                        if orden_ep and orden_ep.isdigit():
                            export_ops_mapping[orden_ep] = export_ops_mapping.get(orden_ep, 0) + 1
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

        summary_data = process_kpi_excels(
            file_paths, semana_num, output_path,
            ots_mapping=ots_mapping,
            export_ops_mapping=export_ops_mapping,
            puestos_mapping=puestos_mapping,
            metadata=metadata
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

        use_pto_trabajo = str(request.form.get('use_pto_trabajo', 'false')).lower() == 'true'
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
        filename = f.filename or f"KPI GSYS SEM{semana_num}.xlsx"
        
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
        email = req.get("email")
        password = req.get("password")
        recipients = req.get("recipients")
        cc = req.get("cc")
        subject = req.get("subject")
        kpi_data = req.get("kpiData")
        template_id = req.get("templateId", 7)
        email_settings = req.get("emailSettings") or req.get("email_settings")
        
        if not all([email, password, recipients, subject, kpi_data]):
            return jsonify({"success": False, "error": "Faltan parámetros obligatorios."}), 400

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
        enviados = send_kpi_report_email(email, password, recipients, subject, kpi_data, adjuntos, template_id, cc=cc)
        
        return jsonify({"success": True, "message": f"El informe KPI ha sido enviado con éxito a {enviados} destinatario(s)."})
    except Exception as e:
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
        "solicitar_mfa": state.solicitar_mfa_flag
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
        if not codigo:
            return jsonify({"success": False, "error": "Código vacío."}), 400
            
        state.mfa_code = str(codigo).strip()
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

def main():
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
        title="Monitoring KPI 2 - Suite Corporativa Unificada",
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
