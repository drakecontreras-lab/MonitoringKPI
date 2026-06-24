import sys
sys.path.insert(0, r"C:\Users\drake\Monitoring KPI 2")

from backend.utils.kpi_excel_processor import extract_trabajo_planificado
import pandas as pd

TRAB_PATH  = r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls"
EXPORT_354 = r"C:\Users\drake\Downloads\EXPORT_20260615_024354.xlsx"
from backend.utils.kpi_excel_processor import PLANNING_GROUP_MAP

df_et = pd.read_excel(EXPORT_354, header=0)
cols_et = [str(c).strip() for c in df_et.columns]
idx_orden_et = next((i for i, c in enumerate(cols_et) if 'orden' in c.lower()), -1)
idx_grp_et   = next((i for i, c in enumerate(cols_et) if 'grupo planif' in c.lower() or 'grupo_planif' in c.lower()), -1)

ots_mapping = {}
for _, row in df_et.iterrows():
    try:
        orden_val = str(int(float(row.iloc[idx_orden_et]))).strip()
    except (ValueError, TypeError):
        orden_val = str(row.iloc[idx_orden_et]).strip()
    grp_code  = str(row.iloc[idx_grp_et]).strip()
    if orden_val and orden_val.isdigit():
        grp_pm = PLANNING_GROUP_MAP.get(grp_code, grp_code)
        ots_mapping[orden_val] = (grp_code, grp_pm)

df_clean, stats = extract_trabajo_planificado(TRAB_PATH, ots_mapping)
print(df_clean.columns.tolist()[:8])
print(df_clean.iloc[0][:8].tolist())
print("Stats groups length:", len(stats['grupos']))
for g in stats['grupos'][:3]: print(g)
