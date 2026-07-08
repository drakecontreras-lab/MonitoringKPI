import asyncio
from typing import List, Optional
from datetime import datetime, timedelta
from .sap_navigator import SAPNavigator
from .iw29_handler import IW29Handler
import os
import re


class ProyeccionOrdenesHandler:
    def __init__(self, page, log_func, url_base=""):
        self.page = page
        self.log = log_func
        self.nav = SAPNavigator(page, url_base, log_fn=log_func)
        self.iw29 = IW29Handler(page, log_fn=log_func)

    def _leer_ordenes_de_excel(self, excel_path: str) -> List[str]:
        """
        Lee las órdenes de mantenimiento desde la columna 'Orden mantenimiento'
        del Excel de Plan Matriz exportado de SAP.
        Busca la columna por nombre en el encabezado (fila 1) o usa índice 8 como fallback.
        Retorna lista de órdenes únicas, excluyendo subtotales.
        """
        try:
            from .kpi_excel_processor import read_raw_sap_file
            df = read_raw_sap_file(excel_path)
            # Intentar encontrar la columna por nombre en fila 1 (encabezado SAP)
            col_idx = 8  # Índice por defecto (columna I)
            if len(df) > 1:
                header_row = [str(v).strip() for v in list(df.iloc[1])]
                for i, h in enumerate(header_row):
                    if 'orden' in h.lower():
                        col_idx = i
                        break

            ordenes = set()
            for i, row in df.iterrows():
                val = row.iloc[col_idx] if col_idx < len(row) else None
                if val is None:
                    continue
                s = str(val).strip()
                if s in ('', 'nan', 'Resultado', 'Resultado total', 'Orden mantenimiento',
                         'Orden mantenimiento_1'):
                    continue
                if s.isdigit() and len(s) >= 6:
                    ordenes.add(s)
            resultado = sorted(ordenes)
            self.log(f"[IW37N] 📋 {len(resultado)} órdenes leídas del Excel de Plan Matriz")
            return resultado
        except Exception as e:
            self.log(f"⚠️ Error leyendo órdenes del Excel Plan Matriz: {e}")
            return []

    async def ejecutar(self, lista_uts: Optional[List[str]] = None, grupo_planif: Optional[str] = None,
                       layout: str = "/KPIAT0610_M", suffix: str = "",
                       excel_plan_matriz: Optional[str] = None):
        """
        Ejecuta la automatización de la transacción SAP IW37N utilizando la secuencia de Playwright grabada por el usuario.
        Lee las órdenes del excel_plan_matriz para subirlas por selección múltiple, marca "Cerrado", limpia período,
        selecciona la pestaña "Otros", ingresa el layout y realiza la exportación de resultados.
        """
