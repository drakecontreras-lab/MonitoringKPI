import sys
import os
import subprocess
import threading
import time
import urllib.request

# Redireccionar automáticamente al entorno virtual si no se está usando
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "Scripts", "python.exe")
if os.path.exists(venv_python) and os.path.normpath(sys.executable).lower() != os.path.normpath(venv_python).lower():
    sys.exit(subprocess.call([venv_python] + sys.argv))

# Limpiar SSLKEYLOGFILE si la ruta no es escribible.
_sslkeylog = os.environ.get("SSLKEYLOGFILE", "")
if _sslkeylog:
    try:
        with open(_sslkeylog, "a"):
            pass
    except (PermissionError, OSError):
        del os.environ["SSLKEYLOGFILE"]
        print("[startup] SSLKEYLOGFILE apuntaba a ruta inválida y fue eliminada.")
del _sslkeylog

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import webview


class NativeApi:
    """JS bridge: file save dialog para exportar excels."""
    def save_excel(self, filename):
        import shutil
        from backend.utils.paths import get_output_dir
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory='',
            save_filename=filename,
            file_types=('Excel Files (*.xlsx)', 'All files (*.*)')
        )
        if result:
            dest_path = result if isinstance(result, str) else result[0]
            src_path = os.path.join(get_output_dir(), filename)
            if os.path.exists(src_path):
                shutil.copy2(src_path, dest_path)
                return True
        return False


SPLASH_HTML = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(135deg,#0b6b7c,#1a8fa0);color:#fff;font-family:Calibri,Arial,sans-serif;
display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
.logo{font-size:36px;font-weight:bold;letter-spacing:-0.5px;margin-bottom:8px}
.sub{font-size:14px;opacity:.85;margin-bottom:24px}
.spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,.25);border-top:4px solid #fff;
border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.msg{font-size:12px;opacity:.6;margin-top:16px}
</style></head><body>
<div class="logo">Monitoring KPIs</div>
<div class="sub">Corporativos</div>
<div class="spinner"></div>
<div class="msg">Inicializando aplicación...</div>
</body></html>"""


def _wait_flask_ready(url, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except Exception:
            time.sleep(0.3)
    return False


def main():
    # Crear ventana con splash; js_api disponible desde el inicio
    window = webview.create_window(
        title="Monitoring KPIs Corporativos",
        html=SPLASH_HTML,
        js_api=NativeApi(),
        width=420,
        height=300,
        resizable=True,
        text_select=False,
        confirm_close=False,
    )

    def bootstrap():
        # Lazy import: pandas, MSAL, supabase, flask, playwright — todo se carga ahora
        from backend.main import main as start_app

        # Arrancar Flask (sin pywebview, solo el servidor HTTP)
        start_app(flask_only=True)

        # Esperar que Flask responda
        _wait_flask_ready("http://127.0.0.1:3001")

        # Cargar la app real en la misma ventana
        window.load_url("http://127.0.0.1:3001")
        window.set_title("Monitoring KPI's Corporativos")
        window.resize(1280, 800)
        window.maximize()

    webview.start(func=bootstrap, debug=False)


if __name__ == "__main__":
    main()