"""Centraliza rutas de salida para que dev y exe (frozen) usen
el mismo directorio, evitando que los handlers SAP guarden en cwd/output
mientras main.py hace glob en AppData/output."""
import os
import sys

_APPDATA_NAME = "MonitoringKPIsCorporativos"


def _get_appdata_dir() -> str:
    base = os.path.join(
        os.environ.get('APPDATA', os.path.expanduser('~')),
        _APPDATA_NAME,
    )
    os.makedirs(base, exist_ok=True)
    return base


def get_output_dir() -> str:
    """Directorio único de salida para Excels generados y subidos.
    Prioriza variable de entorno _MONITORING_OUTPUT_DIR (seteada por main.py)
    como fuente única de verdad, evitando divergencia entre handlers."""
    env_dir = os.environ.get("_MONITORING_OUTPUT_DIR")
    if env_dir:
        os.makedirs(env_dir, exist_ok=True)
        return env_dir
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out = os.path.join(base, "output")
    os.makedirs(out, exist_ok=True)
    return out


def get_browser_session_dir() -> str:
    """Directorio persistente para cookies/sesión de Playwright.
    En exe va al mismo directorio del instalador; en dev, raíz del proyecto."""
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out = os.path.join(base, "browser_session")
    os.makedirs(out, exist_ok=True)
    return out
