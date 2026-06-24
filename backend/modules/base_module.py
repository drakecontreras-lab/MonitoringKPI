import abc
import asyncio
from typing import Callable, Optional

class BaseModule(abc.ABC):
    """
    Clase Base Abstracta para todos los módulos de automatización de la suite.
    Define el ciclo de vida, el manejo de estados de ejecución, pausa, detención y utilidades.
    """
    
    def __init__(self, module_id: str, app_api):
        """
        Inicializa el módulo modular independiente.
        Propósito: Configurar el ID del módulo y guardar la referencia de la API del puente de la app.
        """
        self.module_id = module_id
        self.app_api = app_api
        self.running = False
        self.paused = False
        self.pause_event = asyncio.Event()
        self.pause_event.set()  # Por defecto no está pausado

    def log(self, mensaje: str, nivel: str = "info"):
        """
        Envía un mensaje de registro al frontend en tiempo real.
        Propósito: Permitir a los submódulos reportar eventos de ejecución a la UI.
        """
        self.app_api.emit_log(self.module_id, mensaje, nivel)

    def actualizar_progreso(self, valor: float):
        """
        Envía el porcentaje de progreso de la tarea (0.0 a 1.0) al frontend.
        Propósito: Informar visualmente al usuario sobre el progreso del módulo.
        """
        self.app_api.emit_progress(self.module_id, valor)

    def actualizar_visor(self, image_base64: str):
        """
        Envía un fotograma en Base64 para actualizar el visor del navegador en tiempo real.
        Propósito: Permitir el monitoreo embebido de Playwright en la UI de Nexus.
        """
        self.app_api.emit_visor(self.module_id, image_base64)

    @abc.abstractmethod
    async def ejecutar(self, params: dict):
        """
        Método abstracto de ejecución principal del módulo.
        Propósito: Debe ser implementado por cada módulo independiente para realizar su tarea asíncrona.
        """
        pass

    async def manejar_pausa(self):
        """
        Verifica el estado de pausa y detiene la ejecución del módulo hasta que se reanude.
        Propósito: Permitir pausar de forma segura en puntos de control de la automatización.
        """
        await self.pause_event.wait()

    def pausar(self):
        """
        Pausa el flujo de la automatización estableciendo el evento de pausa.
        Propósito: Activar la pausa del módulo.
        """
        self.paused = True
        self.pause_event.clear()
        self.log("⏸ Automatización en pausa.", "warn")

    def reanudar(self):
        """
        Reanuda el flujo de la automatización liberando el evento de pausa.
        Propósito: Quitar la pausa del módulo y continuar la tarea.
        """
        self.paused = False
        self.pause_event.set()
        self.log("▶ Automatización reanudada.", "ok")

    def detener(self):
        """
        Detiene permanentemente el flujo de la automatización.
        Propósito: Abortar la tarea en curso y liberar recursos de forma limpia.
        """
        self.running = False
        self.paused = False
        self.pause_event.set()
        self.log("⏹ Automatización detenida por el usuario.", "error")
