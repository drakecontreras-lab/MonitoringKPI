# -*- coding: utf-8 -*-
import pandas as pd

file_path = r'C:\Users\drake\Downloads\KPI GSYS SEM25.xlsx'

try:
    df_trab = pd.read_excel(file_path, sheet_name='% Trabajo Planificado')
    print("----- Trabajo Planificado -----")
    print("Columnas:", df_trab.columns.tolist()[:8])
    print(df_trab.head(3).iloc[:, :8].to_string())
    
    if 'Gr.planif' in df_trab.columns:
        print("\nValores de Gr.planif:", df_trab['Gr.planif'].unique().tolist())
    else:
        print("\nNO SE ENCONTRO COLUMNA Gr.planif")
except Exception as e:
    print("Error en Trabajo Planificado:", e)

try:
    df_plan = pd.read_excel(file_path, sheet_name='Plan Matriz')
    print("\n----- Plan Matriz -----")
    print("Columnas:", df_plan.columns.tolist()[:8])
    print(df_plan.head(3).iloc[:, :8].to_string())
    
    if len(df_plan.columns) > 18:
        print("\nValores Op_Total:", df_plan.iloc[:, 18].unique().tolist()[:10])
except Exception as e:
    print("Error en Plan Matriz:", e)
