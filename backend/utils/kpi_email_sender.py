import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime

def format_value(val, suffix=''):
    """
    Formatea un valor numérico para que muestre guion si es vacío/cero, o el número formateado.
    Propósito: Formatear celdas del reporte HTML.
    """
    if val is None or val == 0 or val == '':
        return '—'
    try:
        val_f = float(val)
        if val_f.is_integer():
            rounded = str(int(val_f))
        else:
            rounded = f"{val_f:.1f}"
        return f"{rounded}{suffix}"
    except:
        return '—'

def get_codelco_color_tp(percentage):
    if percentage < 70: return '#e96c28'  # Naranja
    if percentage < 80: return '#f4a700'  # Dorado
    return '#209eb0'                      # Teal

def get_codelco_color_prog_matriz(percentage):
    if percentage < 75: return '#e96c28'
    if percentage < 85: return '#f4a700'
    return '#209eb0'

def get_codelco_bg_color(color):
    if color == '#e96c28': return '#fdf0eb'
    if color == '#f4a700': return '#fef5e6'
    if color == '#2c73b5': return '#eaf2fa'
    return '#e0f4f7'

def get_codelco_badge_tp(value):
    percentage = value * 100
    color = get_codelco_color_tp(percentage)
    bg = get_codelco_bg_color(color)
    formatted = f"{int(round(percentage))}%" if (percentage % 1 == 0) else f"{percentage:.1f}%"
    return f'<span style="background-color:{bg};color:{color};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">{formatted}</span>'

def get_codelco_badge_prog_matriz(value):
    percentage = value * 100
    color = get_codelco_color_prog_matriz(percentage)
    bg = get_codelco_bg_color(color)
    formatted = f"{int(round(percentage))}%" if (percentage % 1 == 0) else f"{percentage:.1f}%"
    return f'<span style="background-color:{bg};color:{color};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">{formatted}</span>'

def get_codelco_badge_prog_semanal(value):
    percentage = value * 100
    color = '#f4a700'
    bg = '#fef5e6'
    formatted = f"{int(round(percentage))}%" if (percentage % 1 == 0) else f"{percentage:.1f}%"
    return f'<span style="background-color:{bg};color:{color};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">{formatted}</span>'

