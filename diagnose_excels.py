
"""
Script de diagnóstico: simula el procesamiento de los archivos PATTERN con los EXPORT.
Detecta qué va mal en extract_trabajo_planificado y extract_plan_matriz.
"""
import sys
sys.path.insert(0, r"C:\Users\drake\Monitoring KPI 2")

from backend.utils.kpi_excel_processor import (
    read_raw_sap_file, extract_trabajo_planificado, extract_plan_matriz,
    PLANNING_GROUP_MAP, parse_sap_count, parse_sap_count_div1000, parse_sap_hh,
    is_resultado_row
)
import pandas as pd

TRAB_PATH  = r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN TRAB S20.xls"
PLAN_PATH  = r"C:\Users\drake\OneDrive - Monitoring SPA\GSYS\Nueva carpeta\0ANALYSIS_PATTERN PLAN S20.xls"
EXPORT_354 = r"C:\Users\drake\Downloads\EXPORT_20260615_024354.xlsx"  # IW39 - trabajo planificado
EXPORT_527 = r"C:\Users\drake\Downloads\EXPORT_20260615_024527.xlsx"  # IW37N - plan matriz

# ────────────────────────────────────────
# 1. Leer los archivos PATTERN
# ────────────────────────────────────────
print("\n" + "="*60)
print("1. LEYENDO PATTERN TRAB")
df_trab = read_raw_sap_file(TRAB_PATH)
print(f"   Shape: {df_trab.shape}")
print("   Fila 0 (headers1):", list(df_trab.iloc[0]))
print("   Fila 1 (headers2):", list(df_trab.iloc[1]))
print("   Fila 2 (datos1) :", list(df_trab.iloc[2]))
print("   Ultima fila     :", list(df_trab.iloc[-1]))

print("\n" + "="*60)
print("2. LEYENDO PATTERN PLAN")
df_plan = read_raw_sap_file(PLAN_PATH)
print(f"   Shape: {df_plan.shape}")
print("   Fila 0 (headers1):", list(df_plan.iloc[0]))
print("   Fila 1 (headers2):", list(df_plan.iloc[1]))
print("   Fila 2 (datos1) :", list(df_plan.iloc[2]))
print("   Ultima fila     :", list(df_plan.iloc[-1]))

# ────────────────────────────────────────
# 2. Leer los EXPORT y construir ots_mapping
# ────────────────────────────────────────
print("\n" + "="*60)
print("3. LEYENDO EXPORT_354 (IW39 - Trabajo Planificado)")
df_e354 = pd.read_excel(EXPORT_354, header=0)
print(f"   Shape: {df_e354.shape}")
print(f"   Columnas: {list(df_e354.columns)}")

print("\n" + "="*60)
print("4. LEYENDO EXPORT_527 (IW37N - Plan Matriz)")
df_e527 = pd.read_excel(EXPORT_527, header=0)
print(f"   Shape: {df_e527.shape}")
print(f"   Columnas: {list(df_e527.columns)}")

# ────────────────────────────────────────
# 3. Construir ots_mapping desde EXPORT_354 (contiene "Grupo planificación")
# ────────────────────────────────────────
print("\n" + "="*60)
print("5. CONSTRUYENDO ots_mapping desde EXPORT_354")

# Buscar la columna "Grupo planificación" y "Orden" en el export
cols_354 = [str(c).strip() for c in df_e354.columns]
print(f"   Columnas: {cols_354}")

# Detectar columnas por nombre
idx_orden_354 = -1
idx_grp_354 = -1
for i, c in enumerate(cols_354):
    c_lower = c.lower()
    if 'orden' in c_lower:
        idx_orden_354 = i
    if 'grupo planif' in c_lower or 'grupo_planif' in c_lower or 'gr.planif' in c_lower or 'gr. planif' in c_lower:
        idx_grp_354 = i

print(f"   idx_orden={idx_orden_354} ({cols_354[idx_orden_354] if idx_orden_354>=0 else 'N/F'})")
print(f"   idx_grp={idx_grp_354} ({cols_354[idx_grp_354] if idx_grp_354>=0 else 'N/F'})")

# Muestra de datos
print("\n   Muestra primeras 5 filas (orden, grupo_planif):")
for i, row in df_e354.head(5).iterrows():
    orden_val = row.iloc[idx_orden_354] if idx_orden_354 >= 0 else "N/A"
    grp_val = row.iloc[idx_grp_354] if idx_grp_354 >= 0 else "N/A"
    print(f"   Orden={orden_val}, Grp={grp_val}")

# ────────────────────────────────────────
# 4. Ejecutar extract_trabajo_planificado sin mapping
# ────────────────────────────────────────
print("\n" + "="*60)
print("6. extract_trabajo_planificado SIN mapping:")
try:
    df_clean_trab, stats_trab = extract_trabajo_planificado(TRAB_PATH, {})
    print(f"   Grupos encontrados: {len(stats_trab['grupos'])}")
    for g in stats_trab['grupos'][:5]:
        print(f"   {g}")
    print(f"   Total: {stats_trab['total']}")
except Exception as e:
    import traceback
    traceback.print_exc()

# ────────────────────────────────────────
# 5. Ejecutar extract_plan_matriz sin mapping
# ────────────────────────────────────────
print("\n" + "="*60)
print("7. extract_plan_matriz (directo):")
try:
    df_clean_plan, stats_plan = extract_plan_matriz(PLAN_PATH)
    print(f"   Grupos encontrados: {len(stats_plan['grupos'])}")
    for g in stats_plan['grupos'][:5]:
        print(f"   {g}")
    print(f"   Total: {stats_plan['total']}")
except Exception as e:
    import traceback
    traceback.print_exc()

# ────────────────────────────────────────
# 6. Ver qué columnas usan los archivos
# ────────────────────────────────────────
print("\n" + "="*60)
print("8. COLUMNAS REALES EN PATTERN TRAB (fila 2 = primera fila de datos):")
data_trab = df_trab.iloc[2:-1]
for idx, col in enumerate(df_trab.iloc[1]):
    print(f"   Col[{idx}] = '{col}'  | datos[0]= '{list(data_trab.iloc[0])[idx] if idx < len(list(data_trab.iloc[0])) else 'N/A'}'")

print("\n" + "="*60)
print("9. COLUMNAS REALES EN PATTERN PLAN (fila 2 = primera fila de datos):")
data_plan = df_plan.iloc[2:-1]
for idx, col in enumerate(df_plan.iloc[1]):
    val = list(data_plan.iloc[0])[idx] if idx < len(list(data_plan.iloc[0])) else 'N/A'
    print(f"   Col[{idx}] = '{col}'  | datos[0]= '{val}'")