self.log(f"[IW37N] 📋 Iniciando Proyección IW37N{suffix}...")
        await self.nav.abrir_transaccion_gui_url("IW37N")
        # Esperar que la página cargue completamente antes de interactuar
        await asyncio.sleep(3)

        # --- VERIFICACIÓN DE CUENTA (Login Bloqueo) ---
        try:
            if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=3000):
                self.log("🔐 Bloqueo detectado: 'Selección de la cuenta'. Seleccionando cuenta corporativa...")
                cuenta = self.page.get_by_text(re.compile(r".*@.*codelco\.cl", re.IGNORECASE)).first
                if await cuenta.is_visible(timeout=3000):
                    await cuenta.click()
                await self.page.wait_for_load_state("networkidle", timeout=15000)
        except: pass

        await self.iw29.preparar()
        ctx = self.iw29._ctx

        try:
            # 1. Filtro 'Cerrado' (Clic según codegen)
            self.log("🔘 Marcando filtro 'Cerrado'...")
            await ctx.get_by_role("checkbox", name="Cerrado").click()

            # 2. Selección múltiple de órdenes desde el Excel Plan Matriz (si está disponible)
            if excel_plan_matriz and os.path.exists(excel_plan_matriz):
                lista_ordenes = self._leer_ordenes_de_excel(excel_plan_matriz)
                if lista_ordenes:
                    self.log(f"[IW37N] 📑 Cargando {len(lista_ordenes)} órdenes masivamente...")
                    await ctx.get_by_role("button", name="Selección múltiple").first.click()
                    await asyncio.sleep(1)

                    import pyperclip
                    pyperclip.copy("\r\n".join(lista_ordenes))

                    # Upload del portapapeles (usando selector exacto recortado del codegen)
                    await ctx.get_by_role("button", name="Upload del portapapeles (Mayú").click()
                    await asyncio.sleep(1)
                    await ctx.get_by_role("button", name="Tomar (F8)").click()
                    await asyncio.sleep(1)
                else:
                    self.log("⚠️ No se encontraron órdenes válidas en el Excel Plan Matriz.")

            # 2.5 Selección múltiple de UT o Grupo (si están disponibles)
            if lista_uts:
                self.log(f"[IW37N] 📍 Ingresando {len(lista_uts)} Ubicaciones Técnicas...")
                try:
                    # En IW37N el nth(2) corresponde a Ubicación Técnica, igual que en IW39
                    await ctx.get_by_role("button", name="Selección múltiple").nth(2).click()
                    await asyncio.sleep(1)
                    
                    import pyperclip
                    pyperclip.copy("\r\n".join(lista_uts))
                    
                    btn_pegar = ctx.get_by_role("button", name=re.compile(r"Upload.*portapapeles", re.IGNORECASE))
                    if await btn_pegar.is_visible(timeout=2000):
                        await btn_pegar.click()
                    else:
                        await self.page.keyboard.press("Shift+F12")
                    
                    await asyncio.sleep(1)
                    await ctx.get_by_role("button", name="Tomar (F8)").click()
                    await asyncio.sleep(1)
                except Exception as e:
                    self.log(f"⚠️ Error en UTs IW37N: {e}")

            elif grupo_planif:
                self.log(f"[IW37N] 🗂️ Filtrando por Grupo de planificación: {grupo_planif}")
                try:
                    import pyperclip
                    grupos_fmt = "\r\n".join([g.strip() for g in grupo_planif.replace(",", "\n").split("\n") if g.strip()])
                    campo = ctx.get_by_role("textbox", name="Grupo planificación").first
                    
                    if "\r\n" in grupos_fmt:
                        try:
                            await ctx.get_by_role("button", name="Selección múltiple").first.click(timeout=2000)
                            await asyncio.sleep(1.5)
                            pyperclip.copy(grupos_fmt)
                            await self.page.keyboard.press("Shift+F12")
                            await asyncio.sleep(1.5)
                            try:
                                await ctx.get_by_role("button", name="Tomar (F8)").click(timeout=2000)
                            except:
                                await self.page.keyboard.press("F8")
                            await asyncio.sleep(1)
                        except Exception as ex:
                            self.log(f"⚠️ No se pudo abrir Selección Múltiple: {ex}. Solo se ingresará el primer grupo.")
                            await campo.fill(grupos_fmt.split("\r\n")[0])
                    else:
                        await campo.fill(grupo_planif)
                        await self.page.keyboard.press("Enter")
                except Exception as e:
                    self.log(f"⚠️ Error en Grupo Planif IW37N: {e}")

            # 3. Limpieza de campo Período
            self.log("🧹 Limpiando Período...")
            await ctx.get_by_role("textbox", name="Período").click()
            await ctx.get_by_role("textbox", name="Período").fill("")

            # 4. Layout: pestaña Otros -> campo Layout
            self.log("🎨 Seleccionando Layout...")
            await ctx.get_by_role("tablist").get_by_text("Otros").click()
            await ctx.get_by_role("textbox", name="Layout").click()
            await ctx.get_by_role("textbox", name="Layout").fill(layout)

            # 5. Ejecutar
            self.log("🚀 Ejecutando (Resaltado)...")
            try:
                await ctx.get_by_role("button", name="Ejecutar  Resaltado").click()
            except Exception as e:
                self.log(f"⚠️ Error al hacer clic en Ejecutar: {e}")
                await self.page.keyboard.press("F8")
                
            await asyncio.sleep(3)

            # 6. Descargar y exportar
            self.log("📥 Exportando Hoja de cálculo...")
            await ctx.get_by_role("button", name="Lista").click()
            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

            # Confirmar y guardar descarga
            async with self.page.expect_download() as download_info:
                async with self.page.expect_popup() as page1_info:
                    await ctx.get_by_role("button", name="OK").click()
                page1 = await page1_info.value
                download = await download_info.value
                await page1.close()

            os.makedirs(os.environ.get("_MONITORING_OUTPUT_DIR", os.path.join(os.getcwd(), "output")), exist_ok=True)
            temp_path = os.path.join(os.environ.get("_MONITORING_OUTPUT_DIR", os.path.join(os.getcwd(), "output")), f"tmp_37N_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)
            
            fecha_f = datetime.now().strftime("%d%m%Y")
            nombre_final = f"{fecha_f}_Proy_37N{suffix}.xlsx"
            ruta_final = os.path.join(os.path.dirname(temp_path), nombre_final)
            if os.path.exists(ruta_final): os.remove(ruta_final)
            os.rename(temp_path, ruta_final)
            self.log(f"[IW37N] ✅ Guardado: {nombre_final}")
            return ruta_final

        except Exception as e:
            self.log(f"❌ Error en flujo IW37N: {e}")
            return None


    async def exportar_fase_final(self) -> Optional[str]:
        """Maneja la exportación desde la pantalla de resultados de IW37N."""
        ctx = self.iw29._ctx
        try:
            btn_lista = ctx.get_by_role("button", name="Lista")
            await btn_lista.wait_for(state="visible", timeout=60000)
            await btn_lista.click()

            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

            self.log("📥 Confirmando modal de exportación final...")
            async with self.page.expect_download() as download_info:
                try:
                    encontrado_export = False
                    for name in ["Exportar a...", "Exportar"]:
                        btn = ctx.get_by_role("button", name=name)
                        if await btn.is_visible(timeout=2000):
                            await btn.click()
                            encontrado_export = True
                            break

                    if not encontrado_export:
                        await self.page.keyboard.press("Enter")

                    await asyncio.sleep(1.5)

                    btn_ok = ctx.get_by_role("button", name="OK")
                    if await btn_ok.is_visible(timeout=2000):
                        await btn_ok.click()
                    else:
                        await self.page.keyboard.press("Enter")

                except Exception as e:
                    self.log(f"⚠️ Error confirmando descarga secuencial: {e}")
                    await self.page.keyboard.press("Enter")

            download = await download_info.value
            os.makedirs(os.environ.get("_MONITORING_OUTPUT_DIR", os.path.join(os.getcwd(), "output")), exist_ok=True)
            temp_path = os.path.join(os.environ.get("_MONITORING_OUTPUT_DIR", os.path.join(os.getcwd(), "output")), f"tmp_37n_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)
            return temp_path
        except Exception as e:
            self.log(f"❌ Error en exportación: {e}")
            return None
