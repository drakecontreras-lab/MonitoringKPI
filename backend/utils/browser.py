import asyncio
import base64
import os
from playwright.async_api import async_playwright, Page, Browser, BrowserContext

class BrowserManager:
    """
    Gestor reutilizable para automatizaciones con Playwright.
    Controla el arranque, apagado y captura de pantalla periódica (screencast) para el visor web.
    """

    def __init__(self, headless: bool = False, user_data_dir: str = "browser_session"):
        """
        Inicializa las opciones de configuración del navegador.
        Propósito: Configurar el modo oculto (headless) y la ruta de persistencia de sesión.
        """
        self.headless = headless
        self.user_data_dir = os.path.abspath(user_data_dir)
        self.pw = None
        self.browser_context: BrowserContext = None
        self.page: Page = None
        self.screencast_task: Optional[asyncio.Task] = None
        self._screencast_running = False

    async def iniciar(self) -> Page:
        """
        Inicia la sesión del navegador persistente con Playwright.
        Propósito: Inicializar el navegador y abrir una página en blanco cargando la sesión.
        """
        os.makedirs(self.user_data_dir, exist_ok=True)
        self.pw = await async_playwright().start()
        
        # Iniciar navegador persistente para mantener cookies y sesiones
        self.browser_context = await self.pw.chromium.launch_persistent_context(
            user_data_dir=self.user_data_dir,
            headless=self.headless,
            viewport={"width": 1280, "height": 720},
            args=["--disable-blink-features=AutomationControlled"],
            permissions=["clipboard-read", "clipboard-write"]
        )
        
        self.page = self.browser_context.pages[0] if self.browser_context.pages else await self.browser_context.new_page()
        return self.page

    async def iniciar_transmision(self, callback_fn: callable):
        """
        Inicia una tarea en segundo plano para tomar screenshots periódicos de la página web.
        Propósito: Proveer un stream de imágenes Base64 de la automatización activa hacia el visor del dashboard.
        """
        if self._screencast_running:
            return
        
        self._screencast_running = True
        
        async def loop_capturas():
            """Loop de capturas en segundo plano a ~4-5 FPS."""
            while self._screencast_running and self.page:
                try:
                    if not self.page.is_closed():
                        # Tomar screenshot comprimido en JPEG de baja calidad para optimizar velocidad y tamaño
                        img_bytes = await self.page.screenshot(type="jpeg", quality=40)
                        base64_str = base64.b64encode(img_bytes).decode("utf-8")
                        callback_fn(base64_str)
                except Exception as e:
                    # Silenciar errores por cierre repentino de páginas
                    pass
                # Esperar 200 ms (5 FPS)
                await asyncio.sleep(0.2)

        self.screencast_task = asyncio.create_task(loop_capturas())

    async def detener_transmision(self):
        """
        Detiene la tarea asíncrona de captura de pantalla.
        Propósito: Frenar el flujo de screencasting al finalizar la automatización.
        """
        self._screencast_running = False
        if self.screencast_task:
            self.screencast_task.cancel()
            try:
                await self.screencast_task
            except asyncio.CancelledError:
                pass
            self.screencast_task = None

    async def cerrar(self):
        """
        Cierra de forma segura el navegador y la instancia de Playwright.
        Propósito: Liberar procesos del sistema y memoria del equipo.
        """
        await self.detener_transmision()
        if self.browser_context:
            await self.browser_context.close()
        if self.pw:
            await self.pw.stop()
        self.browser_context = None
        self.pw = None
        self.page = None
