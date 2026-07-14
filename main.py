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


SPLASH_HTML = r"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;
height:100vh;overflow:hidden;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;-webkit-user-select:none;user-select:none}
.logo{width:auto;height:65px;margin-bottom:20px;animation:pulse 2s ease-in-out infinite}
.logo img{width:100%;height:100%;object-fit:contain}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.85}}
.brand{font-size:28px;font-weight:800;letter-spacing:4px;color:#0f172a}
.subtitle{font-size:14px;color:#64748b;margin-top:4px;letter-spacing:.5px}
.loader{margin-top:24px;display:flex;gap:6px}
.loader div{width:8px;height:8px;border-radius:50%;background:#0284c7;animation:bounce .6s ease-in-out infinite}
.loader div:nth-child(2){animation-delay:.1s}
.loader div:nth-child(3){animation-delay:.2s}
.loader div:nth-child(4){animation-delay:.3s}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
</style></head><body>
<div class="logo">
<img src="data:image/png;base64,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" alt="Monitoring Logo" />
</div>
<div class="brand">MONITORING</div>
<div class="subtitle">Monitoring KPI's Corporativos</div>
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
        html=SPLASH_HTML,
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