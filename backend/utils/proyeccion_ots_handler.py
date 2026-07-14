import asyncio
from typing import List, Optional
from datetime import datetime, timedelta
from .sap_navigator import SAPNavigator
from .iw29_handler import IW29Handler
import re
import os
from .paths import get_output_dir
import pandas as pd


class ProyeccionOtsHandler:
    def __init__(self, page, log_func, url_base=""):
        self.page = page
        self.log = log_func
        self.nav = SAPNavigator(page, url_base, log_fn=log_func)
        self.iw29 = IW29Handler(page, log_fn=log_func)

    def _leer_ordenes_de_excel(self, excel_path: str) -> List[str]:
        """
        Lee las órdenes de mantenimiento desde una columna que contenga 'orden'
        de un Excel exportado de SAP o manual (formato MIME o XLSX).
        Retorna lista de órdenes únicas, excluyendo filas de subtotal.
        """
        try:
            from .kpi_excel_processor import read_raw_sap_file
            df = read_raw_sap_file(excel_path)
            
            # Intentar encontrar la columna por nombre en las primeras filas
            col_idx = 8  # Default: col I (Orden mantenimiento)
            if len(df) > 0:
                for test_row in range(min(4, len(df))):
                    header_row = [str(v).strip().lower() for v in list(df.iloc[test_row])]
                    exact = next((i for i, h in enumerate(header_row)
                                  if h == 'orden mantenimiento' or 'orden' in h and 'mantenimiento' in h), None)
                    if exact is not None:
                        col_idx = exact
                        break
                    generic = next((i for i, h in enumerate(header_row)
                                    if h == 'orden' or ('orden' in h and 'clase' not in h and 'sub' not in h)), None)
                    if generic is not None:
                        col_idx = generic
                        break

            ordenes = set()
            for i, row in df.iterrows():
                val = row.iloc[col_idx] if col_idx < len(row) else None
                if val is None:
                    continue
                s = str(val).strip()
                # Ignorar encabezados, subtotales y valores inválidos
                if s.lower() in ('', 'nan', 'resultado', 'resultado total', 'orden mantenimiento', 'orden mantenimiento_1', 'orden'):
                    continue
                if s.isdigit() and len(s) >= 6:
                    ordenes.add(s)
            
            resultado = sorted(ordenes)
            self.log(f"[IW39] 📋 {len(resultado)} órdenes leídas del Excel de Trabajo Planificado")
            return resultado
        except Exception as e:
            self.log(f"⚠️ Error leyendo órdenes del Excel: {e}")
            return []

    async def ejecutar(self, lista_uts: Optional[List[str]] = None, grupo_planif: Optional[str] = None,
                       layout: str = "/BDytd_25_ot", suffix: str = "",
                       excel_trab_plan: Optional[str] = None):
        """
        Ejecuta la automatización de la transacción SAP IW39 utilizando la secuencia exacta de Playwright grabada por el usuario.
        Lee las órdenes desde excel_trab_plan para subirlas mediante selección múltiple, limpia período y fecha final,
        aplica el layout y finalmente descarga el listado consolidado.
        """
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

        # 1. Filtro 'concluido' (Clic directo según codegen)
        self.log("🔘 Marcando filtro 'concluido'...")
        try:
            await ctx.get_by_role("checkbox", name="concluido").click()
        except Exception as e:
            self.log(f"⚠️ Error al marcar 'concluido': {e}")

        # 2. Selección múltiple de órdenes desde el Excel de Trabajo Planificado (si está disponible)
        if excel_trab_plan and os.path.exists(excel_trab_plan):
            lista_ordenes = self._leer_ordenes_de_excel(excel_trab_plan)
            if lista_ordenes:
                self.log(f"[IW39] 📋 Cargando {len(lista_ordenes)} órdenes via selección múltiple...")
                try:
                    await ctx.get_by_role("button", name="Selección múltiple").first.click()
                    await asyncio.sleep(1)

                    import pyperclip
                    pyperclip.copy("\r\n".join(lista_ordenes))

                    await ctx.get_by_role("button", name="Upload del portapapeles (Mayú").click()
                    await asyncio.sleep(1)
                    await ctx.get_by_role("button", name="Tomar (F8)").click()
                except Exception as e:
                    self.log(f"⚠️ Error cargando órdenes en IW39: {e}")
            else:
                self.log("⚠️ No se encontraron órdenes válidas en el Excel. Continuando sin selección múltiple.")

        # 3. Limpieza de Período y Fecha Final
        self.log("🧹 Limpiando Período y Fecha Final...")
        try:
            await ctx.get_by_role("textbox", name="Período").click()
            await ctx.get_by_role("textbox", name="Período").fill("")
            await ctx.get_by_role("textbox", name="a", description="Ayuda para entrada disponible A fecha", exact=True).click()
            await ctx.get_by_role("textbox", name="a", description="Ayuda para entrada disponible A fecha", exact=True).fill("")
        except Exception as e:
            self.log(f"⚠️ Error limpiando fechas: {e}")

        # 4. Layout: Escribir el nombre completo y presionar Enter
        self.log(f"🎨 Aplicando Layout: {layout}")
        try:
            await ctx.get_by_role("textbox", name="Layout").click()
            await ctx.get_by_role("textbox", name="Layout").fill(layout)
            await self.page.keyboard.press("Enter")
            await asyncio.sleep(1)
        except Exception as e:
            self.log(f"⚠️ Error aplicando layout: {e}")

        # 5. Ejecutar
        self.log("🚀 Ejecutando...")
        try:
            await ctx.get_by_role("button", name="Ejecutar  Resaltado").click()
        except Exception as e:
            self.log(f"⚠️ Error al hacer clic en Ejecutar: {e}")
            await self.page.keyboard.press("F8")

        await asyncio.sleep(2)

        # 6. Descargar y exportar
        self.log("📥 Exportando Hoja de cálculo del coste...")
        try:
            await ctx.get_by_role("button", name="Lista").click()
            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

            async with self.page.expect_download() as download_info:
                async with self.page.expect_popup() as page1_info:
                    await ctx.get_by_role("button", name="OK").click()
                page1 = await page1_info.value
                download = await download_info.value
                await page1.close()

            os.makedirs(get_output_dir(), exist_ok=True)
            temp_path = os.path.join(get_output_dir(), f"tmp_ots_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(temp_path)

            fecha_f = datetime.now().strftime("%d%m%Y")
            nombre_final = f"{fecha_f}_Proy_ots{suffix}.xlsx"
            ruta_final = os.path.join(os.path.dirname(temp_path), nombre_final)
            if os.path.exists(ruta_final): os.remove(ruta_final)
            os.rename(temp_path, ruta_final)
            self.log(f"[IW39] ✅ Guardado: {nombre_final}")
            return ruta_final

        except Exception as e:
            self.log(f"❌ Error en exportación OTs: {e}")
            return None

