"""
PostProcesador - Reescritura fiel de la macro VBA ProcesarPlanificacion
Requiere: pip install pandas openpyxl pywin32
"""

import os
import sys
import pandas as pd
import numpy as np
import win32com.client
import pythoncom
from datetime import datetime, date
import tkinter as tk
from tkinter import simpledialog, filedialog, messagebox
import warnings

# Silenciar advertencias de Pandas (especialmente las de fechas mixtas)
warnings.simplefilter(action='ignore', category=UserWarning)


# ============================================================
# UTILIDADES
# ============================================================

def determinar_area(ut: str) -> str:
    """Replica DeterminarArea de VBA."""
    ut = str(ut).upper().strip()
    if ut.startswith("CDEE"):         return "SEC"
    if ut.startswith("CTAL"):         return "SP&L"
    if ut.startswith("CHSS-SE"):      return "SEC"
    if ut.startswith("CHSS-SU"):      return "SPS"
    if ut.startswith("CHSS-PL"):      return "SP&L"
    if ut.startswith("CHCO-IN-INF"):  return "CHCO"
    return ""


def encontrar_columna(df: pd.DataFrame, nombre: str) -> str | None:
    """Busca encabezado sin importar mayúsculas. Devuelve el nombre real de la columna."""
    for col in df.columns:
        if str(col).strip().upper() == nombre.strip().upper():
            return col
    return None


def solicitar_numero_semana(root) -> str | None:
    s = simpledialog.askstring("Número de Semana",
                               "Ingrese el número de semana que está analizando:",
                               parent=root)
    if not s or not s.strip():
        messagebox.showinfo("Cancelado", "Proceso cancelado.")
        return None
    return s.strip()


def solicitar_fecha_asignada(root, num_semana: str) -> date | None:
    from datetime import timedelta
    hoy = date.today()
    wd = hoy.weekday()          # 0=lun
    dias_hasta_lunes = (7 - wd) % 7 or 7
    proximo_lunes = hoy + timedelta(days=dias_hasta_lunes)
    default_str = proximo_lunes.strftime("%d-%m-%Y")

    while True:
        valor = simpledialog.askstring(
            "Fecha Asignada",
            f"Ingrese la FECHA ASIGNADA para la Semana {num_semana}\nEjemplo: 19-01-2026",
            initialvalue=default_str,
            parent=root
        )
        if not valor or not valor.strip():
            messagebox.showinfo("Cancelado", "Proceso cancelado.")
            return None
        try:
            partes = valor.strip().replace("/", "-").replace(".", "-").split("-")
            d, m, y = int(partes[0]), int(partes[1]), int(partes[2])
            return date(y, m, d)
        except Exception:
            messagebox.showwarning("Fecha inválida", "Fecha inválida. Intente nuevamente (ej: 19-01-2026).")


def seleccionar_archivo(titulo: str, root) -> str | None:
    ruta = filedialog.askopenfilename(
        title=titulo,
        filetypes=[("Archivos Excel", "*.xlsx *.xlsm *.xls")],
        parent=root
    )
    if not ruta:
        messagebox.showwarning("Sin archivo", "No se seleccionó archivo. Proceso cancelado.")
        return None
    return ruta


def seleccionar_archivo_opcional(titulo: str, root) -> str | None:
    ruta = filedialog.askopenfilename(
        title=titulo,
        filetypes=[("Archivos Excel", "*.xlsx *.xlsm *.xls")],
        parent=root
    )
    return ruta if ruta else None


# ============================================================
# LECTURA DE EXCEL → DataFrame
# ============================================================

def leer_excel(ruta: str) -> pd.DataFrame:
    # No forzar dtype=str globalmente para permitir que pandas detecte fechas nativas de Excel
    df = pd.read_excel(ruta)
    df = df.dropna(how="all")
    # Forzar columnas clave a string para evitar pérdida de ceros o notación científica y asegurar filtros
    cols_a_texto = [
        "Orden", "Aviso", "Ubicación técnica", "Ubicacin técnica", "Equipo",
        "Clase actividad PM", "Clase de actividad PM", "Prioridad", "Prioridad aviso",
        "Status de sistema", "Status sistema", "Status sistema op.",
        "Trabajo real", "Trabajo Real", "Trabajo"
    ]
    for col in cols_a_texto:
        c = encontrar_columna(df, col)
        if c:
            df[c] = df[c].astype(str).replace(['nan', 'NaN', 'None', 'nan '], '')
    return df


# ============================================================
# PASO 10-13: ESTADO + DÍAS TRANSCURRIDOS (Avisos / Órdenes)
# ============================================================

def calcular_dias_transcurridos(df: pd.DataFrame, posibles_cols: list, fecha_base: date, indice_vba: int = None) -> pd.DataFrame:
    """
    posibles_cols: lista de nombres de columnas donde buscar la fecha
    indice_vba: índice 1-based de la columna (fallback si no se encuentra por nombre)
    REPLICA: CalcularDiasEnHoja_EstadoA_DiasB
    """
    nombre_col = None
    for c in posibles_cols:
        encontrada = encontrar_columna(df, c)
        if encontrada:
            nombre_col = encontrada
            break
            
    if not nombre_col and indice_vba is not None:
        # Columna 9 (I) -> índice 8 en pandas si no se han insertado columnas aún.
        if len(df.columns) >= indice_vba:
            nombre_col = df.columns[indice_vba - 1]

    if not nombre_col:
        df["Días Transcurridos"] = np.nan
        return df

    def parse(v):
        if pd.isna(v):
            return None
        try:
            # Intentar parseo robusto para SAP
            res = pd.to_datetime(v, dayfirst=True, errors='coerce')
            if pd.isna(res):
                return None
            return res.date()
        except:
            return None

    dias = []
    for v in df[nombre_col]:
        dt = parse(v)
        if dt:
            dias.append((fecha_base - dt).days)
        else:
            dias.append(np.nan)
    df["Días Transcurridos"] = dias
    return df


