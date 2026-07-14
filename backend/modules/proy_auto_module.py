import asyncio
import os
import re
from datetime import datetime
from backend.modules.base_module import BaseModule
from backend.utils.browser import BrowserManager
from backend.utils.sap import LoginManager, SAPNavigator
from backend.utils.paths import get_output_dir, get_browser_session_dir

class ProyAutoModule(BaseModule):
    """Módulo Proyecciones. HUD propio separado de KPIs Corporativos."""

    def __init__(self, app_api):
        super().__init__("proy_auto", app_api)
        self.browser_mgr = None

    def log(self, mensaje, nivel="info"):
        self.app_api.emit_log_proy(mensaje, nivel)

    def actualizar_progreso(self, valor):
        self.app_api.emit_progress_proy(valor)

    def actualizar_visor(self, image_base64):
        self.app_api.emit_visor_proy(image_base64)

    async def ejecutar(self, params: dict):
        self.running = True
        self.paused = False
        self.pause_event.set()

        modo = params.get("mode", "full")
        self.log(f"🚀 Iniciando automatización Planificación SAP (Modo: {modo.upper()})...")
        self.actualizar_progreso(0.05)

        # Si por alguna razón se llama con "macro", ignorar o loguear error
        if modo == "macro":
            self.log("❌ Este módulo solo realiza descargas SAP. Macro delegada al módulo de proyección.", "error")
            self.running = False
            return

        config_glob = self.app_api.config_data
        usuario = config_glob["credenciales"]["usuario"]
        contrasena = config_glob["credenciales"]["contrasena"]
        url_base = config_glob["navegador"]["url_base"]
        headless = config_glob["navegador"].get("headless", False)

        lista_uts = params.get("lista_uts", [])
        grupo_planif = params.get("grupo_planif", "CI0")
        grupo_planif_st = params.get("grupo_planif_st", "CI0")
        lista_grupos_st = [g.strip() for g in grupo_planif_st.split(",") if g.strip()]

        output_dir = get_output_dir()
        excel_trab_plan   = params.get("excel_trab_plan")   or self._buscar_excel_reciente(output_dir, "saved_trab_plan")
        excel_plan_matriz = params.get("excel_plan_matriz") or self._buscar_excel_reciente(output_dir, "saved_plan_matriz")

        if excel_trab_plan:
            self.log(f"📎 Usará órdenes de Trabajo Planificado: {os.path.basename(excel_trab_plan)}")
        if excel_plan_matriz:
            self.log(f"📎 Usará órdenes de Plan Matriz: {os.path.basename(excel_plan_matriz)}")

        # Limpiar archivos Excel crudos de proyecciones anteriores para evitar falsos avisos P1
        try:
            import glob
            for f in glob.glob(os.path.join(output_dir, "*Proy_*.xlsx")):
                try: os.remove(f)
                except: pass
        except Exception as e:
            self.log(f"⚠️ No se pudieron limpiar algunos archivos temporales: {e}", "warning")

        try:
            # 1. Iniciar navegador
            self.log("🌐 Iniciando navegador Playwright...")
            self.browser_mgr = BrowserManager(headless=headless, user_data_dir=get_browser_session_dir())
            page = await self.browser_mgr.iniciar()
            
            # Conectar visor embebido
            await self.browser_mgr.iniciar_transmision(self.actualizar_visor)
            self.actualizar_progreso(0.15)
            await self.manejar_pausa()

            # 2. Login
            self.log("🔐 Comprobando autenticación...")
            login_mgr = LoginManager(page, usuario, contrasena, self.log)
            navigator = SAPNavigator(page, url_base, self.log)

            async def get_otp_code() -> str:
                self.app_api.mfa_event_proy.clear()
                self.app_api.mfa_code_proy = None
                self.app_api.emit_solicitar_mfa_proy()
                await self.app_api.mfa_event_proy.wait()
                return self.app_api.mfa_code_proy

            await page.goto(url_base, wait_until="load", timeout=60000)
            await asyncio.sleep(3)

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
                success = await login_mgr.login_microsoft(async_get_otp_code=get_otp_code)
                self.app_api.hud_proy["solicitar_mfa"] = False
                if not success:
                    self.log("❌ Error en la autenticación corporativa.", "error")
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

            from backend.utils.proyeccion_avisos_handler import ProyeccionAvisosHandler
            from backend.utils.proyeccion_ots_proy_handler import ProyeccionOtsHandler
            from backend.utils.proyeccion_ordenes_handler import ProyeccionOrdenesHandler
            from backend.utils.proyeccion_avisos_diea_handler import ProyeccionAvisosDieaHandler
            from backend.utils.proyeccion_ots_diea_handler import ProyeccionOtsDieaHandler
            from backend.utils.proyeccion_ordenes_diea_handler import ProyeccionOrdenesDieaHandler
            from backend.utils.proyeccion_avisos_st_handler import ProyeccionAvisosStHandler
            from backend.utils.proyeccion_ots_st_handler import ProyeccionOtsStHandler

            # Instanciar handlers
            h_avisos = ProyeccionAvisosHandler(page, self.log, url_base)
            h_ots = ProyeccionOtsHandler(page, self.log, url_base)
            h_ordenes = ProyeccionOrdenesHandler(page, self.log, url_base)

            h_avisos_diea = ProyeccionAvisosDieaHandler(page, self.log, url_base)
            h_ots_diea = ProyeccionOtsDieaHandler(page, self.log, url_base)
            h_ordenes_diea = ProyeccionOrdenesDieaHandler(page, self.log, url_base)

            h_avisos_st = ProyeccionAvisosStHandler(page, self.log, url_base)
            h_ots_st = ProyeccionOtsStHandler(page, self.log, url_base)

            # Orquestar según el modo
            if modo == "full_proyecciones":
                selected = params.get("selected_projections", ["avisos","ordenes","trabajo_planificado","programa_semanal","plan_matriz"])
                activar_uts = params.get("activar_uts", True)
                activar_grupos = params.get("activar_grupos", True)
                dias_venc_avisos = int(params.get("dias_venc_avisos", 7))
                dias_venc_ordenes = int(params.get("dias_venc_ordenes", 21))
                use_pto_trabajo = bool(params.get("use_pto_trabajo", False))
                semana_proy = params.get("semana", "")
                fecha_base_proy = params.get("fecha_base", "")

                self.log(f"🎯 Flujo de proyecciones. Seleccionadas: {', '.join(selected)}")
                self.actualizar_progreso(0.10)

                if activar_uts and lista_uts:
                    self.log("📡 FASE 1: Consultas por Unidades Técnicas...")
                    step = 0
                    total_steps = len([s for s in selected if s in ("avisos","ordenes","trabajo_planificado")])
                    if "avisos" in selected:
                        step += 1
                        self.actualizar_progreso(0.10 + (step/max(total_steps,1))*0.30)
                        await h_avisos.ejecutar(lista_uts=lista_uts, layout="/JC_KPI", suffix="")
                        await self.manejar_pausa()
                    if any(s in selected for s in ("trabajo_planificado", "programa_semanal", "plan_matriz")):
                        step += 1
                        self.actualizar_progreso(0.10 + (step/max(total_steps,1))*0.30)
                        await h_ordenes.ejecutar(lista_uts=lista_uts, layout="KPIAT0610", suffix="", excel_plan_matriz=excel_plan_matriz)
                        await self.manejar_pausa()
                    if "ordenes" in selected:
                        step += 1
                        self.actualizar_progreso(0.10 + (step/max(total_steps,1))*0.30)
                        await h_ots.ejecutar(lista_uts=lista_uts, layout="/BDYTD_25_OT", suffix="")
                        await self.manejar_pausa()
                else:
                    self.log("⏭️ FASE 1 omitida (UTs no activadas).")

                self.actualizar_progreso(0.50)

                if activar_grupos and grupo_planif:
                    self.log("📡 FASE 2: Consultas por Grupo (DIEA)...")
                    step = 0
                    total_steps = len([s for s in selected if s in ("avisos","ordenes","trabajo_planificado")])
                    if "avisos" in selected:
                        step += 1
                        self.actualizar_progreso(0.50 + (step/max(total_steps,1))*0.20)
                        await h_avisos_diea.ejecutar(grupo_planif=grupo_planif, layout="/JC_KPI", suffix="_DIEA")
                        await self.manejar_pausa()
                    if any(s in selected for s in ("trabajo_planificado", "programa_semanal", "plan_matriz")):
                        step += 1
                        self.actualizar_progreso(0.50 + (step/max(total_steps,1))*0.20)
                        await h_ordenes_diea.ejecutar(grupo_planif=grupo_planif, layout="KPIAT0610", suffix="_DIEA")
                        await self.manejar_pausa()
                    if "ordenes" in selected:
                        step += 1
                        self.actualizar_progreso(0.50 + (step/max(total_steps,1))*0.20)
                        await h_ots_diea.ejecutar(grupo_planif=grupo_planif, layout="/BDYTD_25_OT", suffix="_DIEA")
                        await self.manejar_pausa()
                else:
                    self.log("⏭️ FASE 2 omitida (Grupos no activados).")

                self.actualizar_progreso(0.75)

                if any(s in selected for s in ("programa_semanal","plan_matriz","trabajo_planificado","avisos","ordenes")):
                    self.log("📊 FASE 3: Generando Excel consolidado...")
                    from backend.utils.post_procesador import PostProcesador
                    import glob as _glob
                    output_dir = get_output_dir()
                    fecha_str = datetime.now().strftime("%d%m%Y")
                    def _buscar(patron, excluir=None):
                        files = [f for f in os.listdir(output_dir) if patron in f and f.endswith(".xlsx") and not f.startswith("~$")]
                        if excluir: files = [f for f in files if excluir not in f]
                        if not files: return None
                        full = [os.path.join(output_dir,f) for f in files]
                        return sorted(full, key=os.path.getmtime, reverse=True)[0]
                    rutas = {
                        "avisos": [_buscar("Proy_avi",excluir="_DIEA"), _buscar("Proy_avi_DIEA")],
                        "ordenes": [_buscar("Proy_ots",excluir="_DIEA"), _buscar("Proy_ots_DIEA")],
                        "trabajo": [_buscar("Proy_37N",excluir="_DIEA"), _buscar("Proy_37N_DIEA")]
                    }
                    for k,v in rutas.items():
                        f1 = os.path.basename(v[0]) if v[0] else "No encontrado"
                        f2 = os.path.basename(v[1]) if v[1] else "No encontrado (DIEA)"
                        self.log(f"📁 {k.capitalize()}: {f1} + {f2}")
                    self.actualizar_progreso(0.85)
                    def _hilo_macro():
                        try:
                            post = PostProcesador(log_fn=self.log)
                            ok = post.ejecutar(semana_proy, fecha_base_proy, rutas, dias_venc_avisos=dias_venc_avisos, dias_venc_ordenes=dias_venc_ordenes, use_pto_trabajo=use_pto_trabajo)
                            if ok:
                                self.log("✨ Reporte consolidado con éxito.", "ok")
                                self.actualizar_progreso(1.0)
                            else:
                                self.log("❌ Error en post-procesamiento.", "error")
                                self.actualizar_progreso(0.0)
                        except Exception as e:
                            self.log(f"❌ Excepción macro: {e}", "error")
                            self.actualizar_progreso(0.0)
                    import threading as _th
                    _th.Thread(target=_hilo_macro, daemon=True).start()

                self.log("✅ Flujo de proyecciones finalizado.", "ok")

            elif modo == "full":
                self.log("📡 FASE 1: Consultas por Unidades Técnicas...")
                self.actualizar_progreso(0.35)
                await h_avisos.ejecutar(lista_uts=lista_uts, layout="/JC_KPI", suffix="")
                await self.manejar_pausa()
                self.actualizar_progreso(0.50)
                await h_ots.ejecutar(lista_uts=lista_uts, layout="/BDYTD_25_OT", suffix="")
                await self.manejar_pausa()

                self.actualizar_progreso(0.65)
                await h_ordenes.ejecutar(lista_uts=lista_uts, layout="KPIAT0610", suffix="",
                                         excel_plan_matriz=excel_plan_matriz)
                await self.manejar_pausa()

                self.log("📡 FASE 2: Consultas por Grupo de Planificación (DIEA)...")
                self.actualizar_progreso(0.75)
                await h_avisos_diea.ejecutar(grupo_planif=grupo_planif, layout="/JC_KPI", suffix="_DIEA")
                await self.manejar_pausa()

                self.actualizar_progreso(0.85)
                await h_ots_diea.ejecutar(grupo_planif=grupo_planif, layout="/BDYTD_25_OT", suffix="_DIEA")
                await self.manejar_pausa()

                self.actualizar_progreso(0.95)
                await h_ordenes_diea.ejecutar(grupo_planif=grupo_planif, layout="KPIAT0610", suffix="_DIEA")

                self.log("✅ Ciclo de descargas completo finalizado correctamente.", "ok")
                self.actualizar_progreso(1.0)

            elif modo == "avisos_ut":
                await h_avisos.ejecutar(lista_uts=lista_uts)
                self.actualizar_progreso(1.0)
            elif modo == "ots_ut":
                await h_ots.ejecutar(lista_uts=lista_uts)
                self.actualizar_progreso(1.0)
            elif modo == "ordenes_ut":
                await h_ordenes.ejecutar(lista_uts=lista_uts, excel_plan_matriz=excel_plan_matriz)
                self.actualizar_progreso(1.0)

            elif modo == "avisos_diea":
                await h_avisos_diea.ejecutar(grupo_planif=grupo_planif)
                self.actualizar_progreso(1.0)
            elif modo == "ots_diea":
                await h_ots_diea.ejecutar(grupo_planif=grupo_planif)
                self.actualizar_progreso(1.0)
            elif modo == "ordenes_diea":
                await h_ordenes_diea.ejecutar(grupo_planif=grupo_planif)
                self.actualizar_progreso(1.0)

            elif modo == "avisos_st":
                await h_avisos_st.ejecutar(lista_grupos=lista_grupos_st)
                self.actualizar_progreso(1.0)
            elif modo == "ots_st":
                await h_ots_st.ejecutar(lista_grupos=lista_grupos_st)
                self.actualizar_progreso(1.0)

        except Exception as e:
            self.log(f"❌ Error crítico en automatización SAP ({modo}): {e}", "error")
        finally:
            self.running = False
            if self.browser_mgr:
                await self.browser_mgr.cerrar()
                self.browser_mgr = None

    def _buscar_excel_reciente(self, output_dir: str, patron: str, excluir: str = None) -> str | None:
        try:
            if not os.path.exists(output_dir):
                return None
            archivos = [
                f for f in os.listdir(output_dir)
                if patron in f and f.endswith(".xlsx") and not f.startswith("~$")
            ]
            if excluir:
                archivos = [f for f in archivos if excluir not in f]
            if not archivos:
                return None
            rutas = [os.path.join(output_dir, f) for f in archivos]
            return sorted(rutas, key=os.path.getmtime, reverse=True)[0]
        except Exception:
            return None
