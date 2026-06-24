import sys
import os
import json
import pandas as pd
sys.path.insert(0, r"c:\Users\drake\Monitoring KPI 2\Monitoring KPI 2")

from backend.utils.kpi_excel_processor import process_ready_excel

if __name__ == "__main__":
    file_path = r"c:\Users\drake\Monitoring KPI 2\Monitoring KPI 2\output\KPI GSYS SEM24.xlsx"
    data = process_ready_excel(file_path, 24)
    print("TP Grupos:")
    print(json.dumps(data["trabajoPlanificado"]["grupos"], indent=2))
    
    print("\nPM Grupos:")
    print(json.dumps(data["planMatriz"]["grupos"], indent=2))