def generate_template_6(data):
    """
    Genera el HTML de la plantilla 6 (CODELCO Corporativo) con colores oficiales.
    Propósito: Copiar fielmente el diseño de alta fidelidad con cabecera Teal.
    """
    semana = data.get("semana", 0)
    indicadores = data.get("indicadores", {})
    resumen_avisos = data.get("resumenAvisos", {})
    resumen_ordenes = data.get("resumenOrdenes", {})
    trabajo_planificado = data.get("trabajoPlanificado", {})
    programa_semanal = data.get("programaSemanal", {})
    plan_matriz = data.get("planMatriz", {})
    
    current_year = datetime.now().year
    codelco_copper = '#bb5726'
    codelco_orange = '#e96c28'
    codelco_teal = '#209eb0'
    codelco_blue = '#2c73b5'
    codelco_gold = '#f4a700'

    # Color de barras dinámico
    color_tp = get_codelco_color_tp(indicadores.get("trabajoPlanificado", 0))
    color_ps = '#f4a700'
    color_pm = get_codelco_color_prog_matriz(indicadores.get("planMatriz", 0))

    if color_pm == '#209eb0' and (color_tp == '#209eb0' or color_ps == '#209eb0'):
        color_pm = codelco_blue

    # Trabajo Planificado
    tp_last_proceso = ''
    tp_rows_html = []
    for g in trabajo_planificado.get("grupos", []):
        show_proceso = g.get("proceso", "") if g.get("proceso", "") != tp_last_proceso else ""
        if g.get("proceso", ""):
            tp_last_proceso = g.get("proceso", "")
        tp_rows_html.append(f"""
        <tr>
          <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;">{show_proceso}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">{g.get("grPlanif", "")}</td>
          <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;">{g.get("grPlanifPM", "")}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">{format_value(g.get("planificado"))}</td>
          <td style="padding:9px 8px;font-size:11px;color:{codelco_orange if g.get("sinHr", 0) > 0 else '#64748b'};border-bottom:1px solid #e2e8f0;text-align:right;">{format_value(g.get("sinHr"))}</td>
          <td style="padding:9px 8px;font-size:11px;color:{codelco_orange if g.get("imprevistos", 0) > 0 else '#64748b'};border-bottom:1px solid #e2e8f0;text-align:right;">{format_value(g.get("imprevistos"))}</td>
          <td style="padding:9px 8px;font-size:11px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">{format_value(g.get("total"))}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">{get_codelco_badge_tp(g.get("cumplimiento", 0))}</td>
        </tr>
        """)
    tp_rows_html = "".join(tp_rows_html)

    # Programa Semanal
    prog_last_proceso = ''
    prog_rows_html = []
    for g in programa_semanal.get("grupos", []):
        show_proceso = g.get("proceso", "") if g.get("proceso", "") != prog_last_proceso else ""
        if g.get("proceso", ""):
            prog_last_proceso = g.get("proceso", "")
        prog_rows_html.append(f"""
        <tr>
          <td style="padding:8px 10px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;font-weight:bold;">{show_proceso}</td>
          <td style="padding:8px 6px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:center;">{g.get("grPlanif", "")}</td>
          <td style="padding:8px 6px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">{g.get("grPlanifPM", "")}</td>
          <td style="padding:8px 6px;font-size:11px;color:#1e293b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">{format_value(g.get("cumple"))}</td>
          <td style="padding:8px 6px;font-size:11px;color:#64748b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">{format_value(g.get("noCumple"))}</td>
          <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #f1f5f9;">{get_codelco_badge_prog_semanal(g.get("cumplimiento", 0))}</td>
        </tr>
        """)
    prog_rows_html = "".join(prog_rows_html)

    # Plan Matriz
    matriz_last_proceso = ''
    matriz_rows_html = []
    for g in plan_matriz.get("grupos", []):
        show_proceso = g.get("proceso", "") if g.get("proceso", "") != matriz_last_proceso else ""
        if g.get("proceso", ""):
            matriz_last_proceso = g.get("proceso", "")
        matriz_rows_html.append(f"""
        <tr>
          <td style="padding:8px 10px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;font-weight:bold;">{show_proceso}</td>
          <td style="padding:8px 6px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:center;">{g.get("grPlanif", "")}</td>
          <td style="padding:8px 6px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">{g.get("grPlanifPM", "")}</td>
          <td style="padding:8px 6px;font-size:11px;color:#1e293b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">{format_value(g.get("cumple"))}</td>
          <td style="padding:8px 6px;font-size:11px;color:#64748b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">{format_value(g.get("noCumple"))}</td>
          <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #f1f5f9;">{get_codelco_badge_prog_matriz(g.get("cumplimiento", 0))}</td>
        </tr>
        """)
    matriz_rows_html = "".join(matriz_rows_html)

    # Avisos
    if resumen_avisos.get("total", 0) > 0:
        dist_rows = []
        for item in resumen_avisos.get("distribucion", []):
            dist_rows.append(f"""
            <tr>
              <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;">{item.get('proceso', '')}</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">{item.get('grPlanif', '')}</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">{item.get('grPlanifPM', '')}</td>
              <td style="padding:9px 12px;font-size:11px;font-weight:bold;color:#ef4444;border-bottom:1px solid #e2e8f0;text-align:center;">{item.get('cantidad', 0)}</td>
            </tr>
            """)
        dist_rows = "".join(dist_rows)
        avisos_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
          <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.Planif</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.planif.PM</td>
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Avisos</td>
          </tr>
          {dist_rows}
          <tr style="background-color:{codelco_copper};">
            <td colspan="3" style="padding:11px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
            <td style="padding:11px 12px;text-align:center;"><span style="background-color:#cbd5e1;color:#1e293b;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;">{resumen_avisos.get("total", 0)}</span></td>
          </tr>
        </table>
        """
    else:
        avisos_table_html = f"""
        <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
          <div style="font-size:20px;margin-bottom:8px;">🎉</div>
          <div style="color:#0f6b3a;font-size:12px;font-weight:bold;">¡Excelente!</div>
          <div style="color:#334155;font-size:11px;margin-top:4px;">No hay avisos pendientes en este periodo.</div>
        </div>
        """

    # Órdenes
    if resumen_ordenes.get("total", 0) > 0:
        dist_rows = []
        for item in resumen_ordenes.get("distribucion", []):
            dist_rows.append(f"""
            <tr>
              <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;">{item.get('proceso', '')}</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">{item.get('grPlanif', '')}</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">{item.get('grPlanifPM', '')}</td>
              <td style="padding:9px 12px;font-size:11px;font-weight:bold;color:#ef4444;border-bottom:1px solid #e2e8f0;text-align:center;">{item.get('cantidad', 0)}</td>
            </tr>
            """)
        dist_rows = "".join(dist_rows)
        ordenes_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:10px;">
          <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. Planif</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.planif.PM</td>
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Órdenes</td>
          </tr>
          {dist_rows}
          <tr style="background-color:{codelco_copper};">
            <td colspan="3" style="padding:11px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
            <td style="padding:11px 12px;text-align:center;"><span style="background-color:#cbd5e1;color:#1e293b;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;">{resumen_ordenes.get("total", 0)}</span></td>
          </tr>
        </table>
        """
    else:
        ordenes_table_html = f"""
        <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:10px;">
          <div style="font-size:20px;margin-bottom:8px;">🎯</div>
          <div style="color:#0f6b3a;font-size:12px;font-weight:bold;">¡Objetivo cumplido!</div>
          <div style="color:#334155;font-size:11px;margin-top:4px;">No hay órdenes pendientes en este periodo.</div>
        </div>
        """

    # Porcentajes de KPI superiores
    tp_val = indicadores.get("trabajoPlanificado", 0)
    ps_val = indicadores.get("programaSemanal", 0)
    pm_val = indicadores.get("planMatriz", 0)
    avisos_val = indicadores.get("avisosPendientes", 0)
    ordenes_val = indicadores.get("ordenesPendientes", 0)
    
    w_avisos = min(100, max(2, int((avisos_val / 50.0) * 100))) if avisos_val > 0 else 0
    w_ordenes = min(100, max(2, int((ordenes_val / 50.0) * 100))) if ordenes_val > 0 else 0

    return f"""
<div style="background-color:#f8fafc;padding:30px 0;font-family:Calibri,Arial,sans-serif;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;margin:0 auto;box-shadow:0 10px 30px rgba(51,65,85,0.06);border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
 
<!-- Encabezado -->
<tr>
  <td style="background-color:{codelco_teal};padding:32px;border-bottom:4px solid {codelco_copper};">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:15px;vertical-align:middle;">
                <img src="https://www.codelco.com/prontus_codelco/site/artic/20220408/imag/foto_0000000120220408100923/logo.svg" style="height:34px;filter:brightness(0) invert(1);" alt="CODELCO" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:10px;color:#ffffff;letter-spacing:2.5px;text-transform:uppercase;font-weight:bold;opacity:0.9;">■ División Chuquicamata</div>
                <div style="font-size:24px;color:#ffffff;font-weight:bold;margin-top:4px;letter-spacing:-0.5px;">GSYS | Reporte Semanal KPI corporativo</div>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="vertical-align:middle;" width="110">
          <div style="background-color:#ffffff;border-radius:8px;padding:10px 15px;text-align:center;display:inline-block;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
            <div style="font-size:9px;color:{codelco_teal};font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">SEMANA</div>
            <div style="font-size:32px;color:{codelco_teal};font-weight:bold;line-height:1.1;">{semana}</div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:24px 24px 20px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:16px;">■ 1. Indicadores Globales del Período</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="19%" style="padding:4px;">
          <div style="background-color:{codelco_copper};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(187,87,38,0.15);">
            <div style="font-size:20px;">⚠️</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">{avisos_val}</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Avisos</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:{w_avisos}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="19%" style="padding:4px;">
          <div style="background-color:{codelco_orange};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(241,90,86,0.15);">
            <div style="font-size:20px;">📋</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">{ordenes_val}</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Órdenes</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:{w_ordenes}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="20%" style="padding:4px;">
          <div style="background-color:{color_tp};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
            <div style="font-size:20px;">📈</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">{tp_val}%</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Trab. Plan.</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:{tp_val}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="20%" style="padding:4px;">
          <div style="background-color:{color_ps};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
            <div style="font-size:20px;">✅</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">{ps_val}%</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Prog. Sem.</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:{ps_val}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="22%" style="padding:4px;">
          <div style="background-color:{color_pm};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
            <div style="font-size:20px;">📄</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">{pm_val}%</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Plan Matriz</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:{pm_val}%;border-radius:2px;"></div></div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:10px 24px 16px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;">■ Avisos pendientes</div>
    {avisos_table_html}
    
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;margin-top:20px;">■ Ordenes pendientes</div>
    {ordenes_table_html}
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:24px 24px 18px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-top:1px dashed #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:14px;">■ 2. Cumplimiento de Trabajo Planificado</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">HH Plan.</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">Sin HR</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">Imprevistos</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">Total HH</td>
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">% Cump.</td>
      </tr>
      {tp_rows_html}
      <tr style="background-color:{codelco_copper};">
        <td colspan="3" style="padding:11px 12px;font-size:12px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 8px;font-size:11px;color:#ffffff;text-align:right;">{format_value(trabajo_planificado.get("total", {}).get("planificado"))}</td>
        <td style="padding:11px 8px;font-size:11px;color:#ffffff;text-align:right;">{format_value(trabajo_planificado.get("total", {}).get("sinHr"))}</td>
        <td style="padding:11px 8px;font-size:11px;color:#ffffff;text-align:right;">{format_value(trabajo_planificado.get("total", {}).get("imprevistos"))}</td>
        <td style="padding:11px 8px;font-size:12px;font-weight:bold;color:#ffffff;text-align:right;">{format_value(trabajo_planificado.get("total", {}).get("total"))}</td>
        <td style="padding:11px 12px;text-align:center;">{get_codelco_badge_tp(trabajo_planificado.get("total", {}).get("cumplimiento", 0))}</td>
      </tr>
    </table>
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:10px 24px 26px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;">■ 3. Programa Semanal</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background-color:#f1f5f9;">
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✓</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✗</td>
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
      </tr>
      {prog_rows_html}
      <tr style="background-color:{codelco_copper};">
        <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#ffffff;text-align:center;">{format_value(programa_semanal.get("total", {}).get("cumple"))}</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#ffffff;text-align:center;">{format_value(programa_semanal.get("total", {}).get("noCumple"))}</td>
        <td style="padding:9px 10px;text-align:center;">{get_codelco_badge_prog_semanal(programa_semanal.get("total", {}).get("cumplimiento", 0))}</td>
      </tr>
    </table>

    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;margin-top:10px;">■ 4. Plan Matriz</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f1f5f9;">
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✓</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✗</td>
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
      </tr>
      {matriz_rows_html}
      <tr style="background-color:{codelco_copper};">
        <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#ffffff;text-align:center;">{format_value(plan_matriz.get("total", {}).get("cumple"))}</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#ffffff;text-align:center;">{format_value(plan_matriz.get("total", {}).get("noCumple"))}</td>
        <td style="padding:9px 10px;text-align:center;">{get_codelco_badge_prog_matriz(plan_matriz.get("total", {}).get("cumplimiento", 0))}</td>
      </tr>
    </table>
  </td>
</tr>

<tr>
  <td style="background-color:#ffffff;padding:24px 24px 10px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fdf0eb;border-left:4px solid {codelco_copper};border-radius:0 8px 8px 0;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;border-right:1px solid #cbd5e1;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:12.5px;color:#334155;line-height:1.6;font-family:Calibri,Arial,sans-serif;">
            <p style="margin:0 0 12px 0;">
              Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:{codelco_copper};font-weight:bold;text-decoration:underline;">Francisco Toro</a> para su correspondiente revisión y validación.
            </p>
            <p style="margin:0 0 15px 0;color:{codelco_orange};font-weight:bold;font-style:italic;">
              ⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.
            </p>
            <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
              <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
 
<tr><td style="background-color:#edf0f4;height:20px;">&nbsp;</td></tr>
<tr>
  <td style="background-color:#0f1f3d;border-radius:12px;padding:20px 28px;color:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <div style="font-size:10px;color:#7aaad8;font-weight:bold;">Información obtenida de DATAMART · GSYS Mantenimiento DCH</div>
          <div style="font-size:10px;color:#cbd5e1;margin-top:4px;">
            Semana {semana} · {current_year} &nbsp;|&nbsp; Monitoring &nbsp;|&nbsp; Informe generado por <a href="mailto:jose.contreras@monitoring.cl" style="color:#e8a020;text-decoration:none;font-weight:bold;">José Contreras Luna</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
</table>
</div>
"""

