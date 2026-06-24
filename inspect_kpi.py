
import pandas as pd
import xlrd

# ---- KPI GSYS SEM24 (resultado esperado) ----
print("\n" + "="*60)
print("KPI GSYS SEM24 - HOJAS DISPONIBLES")
xl = pd.ExcelFile(r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Reportes\KPI GSYS SEM24.xlsx")
print(xl.sheet_names)

for sheet in xl.sheet_names:
    df = pd.read_excel(r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Reportes\KPI GSYS SEM24.xlsx",
                       sheet_name=sheet, header=None)
    print(f"\n--- Hoja: '{sheet}' --- ({df.shape[0]} filas x {df.shape[1]} cols)")
    print("Primeras 6 filas:")
    print(df.head(6).to_string())
