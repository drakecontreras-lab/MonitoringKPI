
import pandas as pd
import openpyxl
import xlrd

def inspect_excel(path, label, max_rows=5):
    print(f"\n{'='*60}")
    print(f"ARCHIVO: {label}")
    print(f"PATH: {path}")
    print(f"{'='*60}")
    try:
        if path.endswith('.xls'):
            wb = xlrd.open_workbook(path)
            sheets = wb.sheet_names()
            print(f"  Hojas: {sheets}")
            for s in sheets:
                ws = wb.sheet_by_name(s)
                print(f"\n  -- Hoja: {s} ({ws.nrows} filas x {ws.ncols} cols)")
                # Mostrar primeras filas
                for r in range(min(max_rows+3, ws.nrows)):
                    row = [ws.cell_value(r, c) for c in range(ws.ncols)]
                    print(f"    Fila {r}: {row}")
        else:
            xl = pd.ExcelFile(path)
            print(f"  Hojas: {xl.sheet_names}")
            for s in xl.sheet_names:
                df = pd.read_excel(path, sheet_name=s, header=None, nrows=max_rows+3)
                print(f"\n  -- Hoja: {s} ({df.shape[0]} filas x {df.shape[1]} cols)")
                for i, row in df.iterrows():
                    print(f"    Fila {i}: {list(row)}")
    except Exception as e:
        print(f"  ERROR: {e}")

# ---- Archivos de referencia (resultado esperado) ----
inspect_excel(
    r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Reportes\KPI GSYS SEM24.xlsx",
    "KPI GSYS SEM24 (RESULTADO ESPERADO)", max_rows=8
)

# ---- Archivos de patrones ----
inspect_excel(
    r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls",
    "PATTERN TRAB S20", max_rows=8
)

inspect_excel(
    r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN PLAN S20.xls",
    "PATTERN PLAN S20", max_rows=8
)

# ---- Archivos EXPORT ----
inspect_excel(
    r"C:\Users\drake\Downloads\EXPORT_20260615_024354.xlsx",
    "EXPORT_024354", max_rows=8
)

inspect_excel(
    r"C:\Users\drake\Downloads\EXPORT_20260615_024527.xlsx",
    "EXPORT_024527", max_rows=8
)