def calcular_estado_avisos(df: pd.DataFrame, dias_venc: int = 7) -> pd.DataFrame:
    """Replica CalcularEstadoAvisos. dias_venc configurable."""
    col_pri = encontrar_columna(df, "Prioridad") or encontrar_columna(df, "Prioridad aviso")
    mitad = max(1, dias_venc // 2)
    estados = []
    for _, row in df.iterrows():
        dias = row.get("Días Transcurridos", np.nan)
        try:
            pri_num = float(row[col_pri]) if col_pri and pd.notna(row[col_pri]) else None
        except Exception:
            pri_num = None
        if pri_num == 1:
            estados.append("Vencido")
        elif pd.notna(dias):
            d = int(dias)
            if d < mitad:       estados.append("En Plazo")
            elif d < dias_venc: estados.append("Por Vencer")
            else:               estados.append("Vencido")
        else:
            estados.append("")
    df["Estado"] = estados
    return df


def calcular_estado_ordenes(df: pd.DataFrame, dias_venc: int = 21) -> pd.DataFrame:
    """Replica CalcularEstadoOrdenes. dias_venc configurable."""
    tercio = max(1, dias_venc // 3)
    estados = []
    for dias in df["Días Transcurridos"]:
        if pd.notna(dias):
            d = int(dias)
            if d < tercio:          estados.append("En Plazo")
            elif d < dias_venc:     estados.append("Por Vencer")
            else:                  estados.append("Vencido")
        else:
            estados.append("")
    df["Estado"] = estados
    return df


def preparar_estado_dias(df: pd.DataFrame) -> pd.DataFrame:
    """Inserta columnas Estado y Días Transcurridos al inicio si no existen."""
    if "Estado" not in df.columns:
        df.insert(0, "Estado", "")
    if "Días Transcurridos" not in df.columns:
        df.insert(1, "Días Transcurridos", np.nan)
    return df


# ============================================================
# PASO 14: COLUMNA AREAS
# ============================================================

def agregar_columna_areas(df: pd.DataFrame, es_diea: bool = False) -> pd.DataFrame:
    """Replica AgregarOActualizarAreas."""
    col_ut = encontrar_columna(df, "Ubicación técnica")
    
    areas_previas = df["Areas"].copy() if "Areas" in df.columns else None

    if not col_ut:
        if "Areas" not in df.columns:
            df["Areas"] = ""
    else:
        df["Areas"] = df[col_ut].apply(lambda v: determinar_area(str(v)))
        df["Areas"] = df["Areas"].str.replace("Talleres", "CHCO", case=False)

    if areas_previas is not None:
        mask_diea = areas_previas == "DIEA"
        df.loc[mask_diea, "Areas"] = "DIEA"

    if es_diea:
        df["Areas"] = "DIEA"

    return df


def combinar_con_diea(df_principal: pd.DataFrame, df_diea: pd.DataFrame | None) -> pd.DataFrame:
    """Anexa filas DIEA (sin encabezado) y marca su área."""
    if df_diea is None or df_diea.empty:
        return df_principal
    df_diea = df_diea.copy()
    df_diea["Areas"] = "DIEA"
    return pd.concat([df_principal, df_diea], ignore_index=True)


# ============================================================
# PASO 14.2: ELIMINAR FILAS VACÍAS
# ============================================================

def eliminar_filas_vacias_orden(df: pd.DataFrame, col_nombre: str) -> pd.DataFrame:
    """Replica EliminarFilasVaciasOrden para un DataFrame."""
    col = encontrar_columna(df, col_nombre)
    if col:
        df = df[df[col].notna() & (df[col].str.strip() != "")].copy()
    return df


# ============================================================
# PASO 15: HORIZONTE + CRITERIO (Trabajo Planificado)
# ============================================================

def determinar_criterio_trabajo(clase: str, horizonte, grupo: str) -> str:
    """Replica DeterminarCriterioTrabajoPlanificado."""
    clase = str(clase).strip().upper()
    if clase == "ST": return "OT Talleres"
    if clase == "NP": return "Imprevistos"
    if clase == "PL":
        try:
            h = int(float(horizonte))
        except Exception:
            return "No cumple"
        if h <= 7:           return "No cumple"
        if not str(grupo).strip(): return "No cumple"
        return "Cumple"
    return ""


def agregar_horizonte_criterio(df: pd.DataFrame) -> pd.DataFrame:
    """Replica AgregarColumnasTrabajoplanificado."""
    col_fi  = encontrar_columna(df, "Fecha inicio extrema")
    col_fl  = encontrar_columna(df, "Fecha liber.real")
    col_co  = encontrar_columna(df, "Clase de orden")
    # En IW39 sale como 'Grupo planificación', en IW37N como 'Grupo hojas ruta'
    col_gr  = (encontrar_columna(df, "Grupo planificación") or 
               encontrar_columna(df, "Grupo hojas ruta"))

    if not all([col_fi, col_fl, col_co, col_gr]):
        df["Horizonte"] = ""
        df["Criterio"]  = ""
        return df

    horizontes, criterios = [], []
    for idx, row in df.iterrows():
        h = None
        try:
            val_fi = row[col_fi]
            val_fl = row[col_fl]
            # Parseo robusto replica macro
            fi = pd.to_datetime(val_fi, dayfirst=True, errors='coerce')
            fl = pd.to_datetime(val_fl, dayfirst=True, errors='coerce')
            
            if pd.notna(fi) and pd.notna(fl):
                h = (fi.date() - fl.date()).days
                horizontes.append(h)
            else:
                horizontes.append("")
        except Exception:
            horizontes.append("")

        clase = str(row[col_co]).strip().upper() if pd.notna(row[col_co]) else ""
        grupo = str(row[col_gr]).strip() if pd.notna(row[col_gr]) else ""
        criterios.append(determinar_criterio_trabajo(clase, h if h is not None else "", grupo))

    df["Horizonte"] = horizontes
    df["Criterio"]  = criterios
    return df


# ============================================================
# PASOS 16-19: FILTRADO + CRITERIO EN SUBHOJAS
# ============================================================

def filtrar_programa_semanal(df_trabajo: pd.DataFrame) -> pd.DataFrame:
    """Replica FiltrarProgramaSemanal."""
    col_status = (encontrar_columna(df_trabajo, "Status sistema op.") or 
                  encontrar_columna(df_trabajo, "Status sistema"))
    if not col_status:
        return pd.DataFrame()

    # Filtro robusto para SAP: 'plan', 'prog' o 'imop' identifican programa
    def es_planificado(val):
        s = str(val).lower()
        return any(x in s for x in ["plan", "prog", "imop"])

    df = df_trabajo[df_trabajo[col_status].apply(es_planificado)].copy()
    if df.empty:
        return pd.DataFrame()

    # Recalcular Criterio para Programa Semanal
    col_ss = (encontrar_columna(df, "Status de sistema") or
              encontrar_columna(df, "Status sistema"))
    if col_ss:
        df["Criterio"] = df[col_ss].apply(
            lambda v: "Cumple" if "NOT" in str(v).upper() else "No cumple"
        )
    return df


def filtrar_plan_matriz(df_trabajo: pd.DataFrame) -> pd.DataFrame:
    """
    Filtra los datos de Trabajo Planificado para obtener el Plan Matriz, y recalcula la columna de operaciones totales.
    Propósito: Filtrar por Clase de Actividad PM (010, 10, 020, 20), definir el criterio según el status,
    y sobrescribir la columna de Operaciones Totales con el conteo real de filas (operaciones) asociadas a cada orden (OT).
    """
    col_clase = (encontrar_columna(df_trabajo, "Clase actividad PM") or 
                 encontrar_columna(df_trabajo, "Clase de actividad PM"))
    if not col_clase:
        return pd.DataFrame()

    validos = ["010", "10", "020", "20"]
    # Limpiar ".0" y espacios para asegurar coincidencia
    df = df_trabajo.copy()
    df[col_clase] = df[col_clase].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
    df = df[df[col_clase].isin(validos)].copy()
    
    if df.empty:
        return pd.DataFrame(columns=df_trabajo.columns) # Retornar con columnas para tener encabezados

    # 1. Contar operaciones (filas) por Orden en el listado de trabajo original
    col_orden = encontrar_columna(df_trabajo, "Orden")
    ordenes_count = {}
    if col_orden:
        for v in df_trabajo[col_orden]:
            orden_val = str(v).strip()
            if orden_val and orden_val.isdigit():
                ordenes_count[orden_val] = ordenes_count.get(orden_val, 0) + 1

    # 2. Reemplazar el valor en la columna de operaciones totales con el conteo calculado
    col_op_tot = (encontrar_columna(df, "Op. tot.") or 
                  encontrar_columna(df, "Op. tot") or 
                  encontrar_columna(df, "Operaciones totales") or 
                  encontrar_columna(df, "Op. Totales") or
                  encontrar_columna(df, "Cantidad de operaciones tot"))
                  
    if col_orden and col_op_tot:
        nuevos_totales = []
        for v in df[col_orden]:
            orden_val = str(v).strip()
            nuevos_totales.append(ordenes_count.get(orden_val, 0))
        df[col_op_tot] = nuevos_totales

    # Recalcular Criterio para Plan Matriz
    col_ss = (encontrar_columna(df, "Status de sistema") or
              encontrar_columna(df, "Status sistema"))
    if col_ss:
        df["Criterio"] = df[col_ss].apply(
            lambda v: "Cumple" if "NOT" in str(v).upper() else "No cumple"
        )
    return df


# ============================================================
# ESCRITURA EN EXCEL VÍA WIN32COM
# ============================================================

# Colores
COLOR_NARANJA = 0x3131ED   # RGB(237,125,49) en BGR para COM = 237 + 125*256 + 49*65536
COLOR_AZUL    = 0xC47244   # RGB(68,114,196)
COLOR_BLANCO  = 0xFFFFFF
COLOR_NEGRO   = 0x000000
COLOR_ROJO    = 0x0000FF
COLOR_AMARILLO= 0x00FFFF
COLOR_VERDE   = 0x0050B0

# Conversión RGB → BGR para win32com
def rgb(r, g, b): return r + g * 256 + b * 65536


def bulk_convert_df(df: pd.DataFrame) -> list:
    valores = []
    import math
    for r in df.itertuples(index=False):
        fila = []
        for val in r:
            # Manejar nulos/NA
            if pd.isna(val):
                fila.append(None)
            # Manejar fechas
            elif isinstance(val, (datetime, date, pd.Timestamp)):
                try:
                    if isinstance(val, pd.Timestamp):
                        d = val.to_pydatetime()
                    elif isinstance(val, date) and not isinstance(val, datetime):
                        d = datetime(val.year, val.month, val.day)
                    else:
                        d = val
                    
                    if d.year < 1900 or d.year > 2100:
                        fila.append(None)
                    else:
                        fila.append(d.replace(tzinfo=None))
                except:
                    fila.append(None)
            # Sanitizar estrictamente numéricos para pywin32
            elif isinstance(val, (int, np.integer)):
                fila.append(int(val))
            elif isinstance(val, (float, np.floating)):
                try:
                    f_val = float(val)
                    if math.isnan(f_val) or math.isinf(f_val):
                        fila.append(None)
                    else:
                        fila.append(f_val)
                except:
                    fila.append(None)
            else:
                fila.append(str(val))
        valores.append(fila)
    return valores

def df_to_sheet(ws, df: pd.DataFrame):
    """Escribe un DataFrame en una hoja de Excel (win32com) de forma masiva."""
    ws.Cells.Clear()
    if df.empty:
        return

    cols = list(df.columns)
    # Encabezados
    for j, c in enumerate(cols, 1):
        ws.Cells(1, j).Value = str(c)

    # Datos (escritura optimizada por trozos)
    valores = bulk_convert_df(df)
    if valores:
        fila_inicio = 2
        chunk_size = 500
        for i in range(0, len(valores), chunk_size):
            chunk = valores[i : i + chunk_size]
            v_tuple = tuple(tuple(f) for f in chunk)
            
            r1 = fila_inicio + i
            r2 = r1 + len(chunk) - 1
            rng = ws.Range(ws.Cells(r1, 1), ws.Cells(r2, len(cols)))
            try:
                rng.Value = v_tuple
            except Exception as e:
                # Si el chunk falla, intentamos fila por fila para debuggear y salvar el proceso
                for j, fila_vals in enumerate(chunk):
                    try:
                        row_rng = ws.Range(ws.Cells(r1 + j, 1), ws.Cells(r1 + j, len(cols)))
                        row_rng.Value = tuple(fila_vals)
                    except Exception:
                        # Si una fila sigue fallando, la saltamos o ponemos valores como strings
                        try:
                            row_rng.Value = tuple(str(x) if x is not None else "" for x in fila_vals)
                        except:
                            pass
                # No lanzamos excepción para que el resto del libro se genere

def parse_dates_by_letter(df: pd.DataFrame, letras: list):
    for letra in letras:
        col_idx = 0
        for char in letra:
            col_idx = col_idx * 26 + (ord(char) - ord('A')) + 1
        real_idx = col_idx - 1
        if real_idx < len(df.columns):
            col_name = df.columns[real_idx]
            # Parseo inteligente: si ya es datetime (por pd.read_excel), no re-parsear
            if not pd.api.types.is_datetime64_any_dtype(df[col_name]):
                df[col_name] = pd.to_datetime(df[col_name], dayfirst=True, errors='coerce')


def aplicar_formato_encabezado(ws, num_cols: int):
    """Fila 1 azul con texto blanco centrado en negrita."""
    rng = ws.Range(ws.Cells(1, 1), ws.Cells(1, num_cols))
    rng.Font.Bold = True
    rng.Interior.Color = rgb(68, 114, 196)
    rng.Font.Color = rgb(255, 255, 255)
    rng.HorizontalAlignment = -4108  # xlCenter


def aplicar_formato_estado_columnaA(ws, ult_fila: int):
    """Formato condicional usando FormatConditions para ser ultrarrápido y fiel a VBA."""
    rng = ws.Range(ws.Cells(2, 1), ws.Cells(ult_fila, 1))
    try:
        rng.FormatConditions.Delete()
    except Exception:
        pass

    # Vencido
    fc = rng.FormatConditions.Add(Type=1, Operator=3, Formula1='="Vencido"')
    fc.Interior.Color = rgb(255, 0, 0)
    fc.Font.Color = rgb(255, 255, 255)
    fc.Font.Bold = True

    # Por Vencer
    fc2 = rng.FormatConditions.Add(Type=1, Operator=3, Formula1='="Por Vencer"')
    fc2.Interior.Color = rgb(255, 255, 0)
    fc2.Font.Color = rgb(0, 0, 0)
    fc2.Font.Bold = True

    # En Plazo
    fc3 = rng.FormatConditions.Add(Type=1, Operator=3, Formula1='="En Plazo"')
    fc3.Interior.Color = rgb(0, 176, 80)
    fc3.Font.Color = rgb(255, 255, 255)
    fc3.Font.Bold = True


def formatear_fechas(ws, letras_col: list[str]):
    """Aplica formato dd-mm-yyyy a las columnas indicadas."""
    for letra in letras_col:
        try:
            ws.Columns(letra).NumberFormat = "dd-mm-yyyy"
        except Exception:
            pass


def convertir_a_tabla(ws, nombre_tabla: str):
    """Replica ConvertirRangoATabla usando UsedRange para mayor robustez."""
    try:
        rng = ws.UsedRange
        if rng.Rows.Count < 2:
            return

        for lo in ws.ListObjects:
            try: lo.Unlist()
            except: pass

        lo = ws.ListObjects.Add(1, rng, None, 1)   # xlSrcRange, xlYes
        try:
            lo.Name = nombre_tabla
        except Exception:
            pass
        lo.TableStyle = "TableStyleMedium2"
    except Exception:
        pass


# ============================================================
# TABLAS DINÁMICAS
# ============================================================

def campo_existe(pt, nombre: str) -> bool:
    try:
        _ = pt.PivotFields(nombre)
        return True
    except Exception:
        return False


def ocultar_en_blanco(pt, nombre_campo: str):
    try:
        pf = pt.PivotFields(nombre_campo)
        for pi in pf.PivotItems:
            if pi.Name in ("", "(en blanco)", "(blank)"):
                pi.Visible = False
    except Exception:
        pass


def ordenar_areas(pt, nombre_campo: str = "Areas"):
    orden = ["SEC", "SPS", "SP&L", "DIEA", "CHCO"]
    try:
        pf = pt.PivotFields(nombre_campo)
        pt.ManualUpdate = True
        for i, area in enumerate(orden, 1):
            try:
                pf.PivotItems(area).Position = i
            except Exception:
                pass
        pt.ManualUpdate = False
        pt.RefreshTable()
    except Exception:
        pass


def aplicar_formato_pivot(pt):
    """Replica AplicarFormatoPivot_Medio3_SinSubtotales_Expandida."""
    try:
        pt.TableStyle2 = "PivotStyleMedium3"
        pt.RowAxisLayout(2)   # xlTabularRow
        pt.RepeatAllLabels(1) # xlRepeatLabels
        for pf in pt.RowFields:
            for i in range(1, 13):
                try: pf.Subtotals[i-1] = False
                except: pass
        for pf in pt.RowFields:
            for pi in pf.PivotItems:
                try: pi.ShowDetail = True
                except: pass
    except Exception:
        pass


def agregar_columna_porcentaje_com(ws, pt):
    """
    Replica AgregarColumnaPorcentaje: agrega columna 'Cumplimiento' = Cumple/Total
    a la derecha del rango nativo de la tabla dinámica.
    """
    try:
        rData = pt.DataBodyRange
        if rData is None:
            return

        fila_header = rData.Row - 1
        col_ini     = pt.TableRange1.Column
        col_fin     = col_ini + pt.TableRange1.Columns.Count - 1

        col_cumple = 0
        col_total  = 0
        for c in range(col_ini, col_fin + 1):
            v = str(ws.Cells(fila_header, c).Value or "").upper().strip()
            if v == "CUMPLE":
                col_cumple = c
            if "TOTAL" in v:
                col_total = c

        if col_total == 0:
            return

        col_dest = col_ini + pt.TableRange1.Columns.Count

        # Encabezado
        h = ws.Cells(fila_header, col_dest)
        h.Value = "Cumplimiento"
        h.Interior.Color = ws.Cells(fila_header, col_total).Interior.Color
        h.Font.Color      = rgb(255, 255, 255)
        h.Font.Bold       = True

        # Valores
        for i in range(rData.Row, rData.Row + rData.Rows.Count):
            if col_cumple > 0:
                vc = _val(ws.Cells(i, col_cumple).Value)
                vt = _val(ws.Cells(i, col_total).Value)
                ws.Cells(i, col_dest).Value = vc / vt if vt > 0 else 0
            else:
                ws.Cells(i, col_dest).Value = 0
            ws.Cells(i, col_dest).NumberFormat = "0%"

        # Borde y estilo similar al pivot
        rng = ws.Range(ws.Cells(fila_header, col_dest),
                       ws.Cells(rData.Row + rData.Rows.Count - 1, col_dest))
        rng.Borders.LineStyle = 1
        rng.Borders.Weight    = 2
        # Aplicar el mismo color de fondo del encabezado del pivot
        h.Interior.Color = pt.TableRange1.Rows(1).Interior.Color
    except Exception as e:
        pass


def _val(v) -> float:
    try:
        return float(v) if v not in (None, "") else 0.0
    except Exception:
        return 0.0


def asegurar_inicio_pivot(ws, pt, fila_objetivo: int):
    fila_actual = pt.TableRange2.Row
    if fila_actual < fila_objetivo:
        n = fila_objetivo - fila_actual
        ws.Rows(f"{fila_actual}:{fila_actual + n - 1}").Insert(-4121)  # xlShiftDown


def poner_titulo_shape(ws, pt, texto: str, nombre: str):
    try:
        ws.Shapes(nombre).Delete
    except Exception:
        pass

    alto   = 20.0
    izq    = float(pt.TableRange2.Left)
    ancho  = float(pt.TableRange2.Width)
    if any(t in texto for t in ("%TRABAJO", "PROGRAMA", "PLAN MATRIZ")):
        ancho += 65
    top = float(pt.TableRange2.Top) - alto - 2
    if top < 2:
        top = 2.0

    shp = ws.Shapes.AddTextbox(1, izq, top, ancho, alto)  # msoTextOrientationHorizontal=1
    shp.Name = nombre
    shp.Placement = 1  # xlMoveAndSize

    tf = shp.TextFrame2
    tf.TextRange.Text = texto
    tf.MarginLeft     = 6
    tf.MarginRight    = 6
    tf.MarginTop      = 2
    tf.MarginBottom   = 2
    tf.TextRange.Font.Bold = True
    tf.TextRange.Font.Size = 14
    tf.TextRange.Font.Fill.ForeColor.RGB = rgb(0, 0, 0)

    # Color de fondo = color de encabezado del pivot
    try:
        bg = pt.TableRange1.Rows(1).Cells(1, 1).Interior.Color
    except Exception:
        bg = rgb(68, 114, 196)

    shp.Fill.Visible  = True
    shp.Fill.ForeColor.RGB = bg
    shp.Line.Visible  = False
    shp.ZOrder(0)  # msoBringToFront


def crear_pivot(wb, ws_src, ws_tablas, nombre_pivot: str, fila_inicio: int,
                filas_fields: list, col_fields: list, data_fields: list,
                page_fields: list = None) -> object:
    """
    Crea una tabla dinámica genérica.
    data_fields: lista de (nombre_campo, funcion_xlSum/-4112, caption, formato)
    page_fields: lista de (nombre_campo, pagina_inicial)
    """
    ult_f = ws_src.Cells(ws_src.Rows.Count, 1).End(-4162).Row
    ult_c = ws_src.Cells(1, ws_src.Columns.Count).End(-4159).Column
    if ult_f < 2:
        return None

    rng = ws_src.Range(ws_src.Cells(1, 1), ws_src.Cells(ult_f, ult_c))
    pc  = wb.PivotCaches().Create(1, rng)   # xlDatabase=1

    # Limpiar pivot anterior si existe
    try:
        ws_tablas.PivotTables(nombre_pivot).TableRange2.Clear()
    except Exception:
        pass

    fila_pivot = fila_inicio + 2
    pt = pc.CreatePivotTable(ws_tablas.Cells(fila_pivot, 1), nombre_pivot)

    if page_fields:
        for campo, pagina in page_fields:
            if campo_existe(pt, campo):
                pf = pt.PivotFields(campo)
                pf.Orientation = 3  # xlPageField
                pf.Position    = 1
                try:
                    pf.CurrentPage = pagina
                except Exception:
                    pass

    for i, campo in enumerate(filas_fields, 1):
        if campo_existe(pt, campo):
            pf = pt.PivotFields(campo)
            pf.Orientation = 1  # xlRowField
            pf.Position    = i

    for i, campo in enumerate(col_fields, 1):
        if campo_existe(pt, campo):
            pf = pt.PivotFields(campo)
            pf.Orientation = 2  # xlColumnField
            pf.Position    = i

    for campo, funcion, caption, fmt in data_fields:
        if campo_existe(pt, campo):
            pf_data = pt.AddDataField(pt.PivotFields(campo), caption, funcion)
            if fmt:
                pf_data.NumberFormat = fmt

    return pt


# ============================================================
# RESUMEN KPI
# ============================================================

def obtener_valor_pivot(ws, pt, area: str) -> float:
    """Replica SafeObtenerValorPivot."""
    try:
        rData = pt.DataBodyRange
        col_total = rData.Cells(1, rData.Columns.Count).Column
        for rr in pt.RowRange:
            if str(rr.Value or "").strip().upper() == area.upper():
                return _val(ws.Cells(rr.Row, col_total).Value)
    except Exception:
        pass
    return 0.0


def obtener_porcentaje_pivot(ws, pt, area: str) -> float:
    """Replica SafeObtenerPorcentajePivot."""
    try:
        rData    = pt.DataBodyRange
        col_total = rData.Cells(1, rData.Columns.Count).Column

        # Buscar columna Cumple en encabezados
        col_cumple = 0
        fila_h = rData.Row - 1
        col_ini = pt.TableRange1.Column
        col_fin = col_ini + pt.TableRange1.Columns.Count - 1
        for c in range(col_ini, col_fin + 1):
            if str(ws.Cells(fila_h, c).Value or "").strip().upper() == "CUMPLE":
                col_cumple = c
                break

        if col_cumple == 0:
            return 0.0

        for rr in pt.RowRange:
            if str(rr.Value or "").strip().upper() == area.upper():
                vc = _val(ws.Cells(rr.Row, col_cumple).Value)
                vt = _val(ws.Cells(rr.Row, col_total).Value)
                return vc / vt if vt > 0 else 0.0
    except Exception:
        pass
    return 0.0


def get_pivot_safe(ws_tablas, nombre: str):
    try:
        return ws_tablas.PivotTables(nombre)
    except Exception:
        try:
            # PivotTables() devuelve la colección en win32com
            for pt in ws_tablas.PivotTables():
                if pt.Name.lower() == nombre.lower() or pt.Name.lower().startswith(nombre.lower()):
                    return pt
        except:
            pass
    return None


# ============================================================
# PROCESO PRINCIPAL
# ============================================================

def procesar_planificacion(num_semana_arg=None, fecha_base_arg=None, rutas_dict=None, log_fn=None,
                           dias_venc_avisos=7, dias_venc_ordenes=21):
    pythoncom.CoInitialize()

    root = tk.Tk()
    root.withdraw()

    excel = None
    wb    = None

    def print_log(msg):
        print(msg)
        if log_fn:
            log_fn(msg)

    try:
        if num_semana_arg and fecha_base_arg and rutas_dict:
            # Modo automatizado
            num_semana = num_semana_arg
            # Parse fecha (dd-mm-yyyy)
            partes = fecha_base_arg.replace("/", "-").replace(".", "-").split("-")
            fecha_base = date(int(partes[2]), int(partes[1]), int(partes[0]))
            
            ruta_avisos = rutas_dict.get("avisos", [None, None])[0]
            ruta_avisos2 = rutas_dict.get("avisos", [None, None])[1]
            ruta_ordenes = rutas_dict.get("ordenes", [None, None])[0]
            ruta_ordenes2 = rutas_dict.get("ordenes", [None, None])[1]
            ruta_trabajo = rutas_dict.get("trabajo", [None, None])[0]
            ruta_trabajo2 = rutas_dict.get("trabajo", [None, None])[1]
            
            if not ruta_avisos or not ruta_ordenes or not ruta_trabajo:
                print_log("Faltan archivos base para realizar el proceso. Revise las exportaciones.")
                return False
        else:
            # Modo manual UI
            num_semana = solicitar_numero_semana(root)
            if not num_semana:
                return False
    
            fecha_base = solicitar_fecha_asignada(root, num_semana)
            if not fecha_base:
                return False
    
            ruta_avisos = seleccionar_archivo("Seleccione el archivo 1 de AVISOS", root)
            if not ruta_avisos: return False
    
            ruta_avisos2 = seleccionar_archivo_opcional(
                "Seleccione el archivo 2 de AVISOS (DIEA) (Cancelar = no usar)", root)
    
            ruta_ordenes = seleccionar_archivo("Seleccione el archivo 1 de ÓRDENES (OTS)", root)
            if not ruta_ordenes: return False
    
            ruta_ordenes2 = seleccionar_archivo_opcional(
                "Seleccione el archivo 2 de ÓRDENES (DIEA) (Cancelar = no usar)", root)
    
            ruta_trabajo = seleccionar_archivo("Seleccione el archivo 1 de TRABAJO PLANIFICADO (37N)", root)
            if not ruta_trabajo: return False
    
            ruta_trabajo2 = seleccionar_archivo_opcional(
                "Seleccione el archivo 2 de TRABAJO PLANIFICADO (37N) (DIEA) (Cancelar = no usar)", root)

        # ---- PASOS 7-9: Leer y combinar datos ----
        print_log("Leyendo archivos...")

        df_av = leer_excel(ruta_avisos)
        # Limpieza (EliminarFilasVaciasOrden equivalente)
        df_av = df_av.dropna(subset=["Aviso"]) if "Aviso" in df_av.columns else df_av
        
        if ruta_avisos2:
            df_av2 = leer_excel(ruta_avisos2)
            df_av2["Areas"] = "DIEA"
            df_av2 = df_av2.dropna(subset=["Aviso"]) if "Aviso" in df_av2.columns else df_av2
            df_av = combinar_con_diea(df_av, df_av2)

        df_ot = leer_excel(ruta_ordenes)
        df_ot = df_ot.dropna(subset=["Orden"]) if "Orden" in df_ot.columns else df_ot
        
        if ruta_ordenes2:
            df_ot2 = leer_excel(ruta_ordenes2)
            df_ot2["Areas"] = "DIEA"
            df_ot2 = df_ot2.dropna(subset=["Orden"]) if "Orden" in df_ot2.columns else df_ot2
            df_ot = combinar_con_diea(df_ot, df_ot2)

        df_tp = leer_excel(ruta_trabajo)
        df_tp = df_tp.dropna(subset=["Orden"]) if "Orden" in df_tp.columns else df_tp
        
        if ruta_trabajo2:
            df_tp2 = leer_excel(ruta_trabajo2)
            df_tp2["Areas"] = "DIEA"
            df_tp2 = df_tp2.dropna(subset=["Orden"]) if "Orden" in df_tp2.columns else df_tp2
            df_tp = combinar_con_diea(df_tp, df_tp2)

        # ---- Rellenar columnas vacías de grupo de planificación en Trabajo Planificado usando IW39 ----
        print_log("Rellenando columnas vacías de grupo de planificación en Trabajo Planificado...")
        col_orden_ot = encontrar_columna(df_ot, "Orden")
        col_gp_ot = encontrar_columna(df_ot, "Gr. planif") or encontrar_columna(df_ot, "Gr. Planif") or encontrar_columna(df_ot, "Grupo planificación") or encontrar_columna(df_ot, "Grupo planif.")
        col_gppm_ot = encontrar_columna(df_ot, "Gr.planif.pm") or encontrar_columna(df_ot, "Gr. planif.pm") or encontrar_columna(df_ot, "Grupo planif. PM") or encontrar_columna(df_ot, "Gr.planif.PM")
        
        ots_mapping = {}
        if col_orden_ot and col_gp_ot and col_gppm_ot:
            for _, row in df_ot.iterrows():
                orden_val = str(row[col_orden_ot]).strip()
                if orden_val and orden_val.isdigit():
                    gp_val = str(row[col_gp_ot]).strip().replace('CH01/', '')
                    gppm_val = str(row[col_gppm_ot]).strip()
                    ots_mapping[orden_val] = (gp_val, gppm_val)
                    
        col_orden_tp = encontrar_columna(df_tp, "Orden")
        col_gp_tp = encontrar_columna(df_tp, "Gr. planif") or encontrar_columna(df_tp, "Gr. Planif") or encontrar_columna(df_tp, "Grupo planificación") or encontrar_columna(df_tp, "Grupo planif.")
        col_gppm_tp = encontrar_columna(df_tp, "Gr.planif.pm") or encontrar_columna(df_tp, "Gr. planif.pm") or encontrar_columna(df_tp, "Grupo planif. PM") or encontrar_columna(df_tp, "Gr.planif.PM")
        
        if col_orden_tp:
            if not col_gp_tp:
                df_tp["Gr. planif"] = ""
                col_gp_tp = "Gr. planif"
            if not col_gppm_tp:
                df_tp["Gr.planif.pm"] = ""
                col_gppm_tp = "Gr.planif.pm"
                
            nuevos_gp = []
            nuevos_gppm = []
            for _, row in df_tp.iterrows():
                orden_val = str(row[col_orden_tp]).strip()
                gp_val = row[col_gp_tp]
                gppm_val = row[col_gppm_tp]
                
                if orden_val in ots_mapping:
                    mapped_gp, mapped_gppm = ots_mapping[orden_val]
                    val_actual_gp = str(gp_val).strip().lower()
                    if val_actual_gp in ('', 'nan', 'none', 'n/a', '#'):
                        gp_val = mapped_gp
                    val_actual_gppm = str(gppm_val).strip().lower()
                    if val_actual_gppm in ('', 'nan', 'none', 'n/a', '#'):
                        gppm_val = mapped_gppm
                
                nuevos_gp.append(gp_val)
                nuevos_gppm.append(gppm_val)
                
            df_tp[col_gp_tp] = nuevos_gp
            df_tp[col_gppm_tp] = nuevos_gppm

        # ---- PASO 9.2: Parsear fechas ANTES de insertar columnas (para que coincidan las letras) ----
        print_log("Parseando formatos de fecha...")
        parse_dates_by_letter(df_av, ["I","J","K","T","U"])
        parse_dates_by_letter(df_ot, ["N","O","R","S","T","U","V"])
        parse_dates_by_letter(df_tp, ["F","G","X","Y","Z","AA","AB","AC","AD","AE"])

        # ---- PASOS 10-13: Estado + Días ----
        print_log(f"Calculando Estado y Días (Base: {fecha_base})")
        df_av = preparar_estado_dias(df_av)
        # Macro usa columna 9 (I) -> "Creado el"
        cols_avi = ["Creado el", "Fecha de aviso", "Inicio de avería"]
        df_av = calcular_dias_transcurridos(df_av, cols_avi, fecha_base, indice_vba=9)
        df_av = calcular_estado_avisos(df_av, dias_venc_avisos)

        df_ot = preparar_estado_dias(df_ot)
        cols_ot = ["Fecha inicio extrema", "Fecha de inicio extrema", "Fecha de creación"]
        df_ot = calcular_dias_transcurridos(df_ot, cols_ot, fecha_base, indice_vba=14)
        df_ot = calcular_estado_ordenes(df_ot, dias_venc_ordenes)

        # ---- PASO 14: Areas ----
        print("Calculando Áreas...")
        df_av = agregar_columna_areas(df_av)
        df_ot = agregar_columna_areas(df_ot)
        df_tp = agregar_columna_areas(df_tp)

        # Las filas de archivo2 ya tienen Areas="DIEA" por combinar_con_diea,
        # no se sobreescriben porque agregar_columna_areas solo llena las vacías implícitamente.
        # Para ser 100% fieles: re-aplicar DIEA a las filas marcadas
        # (ya fue hecho al combinar, no se toca)

        # ---- PASO 14.2: Eliminar filas vacías ----
        print("Eliminando filas vacías...")
        df_av = eliminar_filas_vacias_orden(df_av, "Aviso")
        df_ot = eliminar_filas_vacias_orden(df_ot, "Orden")
        df_tp = eliminar_filas_vacias_orden(df_tp, "Orden")

        # ---- PASO 15: Horizonte + Criterio ----
        print("Calculando Horizonte y Criterio...")
        df_tp = agregar_horizonte_criterio(df_tp)

# ARREGLO: conversión numérica preservando decimales (formato europeo)
        def _parse_hh(val):
            """Replica parse_sap_hh de kpi_excel_processor. SAP exporta HHx1000."""
            s = str(val).strip()
            if s in ('nan', '', '#', 'NaN', 'None', 'Resultado total', 'Resultado'):
                return 0.0
            try:
                if ',' in s:
                    s = s.replace('.', '').replace(',', '.')
                    return float(s)
                else:
                    v = float(s)
                    return v / 1000.0
            except:
                return 0.0

        for col_name in ("Trabajo real", "Trabajo Real", "Trabajo"):
            c = encontrar_columna(df_tp, col_name)
            if c:
                df_tp[c] = df_tp[c].apply(_parse_hh)

        # ---- PASOS 16-19: Subhojas ----
        print("Filtrando Programa Semanal y Plan Matriz...")
        df_ps = filtrar_programa_semanal(df_tp)
        df_pm = filtrar_plan_matriz(df_tp)

        # ---- PASO 6/20: Crear libro Excel y escribir hojas ----
        print("Creando libro Excel...")
        try:
            excel = win32com.client.DispatchEx("Excel.Application")
            try:
                excel.Visible = True
            except:
                pass
        except Exception as e:
            if log_fn: log_fn(f"Error al iniciar Excel: {e}", "error")
            return False

        wb = excel.Workbooks.Add()
        try:
            excel.DisplayAlerts  = False
            excel.ScreenUpdating = False
            excel.Calculation    = -4135  # xlCalculationManual
        except:
            pass

        hojas_orden = ["Avisos", "Ordenes",
                       "Trabajo planificado", "Programa semanal", "Plan Matriz"]

        # Crear hojas en orden (sin hoja 'Tablas')
        while wb.Sheets.Count > 1:
            wb.Sheets(wb.Sheets.Count).Delete()
        wb.Sheets(1).Name = hojas_orden[0]
        for nombre in hojas_orden[1:]:
            new_ws = wb.Sheets.Add(After=wb.Sheets(wb.Sheets.Count))
            new_ws.Name = nombre

        # Escribir datos (filtrando filas Resultado intermedias, conservando Resultado total)
        def _es_resultado_intermedio_pp(row_series):
            """True si la fila es subtotal SAP intermedio ('Resultado' pero no 'Resultado total')."""
            for val in list(row_series.iloc[:10]):
                s = str(val).strip()
                if s == 'Resultado':
                    return True
            return False

        def _filtrar_resultado_df(df_in):
            """Elimina filas de subtotal SAP intermedias ('Resultado'), conserva 'Resultado total'."""
            if df_in is None or df_in.empty:
                return df_in
            mask = ~df_in.apply(_es_resultado_intermedio_pp, axis=1)
            return df_in[mask]

        data_map = {
            "Avisos":             df_av,
            "Ordenes":            df_ot,
            "Trabajo planificado": df_tp,
            "Programa semanal":   df_ps,
            "Plan Matriz":        df_pm,
        }
        for nombre_hoja, df in data_map.items():
            ws = wb.Sheets(nombre_hoja)
            df_clean = _filtrar_resultado_df(df)
            df_to_sheet(ws, df_clean)
            if df_clean is not None and not df_clean.empty:
                aplicar_formato_encabezado(ws, len(df.columns))
                ws.Cells.EntireColumn.AutoFit()

        # Formato de Estado en Avisos y Órdenes
        for nombre_hoja in ("Avisos", "Ordenes"):
            ws = wb.Sheets(nombre_hoja)
            ult_f = ws.Cells(ws.Rows.Count, 1).End(-4162).Row
            if ult_f >= 2:
                aplicar_formato_estado_columnaA(ws, ult_f)

        # Formatear fechas
        formatear_fechas(wb.Sheets("Avisos"),             ["I","J","K","T","U"])
        formatear_fechas(wb.Sheets("Ordenes"),            ["N","O","R","S","T","U","V"])
        for h in ("Trabajo planificado", "Programa semanal", "Plan Matriz"):
            formatear_fechas(wb.Sheets(h), ["F","G","X","Y","Z","AA","AB","AC","AD","AE"])

        # ---- PASO 20: Convertir a tablas ----
        print("Convirtiendo a tablas...")
        convertir_a_tabla(wb.Sheets("Avisos"),             "tblAvisos")
        convertir_a_tabla(wb.Sheets("Ordenes"),            "tblOrdenes")
        convertir_a_tabla(wb.Sheets("Trabajo planificado"),"tblTrabajoPlan")
        convertir_a_tabla(wb.Sheets("Programa semanal"),   "tblProgramaSem")
        convertir_a_tabla(wb.Sheets("Plan Matriz"),        "tblPlanMatriz")

        # Re-aplicar NumberFormat después de convertir_a_tabla (las tablas sobrescriben formato)
        for h, df_ref in [("Trabajo planificado", df_tp), ("Programa semanal", df_ps), ("Plan Matriz", df_pm)]:
            ws = wb.Sheets(h)
            for col_name in ("Trabajo real", "Trabajo Real", "Trabajo", "Op. tot.", "Op. tot", "Operaciones totales", "Op. Totales", "Cantidad de operaciones tot"):
                c_idx = encontrar_columna(df_ref, col_name)
                if c_idx:
                    col_num = df_ref.columns.get_loc(c_idx) + 1
                    try:
                        ws.Columns(col_num).NumberFormat = "#,##0.0"
                    except:
                        pass

        # ---- Tablas Dinámicas eliminadas: se usa la hoja Resumen directo ----
        ws_tablas = None  # Ya no existe la hoja Tablas
        fila_actual = 1

        # La hoja Resumen ha sido eliminada por solicitud del usuario
        pass

        # ---- PASO 23: Formato general demás hojas ----
        for nombre_hoja in ("Avisos", "Ordenes", "Trabajo planificado",
                            "Programa semanal", "Plan Matriz"):
            ws = wb.Sheets(nombre_hoja)
            ws.Cells.EntireColumn.AutoFit()

        # ---- GUARDAR ----
        # Base de Automatizador/output
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_dir = os.path.join(base_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        ts = datetime.now().strftime("%d%m%Y_%H%M")
        nombre_final = f"Reporte_Consolidado_S{num_semana}_{ts}.xlsx"
        ruta_final   = os.path.join(output_dir, nombre_final)
        
        wb.SaveAs(os.path.abspath(ruta_final), 51)  # 51 = xlOpenXMLWorkbook (.xlsx)

        # Activar primera hoja (Avisos)
        wb.Sheets(1).Activate()

        excel.ScreenUpdating = True
        excel.Calculation    = -4105  # xlCalculationAutomatic

        if (log_fn):
            log_fn(f"Reporte guardado: {nombre_final}", "ok")

        messagebox.showinfo(
            "Éxito",
            f"Proceso completado exitosamente para la Semana {num_semana}\n\n{nombre_final}"
        )
        return True

    except Exception as e:
        import traceback
        err_msg = f"Error en procesar_planificacion: {e}\n{traceback.format_exc()}"
        if log_fn:
            log_fn(err_msg, "error")
        messagebox.showerror("Error", f"Error en el proceso:\n\n{e}\n\n{traceback.format_exc()}")
        return False
    finally:
        try:
            if excel:
                excel.ScreenUpdating = True
                excel.DisplayAlerts  = True
                excel.Calculation    = -4105
                excel.EnableEvents   = True
                try:
                    wb.Close(SaveChanges=False)
                except:
                    pass
                excel.Quit()
        except:
            pass
        root.destroy()
        pythoncom.CoUninitialize()


# ============================================================
# CLASE ENVOLTORIO
# ============================================================

class PostProcesador:
    def __init__(self, log_fn=None):
        self.log_fn = log_fn

    def ejecutar(self, semana, fecha_base, rutas, dias_venc_avisos=7, dias_venc_ordenes=21):
        try:
            return procesar_planificacion(
                num_semana_arg=semana, fecha_base_arg=fecha_base, rutas_dict=rutas,
                log_fn=self.log_fn, dias_venc_avisos=dias_venc_avisos, dias_venc_ordenes=dias_venc_ordenes
            ) is True
        except Exception as e:
            if self.log_fn:
                self.log_fn(f"Error procesando planificacion: {e}", "error")
            return False


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    procesar_planificacion()
