import asyncio
from typing import List, Optional
from datetime import datetime, timedelta
from .sap_navigator import SAPNavigator
from .iw29_handler import IW29Handler
import re
import os
from .paths import get_output_dir

class ProyeccionOtsHandler:
    def __init__(self, page, log_func, url_base=""):
        self.page = page
        self.log = log_func
        self.nav = SAPNavigator(page, url_base, log_fn=log_func)
        self.iw29 = IW29Handler(page, log_fn=log_func)

    async def ejecutar(self, lista_uts: Optional[List[str]] = None, grupo_planif: Optional[str] = None, layout: str = "/BDytd_25_ot", suffix: str = ""):
        self.log(f"[IW39] 🗂️ Iniciando Proyección OTs{suffix}...")
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

        # 1. Filtro 'Pendiente' (Asegurar que En tratam. esté MARCADO)
        try:
            self.log("🔘 Marcando filtro 'En tratam.'...")
            chk_tratamiento = ctx.get_by_role("checkbox", name=re.compile(r"En tratam", re.IGNORECASE))
            if await chk_tratamiento.is_visible(timeout=2000):
                await chk_tratamiento.set_checked(True)
        except Exception as e:
            self.log(f"ℹ️ Nota sobre filtro 'En tratam.': {e}")

        # 2. Filtros de UT o Grupo (Según secuencia manual: primero la selección)
        if lista_uts:
            self.log(f"[IW39] 🗂️ Selección múltiple UT (nth 2)...")
            try:
                # En IW39 el nth(2) es UT según script manual
                await ctx.get_by_role("button", name="Selección múltiple").nth(2).click()
                await asyncio.sleep(1)
                
                import pyperclip
                pyperclip.copy("\r\n".join(lista_uts))
                
                # Botón Upload
                btn_pegar = ctx.get_by_role("button", name=re.compile(r"Upload.*portapapeles", re.IGNORECASE))
                if await btn_pegar.is_visible(timeout=2000):
                    await btn_pegar.click()
                else:
                    await self.page.keyboard.press("Shift+F12")
                
                await asyncio.sleep(1)
                await ctx.get_by_role("button", name="Tomar (F8)").click()
            except Exception as e:
                self.log(f"⚠️ Error en UTs IW39: {e}")

        elif grupo_planif:
            self.log(f"[IW39] 🗂️ Filtrando por Grupo: {grupo_planif}")
            try:
                import pyperclip
                grupos_fmt = "\r\n".join([g.strip() for g in grupo_planif.replace(",", "\n").split("\n") if g.strip()])
                campo = ctx.get_by_role("textbox", name="Grupo planificación").first
                
                if "\r\n" in grupos_fmt:
                    btn_seleccion = ctx.locator("[id='M0:46:::88:78']")
                    await btn_seleccion.click()
                    await asyncio.sleep(1.5)
                    pyperclip.copy(grupos_fmt)
                    await self.page.keyboard.press("Shift+F12")
                    await asyncio.sleep(1.5)
                    try:
                        await ctx.get_by_role("button", name="Tomar (F8)").click(timeout=2000)
                    except:
                        await self.page.keyboard.press("F8")
                    await asyncio.sleep(1)
                else:
                    await campo.fill(grupo_planif)
                    await self.page.keyboard.press("Enter")
            except Exception as e:
                self.log(f"⚠️ Error al filtrar grupo: {e}")

        # 2. Limpieza de Periodo y Fecha Final (Sigue la secuencia manual)
        try:
            self.log("🧹 Configurando periodo y fecha final...")
            # Limpiar Periodo
            await ctx.get_by_role("textbox", name="Período").fill("")
            
            # Calcular Lunes de la semana anterior (14 días atrás)
            hoy = datetime.now()
            lunes_pasado = hoy - timedelta(days=hoy.weekday() + 14)
            f_corte = lunes_pasado.strftime("%d.%m.%Y")
            
            # Llenar "A fecha"
            self.log(f"📅 Fecha de corte calculada: {f_corte}")
            await ctx.get_by_title(re.compile(r"A fecha", re.IGNORECASE)).fill(f_corte)
            await self.page.keyboard.press("Tab")
        except Exception as e:
            self.log(f"⚠️ Error configurando fechas: {e}")

        # 3. Layout (Nombre exacto del script manual)
        try:
            await ctx.get_by_role("textbox", name="Layout").fill(layout)
        except: pass

        # 4. Ejecutar (Usando el nombre exacto del script manual)
        self.log("🚀 Ejecutando...")
        try:
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

    async def exportar_fase_final(self) -> Optional[str]:
        ctx = self.iw29._ctx
        try:
            btn_lista = ctx.get_by_role("button", name="Lista")
            await btn_lista.wait_for(state="visible", timeout=60000)
            await btn_lista.click()
            
            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

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
            os.makedirs(get_output_dir(), exist_ok=True)
            temp_path = os.path.join(get_output_dir(), f"tmp_ots_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)
            return temp_path
        except Exception as e:
            self.log(f"❌ Error en exportación OTs: {e}")
            return None
