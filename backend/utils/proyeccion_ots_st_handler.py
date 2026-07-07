import asyncio
from typing import List, Optional
from datetime import datetime, timedelta
from .sap_navigator import SAPNavigator
from .iw29_handler import IW29Handler
import os
from .paths import get_output_dir
import re
import pyperclip

class ProyeccionOtsStHandler:
    def __init__(self, page, log_func, url_base=""):
        self.page = page
        self.log = log_func
        self.nav = SAPNavigator(page, url_base, log_fn=log_func)
        self.iw29 = IW29Handler(page, log_fn=log_func)

    async def ejecutar(self, lista_grupos: List[str], layout: str = "/BDytd_25_ot", suffix: str = "_ST"):
        self.log(f"[OT-ST-MASIVO] 🗂️ Iniciando Proyección OTs ST (Masivo)...")
        await self.nav.abrir_transaccion_gui_url("IW39")

        # --- VERIFICACIÓN DE CUENTA (Login Bloqueo) ---
        try:
            if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=3000):
                self.log("🔐 Bloqueo detectado: 'Selección de la cuenta'. Seleccionando cuenta @contratistas...")
                await self.page.get_by_text(re.compile(r".*@contratistas\.codelco\.cl", re.IGNORECASE)).first.click()
                await self.page.wait_for_load_state("networkidle", timeout=15000)
        except: pass

        await self.iw29.preparar()
        ctx = self.iw29._ctx

        # 0. Manejo de popups iniciales
        try:
             await ctx.get_by_role("button", name="Cerrar").click(timeout=3000)
        except: pass

        # 1. Filtro 'Pendiente' (Para OTs suele ser 'En tratam.' marcado)
        try:
            self.log("🔘 Asegurando filtro 'En tratam.' marcado...")
            chk_tratamiento = ctx.get_by_role("checkbox", name=re.compile(r"En tratam", re.IGNORECASE))
            if await chk_tratamiento.is_visible(timeout=2000):
                await chk_tratamiento.set_checked(True)
        except Exception as e:
            self.log(f"ℹ️ Nota sobre filtro 'En tratam.': {e}")

        # 2. Configuración de periodo y fecha final
        try:
            self.log("🧹 Limpiando periodo y configurando fecha de corte...")
            await ctx.get_by_role("textbox", name="Período").fill("")
            
            # Lunes de la semana anterior (14 días atrás)
            hoy = datetime.now()
            lunes_pasado = hoy - timedelta(days=hoy.weekday() + 14)
            f_corte = lunes_pasado.strftime("%d.%m.%Y")
            
            self.log(f"📅 Fecha de corte calculada: {f_corte}")
            await ctx.get_by_title(re.compile(r"A fecha", re.IGNORECASE)).fill(f_corte)
            await self.page.keyboard.press("Tab")
            await asyncio.sleep(1)
        except Exception as e:
            self.log(f"⚠️ Error configurando fechas: {e}")

        # 3. Selección Múltiple Grupo Planificación
        self.log(f"📑 Ingresando {len(lista_grupos)} Grupos de Planificación masivamente...")
        try:
            # Limpieza preventiva de Grupo 
            try:
                # En IW39 el nombre puede ser "Gr.planif.mantenimiento HRuta" o similar
                c_grp = ctx.get_by_role("textbox", name=re.compile(r"Gr\.planif", re.IGNORECASE)).first
                if await c_grp.is_visible(timeout=500): 
                    await c_grp.fill("")
            except: pass

            # El botón de selección múltiple (ID confirmado por el usuario para IW39)
            btn_seleccion = ctx.locator("[id='M0:46:::88:78']") 
            if not await btn_seleccion.is_visible(timeout=2000):
                # Fallback: En IW39 suele ser el índice 4 para Grupo Planificación
                btn_seleccion = ctx.get_by_role("button", name="Selección múltiple").nth(4)

            await btn_seleccion.click()
            await asyncio.sleep(2)
            
            # Copiar al portapapeles
            pyperclip.copy("\r\n".join(lista_grupos))
            
            # Pegar (Shift+F12)
            await self.page.keyboard.press("Shift+F12")
            await asyncio.sleep(1.5)
            
            # Confirmar selección (Tomar / F8)
            try:
                btn_tomar = ctx.get_by_role("button", name="Tomar (F8)")
                if await btn_tomar.is_visible(timeout=1000):
                    await btn_tomar.click()
                else:
                    await self.page.keyboard.press("F8")
            except:
                await self.page.keyboard.press("F8")
            
            await asyncio.sleep(1)
            self.log("✅ Grupos cargados correctamente.")
        except Exception as e:
            self.log(f"⚠️ Error al cargar grupos masivamente: {e}")

        # 4. Layout
        try:
            await ctx.get_by_role("textbox", name="Layout").fill(layout)
            await self.page.keyboard.press("Enter")
            await asyncio.sleep(1)
        except: pass

        # 5. Ejecutar
        self.log("🚀 Ejecutando reporte IW39 ST...")
        try:
            await ctx.get_by_role("button", name=re.compile(r"Ejecutar", re.IGNORECASE)).click(timeout=5000)
        except:
            await self.page.keyboard.press("F8")
        
        await asyncio.sleep(3)

        # 5.1 Verificación de errores
        try:
            msg_area = ctx.locator("#msgarea-itms")
            if await msg_area.is_visible(timeout=2000):
                texto_msg = await msg_area.inner_text()
                if any(x in texto_msg.lower() for x in ["no encontr", "no ha selecc", "ningún obj"]):
                    self.log(f"⚠️ SAP indica: {texto_msg.strip()}. Finalizando.")
                    return None
        except: pass

        # 6. Descargar y Guardar
        fecha_f = datetime.now().strftime("%d%m%Y")
        nombre_final = f"{fecha_f}_DIEA_Proy_ots{suffix}.xlsx"
        ruta_final = os.path.join(get_output_dir(), nombre_final)
        
        ruta = await self.exportar_st()
        if ruta:
            if os.path.exists(ruta_final): os.remove(ruta_final)
            os.rename(ruta, ruta_final)
            self.log(f"[IW39-ST] ✅ Guardado reporte consolidado: {nombre_final}")
            return ruta_final
        else:
            self.log(f"[IW39-ST] ❌ No se pudo completar la descarga.")
            return None

    async def exportar_st(self) -> Optional[str]:
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
            os.makedirs(get_output_dir(), exist_ok=True)
            temp_path = os.path.join(get_output_dir(), f"tmp_ots_st_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)
            return temp_path
        except Exception as e:
            self.log(f"❌ Error en exportación OTs ST: {e}")
            return None
