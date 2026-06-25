import msal
import os
import requests
from typing import Optional


def _make_msal_http_client(timeout: int = 5):
    """
    Crea una sesión HTTP con timeout corto para MSAL.
    Evita que la inicialización de MSAL tarde minutos si hay problemas de red.
    """
    session = requests.Session()
    session.request = lambda method, url, **kwargs: \
        requests.Session.request(session, method, url,
                                 timeout=kwargs.pop("timeout", timeout),
                                 **kwargs)
    return session


class EntraIDAuth:
    """
    Clase para interactuar con la Autenticación de Microsoft Entra ID.
    Utiliza MSAL para hacer login interactivo en navegador y gestionar tokens.
    """
    
    def __init__(self, client_id: str, tenant_id: str, authority: str, redirect_uri: str, scopes: list):
        """
        Inicializa la instancia de MSAL PublicClientApplication.
        Propósito: Configurar las variables y el cliente público de Microsoft.
        """
        self.client_id = client_id
        self.tenant_id = tenant_id
        self.authority = authority
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        
        # Caché de tokens en memoria por sesión
        self.cache = msal.SerializableTokenCache()
        self.cache_file = os.path.join(os.path.dirname(__file__), "token_cache.bin")
        if os.path.exists(self.cache_file):
            with open(self.cache_file, "r") as f:
                self.cache.deserialize(f.read())
        
        try:
            self.app = msal.PublicClientApplication(
                self.client_id,
                authority=self.authority,
                token_cache=self.cache,
                validate_authority=False,         # Evita overhead de validación
                http_client=_make_msal_http_client(timeout=5)  # Falla rápido si no hay red
            )
        except Exception as e:
            print(f"[auth] Advertencia: MSAL no pudo inicializarse ({e}). El login estará disponible cuando haya conexión.")
            self.app = None

    def obtener_usuario_actual(self) -> Optional[dict]:
        """
        Intenta obtener el usuario autenticado de la sesión cacheada silenciosamente.
        Propósito: Recuperar datos del usuario si el token sigue vigente sin forzar login interactivo.
        """
        if not self.app:
            return None
        accounts = self.app.get_accounts()
        if accounts:
            result = self.app.acquire_token_silent(self.scopes, account=accounts[0])
            if result and "access_token" in result:
                if self.cache.has_state_changed:
                    with open(self.cache_file, "w") as f:
                        f.write(self.cache.serialize())
                claims = result.get("id_token_claims")
                if claims:
                    return claims
                return {
                    "name": accounts[0].get("name", accounts[0].get("username", "Operador Codelco")),
                    "preferred_username": accounts[0].get("username", "")
                }
        return None

    def login(self) -> Optional[dict]:
        """
        Realiza el login interactivo abriendo el navegador.
        Propósito: Obtener el token de acceso interactivo del usuario corporativo Microsoft.
        """
        # Si MSAL no se pudo inicializar al arrancar, reintentarlo ahora
        if not self.app:
            try:
                self.app = msal.PublicClientApplication(
                    self.client_id,
                    authority=self.authority,
                    token_cache=self.cache,
                    validate_authority=False,
                    http_client=_make_msal_http_client(timeout=5)
                )
                print("[auth] MSAL re-inicializado correctamente al hacer login.")
            except Exception as e:
                print(f"[auth] No se pudo re-inicializar MSAL: {e}")
                return None
        accounts = self.app.get_accounts()
        if accounts:
            result = self.app.acquire_token_silent(self.scopes, account=accounts[0])
            if result:
                return result.get("id_token_claims")

        try:
            # Extraer puerto de la redirect_uri para la escucha local interactiva (ej: 5000)
            port = None
            if ":" in self.redirect_uri.replace("http://", "").replace("https://", ""):
                port = int(self.redirect_uri.split(":")[-1].split("/")[0])
            
            # Plantilla HTML con diseño moderno sin sangrías iniciales para forzar interpretación HTML y evitar colisión de llaves con .format()
            # Modificada para usar el mismo color de fondo azul de la suite principal.
            success_html_template = "<html><head><meta charset='utf-8'><title>Autenticaci&oacute;n Completada</title><link href='https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap' rel='stylesheet'></head><body style='margin: 0; padding: 0; background: #0f1524; background-image: radial-gradient(at 0% 0%, rgba(0, 102, 204, 0.4) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(0, 204, 255, 0.3) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(13, 20, 38, 0.9) 0px, transparent 100%); background-attachment: fixed; color: #ffffff; font-family: \"Outfit\", -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden;'><div style='text-align: center; background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 3rem 2rem; max-width: 450px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);'><div style='font-size: 4rem; margin-bottom: 1.5rem; display: inline-block; color: #FF8E53;'>&check;</div><h1 style='font-size: 1.8rem; font-weight: 800; margin: 0 0 1rem 0; color: #ffffff;'>Autenticaci&oacute;n Completada</h1><p style='font-size: 1rem; color: #a0aec0; line-height: 1.6; margin: 0 0 1.5rem 0;'>El proceso de inicio de sesi&oacute;n ha finalizado con &eacute;xito. Ya puedes cerrar esta pesta\u0026ntilde;a del navegador y regresar a la aplicaci&oacute;n de escritorio.</p><div style='background: rgba(255, 107, 107, 0.1); border-left: 4px solid #FF6B6B; border-radius: 8px; padding: 1rem; font-size: 0.85rem; color: #f7fafc; text-align: left; margin-top: 1.5rem;'><div style='font-weight: 600; margin-bottom: 0.25rem; color: #FF6B6B;'>&#128274; Por tu seguridad:</div>No compartas el contenido de esta p\u0026aacute;gina, la barra de direcciones, ni realices capturas de pantalla.</div></div></body></html>"
            
            result = self.app.acquire_token_interactive(
                scopes=self.scopes,
                port=port,
                success_template=success_html_template
            )
            
            if "access_token" in result:
                if self.cache.has_state_changed:
                    with open(self.cache_file, "w") as f:
                        f.write(self.cache.serialize())
                claims = result.get("id_token_claims")
                if claims:
                    return claims
                accounts = self.app.get_accounts()
                if accounts:
                    return {
                        "name": accounts[0].get("name", accounts[0].get("username", "Operador Codelco")),
                        "preferred_username": accounts[0].get("username", "")
                    }
                return {"name": "Operador Codelco", "preferred_username": ""}
            else:
                print(f"Error en login: {result.get('error_description')}")
                return None
        except Exception as e:
            print(f"Excepción en login interactivo de Microsoft: {e}")
            return None

    def logout(self):
        """
        Elimina las cuentas del caché del cliente de MSAL.
        Propósito: Cerrar la sesión del usuario actual en la aplicación.
        """
        if not self.app:
            return
        for account in self.app.get_accounts():
            self.app.remove_account(account)
        if os.path.exists(self.cache_file):
            try:
                os.remove(self.cache_file)
            except:
                pass
