import os
import asyncio
from typing import Dict, Any

from backend.modules.base_module import BaseModule
from backend.utils.browser import BrowserManager
from backend.utils.sap import LoginManager
from backend.utils.paths import get_browser_session_dir

class KpiAutoModule(BaseModule):
    """Módulo KPIs Corporativos. HUD propio separado de Proyecciones."""
    def __init__(self, app_api):
        super().__init__("kpi_auto", app_api)
        self.browser_mgr = None

    def log(self, mensaje, nivel="info"):
        self.app_api.emit_log_kpi(mensaje, nivel)

    def actualizar_progreso(self, valor):
        self.app_api.emit_progress_kpi(valor)

    def actualizar_visor(self, image_base64):
        self.app_api.emit_visor_kpi(image_base64)

    async def ejecutar(self, params: Dict[str, Any]):
        """
        Ejecuta la descarga batch de OTs (IW39) y Órdenes (IW37N).
        """
        self.running = True
        self.paused = False
        self.pause_event.set()

        try:
            excel_trab_plan = params.get("excel_trab_plan")
            excel_plan_matriz = params.get("excel_plan_matriz")
            
            # Obtener configuración global
            config_glob = self.app_api.config_data
            usuario = config_glob["credenciales"]["usuario"]
            contrasena = config_glob["credenciales"]["contrasena"]
            url_base = config_glob["navegador"]["url_base"]
            headless = config_glob["navegador"].get("headless", False)

            self.log("🚀 Iniciando automatización SAP para KPIs Corporativos...", "info")
            self.actualizar_progreso(0.10)

            # Iniciar navegador
            self.browser_mgr = BrowserManager(headless=headless, user_data_dir=get_browser_session_dir())
            page = await self.browser_mgr.iniciar()

            # Conectar visor embebido
            await self.browser_mgr.iniciar_transmision(self.actualizar_visor)

            self.log("🌐 Conectando a SAP Fiori...", "info")
            await page.goto(url_base, wait_until="load", timeout=60000)
            await asyncio.sleep(3)

            login_mgr = LoginManager(page, usuario, contrasena, self.log)

            # Detectar si la sesión expiró comprobando la URL actual
            url_actual = page.url
            necesita_login = (
                "login.microsoftonline.com" in url_actual
                or "login.live.com" in url_actual
                or "saml2" in url_actual
                or "sso_reload" in url_actual
                or not await login_mgr.esta_logueado()
            )

            if necesita_login:
                self.log("🔐 Sesión no detectada o expirada. Iniciando sesión interactiva con Microsoft...")
                self.actualizar_progreso(0.15)
                
                async def _get_mfa() -> str:
                    self.app_api.mfa_event_kpi.clear()
                    self.app_api.mfa_code_kpi = None
                    self.app_api.emit_solicitar_mfa_kpi()
                    self.log("📱 Esperando código MFA del usuario en el panel de KPIs...", "warn")
                    await self.app_api.mfa_event_kpi.wait()
                    return self.app_api.mfa_code_kpi
                
                exito_login = await login_mgr.login_microsoft(async_get_otp_code=_get_mfa)
                # Asegurar que el prompt MFA del frontend se oculte tras login
                self.app_api.hud_kpi["solicitar_mfa"] = False
                if not exito_login:
                    self.log("❌ Autenticación corporativa fallida o cancelada.", "error")
                    await self.browser_mgr.cerrar()
                    self.running = False
                    return
                # Volver a la URL base tras el login
                await page.goto(url_base, wait_until="load", timeout=60000)
                await asyncio.sleep(2)
            else:
                self.log("✅ Sesión SAP activa detectada.")

            self.actualizar_progreso(0.25)
            await self.manejar_pausa()

            # Importar handlers
            from backend.utils.proyeccion_ots_handler import ProyeccionOtsHandler
            from backend.utils.proyeccion_ordenes_handler import ProyeccionOrdenesHandler

            h_ots = ProyeccionOtsHandler(page, self.log, url_base)
            h_ordenes = ProyeccionOrdenesHandler(page, self.log, url_base)

            self.log("🗂️ Ejecutando batch de KPIs (OTs + Órdenes) en una misma sesión...")
            
            # IW39
            # suffix="_KPI" evita colisión de nombre de archivo con la automatización
            # de Proyecciones (proy_auto_module), que usa el mismo handler y guarda
            # en el mismo OUTPUT_DIR con el nombre genérico "Proy_ots"/"Proy_37N".
            # Sin este sufijo, main.py podía tomar por error el archivo de la otra
            # automatización (el más reciente por ctime), corrompiendo el mapping
            # gr_planif usado para enriquecer Trabajo Planificado y Plan Matriz.
            await h_ots.ejecutar(lista_uts=None, excel_trab_plan=excel_trab_plan, suffix="_KPI")
            self.actualizar_progreso(0.50)
            await self.manejar_pausa()

            # Pausa para asegurar que SAP termine de procesar IW39 antes de IW37N
            self.log("⏳ Esperando estabilización de SAP antes de IW37N...")
            await asyncio.sleep(4)

            # IW37N
            await h_iw37n.ejecutar(lista_uts=None, excel_plan_matriz=excel_plan_matriz, suffix="_KPI")
            self.actualizar_progreso(1.0)

            self.log("✅ Descargas batch de KPIs Corporativos finalizadas.", "ok")

        except Exception as e:
            self.log(f"❌ Error crítico en automatización SAP (KPIs): {e}", "error")
        finally:
            self.running = False
            if self.browser_mgr:
                await self.browser_mgr.cerrar()
                self.browser_mgr = None