def generate_template_7(data):
    """
    Genera el HTML de la plantilla 7 (CODELCO Outlook Tradicional) compatible con motores antiguos.
    Propósito: Estructurar el reporte con tablas HTML básicas y estilos CSS simples para asegurar compatibilidad en Outlook.
    """
    # Comentario oculto con crédito solicitado
    credit_comment = "<!-- Creado por José Contreras Luna (jose.contreras@minitoring.cl) -->"

    semana = data.get("semana", 0)
    indicadores = data.get("indicadores", {})
    resumen_avisos = data.get("resumenAvisos", {})
    resumen_ordenes = data.get("resumenOrdenes", {})
    trabajo_planificado = data.get("trabajoPlanificado", {})
    programa_semanal = data.get("programaSemanal", {})
    plan_matriz = data.get("planMatriz", {})
    
    # Obtener configuraciones de correo dinámicas
    email_settings = data.get("email_settings", {})
    header_tag = email_settings.get("header_tag", "■ &nbsp; DIVISIÓN CHUQUICAMATA &nbsp;·&nbsp; GSYS MANTENIMIENTO")
    title = email_settings.get("title", "Reporte Semanal de KPIs Corporativos")
    subtitle = email_settings.get("subtitle", "Sistema de Gestión & Mantenimiento Industrial")
    body_p1 = email_settings.get("body_p1", "Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Se solicita enviar HOY el plan de acción a Francisco Toro para su correspondiente revisión y validación.")
    body_p2 = email_settings.get("body_p2", "⚠️  Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.")
    generado_nombre = email_settings.get("generado_nombre", "José Contreras Luna")
    generado_email = email_settings.get("generado_email", "jose.contreras@monitoring.cl")

    # Targets (umbrales) configurables — igual que en la previsualización del frontend
    avisos_target  = int(email_settings.get("avisos_target",  10))
    ordenes_target = int(email_settings.get("ordenes_target", 10))
    tp_target      = int(email_settings.get("tp_target",      80))
    ps_target      = int(email_settings.get("ps_target",      85))
    pm_target      = int(email_settings.get("pm_target",      85))

    # Colores dinámicos con targets (Verde / Amarillo / Rojo)
    def _color_pct(val, target):
        """Verde si cumple target, amarillo si está hasta 10 puntos abajo, rojo si más bajo."""
        if val >= target:       return '#1a6b3a'   # verde
        if val >= target - 10:  return '#e8a020'   # amarillo
        return '#c62828'                            # rojo

    def _color_count_inv(val, target):
        """Para conteos donde MENOS es mejor (avisos/órdenes): verde si menor que target."""
        if val <= target:       return '#1a6b3a'
        if val <= target + 10:  return '#e8a020'
        return '#bb5726'

    def _bg_for_color(hex_color):
        if hex_color == '#1a6b3a': return '#e6f4ea'
        if hex_color == '#e8a020': return '#fef5e6'
        if hex_color == '#c62828' or hex_color == '#bb5726': return '#fce8e6'
        return '#f1f5f9'
        
    def _badge_pct(value, target):
        percentage = value * 100 if value <= 1 else value
        c = _color_pct(percentage, target)
        bg = _bg_for_color(c)
        formatted = f"{int(round(percentage))}%" if (percentage % 1 == 0) else f"{percentage:.1f}%"
        return f'<span style="background-color:{bg};color:{c};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">{formatted}</span>'

    current_year = datetime.now().year
    
    # Trabajo Planificado
    tp_last_proceso = ''
    tp_rows_html = []
    for g in trabajo_planificado.get("grupos", []):
        show_proceso = g.get("proceso", "") if g.get("proceso", "") != tp_last_proceso else ""
        if g.get("proceso", ""):
            tp_last_proceso = g.get("proceso", "")
        tp_rows_html.append(f"""
        <tr>
          <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">{show_proceso}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{g.get("grPlanif", "")}</td>
          <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{g.get("grPlanifPM", "")}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">{format_value(g.get("planificado"))}</td>
          <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">{format_value(g.get("sinHr"))}</td>
          <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">{format_value(g.get("imprevistos"))}</td>
          <td style="padding:9px 8px;font-size:11px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">{format_value(g.get("total"))}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{_badge_pct(g.get("cumplimiento", 0), tp_target)}</td>
        </tr>
        """)
    tp_rows_html = "".join(tp_rows_html)

    # Programa Semanal
    prog_last_proceso = ''
    prog_rows_html = []
    for g in programa_semanal.get("grupos", []):
        show_proceso = g.get("proceso", "") if g.get("proceso", "") != prog_last_proceso else ""
        if g.get("proceso", ""):
            prog_last_proceso = g.get("proceso", "")
        prog_rows_html.append(f"""
        <tr>
          <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">{show_proceso}</td>
          <td style="padding:8px 4px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{g.get("grPlanif", "")}</td>
          <td style="padding:8px 4px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{g.get("grPlanifPM", "")}</td>
          <td style="padding:8px 4px;font-size:11px;color:#1a6b3a;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{format_value(g.get("cumple"))}</td>
          <td style="padding:8px 4px;font-size:11px;color:#cbd5e1;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{format_value(g.get("noCumple"))}</td>
          <td style="padding:8px 6px;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{_badge_pct(g.get("cumplimiento", 0), ps_target)}</td>
        </tr>
        """)
    prog_rows_html = "".join(prog_rows_html)

    # Plan Matriz
    matriz_last_proceso = ''
    matriz_rows_html = []
    for g in plan_matriz.get("grupos", []):
        show_proceso = g.get("proceso", "") if g.get("proceso", "") != matriz_last_proceso else ""
        if g.get("proceso", ""):
            matriz_last_proceso = g.get("proceso", "")
        matriz_rows_html.append(f"""
        <tr>
          <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">{show_proceso}</td>
          <td style="padding:8px 4px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{g.get("grPlanif", "")}</td>
          <td style="padding:8px 4px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{g.get("grPlanifPM", "")}</td>
          <td style="padding:8px 4px;font-size:11px;color:#1a6b3a;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{format_value(g.get("cumple"))}</td>
          <td style="padding:8px 4px;font-size:11px;color:#cbd5e1;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{format_value(g.get("noCumple"))}</td>
          <td style="padding:8px 6px;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{_badge_pct(g.get("cumplimiento", 0), pm_target)}</td>
        </tr>
        """)
    matriz_rows_html = "".join(matriz_rows_html)

    # Avisos
    if resumen_avisos.get("total", 0) > 0:
        dist_rows = []
        for item in resumen_avisos.get("distribucion", []):
            dist_rows.append(f"""
            <tr>
              <td style="padding:8px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{item.get('proceso', '')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{item.get('grPlanif', '')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{item.get('grPlanifPM', '')}</td>
              <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#c62828;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{item.get('cantidad', 0)}</td>
            </tr>
            """)
        dist_rows = "".join(dist_rows)
        avisos_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:20px;">
          <tr style="background-color:#E55302;border-bottom:1px solid #E55302;">
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">Proceso Mantenimiento</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Gr.Planif</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Gr.planif.PM</td>
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Cantidad</td>
          </tr>
          {dist_rows}
          <tr style="background-color:#f1f5f9;">
            <td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#475569;font-family:Arial,sans-serif;">TOTAL GENERAL</td>
            <td style="padding:10px 12px;text-align:center;color:#475569;font-weight:bold;font-size:11px;font-family:Arial,sans-serif;">{resumen_avisos.get("total", 0)}</td>
          </tr>
        </table>
        """
    else:
        avisos_table_html = f"""
        <table width="100%" cellpadding="15" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px dashed #cbd5e1;background-color:#fdf5f2;text-align:center;margin-bottom:20px;">
          <tr>
            <td style="font-family:Arial,sans-serif;color:#9a3210;font-size:11px;font-weight:bold;">
              ⚠️ No hay avisos pendientes en este período.
            </td>
          </tr>
        </table>
        """

    # Órdenes
    if resumen_ordenes.get("total", 0) > 0:
        dist_rows = []
        for item in resumen_ordenes.get("distribucion", []):
            dist_rows.append(f"""
            <tr>
              <td style="padding:8px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{item.get('proceso', '')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{item.get('grPlanif', '')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{item.get('grPlanifPM', '')}</td>
              <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#c62828;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{item.get('cantidad', 0)}</td>
            </tr>
            """)
        dist_rows = "".join(dist_rows)
        ordenes_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:10px;">
          <tr style="background-color:#E55302;border-bottom:1px solid #E55302;">
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">Proceso Mantenimiento</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Gr.Planif</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Gr.planif.PM</td>
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Cantidad</td>
          </tr>
          {dist_rows}
          <tr style="background-color:#f8fafc;">
            <td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#475569;font-family:Arial,sans-serif;">TOTAL GENERAL</td>
            <td style="padding:10px 12px;text-align:center;color:#475569;font-weight:bold;font-size:11px;font-family:Arial,sans-serif;">{resumen_ordenes.get("total", 0)}</td>
          </tr>
        </table>
        """
    else:
        ordenes_table_html = f"""
        <table width="100%" cellpadding="15" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px dashed #cbd5e1;background-color:#fdf5f2;text-align:center;margin-bottom:10px;">
          <tr>
            <td style="font-family:Arial,sans-serif;color:#9a3210;font-size:11px;font-weight:bold;">
              ⚠️ No hay órdenes pendientes en este período.
            </td>
          </tr>
        </table>
        """

    # Porcentajes de KPI superiores
    tp_val      = indicadores.get("trabajoPlanificado", 0)
    ps_val      = indicadores.get("programaSemanal",   0)
    pm_val      = indicadores.get("planMatriz",        0)
    avisos_val  = indicadores.get("avisosPendientes",  0)
    ordenes_val = indicadores.get("ordenesPendientes", 0)

    # Colores usando targets configurados
    color_tp      = _color_pct(tp_val, tp_target)
    color_ps      = _color_pct(ps_val, ps_target)
    color_pm      = _color_pct(pm_val, pm_target)
    color_avisos  = _color_count_inv(avisos_val,  avisos_target)
    color_ordenes = _color_count_inv(ordenes_val, ordenes_target)

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  {credit_comment}
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>GSYS | Reporte Semanal KPI Corporativo</title>
  <!--[if mso]>
  <style type="text/css">
    table {{ border-collapse: collapse; }}
    .outlook-fix {{ display: block !important; }}
  </style>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#e8edf2;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8edf2" style="background-color:#e8edf2;">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <!-- Container principal 680px -->
      <table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background-color:#ffffff;" bgcolor="#ffffff">

        <!-- ═══════════════════════════════════════════════
             CABECERA: barra superior decorativa (3px)
        ════════════════════════════════════════════════ -->
        <tr>
          <td height="4" bgcolor="#1a8fa0" style="font-size:0;line-height:0;background-color:#1a8fa0;">&nbsp;</td>
        </tr>

        <!-- HEADER PRINCIPAL -->
        <tr>
          <td bgcolor="#0d7a8c" style="padding:0;background-color:#0d7a8c;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Logo / Ícono izquierda sin la G, solo el cuadrado -->
                <td width="72" align="center" valign="middle" bgcolor="#0b6b7c" style="padding:22px 0;background-color:#0b6b7c;">
                  <!--[if mso]>
                  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" width="44" height="44" fillcolor="#bb5726" stroke="f" style="width:44px;height:44px;">
                  </v:rect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <div style="width:44px;height:44px;background-color:#bb5726;margin:0 auto;"></div>
                  <!--<![endif]-->
                </td>

                <!-- Texto central -->
                <td valign="middle" style="padding:18px 16px 18px 12px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#7fd8e8;letter-spacing:2px;font-weight:bold;text-transform:uppercase;padding-bottom:4px;">
                        {header_tag}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;line-height:1.2;padding-bottom:3px;">
                        {title}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a8dde8;">
                        {subtitle}
                      </td>
                    </tr>
                  </table>
                </td>

                <!-- Badge Semana -->
                <td align="right" valign="middle" style="padding:18px 20px 18px 0;white-space:nowrap;">
                  <table cellpadding="0" cellspacing="0" border="0" align="right">
                    <tr>
                      <td align="center" bgcolor="#bb5726" style="padding:4px 0 2px 0;background-color:#bb5726;width:64px;">
                        <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffd4b8;letter-spacing:2px;text-transform:uppercase;text-align:center;">SEMANA</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" bgcolor="#ffffff" style="padding:4px 0 6px 0;background-color:#ffffff;width:64px;">
                        <div style="font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:bold;color:#0d7a8c;line-height:1;text-align:center;">{semana}</div>
                      </td>
                    </tr>
                    <tr>
                      <td height="3" bgcolor="#bb5726" style="background-color:#bb5726;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Barra de acento naranja -->
        <tr>
          <td height="3" bgcolor="#bb5726" style="font-size:0;line-height:0;background-color:#bb5726;">&nbsp;</td>
        </tr>


        <!-- ═══════════════════════════════════════════════
             SECCIÓN 1: INDICADORES GLOBALES
        ════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="#f8fafc" style="padding:0;background-color:#f8fafc;">
            <!-- Título sección -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 20px 4px 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="3" bgcolor="#0d7a8c" style="background-color:#0d7a8c;font-size:0;line-height:0;">&nbsp;</td>
                      <td style="padding:6px 0 6px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;letter-spacing:0.5px;text-transform:uppercase;">
                        1. &nbsp;Indicadores Globales del Período
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- KPI Cards -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:8px 16px 20px 16px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>

                      <!-- KPI: AVISOS -->
                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid {color_avisos};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">⚠️</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:{color_avisos};line-height:1;">{avisos_val}</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="{color_avisos}" style="padding:5px;background-color:{color_avisos};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">AVISOS</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- KPI: ÓRDENES -->
                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid {color_ordenes};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">📋</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:{color_ordenes};line-height:1;">{ordenes_val}</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="{color_ordenes}" style="padding:5px;background-color:{color_ordenes};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">ÓRDENES</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- KPI: PLANIFICADO (color dinámico via variable) -->
                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid {color_tp};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">📈</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:{color_tp};line-height:1;">{tp_val}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="{color_tp}" style="padding:5px;background-color:{color_tp};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">PLANIF.</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- KPI: PROGRAMADO -->
                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid {color_ps};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">✅</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:{color_ps};line-height:1;">{ps_val}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="{color_ps}" style="padding:5px;background-color:{color_ps};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">PROG.</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- KPI: MATRIZ (color dinámico) -->
                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid {color_pm};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">📄</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:{color_pm};line-height:1;">{pm_val}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="{color_pm}" style="padding:5px;background-color:{color_pm};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">MATRIZ</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>


        <!-- ═══════════════════════════════════════════════
             SECCIÓN: AVISOS Y ÓRDENES PENDIENTES
        ════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="#ffffff" style="padding:0 20px 20px 20px;background-color:#ffffff;">

            <!-- Avisos pendientes -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 10px 0;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="3" bgcolor="#bb5726" style="background-color:#bb5726;font-size:0;line-height:0;">&nbsp;</td>
                      <td style="padding:5px 0 5px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">
                        Avisos Pendientes
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  {avisos_table_html}
                </td>
              </tr>
            </table>

            <!-- Espacio -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="16" style="font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Órdenes pendientes -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 10px 0;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="3" bgcolor="#e96c28" style="background-color:#e96c28;font-size:0;line-height:0;">&nbsp;</td>
                      <td style="padding:5px 0 5px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">
                        Órdenes Pendientes
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  {ordenes_table_html}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Divisor -->
        <tr>
          <td height="1" bgcolor="#e2e8f0" style="font-size:0;line-height:0;background-color:#e2e8f0;">&nbsp;</td>
        </tr>


        <!-- ═══════════════════════════════════════════════
             SECCIÓN 2: TRABAJO PLANIFICADO
        ════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="#ffffff" style="padding:20px;background-color:#ffffff;">

            <!-- Título -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 14px 0;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="3" bgcolor="#0d7a8c" style="background-color:#0d7a8c;font-size:0;line-height:0;">&nbsp;</td>
                      <td style="padding:5px 0 5px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">
                        2. &nbsp;Cumplimiento de Trabajo Planificado
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Tabla TP -->
            <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dde3ea" style="border-collapse:collapse;border:1px solid #dde3ea;">
              <tr bgcolor="#E55302" style="background-color:#E55302;border-bottom:1px solid #E55302;">
                <td style="padding:9px 10px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Proceso</td>
                <td align="center" style="padding:9px 6px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Gr. planif</td>
                <td align="center" style="padding:9px 6px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Gr. planif.PM</td>
                <td align="right" style="padding:9px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">HH Plan.</td>
                <td align="right" style="padding:9px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Sin HR</td>
                <td align="right" style="padding:9px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Imprevistos</td>
                <td align="right" style="padding:9px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Total HH</td>
                <td align="center" style="padding:9px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E55302;">% Cump.</td>
              </tr>
              <!-- Filas dinámicas -->
              {tp_rows_html}
              <!-- Fila total -->
              <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
                <td colspan="3" style="padding:10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">TOTAL GENERAL</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{format_value(trabajo_planificado.get("total", {}).get("planificado"))}</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{format_value(trabajo_planificado.get("total", {}).get("sinHr"))}</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{format_value(trabajo_planificado.get("total", {}).get("imprevistos"))}</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{format_value(trabajo_planificado.get("total", {}).get("total"))}</td>
                <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{int(round(trabajo_planificado.get("total", {}).get("cumplimiento", 0) * 100))}%</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divisor -->
        <tr>
          <td height="1" bgcolor="#e2e8f0" style="font-size:0;line-height:0;background-color:#e2e8f0;">&nbsp;</td>
        </tr>


        <!-- ═══════════════════════════════════════════════
             SECCIÓN 3 y 4: PROGRAMA SEMANAL + PLAN MATRIZ
             (side by side si hay espacio, sino stacked)
         ════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="#ffffff" style="padding:20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr valign="top">

                <!-- Programa Semanal (izq) -->
                <td width="48%" valign="top" style="padding-right:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:0 0 10px 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="3" bgcolor="#0d7a8c" style="background-color:#0d7a8c;font-size:0;line-height:0;">&nbsp;</td>
                            <td style="padding:5px 0 5px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">
                              3. Programa Semanal
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dde3ea" style="border-collapse:collapse;border:1px solid #dde3ea;">
                    <tr bgcolor="#E55302" style="background-color:#E55302;border-bottom:1px solid #E55302;">
                      <td style="padding:8px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Proceso</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Gr.</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Gr.PM</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#52c774;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">✓</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#f87171;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">✗</td>
                      <td align="center" style="padding:8px 6px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;">%</td>
                    </tr>
                    {prog_rows_html}
                    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
                      <td colspan="3" style="padding:9px 8px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#334155;">TOTAL</td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">{format_value(programa_semanal.get("total", {}).get("cumple"))}</td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">{format_value(programa_semanal.get("total", {}).get("noCumple"))}</td>
                      <td align="center" bgcolor="#f1f5f9" style="padding:9px 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{int(round(programa_semanal.get("total", {}).get("cumplimiento", 0) * 100))}%</td>
                    </tr>
                  </table>
                </td>

                <!-- Espaciador -->
                <td width="4%">&nbsp;</td>

                <!-- Plan Matriz (der) -->
                <td width="48%" valign="top" style="padding-left:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:0 0 10px 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="3" bgcolor="#bb5726" style="background-color:#bb5726;font-size:0;line-height:0;">&nbsp;</td>
                            <td style="padding:5px 0 5px 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">
                              4. Plan Matriz
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dde3ea" style="border-collapse:collapse;border:1px solid #dde3ea;">
                    <tr bgcolor="#E55302" style="background-color:#E55302;border-bottom:1px solid #E55302;">
                      <td style="padding:8px 8px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Proceso</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Gr.</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">Gr.PM</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#52c774;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">✓</td>
                      <td align="center" style="padding:8px 4px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#f87171;border-bottom:2px solid #E55302;border-right:1px solid #f09564;">✗</td>
                      <td align="center" style="padding:8px 6px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;text-transform:uppercase;border-bottom:2px solid #E55302;">%</td>
                    </tr>
                    {matriz_rows_html}
                    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
                      <td colspan="3" style="padding:9px 8px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#334155;">TOTAL</td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">{format_value(plan_matriz.get("total", {}).get("cumple"))}</td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">{format_value(plan_matriz.get("total", {}).get("noCumple"))}</td>
                      <td align="center" bgcolor="#f1f5f9" style="padding:9px 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">{int(round(plan_matriz.get("total", {}).get("cumplimiento", 0) * 100))}%</td>
                    </tr>
                  </table>
                </td>

              </tr>
            </table>
          </td>
        </tr>


        <!-- ═══════════════════════════════════════════════
             NOTA / CTA
             ════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="#fdf5f2" style="padding:20px;background-color:#fdf5f2;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="4" bgcolor="#bb5726" style="background-color:#bb5726;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:14px 16px;background-color:#ffffff;border:1px solid #f0d0c4;border-left:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#334155;line-height:1.7;padding-bottom:12px;">
                        {body_p1}
                      </td>
                    </tr>
                    <tr>
                      <td bgcolor="#fff8f5" style="padding:10px 12px;background-color:#fff8f5;border-left:3px solid #e96c28;">
                        <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a3210;font-weight:bold;">
                          {body_p2}
                        </span>
                      </td>
                    </tr>
                    <tr><td height="14" style="font-size:0;line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td align="center">
                        <!-- CTA Button Outlook-compatible -->
                        <table cellpadding="0" cellspacing="0" border="0" align="center">
                          <tr>
                            <td bgcolor="#0d7a8c" style="background-color:#0d7a8c;padding:0;">
                              <!--[if mso]>
                              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                                href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc"
                                style="height:38px;v-text-anchor:middle;width:200px;" arcsize="5%" strokecolor="#0d7a8c" fillcolor="#0d7a8c">
                                <w:anchorlock/>
                                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">Ver Dashboard de KPIs</center>
                              </v:roundrect>
                              <![endif]-->
                              <!--[if !mso]><!-->
                              <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc"
                                 style="display:inline-block;padding:11px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#0d7a8c;border:0;">
                                ▶ &nbsp;Ver Dashboard de KPIs
                              </a>
                              <!--<![endif]-->
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>


        <!-- ═══════════════════════════════════════════════
             PIE DE PÁGINA
        ════════════════════════════════════════════════ -->
        <tr>
          <td height="3" bgcolor="#0d7a8c" style="font-size:0;line-height:0;background-color:#0d7a8c;">&nbsp;</td>
        </tr>
        <tr bgcolor="#bb5726" style="background-color:#bb5726;">
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr valign="middle">
                <!-- Izquierda: fuente de datos -->
                <td valign="middle">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#ffd4b8;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;font-weight:bold;">
                    Fuente de datos
                  </div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#ffffff;font-weight:bold;">
                    DATAMART · GSYS Mantenimiento DCH
                  </div>
                </td>
                <!-- Derecha: semana / generado por -->
                <td align="right" valign="middle">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#ffd4b8;padding-bottom:4px;font-weight:bold;">
                    Semana {semana} &nbsp;·&nbsp; {current_year} &nbsp;·&nbsp; Monitoring
                  </div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#ffffff;">
                    Generado por&nbsp;
                    <a href="mailto:{generado_email}" style="color:#ffd4b8;text-decoration:none;font-weight:bold;">{generado_nombre}</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Franja final decorativa -->
        <tr>
          <td height="4" bgcolor="#bb5726" style="font-size:0;line-height:0;background-color:#bb5726;">&nbsp;</td>
        </tr>

      </table>
      <!-- /Container -->

    </td>
  </tr>
