
import pandas as pd

# PATTERN TRAB - leer como HTML
print("="*60)
print("PATTERN TRAB S20")
try:
    tables = pd.read_html(
        r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls",
        encoding='latin-1'
    )
    print(f"  {len(tables)} tablas encontradas")
    for i, t in enumerate(tables):
        print(f"\n  Tabla {i}: {t.shape}")
        print(f"  Columnas: {list(t.columns)}")
        print(t.head(5).to_string())
except Exception as e:
    print(f"HTML error: {e}")
    # intentar con cp1252
    try:
        tables = pd.read_html(
            r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls",
            encoding='cp1252'
        )
        print(f"  cp1252: {len(tables)} tablas")
        for i, t in enumerate(tables):
            print(f"\n  Tabla {i}: {t.shape}")
            print(f"  Columnas: {list(t.columns)}")
            print(t.head(5).to_string())
    except Exception as e2:
        print(f"cp1252 error: {e2}")

print("\n" + "="*60)
print("PATTERN PLAN S20")
try:
    tables2 = pd.read_html(
        r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN PLAN S20.xls",
        encoding='latin-1'
    )
    print(f"  {len(tables2)} tablas encontradas")
    for i, t in enumerate(tables2):
        print(f"\n  Tabla {i}: {t.shape}")
        print(f"  Columnas: {list(t.columns)}")
        print(t.head(5).to_string())
except Exception as e:
    print(f"HTML error: {e}")
