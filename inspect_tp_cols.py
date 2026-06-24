"""Verifica los criterios del nuevo procesador con el archivo PATTERN S25."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backend.utils.kpi_excel_processor import extract_trabajo_planificado

path = r"C:\Users\drake\Downloads\0ANALYSIS_PATTERN_TRAB_S25.xls"
df_clean, stats = extract_trabajo_planificado(path)

tp = stats['total']
print(f"\n{'='*55}")
print(f"  KPI % Trabajo Planificado - SEM 25")
print(f"{'='*55}")
print(f"  Planificado  : {tp['planificado']:>10.1f} HH")
print(f"  Sin HR       : {tp['sinHr']:>10.1f} HH")
print(f"  Sin horizonte: {tp.get('sinHorizonte', tp['sinHr']):>10.1f} HH")
print(f"  Imprevistos  : {tp['imprevistos']:>10.1f} HH")
print(f"  Total        : {tp['total']:>10.1f} HH")
print(f"  Cumplimiento : {tp['cumplimiento']*100:>9.1f}%")
print(f"\nDistribución de criterios en el Excel:")
if 'Criterio' in df_clean.columns:
    print(df_clean['Criterio'].value_counts().to_string())
