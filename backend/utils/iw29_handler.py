"""
iw29_handler.py - Automatización de la transacción IW29 (Notificaciones PM)
"""
import asyncio
import re
import os
from datetime import datetime
from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout
from typing import Callable, List, Dict, Optional


class IW29Handler:
    """
    Gestiona la transacción IW29 de SAP PM.
    """

    def __init__(self, page: Page, log_fn: Callable = print, pause_fn: Callable = None):
        self.page = page
        self.log = log_fn
        self.pausa_fn = pause_fn
        self.frame = None

    async def preparar(self):
        """Prepara el contexto del iFrame de SAP."""
        # --- VERIFICACIÓN DE CUENTA (Login Bloqueo) ---
        try:
            if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=2000):
                self.log("🔐 Bloqueo detectado en preparar: 'Selección de la cuenta'.")
                await self.page.get_by_text(re.compile(r".*@contratistas\.codelco\.cl", re.IGNORECASE)).first.click()
                await self.page.wait_for_load_state("networkidle", timeout=10000)
        except: pass

        try:
            self.selector_iframe = "iframe[name='application-Shell-startGUI-iframe']"
            iframe_el = await self.page.wait_for_selector(self.selector_iframe, timeout=30000)
            self.frame = await iframe_el.content_frame()
            self.log("✅ iFrame SAP detectado.")
        except PlaywrightTimeout:
            self.frame = self.page
            self.log("⚠️ No se detectó el iframe esperado, intentando en contexto principal.")

    @property
    def _ctx(self):
        return self.frame if self.frame else self.page

    async def _check_p(self):
        if self.pausa_fn: await self.pausa_fn()

    async def _limpiar_fechas(self):
        ctx = self._ctx
        self.log("🧹 Limpiando fechas (Avisos/Órdenes)...")
        # Nombres comunes de campos de fecha en IW29 e IW39
        nombres = ["Fecha de aviso", "hst", "Fecha de entrada", "en", "Período", "Periodo"]
        for campo_nombre in nombres:
            try:
                # Intentar por rol y nombre
                campos = await ctx.get_by_role("textbox", name=re.compile(campo_nombre, re.IGNORECASE)).all()
                for campo in campos:
                    if await campo.is_visible(timeout=500):
                        await campo.click()
                        await self.page.keyboard.press("Control+A")
                        await self.page.keyboard.press("Backspace")
                        await campo.fill("")
            except: pass

    async def _aplicar_layout(self, layout: str):
        ctx = self._ctx
        self.log(f"🎨 Aplicando layout {layout}...")
        try:
            campo_layout = ctx.get_by_role("textbox", name="Layout")
            await campo_layout.fill(layout)
            
            # Centro planificación = CH01 si está visible
            try:
                campo_centro = ctx.get_by_role("textbox", name="Centro planificación")
                if await campo_centro.is_visible(timeout=1000):
                    await campo_centro.fill("CH01")
            except: pass
            
            await self.page.keyboard.press("Enter")
            await asyncio.sleep(1)
        except: pass

    async def _ejecutar_y_descargar(self, custom_path: str = None) -> Optional[str]:
        ctx = self._ctx
        self.log("🚀 Ejecutando y exportando...")
        try:
            # 1. Ejecutar si no se ha hecho
            try:
                btn_ejecutar = ctx.get_by_role("button", name=re.compile(r"Ejecutar", re.IGNORECASE))
                if await btn_ejecutar.is_visible(timeout=2000):
                    await btn_ejecutar.click()
            except: pass
            
            # 2. Esperar botón Lista (ALV)
            try:
                await ctx.get_by_role("button", name="Lista").wait_for(state="visible", timeout=10000)
                await ctx.get_by_role("button", name="Lista").click()
            except PlaywrightTimeout:
                # Verificamos mensajes de "No hay datos" en el área de mensajes
                try:
                    msg_area = ctx.locator("#msgarea-itms")
                    if await msg_area.is_visible(timeout=1000):
                        texto_msg = await msg_area.inner_text()
                        lineas = [l.strip() for l in texto_msg.split("\n") if l.strip()]
                        msg_limpio = lineas[0] if lineas else "Sin mensaje"
                        
                        if any(x in msg_limpio.lower() for x in ["no encontr", "no ha selecc", "ningún obj"]):
                            self.log(f"⚠️ SAP indica: {msg_limpio}. Finalizando.")
                            return None
                except: pass
                
                # Reintento manual F8 si no hay mensaje claro
                await self.page.keyboard.press("F8")
                await asyncio.sleep(2)

            # 3. Iniciar flujo de exportación ALV
            await ctx.get_by_text("Hoja de cálculo del coste", exact=True).click()
            await ctx.get_by_role("button", name="Exportar a...").click()

            # 4. Confirmar Modal Final y Capturar Descarga
            self.log("📥 Confirmando modal OK...")
            async with self.page.expect_download() as download_info:
                # Intentar clic en OK de forma robusta
                try:
                    btn_ok = ctx.get_by_role("button", name="OK")
                    if await btn_ok.is_visible(timeout=3000):
                        await btn_ok.click()
                    else:
                        await self.page.keyboard.press("Enter")
                except:
                    await self.page.keyboard.press("Enter")
                
                # Manejar posible popup de SAP (opcional)
                try:
                    async with self.page.expect_popup(timeout=2000) as popup_info:
                        pass
                    popup = await popup_info.value
                    await popup.close()
                except: pass

            download = await download_info.value
            output_dir = os.path.join(os.getcwd(), "output")
            os.makedirs(output_dir, exist_ok=True)
            
            ruta_final = custom_path if custom_path else os.path.join(output_dir, f"tmp_{datetime.now().strftime('%H%M%S')}.xlsx")
            await download.save_as(ruta_final)
            return ruta_final
        except Exception as e:
            self.log(f"❌ Error en descarga: {e}")
            return None

    async def automatizar_avisos_pendientes(self, lista_uts: List[str], layout: str = "/JC_KPI", solo_filtros: bool = False) -> Optional[str]:
        try:
            ctx = self._ctx
            await self._check_p()

            # 1. Filtro 'Pendiente'
            self.log("🔘 Filtrando avisos pendientes...")
            try:
                chk_tratamiento = ctx.get_by_role("checkbox", name="En tratam.")
                if await chk_tratamiento.is_checked(): await chk_tratamiento.click()
            except: pass

            # 2. Fechas
            await self._limpiar_fechas()

            # 3. Layout e ingreso Centro Planificación
            await self._aplicar_layout(layout)

            # 4. Selección Múltiple
            self.log("📑 Ingresando UTs masivamente...")
            try:
                btn_seleccion = ctx.get_by_role("button", name="Selección múltiple").nth(2)
                await btn_seleccion.click()
                await asyncio.sleep(2)
                
                import pyperclip
                pyperclip.copy("\r\n".join(lista_uts))
                
                # Buscar botón de pegado
                btn_pegar = None
                for regex in [r"Upload.*portapapeles", r"Cargar.*portapapeles", r"Pegar"]:
                    try:
                        btn = ctx.get_by_role("button", name=re.compile(regex, re.IGNORECASE))
                        if await btn.is_visible(timeout=1000):
                            btn_pegar = btn; break
                    except: continue

                if btn_pegar:
                    await btn_pegar.click()
                else:
                    await self.page.keyboard.press("Shift+F12")
                
                await asyncio.sleep(1)
                await ctx.get_by_role("button", name="Tomar (F8)").click()
            except Exception as e:
                self.log(f"⚠️ Error en UTs: {e}")

            if solo_filtros:
                return None

            # 5. Ejecutar y Descargar
            ruta = await self._ejecutar_y_descargar()
            if ruta:
                fecha_hoy = datetime.now().strftime("%d%m%Y")
                ruta_final = os.path.join(os.path.dirname(ruta), f"avi_pend_{fecha_hoy}.xlsx")
                if os.path.exists(ruta_final): os.remove(ruta_final)
                os.rename(ruta, ruta_final)
                return ruta_final
            
            return None

        except Exception as e:
            self.log(f"❌ Error crítico: {e}")
            return None
