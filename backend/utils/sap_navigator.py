"""
sap_navigator.py - Navegación dentro de SAP Fiori / GUI SAP
"""
import asyncio
import re
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from typing import Callable


class SAPNavigator:
    def __init__(self, page: Page, url_base: str, log_fn: Callable = print):
        self.page = page
        self.url_base = url_base
        self.log = log_fn

    async def ir_a_fiori(self):
        """Navega al launchpad de SAP Fiori."""
        self.log(f"🌐 Navegando a {self.url_base}...")
        await self.page.goto(self.url_base, wait_until="networkidle")
        self.log("✅ SAP Fiori cargado.")

    async def esperar_fiori_cargado(self, timeout_ms: int = 30000):
        """Espera a que el launchpad de Fiori esté listo."""
        try:
            # Espera a que aparezca algún elemento del shell de Fiori
            await self.page.wait_for_selector(
                ".sapShellHeader, .sapUshellShell, [id*='shell']",
                timeout=timeout_ms
            )
            self.log("✅ Launchpad Fiori listo.")
            return True
        except PlaywrightTimeout:
            self.log("⚠️ El launchpad Fiori tardó demasiado en cargar.")
            return False

    async def abrir_transaccion_gui_url(self, transaccion: str):
        """
        Abre una transacción SAP GUI directamente vía URL de Fiori.
        """
        if not self.url_base or not self.url_base.startswith("http"):
            self.log(f"❌ URL base inválida ({self.url_base}). Revisa Configuración.")
            return

        url = f"{self.url_base}#Shell-startGUI?sap-system=FIORI_MENU&sap-ui2-tcode={transaccion}"
        self.log(f"🔗 Abriendo transacción GUI: {transaccion}")
        try:
            await self.page.goto(url, wait_until="commit", timeout=60000)
            await self.page.reload(wait_until="commit", timeout=60000) # Destruye el iframe de la tx anterior
            await asyncio.sleep(2) 
            
            # --- NUEVA VERIFICACIÓN DE LOGIN / SELECCIÓN CUENTA ---
            # Si al navegar nos rebota a Selección de cuenta de Microsoft
            try:
                if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=3000):
                    self.log("🔐 Bloqueo detectado: Pantalla 'Selección de la cuenta'. Resolviendo...")
                    cuenta = self.page.get_by_text(re.compile(r".*@contratistas\.codelco\.cl", re.IGNORECASE)).first
                    if await cuenta.is_visible(timeout=3000):
                        await cuenta.click(force=True)
                        await self.page.wait_for_load_state("networkidle", timeout=15000)
            except: pass

        except Exception as e:
            self.log(f"⚠️ Error al navegar: {e}")

        try:
            await self.cerrar_popups_sap(reintentos=2)
        except: pass

    async def cerrar_popups_sap(self, reintentos: int = 2):
        """Busca y cierra popups comunes de SAP con reintentos optimizados."""
        selectores_botones = [
            "button[title*='Continuar']", "button[title*='Aceptar']",
            "button[title*='OK']", "button[title*='Cerrar']",
            "button:has-text('Cerrar')", "button:has-text('Continuar')",
            "button:has-text('Aceptar')", "button:has-text('OK')",
            "[id*='popup_close']", "[aria-label*='Close']"
        ]

        for i in range(reintentos):
            encontrado_en_ronda = False
            await asyncio.sleep(0.5) # Reducido de 1s a 0.5s
            
            frame_sap = await self.obtener_frame_sap()
            contextos = [self.page]
            if frame_sap != self.page:
                contextos.append(frame_sap)

            for ctx in contextos:
                for selector in selectores_botones:
                    try:
                        boton = await ctx.query_selector(selector)
                        if boton and await boton.is_visible():
                            self.log(f"🔘 Cerrando popup: {selector}")
                            await boton.click(timeout=2000)
                            await asyncio.sleep(0.5)
                            encontrado_en_ronda = True
                    except:
                        continue
            
            if not encontrado_en_ronda:
                break

    async def buscar_en_fiori(self, termino: str):
        """Usa la barra de búsqueda del launchpad Fiori para buscar una app/transacción."""
        self.log(f"🔍 Buscando '{termino}' en Fiori...")
        try:
            # Botón de búsqueda en el shell de Fiori
            boton_buscar = await self.page.wait_for_selector(
                ".sapUshellSearchBtn, [title='Search'], [aria-label='Search']",
                timeout=10000
            )
            await boton_buscar.click()

            campo_busqueda = await self.page.wait_for_selector(
                ".sapUshellSearchInput input, input[placeholder*='Search'], input[placeholder*='Buscar']",
                timeout=5000
            )
            await campo_busqueda.fill(termino)
            await self.page.keyboard.press("Enter")
            await self.page.wait_for_load_state("networkidle")
            self.log(f"✅ Búsqueda '{termino}' ejecutada.")
        except PlaywrightTimeout as e:
            self.log(f"❌ No se pudo usar la búsqueda Fiori: {e}")
            raise

    async def abrir_app_desde_tile(self, nombre_app: str):
        """Hace clic en un tile/mosaico del launchpad Fiori por nombre."""
        self.log(f"🟦 Abriendo app '{nombre_app}'...")
        try:
            tile = await self.page.wait_for_selector(
                f"[title*='{nombre_app}'], .sapUshellTileTitle:has-text('{nombre_app}')",
                timeout=10000
            )
            await tile.click()
            await self.page.wait_for_load_state("networkidle")
            self.log(f"✅ App '{nombre_app}' abierta.")
        except PlaywrightTimeout:
            self.log(f"❌ No se encontró el tile '{nombre_app}'")
            raise

    async def esta_en_sap_gui(self) -> bool:
        """Detecta si hay un iframe de SAPGUI Web/HTML5 embebido."""
        try:
            await self.page.wait_for_selector(
                "iframe[id*='ITSAM'], iframe[name*='HostedView'], iframe.sapItsamIFrame",
                timeout=8000
            )
            return True
        except PlaywrightTimeout:
            return False

    async def obtener_frame_sap(self):
        """Obtiene el frame interno del SAP GUI Web si existe."""
        # Selector ampliado para captar diferentes versiones de Fiori/WebGUI
        selector = "iframe[id*='ITSAM'], iframe[name*='HostedView'], iframe[id*='startGUI'], iframe.sapItsamIFrame"
        frame_element = await self.page.query_selector(selector)
        if frame_element:
            return await frame_element.content_frame()
        return self.page  # Si no hay iframe, trabajar directamente con la página
