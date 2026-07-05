"""
Email sender específico para reportes de Proyecciones.
Separado de kpi_email_sender — no comparten templates.
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime


def format_value(val, suffix=''):
    if val is None or val == 0 or val == '':
        return '—'
    try:
        val_f = float(val)
        if val_f.is_integer():
            return f"{int(val_f)}{suffix}"
        return f"{val_f:.1f}{suffix}"
    except:
        return '—'


def generate_proy_email_template(data):
    """Genera HTML del reporte de proyecciones."""
    semana = data.get("semana", "")
    avisos_p1 = data.get("avisos_p1", [])
    resumen_areas = data.get("resumen_areas", [])
    email_settings = data.get("email_settings", {})
    header_tag = email_settings.get("header_tag", "■ &nbsp; DIVISIÓN CHUQUICAMATA &nbsp;·&nbsp; GSYS MANTENIMIENTO")
    title = email_settings.get("title", "Reporte de Proyecciones de Planificación")
    body_p1 = email_settings.get("body_p1", "Favor revisar la información y proceder de acuerdo con el flujograma establecido.")
    generado_nombre = email_settings.get("generado_nombre", "José Contreras Luna")
    generado_email = email_settings.get("generado_email", "jose.contreras@monitoring.cl")
    current_year = datetime.now().year

    if avisos_p1:
        p1_rows = ""
        for a in avisos_p1:
            p1_rows += f"""
            <tr>
              <td style="padding:8px 8px;font-size:11px;color:#c62828;font-weight:bold;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;text-align:center;">{a.get('aviso','')}</td>
              <td style="padding:8px 4px;font-size:11px;color:#c62828;font-weight:bold;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;text-align:center;">{a.get('prioridad','')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{a.get('ut','')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">{a.get('descripcion','')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;text-align:center;">{a.get('fecha_aviso','')}</td>
              <td style="padding:8px 4px;font-size:11px;color:#c62828;font-weight:bold;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;text-align:center;">{a.get('dias_transcurridos','')}</td>
              <td style="padding:8px 8px;font-size:11px;color:#ffffff;font-weight:bold;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;text-align:center;background-color:#c62828;">{a.get('estado','')}</td>
            </tr>
            """
        p1_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:20px;">
          <tr style="background-color:#c62828;">
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Aviso</td>
            <td style="padding:10px 4px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Pri.</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">Ubicación Técnica</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">Descripción</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Fecha Aviso</td>
            <td style="padding:10px 4px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Días</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Estado</td>
          </tr>
          {p1_rows}
        </table>
        """
    else:
        p1_table_html = """
        <table width="100%" cellpadding="15" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px dashed #cbd5e1;background-color:#f0fdf4;text-align:center;margin-bottom:20px;">
          <tr><td style="font-family:Arial,sans-serif;color:#166534;font-size:11px;font-weight:bold;">✓ No hay avisos de prioridad 1.</td></tr>
        </table>
        """

    if resumen_areas:
        area_rows = ""
        for area in resumen_areas:
            area_rows += f"""
            <tr>
              <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">{area.get('area','')}</td>
              <td style="padding:9px 8px;font-size:11px;color:#c62828;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{area.get('avisos',0)}</td>
              <td style="padding:9px 8px;font-size:11px;color:#e96c28;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{area.get('ordenes',0)}</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">{area.get('trabajo_planificado',0)}%</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{area.get('programa_semanal',0)}%</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">{area.get('plan_matriz',0)}%</td>
            </tr>
            """
        area_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dde3ea" style="border-collapse:collapse;border:1px solid #dde3ea;margin-bottom:20px;">
          <tr bgcolor="#E55302" style="background-color:#E55302;">
            <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">Área</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Avisos</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Órdenes</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:right;font-family:Arial,sans-serif;">Trab. Plan.</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Prog. Sem.</td>
            <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Plan Matriz</td>
          </tr>
          {area_rows}
        </table>
        """
    else:
        area_table_html = '<p style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;">No hay datos de resumen por área.</p>'

    return f"""<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Reporte de Proyecciones</title></head>
<body style="margin:0;padding:0;background-color:#e8edf2;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8edf2">
  <tr><td align="center" style="padding:24px 12px;">
    <table width="816" cellpadding="0" cellspacing="0" border="0" style="max-width:816px;width:100%;background-color:#ffffff;">
      <tr><td height="4" bgcolor="#1a8fa0" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td bgcolor="#0d7a8c" style="padding:18px 20px;">
        <div style="font-size:9px;color:#7fd8e8;letter-spacing:2px;font-weight:bold;text-transform:uppercase;padding-bottom:4px;">{header_tag}</div>
        <div style="font-size:19px;font-weight:bold;color:#ffffff;line-height:1.2;">{title}</div>
        <div style="font-size:11px;color:#a8dde8;margin-top:3px;">Semana {semana} · Proyecciones de Planificación SAP</div>
      </td></tr>
      <tr><td height="3" bgcolor="#bb5726" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td bgcolor="#ffffff" style="padding:20px;">
        <div style="font-size:11px;color:#c62828;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-left:3px solid #c62828;padding-left:8px;">⚠ Avisos Prioridad 1 ({len(avisos_p1)})</div>
        {p1_table_html}
        <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;margin-top:20px;border-left:3px solid #0d7a8c;padding-left:8px;">Resumen por Área</div>
        {area_table_html}
      </td></tr>
      <tr><td bgcolor="#fdf5f2" style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="4" bgcolor="#bb5726" style="font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:14px 16px;background-color:#ffffff;border:1px solid #f0d0c4;border-left:0;">
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#334155;line-height:1.7;margin:0 0 12px 0;">{body_p1}</p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="#bb5726" style="padding:16px 20px;">
        <div style="font-size:9px;color:#ffd4b8;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Fuente de datos</div>
        <div style="font-size:10px;color:#ffffff;font-weight:bold;margin-top:4px;">Semana {semana} · {current_year} &nbsp;|&nbsp; Monitoring &nbsp;|&nbsp; Informe generado por <a href="mailto:{generado_email}" style="color:#ffd4b8;text-decoration:none;font-weight:bold;">{generado_nombre}</a></div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
"""


def send_proy_report_email(email, password, recipients, subject, proy_data, adjuntos=None, cc=None):
    """Envía el reporte de proyecciones por correo SMTP."""
    if not recipients:
        return 0
    msg = MIMEMultipart()
    msg['From'] = email
    msg['To'] = recipients
    if cc: msg['Cc'] = cc
    msg['Subject'] = subject
    html_body = generate_proy_email_template(proy_data)
    msg.attach(MIMEText(html_body, 'html'))
    if adjuntos:
        for filepath in adjuntos:
            if filepath and os.path.exists(filepath):
                with open(filepath, "rb") as f:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename="{os.path.basename(filepath)}"')
                    msg.attach(part)
    recipients_list = [r.strip() for r in recipients.replace(';', ',').split(',') if r.strip()]
    if cc:
        recipients_list += [r.strip() for r in cc.replace(';', ',').split(',') if r.strip()]
    try:
        smtp = smtplib.SMTP("smtp-mail.outlook.com", 587)
        smtp.starttls()
        smtp.login(email, password)
        smtp.sendmail(email, recipients_list, msg.as_string())
        smtp.quit()
        return len(recipients_list)
    except Exception as e:
        print(f"[ProyEmail] Error enviando correo: {e}")
        raise
