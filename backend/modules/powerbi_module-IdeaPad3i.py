import asyncio
import os
import re
from datetime import datetime
from playwright.async_api import TimeoutError as PlaywrightTimeout
from backend.modules.base_module import BaseModule
from backend.utils.browser import BrowserManager

class PowerBIModule(BaseModule):
    """
    Módulo para realizar captura de pantalla de un informe de Power BI.
    Propósito: Automatizar el login y captura de la sección de Power BI especificada por el usuario.
    """

    def __init__(self, app_api):
        """
        Inicializa el módulo con el ID 'powerbi'.
        Propósito: Configurar el identificador y guardar la referencia del puente de comunicación.
        """
        super().__init__("powerbi", app_api)
        self.browser_mgr = None
        self.ultimo_screenshot = None

    async def ejecutar(self, params: dict):
        """
        Inicia la ejecución del módulo de captura de Power BI.
        Propósito: Orquestar el inicio del navegador, autenticación usando el LoginManager corporativo y tomar la captura del selector.
        """
        # Creado por José Contreras Luna (jose.contreras@minitoring.cl)
        self.running = True
        self.paused = False
        self.pause_event.set()

        semana = params.get("semana", "P10")
        self.log(f"🚀 Iniciando captura de Power BI para la Semana {semana}...")
        self.actualizar_progreso(0.10)

        config_glob = self.app_api.config_data
        usuario = config_glob["credenciales"]["usuario"]
        contrasena = config_glob["credenciales"]["contrasena"]
        headless = config_glob["navegador"].get("headless", False)

        url_powerbi = "https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi"

        try:
            # 1. Iniciar navegador
            self.log("🌐 Iniciando navegador Playwright (Viewport 1920x1080)...")
            self.browser_mgr = BrowserManager(headless=headless, user_data_dir="browser_session")
            
            # Inicializamos y sobrescribimos el viewport a 1920x1080
            self.pw = await self.browser_mgr.iniciar()
            page = self.browser_mgr.page
            if page:
                await page.set_viewport_size({"width": 1920, "height": 1080})

            # Conectar visor embebido
            await self.browser_mgr.iniciar_transmision(self.actualizar_visor)
            self.actualizar_progreso(0.20)
            await self.manejar_pausa()

            # 2. Navegar a Power BI
            self.log("🌐 Navegando a Power BI...")
            await page.goto(url_powerbi, wait_until="load")
            self.actualizar_progreso(0.40)
            await self.manejar_pausa()

            # Función para obtener el código OTP del modal del frontend
            async def get_otp_code() -> str:
                """Emite el evento MFA al frontend y espera a que el usuario ingrese el código."""
                self.app_api.mfa_event.clear()
                self.app_api.mfa_code = None
                self.app_api.emit_solicitar_mfa()
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.app_api.mfa_event.wait)
                return self.app_api.mfa_code

            # 3. Flujo de autenticación paso a paso usando LoginManager compartido
            self.log("🔐 Iniciando flujo de autenticación...")
            from backend.utils.sap import LoginManager
            login_mgr = LoginManager(page, usuario, contrasena, log_fn=self.log)
            login_exitoso = await login_mgr.login_microsoft(async_get_otp_code=get_otp_code)
            
            if not login_exitoso:
                self.log("❌ Error en la autenticación con Microsoft.", "error")
                await self.browser_mgr.cerrar()
                self.running = False
                return

            self.log("🔄 Esperando carga del reporte de Power BI...")
            self.actualizar_progreso(0.60)
            await self.manejar_pausa()

            # Esperar por el elemento del contenedor visual
            selector_visual = '[data-automation-type="visualContainerHost"]'
            try:
                await page.wait_for_selector(selector_visual, timeout=60000)
            except Exception as e:
                self.log(f"⚠️ Tiempo de espera agotado buscando el selector visual principal. Intentando capturar la página directamente. Error: {e}", "warn")

            # Esperar a que los elementos internos de la tabla pivote o spinners terminen de cargar
            try:
                await page.wait_for_selector(".pivotTable", timeout=15000)
            except:
                pass

            # Dar 5 segundos adicionales para asegurar renderizado completo de gráficos y datos
            await asyncio.sleep(5)
            
            output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
            os.makedirs(output_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M")
            filename = f"powerbi_screenshot_SEM{semana}_{timestamp}.png"
            output_path = os.path.join(output_dir, filename)

            # Tomar screenshot del elemento
            self.log("📸 Tomando captura del reporte...")
            elemento = await page.query_selector(selector_visual)
            if elemento:
                await elemento.screenshot(path=output_path)
            else:
                await page.screenshot(path=output_path)

            self.ultimo_screenshot = output_path
            self.log(f"✨ Captura de Power BI guardada con éxito: {filename}", "ok")
            self.actualizar_progreso(1.0)

        except Exception as e:
            self.log(f"❌ Error crítico en captura de Power BI: {e}", "error")
            self.actualizar_progreso(0.0)
        finally:
            self.running = False
            if self.browser_mgr:
                await self.browser_mgr.cerrar()
                self.browser_mgr = None
