import sys
import os
import subprocess

# Redireccionar automáticamente al entorno virtual si no se está usando
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "Scripts", "python.exe")
if os.path.exists(venv_python) and os.path.normpath(sys.executable).lower() != os.path.normpath(venv_python).lower():
    sys.exit(subprocess.call([venv_python] + sys.argv))

# Limpiar SSLKEYLOGFILE si la ruta no es escribible.
# Rutas tipo \\?\Volume{...}\virtual_file.log (DevTools) causan PermissionError
# en toda conexión HTTPS de Python/urllib3, bloqueando MSAL y requests.
_sslkeylog = os.environ.get("SSLKEYLOGFILE", "")
if _sslkeylog:
    try:
        with open(_sslkeylog, "a"):
            pass  # Si se puede abrir, la dejamos
    except (PermissionError, OSError):
        del os.environ["SSLKEYLOGFILE"]
        print("[startup] SSLKEYLOGFILE apuntaba a una ruta inválida y fue eliminada.")
del _sslkeylog


# Agregar el directorio actual al path de importaciones
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.main import main

# Punto de entrada principal en la raíz de la suite
if __name__ == "__main__":
    main()
