import asyncio
import re
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from typing import Callable

class LoginManager:
    """
    Gestiona el inicio de sesión en Microsoft Entra ID para acceder a SAP Fiori.
    """
    
    def __init__(self, page: Page, usuario: str, contrasena: str, log_fn: Callable = print):
        """
        Inicializa las credenciales y el contexto de página.
        Propósito: Configurar las variables del usuario y el logger del módulo.
        """
        self.page = page
        self.usuario = usuario
        self.contrasena = contrasena
        self.log = log_fn

    async def esta_logueado(self) -> bool:
        """
        Detecta si ya existe una sesión activa o si se muestra el portal de login.
        Propósito: Evitar intentar el inicio de sesión si el navegador ya está autenticado.
        """
        try:
            await self.page.wait_for_selector(
                "input[type='email'], input[name='loginfmt']",
                timeout=5000
            )
            return False  # Aparece login → no está logueado
        except PlaywrightTimeout:
            return True   # No apareció login → ya está logueado

    async def login_microsoft(self, async_get_otp_code: Callable = None) -> bool:
        """
        Flujo de autenticación exacto para Microsoft Entra basado en Playwright Codegen.
        Propósito: Autenticar paso a paso detectando cada pantalla de Microsoft sin asumir un orden fijo.
        """
        try:
            # Dar tiempo a la página para cargar y mostrar su estado inicial
            await asyncio.sleep(2)

            # Paso A: Selección de cuenta (si aparece)
            try:
                if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=3000):
                    self.log("📌 Pantalla 'Selección de la cuenta' detectada. Seleccionando cuenta corporativa...")
                    # 1. Intentar por dominio @contratistas.codelco.cl
                    cuenta = self.page.get_by_text(re.compile(r".*@contratistas\.codelco\.cl", re.IGNORECASE)).first
                    if await cuenta.is_visible(timeout=3000):
                        await cuenta.click(force=True)
                        await self.page.wait_for_load_state("networkidle", timeout=15000)
                        await asyncio.sleep(1)
                        self.log("✅ Cuenta contratista seleccionada.")
                    # 2. Fallback: buscar por el email del usuario configurado
                    else:
                        try:
                            correo_el = self.page.get_by_text(self.usuario, exact=False).first
                            if await correo_el.is_visible(timeout=2000):
                                self.log(f"👤 Cuenta detectada ({self.usuario}). Click forzado...")
                                await correo_el.click(force=True)
                                await self.page.wait_for_load_state("load", timeout=15000)
                                self.log("✅ Cuenta seleccionada.")
                        except:
                            pass
            except PlaywrightTimeout:
                pass
            except Exception:
                pass

            # Paso B: Email / Usuario (si aún es necesario)
            try:
                campo_email = await self.page.wait_for_selector(
                    "input[type='email'], input[name='loginfmt']",
                    timeout=5000
                )
                self.log("🔐 Ingresando usuario...")
                await campo_email.fill(self.usuario)
                await self.page.click("input[type='submit'], button[type='submit']")
                await self.page.wait_for_load_state("networkidle")
                await asyncio.sleep(1)
            except PlaywrightTimeout:
                self.log("ℹ️ Campo de email omitido o ya procesado.")
            except Exception as e:
                self.log(f"⚠️ Error en paso de email: {e}")

            # Paso C: Contraseña (selector exacto del Codegen)
            try:
                campo_pass = self.page.get_by_role("textbox", name="Escriba la contraseña para")
                if await campo_pass.is_visible(timeout=8000):
                    self.log("🔐 Pantalla de contraseña detectada. Ingresando credencial...")
                    await campo_pass.fill(self.contrasena)
                    # Botón "Iniciar sesión" (selector exacto del Codegen)
                    btn_login = self.page.get_by_role("button", name="Iniciar sesión")
                    await btn_login.click()
                    await self.page.wait_for_load_state("networkidle", timeout=20000)
                    self.log("✅ Contraseña enviada correctamente.")
                    await asyncio.sleep(2)
            except PlaywrightTimeout:
                self.log("ℹ️ Campo de contraseña no detectado (posible sesión activa o usuario ya logueado).")
            except Exception as e:
                self.log(f"⚠️ Error en paso de contraseña: {e}")

            # Paso D: Contraseña alternativa (fallback por selector estándar)
            try:
                campo_pass_fb = await self.page.wait_for_selector(
                    "input[type='password'], input[name='passwd']",
                    timeout=3000
                )
                self.log("🔐 Ingresando contraseña (fallback)...")
                await campo_pass_fb.fill(self.contrasena)
                await self.page.click("input[type='submit'], button[type='submit']")
                await self.page.wait_for_load_state("networkidle")
                await asyncio.sleep(1)
            except PlaywrightTimeout:
                self.log("ℹ️ Campo password fallback omitido.")
            except Exception:
                pass

            # Paso E: OTP (Doble Factor - selector exacto del Codegen)
            try:
                campo_otp = self.page.get_by_role("textbox", name="Especificar el código")
                if await campo_otp.is_visible(timeout=10000):
                    self.log("📱 Código del autenticador requerido. Solicitando al usuario en el panel...")
                    if async_get_otp_code:
                        codigo = await async_get_otp_code()
                        if not codigo:
                            self.log("❌ Autenticación cancelada: No se proporcionó código OTP.", "error")
                            return False
                        await campo_otp.fill(codigo)
                        # Botón "Comprobar" (selector exacto del Codegen)
                        btn_comprobar = self.page.get_by_role("button", name="Comprobar")
                        await btn_comprobar.click()
                        await self.page.wait_for_load_state("networkidle", timeout=20000)
                        self.log("✅ Código OTP verificado correctamente.")
                        await asyncio.sleep(2)
                    else:
                        self.log("❌ Autenticación fallida: No se proporcionó callback de OTP.", "error")
                        return False
            except PlaywrightTimeout:
                self.log("ℹ️ No se requirió código del autenticador.")
            except Exception as e:
                self.log(f"⚠️ Error en paso OTP: {e}")

            # Paso F: Mantener sesión (¿Desea mantener la sesión iniciada?)
            try:
                btn_si = self.page.get_by_role("button", name="Sí")
                if await btn_si.is_visible(timeout=5000):
                    await btn_si.click()
                    self.log("✅ Sesión persistida.")
                    await self.page.wait_for_load_state("networkidle", timeout=10000)
            except PlaywrightTimeout:
                pass
            except Exception:
                pass

            self.log("✅ Autenticación con Microsoft completada exitosamente.")
            return True

        except Exception as e:
            self.log(f"❌ Error inesperado en autenticación Microsoft: {e}", "error")
            return False

    async def _detectar_mfa(self) -> bool:
        """
        Detecta si aparece la pantalla de confirmación por celular (MFA).
        Propósito: Determinar si el flujo requiere pausa para aprobación manual.
        """
        try:
            await self.page.wait_for_selector(
                "text=Approve sign in request, text=Aprueba la solicitud de inicio, [data-bind*='AuthenticatorApp']",
                timeout=5000
            )
            return True
        except PlaywrightTimeout:
            return False

    async def _detectar_mfa_otp(self) -> bool:
        """
        Detecta si aparece la pantalla de confirmación por OTP numérico (Enter code).
        Propósito: Determinar si el flujo requiere ingresar el código numérico manualmente.
        """
        try:
            # Detección del heading "Especificar el código"
            try:
                if await self.page.get_by_role("heading", name="Especificar el código").is_visible(timeout=2000):
                    return True
            except:
                pass
            try:
                if await self.page.get_by_role("textbox", name="Especificar el código").is_visible(timeout=2000):
                    return True
            except:
                pass
            
            await self.page.wait_for_selector(
                "input[name='otc'], input[id='idTxtBx_SAOTCC_OTC'], input[type='tel']",
                timeout=3000
            )
            return True
        except PlaywrightTimeout:
            return False

    async def _esperar_post_mfa(self, timeout_s: int = 120):
        """
        Pausa y espera que el usuario apruebe la notificación MFA.
        Propósito: Continuar el flujo del navegador una vez que Microsoft aprueba la sesión.
        """
        try:
            await self.page.wait_for_url(
                lambda url: "login.microsoftonline.com" not in url and "login.live.com" not in url,
                timeout=timeout_s * 1000
            )
        except PlaywrightTimeout:
            raise TimeoutError(f"Expiró la espera de aprobación MFA ({timeout_s}s).")


