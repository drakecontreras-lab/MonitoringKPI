import sys
with open('C:/Users/drake/Monitoring KPI 2/backend/utils/kpi_excel_processor.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
    start = -1
    for i, line in enumerate(lines):
        if 'def extract_trabajo_planificado' in line:
            start = i
            break
            
    for i in range(start, start + 100):
        print(f"{i}: {lines[i]}", end='')
