import asyncio
from typing import List, Optional
from datetime import datetime, timedelta
from .sap_navigator import SAPNavigator
from .iw29_handler import IW29Handler
import os
import re
import pyperclip

class ProyeccionOtsDieaHandler:
    def __init__(self, page, log_func, url_base=""):
        self.page = page
        self.log = log_func
        self.nav = SAPNavigator(page, url_base, log_fn=log_func)
        self.iw29 = IW29Handler(page, log_fn=log_func)

    async def ejecutar(self, grupo_planif: str = "CI0", layout: str = "/BDytd_25_ot", suffix: str = "_DIEA"):
        self.log(f"[DIEA-DEDICADO] 🗂️ Iniciando Proyección OTs DIEA...")
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

        # 1. Filtro 'Pendiente' (Asegurar que En tratam. esté MARCADO)
        try:
            self.log("🔘 Marcando filtro 'En tratam.'...")
            chk_tratamiento = ctx.get_by_role("checkbox", name=re.compile(r"En tratam", re.IGNORECASE))
            if await chk_tratamiento.is_visible(timeout=2000):
                await chk_tratamiento.set_checked(True)
        except Exception as e:
            self.log(f"ℹ️ Nota sobre filtro 'En tratam.': {e}")

        # 1. Configuración de periodo y fecha final (Limpieza y Fechas primero)
        try:
            self.log("🧹 Limpiando periodo y configurando fecha de corte...")
            await ctx.get_by_role("textbox", name="Período").fill("")
            
            # Lunes de la semana anterior (14 días atrás según requerimiento)
            hoy = datetime.now()
            lunes_pasado = hoy - timedelta(days=hoy.weekday() + 14)
            f_corte = lunes_pasado.strftime("%d.%m.%Y")
            
            self.log(f"📅 Fecha de corte calculada (Lunes anterior): {f_corte}")
            await ctx.get_by_title(re.compile(r"A fecha", re.IGNORECASE)).fill(f_corte)
            await self.page.keyboard.press("Tab")
            await asyncio.sleep(1)
        except Exception as e:
            self.log(f"⚠️ Error configurando fechas: {e}")

        # 2. Filtro por Grupo (Usando Modal + Pegado Masivo para mayor robustez)
        self.log(f"[IW39-DIEA] 📑 Ingresando Grupo Planificación: {grupo_planif}")
        try:
            # Limpieza preventiva
            try:
                c_grp = ctx.get_by_role("textbox", name=re.compile(r"Gr\.planif", re.IGNORECASE)).first
                if await c_grp.is_visible(timeout=500): await c_grp.fill("")
            except: pass

            # Abrir modal de selección múltiple con el ID proporcionado por el usuario
            btn_seleccion = ctx.locator("[id='M0:46:::88:78']")
            await btn_seleccion.click()
            await asyncio.sleep(1.5)
            import pyperclip
            # Si vienen separados por coma, o salto de linea desde frontend
            # Reemplazar comas por saltos de linea y limpiar
            grupos_fmt = "\r\n".join([g.strip() for g in grupo_planif.replace(",", "\n").split("\n") if g.strip()])
            pyperclip.copy(grupos_fmt)
            
            await self.page.keyboard.press("Shift+F12")
            await asyncio.sleep(1)
            
            # Tomar (F8)
            try:
                await ctx.get_by_role("button", name="Tomar (F8)").click(timeout=2000)
            except:
                await self.page.keyboard.press("F8")
                
            await asyncio.sleep(1)
            self.log("✅ Grupo cargado correctamente.")
        except Exception as e:
            self.log(f"⚠️ Error al filtrar grupo: {e}")

        # 3. Layout (Nombre exacto del script manual)
        try:
            await ctx.get_by_role("textbox", name="Layout").fill(layout)
            await self.page.keyboard.press("Enter")
            await asyncio.sleep(1)
        except: pass

        # 4. Ejecutar (Usando el nombre exacto del script manual)
        self.log("🚀 Ejecutando...")
        try:
            # Intentar click en el botón de ejecutar resaltado
            await ctx.get_by_role("button", name=re.compile(r"Ejecutar", re.IGNORECASE)).click(timeout=5000)
        except:
            await self.page.keyboard.press("F8")
        
        await asyncio.sleep(2)

        # 4.1 Verificación de errores inmediatos (No hay datos)
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

        # 5. Descargar
        ruta = await self.exportar_fase_final()
        if ruta:
            fecha_f = datetime.now().strftime("%d%m%Y")
            nombre_final = f"{fecha_f}_Proy_ots{suffix}.xlsx"
            ruta_final = os.path.join(os.path.dirname(ruta), nombre_final)
            if os.path.exists(ruta_final): os.remove(ruta_final)
            os.rename(ruta, ruta_final)
            self.log(f"[IW39] ✅ Guardado: {nombre_final}")
            return ruta_final

    async def exportar_fase_final(self) -> Optional[str]:
        ctx = self.iw29._ctx
        try:
            # Esperar botón Lista (ALV)
            self.log("⏳ Esperando tabla de resultados (timeout 5s)...")
            btn_lista = ctx.get_by_role("button", name="Lista")
            try:
                await btn_lista.wait_for(state="visible", timeout=5000)
            except:
                self.log("⚠️ No se detectó tabla de resultados en 5s. Posiblemente no hay datos.")
                # Verificar mensajes de "No hay datos"
                mensajes_vacio = [r"No.*encontrado", r"No.*seleccionado", r"Seleccione.*objetos"]
                for msg in mensajes_vacio:
                    if await ctx.get_by_text(re.compile(msg, re.IGNORECASE)).is_visible():
                        self.log("ℹ️ SAP confirmó: No se encontraron datos para los filtros aplicados.")
                        break
                return None

            await btn_lista.click()
            
            # Iniciar exportación
            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

            # 3. CAPTURAR DESCARGA Y POPUP
            self.log("📥 Confirmando modal de exportación final...")
            async with self.page.expect_download() as download_info:
                try:
                    # PASO 1: Clic en el botón principal de exportación (según lo visto en captura)
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
            os.makedirs(os.environ.get("_MONITORING_OUTPUT_DIR", os.path.join(os.getcwd(), "output")), exist_ok=True)
            temp_path = os.path.join(os.environ.get("_MONITORING_OUTPUT_DIR", os.path.join(os.getcwd(), "output")), f"tmp_ots_diea_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)
            return temp_path
        except Exception as e:
            self.log(f"❌ Error en exportación DIEA: {e}")
            return None
