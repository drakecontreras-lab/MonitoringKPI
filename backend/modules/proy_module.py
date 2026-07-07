import os
import threading
from datetime import datetime
from backend.modules.base_module import BaseModule
from backend.utils.paths import get_output_dir

class ProyMacroModule(BaseModule):
    """
    Módulo para consolidar los reportes de planificación (Macros de Excel).
    Opera como módulo independiente e interactúa con el visor del frontend.
    """

    def __init__(self, app_api):
        """
        Inicializa el módulo con el ID 'proy_macro'.
        """
        super().__init__("proy_macro", app_api)

    async def ejecutar(self, params: dict):
        """
        Inicia la ejecución del módulo de planificación según el modo solicitado.
        Propósito: Orquestar el procesamiento Excel en base al parámetro 'mode'.
        """
        self.running = True
        self.paused = False
        self.pause_event.set()

        modo = params.get("mode", "macro")
        self.log(f"🚀 Iniciando consolidación Planificación Excel...")
        self.actualizar_progreso(0.05)

        if modo != "macro":
            self.log(f"❌ Este módulo solo ejecuta macros Excel. Modo no soportado: {modo.upper()}", "error")
            self.running = False
            return

        await self._ejecutar_macro(params)

    async def _ejecutar_macro(self, params: dict):
        """
        Ejecuta la macro de consolidación y procesamiento de Excel en segundo plano.
        Propósito: Procesar y estructurar hojas de cálculo descargadas sin congelar la app.
        """
        from backend.utils.post_procesador import PostProcesador
        
        semana = params.get("semana", "P10")
        fecha_base_str = params.get("fecha_base", "")
        
        self.log(f"⚙️ Iniciando consolidación de Excel para Semana {semana} y Fecha {fecha_base_str}...")
        self.actualizar_progreso(0.20)

        output_dir = get_output_dir()
        os.makedirs(output_dir, exist_ok=True)
        
        fecha_str = datetime.now().strftime("%d%m%Y")
        
        def buscar_archivo_reciente(patron, excluir=None):
            """Busca el archivo más reciente que coincide con el patrón en la carpeta output."""
            files = [f for f in os.listdir(output_dir) if patron in f and f.startswith(fecha_str) and f.endswith(".xlsx") and not f.startswith("~$")]
            if excluir:
                files = [f for f in files if excluir not in f]
            if not files:
                return None
            full_paths = [os.path.join(output_dir, f) for f in files]
            return sorted(full_paths, key=os.path.getmtime, reverse=True)[0]

        # Mapeo de archivos recientes requeridos por la macro
        rutas = {
            "avisos":  [buscar_archivo_reciente("Proy_avi", excluir="_DIEA"), buscar_archivo_reciente("Proy_avi_DIEA")],
            "ordenes": [buscar_archivo_reciente("Proy_ots", excluir="_DIEA"), buscar_archivo_reciente("Proy_ots_DIEA")],
            "trabajo": [buscar_archivo_reciente("Proy_37N", excluir="_DIEA"), buscar_archivo_reciente("Proy_37N_DIEA")]
        }

        # Informar archivos tomados
        for k, v in rutas.items():
            f1 = os.path.basename(v[0]) if v[0] else "No encontrado"
            f2 = os.path.basename(v[1]) if v[1] else "No encontrado (DIEA)"
            self.log(f"📁 {k.capitalize()}: {f1} + {f2}")

        self.actualizar_progreso(0.40)

        def hilo_macro():
            """Subproceso síncrono para interactuar con la API COM de Excel."""
            try:
                post = PostProcesador(log_fn=self.log)
                success = post.ejecutar(semana, fecha_base_str, rutas)
                
                if success:
                    self.log("✨ Reporte de planificación consolidado y formateado con éxito.", "ok")
                    self.actualizar_progreso(1.0)
                else:
                    self.log("❌ Ocurrieron errores en la macro de post-procesamiento de Excel.", "error")
                    self.actualizar_progreso(0.0)
            except Exception as e:
                self.log(f"❌ Excepción ejecutando macro Excel: {e}", "error")
                self.actualizar_progreso(0.0)
            finally:
                self.running = False

        # Correr la macro en un thread secundario debido a peticiones COM síncronas de Excel
        threading.Thread(target=hilo_macro, daemon=True).start()
