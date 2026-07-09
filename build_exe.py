import os
import sys
import subprocess

# Redireccionar automáticamente al entorno virtual si no se está usando
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "Scripts", "python.exe")
if os.path.exists(venv_python) and os.path.normpath(sys.executable).lower() != os.path.normpath(venv_python).lower():
    print(f"Redirigiendo compilacion al entorno virtual: {venv_python}")
    sys.exit(subprocess.call([venv_python] + sys.argv))

print("== Script de Compilacion para Monitoring KPI's Corporativos ==")

# 1. Asegurar dependencias de compilación
print("\n[1/4] Instalando dependencias de empaquetado (PyInstaller y Pillow)...")
try:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller", "pillow"])
    print("Dependencias listas.")
except Exception as e:
    print(f"Error instalando dependencias: {e}")
    sys.exit(1)

# 2. Generar el icono .ico
print("\n[2/4] Generando archivo icon.ico a partir del PNG...")
png_path = r"C:\Users\drake\Downloads\iconoMonitoring.png"
ico_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon.ico")

if not os.path.exists(png_path):
    if os.path.exists(ico_path):
        print("No se encontro el PNG original, usando el archivo icon.ico existente.")
    else:
        print(f"No se encontro el archivo de origen: {png_path} ni icon.ico existente.")
        sys.exit(1)
else:
    try:
        from PIL import Image
        img = Image.open(png_path)
        # Guardar como ICO incluyendo tamaños de iconos estándar de Windows
        img.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        print(f"Archivo icon.ico creado exitosamente en: {ico_path}")
    except Exception as e:
        print(f"Error al generar icon.ico: {e}")
        sys.exit(1)

# 3. Compilar aplicación con PyInstaller
print("\n[3/4] Compilando con PyInstaller (modo windowed)...")

dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
if not os.path.exists(dist_path):
    print("No se encontro la carpeta 'frontend/dist'. Por favor ejecuta 'npm run build' dentro de 'frontend' antes de compilar.")
    sys.exit(1)

command = [
    "pyinstaller",
    "--name=Monitoring KPIs Corporativos",
    "--console",
    f"--icon={ico_path}",
    "--noconfirm",
    "--clean",
    "--add-data=frontend/dist;frontend/dist",
    "--add-data=config.json;.",
    "--add-data=.env;.",
    "--add-data=icon.ico;.",
    "--add-data=.venv/Lib/site-packages/playwright/driver;playwright/driver",
    "main.py"
]

try:
    # Intentar ejecutar PyInstaller usando el binario del entorno virtual actual
    pyinstaller_bin = os.path.join(os.path.dirname(sys.executable), "pyinstaller.exe")
    if not os.path.exists(pyinstaller_bin):
        # Fallback a llamar al módulo python
        subprocess.check_call([sys.executable, "-m", "PyInstaller"] + command[1:])
    else:
        subprocess.check_call([pyinstaller_bin] + command[1:])
    print("\n¡Compilacion completada!")
    folder_name = "Monitoring KPI's Corporativos"
    print(f"Puedes encontrar el ejecutable en: {os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist', folder_name)}")
except Exception as e:
    print(f"\nError durante la compilacion con PyInstaller: {e}")
    sys.exit(1)
