import asyncio
from typing import List, Optional
from datetime import datetime
from .sap_navigator import SAPNavigator
from .iw29_handler import IW29Handler
import os
import re

class ProyeccionAvisosDieaHandler:
    def __init__(self, page, log_func, url_base=""):
        self.page = page
        self.log = log_func
        self.nav = SAPNavigator(page, url_base, log_fn=log_func)
        self.iw29 = IW29Handler(page, log_fn=log_func)

    async def ejecutar(self, grupo_planif: str = "CI0", layout: str = "/JC_KPI", suffix: str = "_DIEA"):
        self.log(f"[DIEA-DEDICADO] 🔧 Iniciando Proyección Avisos DIEA...")
        await self.nav.abrir_transaccion_gui_url("IW29")

        # --- VERIFICACIÓN DE CUENTA (Login Bloqueo) ---
        try:
            if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=3000):
                self.log("🔐 Bloqueo detectado: 'Selección de la cuenta'. Seleccionando cuenta @contratistas...")
                await self.page.get_by_text(re.compile(r".*@contratistas\.codelco\.cl", re.IGNORECASE)).first.click()
                await self.page.wait_for_load_state("networkidle", timeout=15000)
        except: pass

        await self.iw29.preparar()
        ctx = self.iw29._ctx

        # 1. Filtro 'Pendiente' (Asegurar que En tratam. esté desmarcado)
        try:
            self.log("🔘 Desmarcando filtro 'En tratam.'...")
            chk_tratamiento = ctx.get_by_role("checkbox", name=re.compile(r"En tratam", re.IGNORECASE))
            if await chk_tratamiento.is_visible(timeout=2000):
                await chk_tratamiento.set_checked(False)
        except Exception as e:
            self.log(f"ℹ️ Nota sobre filtro 'En tratam.': {e}")

        # 2. Limpieza de fechas
        await self.iw29._limpiar_fechas()

        # 3. Layout e ingreso Centro Planificación
        await self.iw29._aplicar_layout(layout)

        # 4. Filtro por Grupo (Selector específico dado por el usuario)
        self.log(f"[IW29-DIEA] 🔧 Filtrando por Grupo Planificación: {grupo_planif}")
        try:
            # Selector exacto: get_by_role("textbox", name="Grupo planificación")
            campo = ctx.get_by_role("textbox", name="Grupo planificación").first
            await campo.fill(grupo_planif)
            await self.page.keyboard.press("Tab") # Cambiado de Enter a Tab para mayor estabilidad
            await asyncio.sleep(1)
        except Exception as e:
            self.log(f"⚠️ Error al filtrar grupo: {e}")

        # 5. Ejecutar
        self.log("🚀 Ejecutando reporte IW29 DIEA...")
        try:
            # Intentar click directo en Ejecutar (o cualquier botón que diga Ejecutar)
            await ctx.get_by_role("button", name=re.compile(r"Ejecutar", re.IGNORECASE)).click(timeout=5000)
        except:
            # Si el botón no es clicable, usar F8 (comando estándar de SAP para Ejecutar)
            await self.page.keyboard.press("F8")
        
        await asyncio.sleep(2)

        # 5.1 Verificación de errores inmediatos (No hay datos)
        try:
            msg_area = ctx.locator("#msgarea-itms")
            if await msg_area.is_visible(timeout=2000):
                # Tomar solo la primera línea del mensaje para el log
                texto_msg = await msg_area.inner_text()
                lineas = [l.strip() for l in texto_msg.split("\n") if l.strip()]
                msg_limpio = lineas[0] if lineas else "Sin mensaje"
                
                if any(x in msg_limpio.lower() for x in ["no encontr", "no ha selecc", "ningún obj"]):
                    self.log(f"⚠️ SAP indica: {msg_limpio}. Finalizando.")
                    return None
        except: pass

        # 6. Descargar y Guardar (INDIVIDUAL DIEA)
        ruta = await self.exportar_diea()
        if ruta:
            fecha_f = datetime.now().strftime("%d%m%Y")
            nombre_final = f"{fecha_f}_Proy_avi{suffix}.xlsx"
            ruta_final = os.path.join(os.path.dirname(ruta), nombre_final)
            if os.path.exists(ruta_final): os.remove(ruta_final)
            os.rename(ruta, ruta_final)
            self.log(f"[IW29-DIEA] ✅ Guardado: {nombre_final}")
            return ruta_final
        else:
            self.log(f"[IW29-DIEA] ❌ No se pudo completar la descarga.")
            return None

    async def exportar_diea(self) -> Optional[str]:
        """Maneja la exportación robusta desde la pantalla de resultados."""
        ctx = self.iw29._ctx
        try:
            # 1. Esperar a que la lista cargue
            btn_lista = ctx.get_by_role("button", name="Lista")
            await btn_lista.wait_for(state="visible", timeout=60000)
            await btn_lista.click()
            
            # 2. Flujo ALV
            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

            # 3. CAPTURAR DESCARGA Y POPUP
            self.log("📥 Confirmando modal de exportación final...")
            async with self.page.expect_download() as download_info:
                try:
                    # PASO 1: Clic en el botón principal de exportación
                    encontrado_export = False
                    for name in ["Exportar a...", "Exportar"]:
                        btn = ctx.get_by_role("button", name=name)
                        if await btn.is_visible(timeout=2000):
                            await btn.click()
                            encontrado_export = True
                            break
                    
                    if not encontrado_export:
                        await self.page.keyboard.press("Enter")
                    
                    await asyncio.sleep(1.5) # Espera para el segundo modal de confirmación

                    # PASO 2: Clic en 'OK' para confirmar el inicio de la descarga
                    btn_ok = ctx.get_by_role("button", name="OK")
                    if await btn_ok.is_visible(timeout=2000):
                        await btn_ok.click()
                    else:
                        await self.page.keyboard.press("Enter")
                        
                except Exception as e:
                    self.log(f"⚠️ Error confirmando descarga secuencial: {e}")
                    await self.page.keyboard.press("Enter")
                
                # Gestión del popup opcional de SAP
                try:
                    async with self.page.expect_popup(timeout=3000) as popup_info:
                        pass 
                    popup = await popup_info.value
                    await popup.close()
                except: pass

            download = await download_info.value
            os.makedirs(os.path.join(os.getcwd(), "output"), exist_ok=True)
            temp_path = os.path.join(os.getcwd(), "output", f"tmp_avi_diea_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)
            return temp_path
        except Exception as e:
            self.log(f"❌ Error en exportación DIEA: {e}")
            return None
