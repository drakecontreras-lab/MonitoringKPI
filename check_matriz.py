import sys
sys.path.insert(0, r"C:\Users\drake\Monitoring KPI 2")

from backend.utils.kpi_excel_processor import extract_plan_matriz
import pandas as pd

PLAN_PATH  = r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN PLAN S20.xls"
EXPORT_527 = r"C:\Users\drake\Downloads\EXPORT_20260615_024527.xlsx"

df_ep = pd.read_excel(EXPORT_527, header=0)
cols_ep = [str(c).strip() for c in df_ep.columns]
idx_orden_ep = next((i for i, c in enumerate(cols_ep) if c.lower() == 'orden' or c.lower().startswith('orden')), -1)

export_ops_mapping = {}
for _, row in df_ep.iterrows():
    try:
        orden_ep = str(int(float(row.iloc[idx_orden_ep]))).strip()
    except (ValueError, TypeError):
        orden_ep = str(row.iloc[idx_orden_ep]).strip()
    if orden_ep and orden_ep.isdigit():
        export_ops_mapping[orden_ep] = export_ops_mapping.get(orden_ep, 0) + 1

print(f"Mapping size: {len(export_ops_mapping)}")
print(f"Sample mapping: {list(export_ops_mapping.items())[:5]}")

df_clean_plan, stats_plan = extract_plan_matriz(PLAN_PATH, export_ops_mapping)
print(f"Total: {stats_plan['total']}")
