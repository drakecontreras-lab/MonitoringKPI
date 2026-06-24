import asyncio
import os
import re
import pyperclip
from datetime import datetime
from backend.modules.base_module import BaseModule
from backend.utils.browser import BrowserManager
from backend.utils.sap import LoginManager, SAPNavigator

class IW29Module(BaseModule):
    """
    Módulo para automatizar la extracción de Avisos Pendientes en la transacción SAP IW29.
    Opera como módulo independiente e interactúa con el visor del frontend.
    """

    def __init__(self, app_api):
        """
        Inicializa el módulo con el ID 'iw29'.
        Propósito: Configurar el identificador y guardar la referencia del puente de comunicación.
        """
        super().__init__("iw29", app_api)
        self.browser_mgr = None

    async def ejecutar(self, params: dict):
        """
        Inicia la ejecución asíncrona de la descarga de avisos.
        Propósito: Ejecutar todo el flujo del scraping (Playwright) informando logs y transmitiendo pantalla.
        """
        self.running = True
        self.paused = False
        self.pause_event.set()

        self.log("🚀 Iniciando automatización Confiabilidad (IW29)...")
        self.actualizar_progreso(0.05)

        # Leer parámetros
        lista_uts = params.get("lista_uts", [])
        layout_sap = params.get("layout_sap", "/JC_KPI")
        config_glob = self.app_api.config_data
        
        usuario = config_glob["credenciales"]["usuario"]
        contrasena = config_glob["credenciales"]["contrasena"]
        url_base = config_glob["navegador"]["url_base"]
        headless = config_glob["navegador"].get("headless", False)

        if not lista_uts:
            self.log("⚠️ No se ingresaron Unidades Técnicas para consultar.", "warn")
            self.running = False
            return

        try:
            # 1. Iniciar navegador
            self.log("🌐 Iniciando navegador Playwright...")
            self.browser_mgr = BrowserManager(headless=headless, user_data_dir="browser_session")
            page = await self.browser_mgr.iniciar()
            
            # Conectar la transmisión al visor
            await self.browser_mgr.iniciar_transmision(self.actualizar_visor)
            self.actualizar_progreso(0.15)
            await self.manejar_pausa()

            # 2. Login
            self.log("🔐 Comprobando autenticación...")
            login_mgr = LoginManager(page, usuario, contrasena, self.log)
            navigator = SAPNavigator(page, url_base, self.log)
            
            async def get_otp_code() -> str:
                self.app_api.mfa_event.clear()
                self.app_api.mfa_code = None
                self.app_api.emit_solicitar_mfa()
                await self.app_api.mfa_event.wait()
                return self.app_api.mfa_code

            await page.goto(url_base, wait_until="load")
            if not await login_mgr.esta_logueado():
                self.log("🔐 Sesión no detectada. Iniciando sesión interactiva con Microsoft...")
                success = await login_mgr.login_microsoft(async_get_otp_code=get_otp_code)
                if not success:
                    self.log("❌ Error en la autenticación con Microsoft.", "error")
                    await self.browser_mgr.cerrar()
                    self.running = False
                    return

            self.actualizar_progreso(0.30)
            await self.manejar_pausa()

            # 3. Abrir IW29
            await navigator.abrir_transaccion_gui_url("IW29")
            frame = await navigator.obtener_frame_sap()
            
            self.actualizar_progreso(0.45)
            await self.manejar_pausa()

            # 4. Formulario IW29 - Filtrar Pendientes
            self.log("🔘 Configurando filtros: Avisos Pendientes...")
            try:
                chk_tratam = frame.get_by_role("checkbox", name="En tratam.")
                if await chk_tratam.is_checked(timeout=3000):
                    await chk_tratam.click()
            except Exception as e:
                self.log(f"⚠️ No se pudo desmarcar 'En tratamiento': {e}", "info")

            # 5. Limpiar fechas
            self.log("🧹 Limpiando campos de fecha...")
            nombres_fecha = ["Fecha de aviso", "hst", "Fecha de entrada", "en", "Período", "Periodo"]
            for nombre_f in nombres_fecha:
                try:
                    campos = await frame.get_by_role("textbox", name=re.compile(nombre_f, re.IGNORECASE)).all()
                    for campo in campos:
                        if await campo.is_visible(timeout=500):
                            await campo.click()
                            await page.keyboard.press("Control+A")
                            await page.keyboard.press("Backspace")
                except: pass

            # 6. Aplicar Layout y Centro de Planificación
            self.log(f"🎨 Aplicando Layout SAP: {layout_sap}...")
            try:
                campo_layout = frame.get_by_role("textbox", name="Layout")
                await campo_layout.fill(layout_sap)
                
                # Intentar rellenar Centro Planificación a CH01
                try:
                    campo_centro = frame.get_by_role("textbox", name="Centro planificación")
                    if await campo_centro.is_visible(timeout=1000):
                        await campo_centro.fill("CH01")
                except: pass

                await page.keyboard.press("Enter")
                await asyncio.sleep(1)
            except Exception as e:
                self.log(f"⚠️ Alerta al aplicar layout: {e}", "warn")

            self.actualizar_progreso(0.60)
            await self.manejar_pausa()

            # 7. Selección Múltiple de UTs
            self.log("📑 Pegando lista de Unidades Técnicas masivamente...")
            try:
                btn_seleccion = frame.get_by_role("button", name="Selección múltiple").nth(2)
                await btn_seleccion.click()
                await asyncio.sleep(1.5)

                pyperclip.copy("\r\n".join(lista_uts))
                
                # Pegar portapapeles usando Control+v nativo para evitar la alerta de seguridad del portapapeles del navegador
                await page.keyboard.press("Control+v")

                await asyncio.sleep(1)
                await frame.get_by_role("button", name="Tomar (F8)").click()
            except Exception as e:
                self.log(f"⚠️ Error al ingresar UTs masivas: {e}", "warn")

            self.actualizar_progreso(0.75)
            await self.manejar_pausa()

            # 8. Ejecutar y Descargar
            self.log("🚀 Consultando reportes SAP (Ejecutar)...")
            try:
                btn_ejecutar = frame.get_by_role("button", name=re.compile(r"Ejecutar", re.IGNORECASE))
                if await btn_ejecutar.is_visible(timeout=2000):
                    await btn_ejecutar.click()
            except: pass

            # Esperar botón Lista
            try:
                await frame.get_by_role("button", name="Lista").wait_for(state="visible", timeout=12000)
                await frame.get_by_role("button", name="Lista").click()
            except:
                # Si falla, intentar presionar F8 como plan B
                await page.keyboard.press("F8")
                await asyncio.sleep(2)

            self.log("📥 Exportando reporte ALV a Excel...")
            await frame.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await frame.get_by_role("button", name="Exportar a...").click()

            # Capturar descarga
            async with page.expect_download() as download_info:
                try:
                    btn_ok = frame.get_by_role("button", name="OK")
                    if await btn_ok.is_visible(timeout=2000):
                        await btn_ok.click()
                    else:
                        await page.keyboard.press("Enter")
                except:
                    await page.keyboard.press("Enter")

            download = await download_info.value
            
            output_dir = os.path.join(os.getcwd(), config_glob["app"].get("output_dir", "output"))
            os.makedirs(output_dir, exist_ok=True)
            
            fecha_hoy = datetime.now().strftime("%d%m%Y")
            ruta_final = os.path.join(output_dir, f"avi_pend_{fecha_hoy}.xlsx")
            
            if os.path.exists(ruta_final):
                os.remove(ruta_final)
                
            await download.save_as(ruta_final)
            self.log(f"✨ Reporte descargado exitosamente en: {os.path.basename(ruta_final)}", "ok")
            self.actualizar_progreso(1.0)

        except Exception as e:
            self.log(f"❌ Error crítico en el módulo IW29: {e}", "error")
        finally:
            self.running = False
            if self.browser_mgr:
                await self.browser_mgr.cerrar()
                self.browser_mgr = None
