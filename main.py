import sys
import os
import subprocess
import threading
import time
import urllib.request
import ctypes

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


_is_maximized = False
_normal_rect = (0, 0, 1024, 768)

def _maximize_window_workarea(window):
    global _is_maximized, _normal_rect
    try:
        import win32api
        monitor_info = win32api.GetMonitorInfo(win32api.MonitorFromPoint((window.x or 0, window.y or 0)))
        work_area = monitor_info.get('Work')
        if work_area:
            _normal_rect = (window.x or 0, window.y or 0, window.width or 1024, window.height or 768)
            x, y, w, h = work_area[0], work_area[1], work_area[2] - work_area[0], work_area[3] - work_area[1]
            window.move(x, y)
            window.resize(w, h)
            _is_maximized = True
            return
    except Exception:
        pass
    window.maximize()
    _is_maximized = True

def _restore_window(window):
    global _is_maximized, _normal_rect
    x, y, w, h = _normal_rect
    window.resize(w, h)
    window.move(x, y)
    _is_maximized = False

class NativeApi:
    """JS bridge: file save dialog para exportar excels y controles de ventana."""
    
    def minimize_app(self):
        try:
            window = webview.windows[0]
            window.minimize()
        except Exception:
            pass

    def close_app(self):
        try:
            window = webview.windows[0]
            window.destroy()
        except Exception:
            pass

    def toggle_maximize(self):
        global _is_maximized
        try:
            window = webview.windows[0]
            if _is_maximized:
                _restore_window(window)
            else:
                _maximize_window_workarea(window)
        except Exception:
            pass

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


SPLASH_THEMES = {
    "dark":  {"bg": "#1c2333", "text": "#f1f5f9", "subtitle": "#94a3b8", "border": "#2d3548", "logo": "LogoMonitoring-dark-theme.png"},
    "light": {"bg": "#ffffff", "text": "#1e293b", "subtitle": "#64748b", "border": "#e2e8f0", "logo": "LogoMonitoring-light-theme.png"},
}


def _leer_theme_guardado():
    """Lee el tema (dark/light) guardado en config.json por la app (ver
    /api/config, campo 'theme'). Se lee directo del archivo porque el
    splash se muestra antes de que Flask arranque."""
    try:
        if getattr(sys, 'frozen', False):
            appdata_dir = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), "MonitoringKPIsCorporativos")
            config_path = os.path.join(appdata_dir, "config.json")
        else:
            config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
        import json
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        theme = cfg.get("theme")
        return theme if theme in SPLASH_THEMES else "dark"
    except Exception:
        return "dark"


def _build_splash_html():
    theme = _leer_theme_guardado()
    colors = SPLASH_THEMES[theme]

    if getattr(sys, 'frozen', False):
        bundle_dir = sys._MEIPASS
    else:
        bundle_dir = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(bundle_dir, "frontend", "dist", colors["logo"])

    logo_b64 = ""
    try:
        import base64
        with open(logo_path, "rb") as f:
            logo_b64 = base64.b64encode(f.read()).decode("ascii")
    except Exception:
        pass
    logo_tag = f'<img src="data:image/png;base64,{logo_b64}" alt="Monitoring Logo" />' if logo_b64 else ''

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:100%;height:100%}}
body{{background:{colors["bg"]};display:flex;flex-direction:column;align-items:center;justify-content:center;
height:100vh;overflow:hidden;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:{colors["text"]};-webkit-user-select:none;user-select:none;
border:1px solid {colors["border"]};box-sizing:border-box}}
.logo{{width:auto;height:65px;margin-bottom:20px}}
.logo img{{width:100%;height:100%;object-fit:contain}}
.subtitle{{font-size:14px;color:{colors["subtitle"]};margin-top:4px;letter-spacing:.5px}}
.loader{{margin-top:24px;display:flex;gap:6px}}
.loader div{{width:8px;height:8px;border-radius:50%;background:#0284c7;animation:bounce .6s ease-in-out infinite}}
.loader div:nth-child(2){{animation-delay:.1s}}
.loader div:nth-child(3){{animation-delay:.2s}}
.loader div:nth-child(4){{animation-delay:.3s}}
@keyframes bounce{{0%,100%{{transform:translateY(0)}}50%{{transform:translateY(-12px)}}}}
</style></head><body>
<div class="logo">{logo_tag}</div>
<div class="subtitle">KPI's Corporativos</div>
<div class="loader"><div></div><div></div><div></div><div></div></div>
</body></html>"""


def _get_screen_center(width, height):
    try:
        sx = ctypes.windll.user32.GetSystemMetrics(0)
        sy = ctypes.windll.user32.GetSystemMetrics(1)
        return (sx - width) // 2, (sy - height) // 2
    except Exception:
        return 100, 100


def _wait_flask_ready(url, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except Exception:
            time.sleep(0.3)
    return False


def _log(msg):
    try:
        with open("startup.log", "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    except Exception:
        pass

def main():
    _log("=== main() inicio ===")
    splash_w = 400
    splash_h = 230
    cx, cy = _get_screen_center(splash_w, splash_h)
    _log(f"center=({cx},{cy}) splash={splash_w}x{splash_h}")

    # Ventana de splash propia, sin marco de ventana tradicional (frameless).
    # Se destruye una vez la app principal está lista; la app principal se
    # crea como una ventana nueva (con marco normal, título y controles OS).
    splash = webview.create_window(
        title="Monitoring KPIs Corporativos",
        html=_build_splash_html(),
        width=splash_w,
        height=splash_h,
        x=cx,
        y=cy,
        resizable=False,
        frameless=True,
        text_select=False,
        confirm_close=False
    )
    _log("ventana splash creada (frameless)")

    def bootstrap():
        try:
            _log("bootstrap: inicio")
            from backend.main import run_flask
            _log("bootstrap: import run_flask OK")
            flask_thread = threading.Thread(target=run_flask, daemon=True)
            flask_thread.start()
            _log("bootstrap: flask_thread iniciado")
            ready = _wait_flask_ready("http://127.0.0.1:3001")
            _log(f"bootstrap: flask ready={ready}")

            main_window = webview.create_window(
                title="Monitoring KPI's Corporativos",
                url="http://127.0.0.1:3001",
                js_api=NativeApi(),
                width=1280,
                height=800,
                resizable=True,
                confirm_close=False
            )
            main_window.maximize()
            _log("bootstrap: ventana principal creada y maximizada")

            splash.destroy()
            _log("bootstrap: splash destruido - DONE")
        except Exception as e:
            _log(f"bootstrap ERROR: {e}")
            import traceback
            _log(traceback.format_exc())

    webview.start(func=bootstrap, debug=False)
    _log("webview.start retornó")


if __name__ == "__main__":
    main()