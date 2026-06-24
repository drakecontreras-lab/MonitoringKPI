
import pandas as pd

# Los .xls son en realidad HTML/XML con extension .xls
# Intentar con engine xlrd (html) o leer como html
def try_read_xls(path, label):
    print(f"\n{'='*60}")
    print(f"ARCHIVO: {label}")
    # Probar distintos engines
    for engine in ['xlrd', 'openpyxl', None]:
        try:
            kw = {'engine': engine} if engine else {}
            xl = pd.ExcelFile(path, **kw)
            print(f"  Engine '{engine}' OK - Hojas: {xl.sheet_names}")
            for s in xl.sheet_names:
                df = pd.read_excel(path, sheet_name=s, header=None, nrows=6, **kw)
                print(f"\n  -- Hoja: '{s}' --")
                print(df.to_string())
            return
        except Exception as e:
            print(f"  Engine '{engine}' FALLO: {e}")
    # Intentar como HTML
    try:
        import lxml
        tables = pd.read_html(path, encoding='latin-1')
        print(f"\n  HTML con {len(tables)} tablas")
        for i, t in enumerate(tables[:2]):
            print(f"\n  Tabla {i}: {t.shape}")
            print(t.head(6).to_string())
    except Exception as e:
        print(f"  HTML FALLO: {e}")

try_read_xls(
    r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls",
    "PATTERN TRAB S20"
)

try_read_xls(
    r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN PLAN S20.xls",
    "PATTERN PLAN S20"
)

# EXPORT files
print("\n" + "="*60)
print("EXPORT_024354")
df1 = pd.read_excel(r"C:\Users\drake\Downloads\EXPORT_20260615_024354.xlsx", header=0)
print(f"  Shape: {df1.shape}")
print(f"  Columnas: {list(df1.columns)}")
print(df1.head(5).to_string())

print("\n" + "="*60)
print("EXPORT_024527")
df2 = pd.read_excel(r"C:\Users\drake\Downloads\EXPORT_20260615_024527.xlsx", header=0)
print(f"  Shape: {df2.shape}")
print(f"  Columnas: {list(df2.columns)}")
print(df2.head(5).to_string())
