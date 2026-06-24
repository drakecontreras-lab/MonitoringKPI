import pandas as pd
df = pd.read_excel('C:/Users/drake/Monitoring KPI 2/output/KPI GSYS SEM25.xlsx', sheet_name='% Trabajo Planificado')
print('Trabajo Planificado columns:', df.columns.tolist())
print(df.head())