</table>
</body>
</html>
"""

def generate_kpi_email_template(data, template_id=7):
    """
    Selector principal de plantillas de correo.
    """
    if str(template_id) == '6':
        return generate_template_6(data)
    
    return generate_template_7(data)

def send_kpi_report_email(smtp_user, smtp_pass, recipients, subject, kpi_data, attachment_path=None, template_id=7, cc=None):
    """
    Envía el correo electrónico del informe KPI.
    Propósito: Autenticar por TLS en Office365, construir el correo Multipart y adjuntar el Excel consolidado.
    """
    # Generar el HTML
    html_content = generate_kpi_email_template(kpi_data, template_id)
    
    # Lista de destinatarios sanitizada
    to_list = []
    import re
    raw_recipients = re.split(r'[,;]', str(recipients))
    for r in raw_recipients:
        email = r.strip()
        if '@' in email:
            to_list.append(email)
            
    if not to_list:
        raise ValueError("No se encontraron correos de destinatarios válidos.")

    # Lista de CC sanitizada
    cc_list = []
    if cc:
        raw_cc = re.split(r'[,;]', str(cc))
        for r in raw_cc:
            email = r.strip()
            if '@' in email:
                cc_list.append(email)

    # Crear mensaje multipart
    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = ", ".join(to_list)
    if cc_list:
        msg['Cc'] = ", ".join(cc_list)
    msg['Subject'] = subject

    # Cuerpo HTML
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))

    # Adjuntos
    if attachment_path:
        paths = attachment_path if isinstance(attachment_path, (list, tuple)) else [attachment_path]
        for path in paths:
            if path and os.path.exists(path):
                filename = os.path.basename(path)
                try:
                    with open(path, "rb") as attachment:
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(attachment.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename= {filename}",
                    )
                    msg.attach(part)
                    print(f"[Email] Archivo adjuntado con éxito: {filename}")
                except Exception as e:
                    print(f"[Email] Alerta al adjuntar archivo {filename}: {e}")

    # Enviar vía SMTP Outlook
    print(f"[Email] Conectando a smtp.office365.com:587 para {smtp_user}...")
    server = smtplib.SMTP('smtp.office365.com', 587)
    server.starttls()
    server.login(smtp_user, smtp_pass)
    
    text = msg.as_string()
    server.sendmail(smtp_user, to_list + cc_list, text)
    server.quit()
    print("[Email] Reporte enviado de forma exitosa.")
    return len(to_list)
