
import pandas as pd
import xlrd

# ---- PATTERN TRAB ----
print("\n" + "="*60)
print("PATTERN TRAB S20 - HOJAS DISPONIBLES")
wb = xlrd.open_workbook(r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls")
print(wb.sheet_names())
for sn in wb.sheet_names():
    ws = wb.sheet_by_name(sn)
    print(f"\n--- Hoja: '{sn}' ({ws.nrows} filas x {ws.ncols} cols) ---")
    for r in range(min(8, ws.nrows)):
        print(f"  Fila {r}: {[ws.cell_value(r, c) for c in range(ws.ncols)]}")

print("\n" + "="*60)
print("PATTERN PLAN S20 - HOJAS DISPONIBLES")
wb2 = xlrd.open_workbook(r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN PLAN S20.xls")
print(wb2.sheet_names())
for sn in wb2.sheet_names():
    ws = wb2.sheet_by_name(sn)
    print(f"\n--- Hoja: '{sn}' ({ws.nrows} filas x {ws.ncols} cols) ---")
    for r in range(min(8, ws.nrows)):
        print(f"  Fila {r}: {[ws.cell_value(r, c) for c in range(ws.ncols)]}")