class SAPNavigator:
    """
    Proporciona métodos reutilizables para navegar por SAP Fiori y sus transacciones GUI.
    """
    
    def __init__(self, page: Page, url_base: str, log_fn: Callable = print):
        """
        Inicializa el navegador con la página y URL.
        Propósito: Guardar la referencia de la página de Playwright y su URL.
        """
        self.page = page
        self.url_base = url_base
        self.log = log_fn

    async def abrir_transaccion_gui_url(self, transaccion: str):
        """
        Navega directamente a la URL de Fiori que inicializa una transacción GUI.
        Propósito: Ahorrar pasos de búsqueda manual en el menú de Fiori.
        """
        if not self.url_base or not self.url_base.startswith("http"):
            self.log(f"❌ URL de Fiori inválida: {self.url_base}")
            return

        url = f"{self.url_base}#Shell-startGUI?sap-system=FIORI_MENU&sap-ui2-tcode={transaccion}"
        self.log(f"🔗 Abriendo transacción GUI: {transaccion}")
        try:
            await self.page.goto(url, wait_until="commit", timeout=60000)
            await asyncio.sleep(2)

            # Verificar si hubo redirección SAML/Microsoft (sesión expirada a mitad de ejecución)
            url_actual = self.page.url
            if (
                "login.microsoftonline.com" in url_actual
                or "saml2" in url_actual
                or "sso_reload" in url_actual
            ):
                self.log("⚠️ Redirección de sesión detectada al abrir transacción. Esperando re-autenticación manual o re-selección de cuenta...")
                try:
                    # Intentar selección de cuenta automática
                    if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=5000):
                        cuenta = self.page.get_by_text(re.compile(r".*@.*codelco\.cl", re.IGNORECASE)).first
                        if await cuenta.is_visible(timeout=3000):
                            await cuenta.click()
                            await self.page.wait_for_load_state("networkidle", timeout=20000)
                            await asyncio.sleep(2)
                except: pass

                # Reintentar la navegación a la transacción
                await self.page.goto(url, wait_until="commit", timeout=60000)
                await asyncio.sleep(2)

            # Resolver Selección de Cuenta si aparece a mitad de navegación
            try:
                if await self.page.get_by_text("Selección de la cuenta", exact=False).is_visible(timeout=3000):
                    cuenta = self.page.get_by_text(re.compile(r".*@.*codelco\.cl", re.IGNORECASE)).first
                    if await cuenta.is_visible(timeout=3000):
                        await cuenta.click(force=True)
                        await self.page.wait_for_load_state("networkidle", timeout=10000)
            except: pass

        except Exception as e:
            self.log(f"⚠️ Alerta al abrir transacción: {e}")

        try:
            await self.cerrar_popups_sap(reintentos=2)
        except: pass

    async def cerrar_popups_sap(self, reintentos: int = 2):
        """
        Detecta y presiona botones de popups informativos o de advertencia de SAP.
        Propósito: Evitar bloqueos de flujo debido a ventanas modales de aviso de SAP.
        """
        selectores_botones = [
            "button[title*='Continuar']", "button[title*='Aceptar']",
            "button[title*='OK']", "button[title*='Cerrar']",
            "button:has-text('Cerrar')", "button:has-text('Continuar')",
            "button:has-text('Aceptar')", "button:has-text('OK')"
        ]

        for _ in range(reintentos):
            encontrado = False
            await asyncio.sleep(0.5)
            
            frame_sap = await self.obtener_frame_sap()
            contextos = [self.page]
            if frame_sap != self.page:
                contextos.append(frame_sap)

            for ctx in contextos:
                for selector in selectores_botones:
                    try:
                        boton = await ctx.query_selector(selector)
                        if boton and await boton.is_visible():
                            self.log(f"🔘 Cerrando modal emergente de SAP: {selector}")
                            await boton.click(timeout=2000)
                            await asyncio.sleep(0.5)
                            encontrado = True
                    except: continue
            
            if not encontrado:
                break

    async def obtener_frame_sap(self):
        """
        Busca y retorna el iframe donde corre el SAP GUI HTML5.
        Propósito: Trabajar con los elementos del formulario dentro del iFrame de SAP.
        """
        selector = "iframe[id*='ITSAM'], iframe[name*='HostedView'], iframe[id*='startGUI'], iframe.sapItsamIFrame"
        frame_element = await self.page.query_selector(selector)
        if frame_element:
            return await frame_element.content_frame()
        return self.page
