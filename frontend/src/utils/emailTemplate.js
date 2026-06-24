/**
 * Módulo para la generación del contenido HTML del correo electrónico de reportes KPI.
 * Asegura la compatibilidad con Outlook e implementa estilos premium, dinámicos y estructuralmente diferenciados.
 */

// --- UTILS Y CONSTANTES ---

/**
 * Formatea un valor numérico para que muestre guion si es vacío/cero, o el número formateado
 */
function formatValue(val, suffix = '') {
  if (val === undefined || val === null || val === 0 || val === '') {
    return '—';
  }
  const rounded = (val % 1 === 0) ? Math.round(val) : val.toFixed(1);
  return `${rounded.toLocaleString('es-CL')}${suffix}`;
}

// Thresholds globales por defecto (sobrescribibles desde email_settings)
const DEFAULT_AVISOS_TARGET = 10;
const DEFAULT_ORDENES_TARGET = 10;
const DEFAULT_TP_TARGET = 80;
const DEFAULT_PS_TARGET = 85;
const DEFAULT_PM_TARGET = 85;


// --- 1. PLANTILLA CORPORATIVO OSCURO (ORIGINAL PREMIUM) ---
function generateTemplate1(data) {
  const { semana, indicadores, resumenAvisos, resumenOrdenes, trabajoPlanificado, programaSemanal, planMatriz } = data;
  const currentYear = new Date().getFullYear();

  const colorTP = getBarColorTP(indicadores.trabajoPlanificado);
  const colorPS = getBarColorProgMatriz(indicadores.programaSemanal);
  const colorPM = getBarColorProgMatriz(indicadores.planMatriz);

  // Tablas en tonos oscuros elegantes con 3 columnas (Proceso, Gr. planif, Gr. planif.PM)
  // Se oculta el proceso repetido (celdas combinadas de Excel) para dar limpieza visual
  let tpLastProceso = '';
  const tpRowsHtml = trabajoPlanificado.grupos.map(g => {
    const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
    if (g.proceso) {
      tpLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:9px 12px;font-size:11px;color:#2d3748;border-bottom:1px solid #e2e8f0;font-weight:bold;">${showProceso}</td>
      <td style="padding:9px 8px;font-size:11px;color:#2d3748;border-bottom:1px solid #e2e8f0;text-align:center;">${g.grPlanif}</td>
      <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;">${g.grPlanifPM}</td>
      <td style="padding:9px 8px;font-size:11px;color:#2d3748;border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.planificado)}</td>
      <td style="padding:9px 8px;font-size:11px;color:${g.sinHr > 0 ? '#c0392b' : '#9090a0'};border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.sinHr)}</td>
      <td style="padding:9px 8px;font-size:11px;color:${g.imprevistos > 0 ? '#c0392b' : '#9090a0'};border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.imprevistos)}</td>
      <td style="padding:9px 8px;font-size:11px;font-weight:bold;color:#2d3748;border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.total)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${getBadgeTP(g.cumplimiento)}</td>
    </tr>
    `;
  }).join('');

  let progLastProceso = '';
  const progRowsHtml = programaSemanal.grupos.map(g => {
    const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
    if (g.proceso) {
      progLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:8px 10px;font-size:11px;color:#2d3748;border-bottom:1px solid #f0f3f8;font-weight:bold;">${showProceso}</td>
      <td style="padding:8px 6px;font-size:11px;color:#2d3748;border-bottom:1px solid #f0f3f8;text-align:center;">${g.grPlanif}</td>
      <td style="padding:8px 6px;font-size:11px;color:#64748b;border-bottom:1px solid #f0f3f8;text-align:center;">${g.grPlanifPM}</td>
      <td style="padding:8px 6px;font-size:11px;color:#1a6b3a;font-weight:bold;text-align:center;border-bottom:1px solid #f0f3f8;">${formatValue(g.cumple)}</td>
      <td style="padding:8px 6px;font-size:11px;color:#c0392b;font-weight:bold;text-align:center;border-bottom:1px solid #f0f3f8;">${formatValue(g.noCumple)}</td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #f0f3f8;">${getBadgeProgMatriz(g.cumplimiento)}</td>
    </tr>
    `;
  }).join('');

  let matrizLastProceso = '';
  const matrizRowsHtml = planMatriz.grupos.map(g => {
    const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
    if (g.proceso) {
      matrizLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:8px 10px;font-size:11px;color:#2d3748;border-bottom:1px solid #f0f3f8;font-weight:bold;">${showProceso}</td>
      <td style="padding:8px 6px;font-size:11px;color:#2d3748;border-bottom:1px solid #f0f3f8;text-align:center;">${g.grPlanif}</td>
      <td style="padding:8px 6px;font-size:11px;color:#64748b;border-bottom:1px solid #f0f3f8;text-align:center;">${g.grPlanifPM}</td>
      <td style="padding:8px 6px;font-size:11px;color:#1a6b3a;font-weight:bold;text-align:center;border-bottom:1px solid #f0f3f8;">${formatValue(g.cumple)}</td>
      <td style="padding:8px 6px;font-size:11px;color:#c0392b;font-weight:bold;text-align:center;border-bottom:1px solid #f0f3f8;">${formatValue(g.noCumple)}</td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #f0f3f8;">${getBadgeProgMatriz(g.cumplimiento)}</td>
    </tr>
    `;
  }).join('');

  const avisosTableHtml = resumenAvisos.total > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
      <tr style="background-color:#f0f3f8;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#4a5568;">Proceso</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Gr.Planif</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Gr.planif.PM</td>
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Avisos</td>
      </tr>
      ${resumenAvisos.distribucion.map(item => `
        <tr>
          <td style="padding:9px 12px;font-size:11px;color:#2d3748;border-bottom:1px solid #cbd5e1;">${item.proceso}</td>
          <td style="padding:9px 8px;font-size:11px;color:#2d3748;border-bottom:1px solid #cbd5e1;text-align:center;">${item.grPlanif}</td>
          <td style="padding:9px 8px;font-size:11px;color:#2d3748;border-bottom:1px solid #cbd5e1;text-align:center;">${item.grPlanifPM}</td>
          <td style="padding:9px 12px;font-size:11px;font-weight:bold;color:#2d3748;border-bottom:1px solid #cbd5e1;text-align:center;">${item.cantidad}</td>
        </tr>
      `).join('')}
      <tr style="background-color:#0f1f3d;">
        <td colspan="3" style="padding:11px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 12px;text-align:center;"><span style="background-color:#e8a020;color:#0f1f3d;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;">${resumenAvisos.total}</span></td>
      </tr>
    </table>` : `
    <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
      <div style="font-size:20px;margin-bottom:8px;">🎉</div>
      <div style="color:#0f6b3a;font-size:12px;font-weight:bold;">¡Excelente!</div>
      <div style="color:#2d3748;font-size:11px;margin-top:4px;">No hay avisos pendientes en este periodo.</div>
    </div>`;

  const ordenesTableHtml = resumenOrdenes.total > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:10px;">
      <tr style="background-color:#f0f3f8;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#4a5568;">Proceso</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Gr. Planif</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Gr.planif.PM</td>
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Órdenes</td>
      </tr>
      ${resumenOrdenes.distribucion.map(item => `
        <tr>
          <td style="padding:9px 12px;font-size:11px;color:#2d3748;border-bottom:1px solid #cbd5e1;">${item.proceso}</td>
          <td style="padding:9px 8px;font-size:11px;color:#2d3748;border-bottom:1px solid #cbd5e1;text-align:center;">${item.grPlanif}</td>
          <td style="padding:9px 8px;font-size:11px;color:#2d3748;border-bottom:1px solid #cbd5e1;text-align:center;">${item.grPlanifPM}</td>
          <td style="padding:9px 12px;font-size:11px;font-weight:bold;color:#2d3748;border-bottom:1px solid #cbd5e1;text-align:center;">${item.cantidad}</td>
        </tr>
      `).join('')}
      <tr style="background-color:#0f1f3d;">
        <td colspan="3" style="padding:11px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 12px;text-align:center;"><span style="background-color:#e8a020;color:#0f1f3d;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;">${resumenOrdenes.total}</span></td>
      </tr>
    </table>` : `
    <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:10px;">
      <div style="font-size:20px;margin-bottom:8px;">🎯</div>
      <div style="color:#0f6b3a;font-size:12px;font-weight:bold;">¡Objetivo cumplido!</div>
      <div style="color:#2d3748;font-size:11px;margin-top:4px;">No hay órdenes pendientes en este periodo.</div>
    </div>`;

  const wAvisos = Math.min(100, Math.max(2, (indicadores.avisosPendientes / 50) * 100));
  const wOrdenes = Math.min(100, Math.max(2, (indicadores.ordenesPendientes / 50) * 100));

  const notaDestacadaHtml = `
  <tr>
    <td style="background-color:#ffffff;padding:24px 24px 10px 24px;border-left:1px solid #dcdfe4;border-right:1px solid #dcdfe4;border-bottom:1px solid #dcdfe4;border-radius:0 0 8px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f3f8;border-left:4px solid #e8a020;border-radius:0 8px 8px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
        <tr>
          <td style="padding:16px 20px;">
            <div style="font-size:12.5px;color:#2d3748;line-height:1.6;font-family:Calibri,Arial,sans-serif;">
              <p style="margin:0 0 12px 0;">
                Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:#0f1f3d;font-weight:bold;text-decoration:underline;">Francisco Toro</a> para su correspondiente revisión y validación.
              </p>
              <p style="margin:0 0 15px 0;color:#c0392b;font-weight:bold;font-style:italic;">
                ⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.
              </p>
              
              <!-- Botón Corporativo Premium de Cobre Destacado -->
              <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#bb5726">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">Ver Dashboard de KPIs</center>
                </v:roundrect>
                <![endif]-->
                <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return `
<div style="background-color:#edf0f4;padding:30px 0;font-family:Calibri,Arial,sans-serif;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;margin:0 auto;">
 
<tr>
  <td style="background-color:#0f1f3d;border-radius:12px 12px 0 0;padding:28px 28px 22px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:15px;vertical-align:middle;">
                <img src="https://www.codelco.com/prontus_codelco/site/artic/20220408/imag/foto_0000000120220408100923/logo.svg" style="height:32px;filter:brightness(0) invert(1);" alt="CODELCO" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:10px;color:#6a8ab0;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">■ Informe de Gestión · GSYS Mantenimiento</div>
                <div style="font-size:24px;color:#ffffff;font-weight:bold;margin-top:6px;letter-spacing:0.3px;">GSYS | Reporte Semanal KPI corporativo</div>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="vertical-align:middle;">
          <div style="background-color:#e8a020;border-radius:8px;padding:10px 18px;text-align:center;display:inline-block;">
            <div style="font-size:9px;color:#0f1f3d;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">SEMANA</div>
            <div style="font-size:32px;color:#0f1f3d;font-weight:bold;line-height:1.1;">${semana}</div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr><td style="height:5px;background-color:#e8a020;font-size:0;">&nbsp;</td></tr>
 
<tr>
  <td style="background-color:#ffffff;padding:24px 24px 20px 24px;border-left:1px solid #dcdfe4;border-right:1px solid #dcdfe4;">
    <div style="font-size:11px;color:#8090a8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:16px;">■ 1. Indicadores Globales del Período</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="19%" style="padding:4px;">
          <div style="background-color:#c0392b;border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;">
            <div style="font-size:20px;">⚠️</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.avisosPendientes}</div>
            <div style="font-size:9px;text-transform:uppercase;font-weight:bold;">Avisos</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:6px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.avisosPendientes===0?0:wAvisos}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="19%" style="padding:4px;">
          <div style="background-color:#c0392b;border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;">
            <div style="font-size:20px;">📋</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.ordenesPendientes}</div>
            <div style="font-size:9px;text-transform:uppercase;font-weight:bold;">Órdenes</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:6px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.ordenesPendientes===0?0:wOrdenes}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="20%" style="padding:4px;">
          <div style="background-color:${colorTP};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;">
            <div style="font-size:20px;">📈</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.trabajoPlanificado}%</div>
            <div style="font-size:9px;text-transform:uppercase;font-weight:bold;">Trab. Plan.</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:6px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.trabajoPlanificado}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="20%" style="padding:4px;">
          <div style="background-color:${colorPS};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;">
            <div style="font-size:20px;">✅</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.programaSemanal}%</div>
            <div style="font-size:9px;text-transform:uppercase;font-weight:bold;">Prog. Sem.</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:6px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.programaSemanal}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="22%" style="padding:4px;">
          <div style="background-color:${colorPM};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;">
            <div style="font-size:20px;">📄</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.planMatriz}%</div>
            <div style="font-size:9px;text-transform:uppercase;font-weight:bold;">Plan Matriz</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:6px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.planMatriz}%;border-radius:2px;"></div></div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:10px 24px 16px 24px;border-left:1px solid #dcdfe4;border-right:1px solid #dcdfe4;">
    <div style="font-size:11px;color:#8090a8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;">■ Avisos pendientes</div>
    ${avisosTableHtml}
    
    <div style="font-size:11px;color:#8090a8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;margin-top:20px;">■ Ordenes pendientes</div>
    ${ordenesTableHtml}
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:24px 24px 18px 24px;border-left:1px solid #dcdfe4;border-right:1px solid #dcdfe4;border-top:1px dashed #cbd5e1;">
    <div style="font-size:11px;color:#8090a8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:14px;">■ 2. Cumplimiento de Trabajo Planificado</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #cbd5e1;">
      <tr style="background-color:#f0f3f8;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#4a5568;">Proceso</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Gr. planif</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">Gr. planif.PM</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:right;">HH Plan.</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:right;">Sin HR</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:right;">Imprevistos</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#4a5568;text-align:right;">Total HH</td>
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#4a5568;text-align:center;">% Cump.</td>
      </tr>
      ${tpRowsHtml}
      <tr style="background-color:#0f1f3d;">
        <td colspan="3" style="padding:11px 12px;font-size:12px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 8px;font-size:11px;color:#cbd5e1;text-align:right;">${formatValue(trabajoPlanificado.total.planificado)}</td>
        <td style="padding:11px 8px;font-size:11px;color:#f87171;text-align:right;">${formatValue(trabajoPlanificado.total.sinHr)}</td>
        <td style="padding:11px 8px;font-size:11px;color:#f87171;text-align:right;">${formatValue(trabajoPlanificado.total.imprevistos)}</td>
        <td style="padding:11px 8px;font-size:12px;font-weight:bold;color:#ffffff;text-align:right;">${formatValue(trabajoPlanificado.total.total)}</td>
        <td style="padding:11px 12px;text-align:center;">${getBadgeTP(trabajoPlanificado.total.cumplimiento)}</td>
      </tr>
    </table>
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:10px 24px 26px 24px;border-left:1px solid #dcdfe4;border-right:1px solid #dcdfe4;">
    <div style="font-size:11px;color:#8090a8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;">■ 3. Programa Semanal</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background-color:#f0f3f8;">
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#607080;">Proceso</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">Gr. planif</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">Gr. planif.PM</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">✓</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">✗</td>
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">%</td>
      </tr>
      ${progRowsHtml}
      <tr style="background-color:#0f1f3d;">
        <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#4ade80;text-align:center;">${formatValue(programaSemanal.total.cumple)}</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#f87171;text-align:center;">${formatValue(programaSemanal.total.noCumple)}</td>
        <td style="padding:9px 10px;text-align:center;">${getBadgeProgMatriz(programaSemanal.total.cumplimiento)}</td>
      </tr>
    </table>

    <div style="font-size:11px;color:#8090a8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;margin-top:10px;">■ 4. Plan Matriz</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f0f3f8;">
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#607080;">Proceso</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">Gr. planif</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">Gr. planif.PM</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">✓</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">✗</td>
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#607080;text-align:center;">%</td>
      </tr>
      ${matrizRowsHtml}
      <tr style="background-color:#0f1f3d;">
        <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#4ade80;text-align:center;">${formatValue(planMatriz.total.cumple)}</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#f87171;text-align:center;">${formatValue(planMatriz.total.noCumple)}</td>
        <td style="padding:9px 10px;text-align:center;">${getBadgeProgMatriz(planMatriz.total.cumplimiento)}</td>
      </tr>
    </table>
  </td>
</tr>

${notaDestacadaHtml}
 
<tr><td style="background-color:#edf0f4;height:20px;">&nbsp;</td></tr>
<tr>
  <td style="background-color:#0f1f3d;border-radius:12px;padding:20px 28px;color:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <div style="font-size:10px;color:#7aaad8;font-weight:bold;">Información obtenida de DATAMART · GSYS Mantenimiento DCH</div>
          <div style="font-size:10px;color:#cbd5e1;margin-top:4px;">
            Semana ${semana} · ${currentYear} &nbsp;|&nbsp; Monitoring &nbsp;|&nbsp; Informe generado por <a href="mailto:jose.contreras@monitoring.cl" style="color:#e8a020;text-decoration:none;font-weight:bold;">José Contreras</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
</table>
</div>`;
}

// --- 2. PLANTILLA EJECUTIVO SLATE (DISEÑO MÁS COMPACTO Y MODERNO) ---
function generateTemplate2(data) {
  const { semana, indicadores, resumenAvisos, resumenOrdenes, trabajoPlanificado, programaSemanal, planMatriz } = data;
  const currentYear = new Date().getFullYear();

  const colorTP = getBarColorTP(indicadores.trabajoPlanificado);
  const colorPS = getBarColorProgMatriz(indicadores.programaSemanal);
  const colorPM = getBarColorProgMatriz(indicadores.planMatriz);

  return `
<div style="background-color:#f1f5f9;padding:40px 0;font-family:'Segoe UI',Arial,sans-serif;color:#334155;">
<table width="660" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;width:100%;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #e2e8f0;">
 
  <!-- Header Minimalista y Limpio -->
  <tr>
    <td style="background-color:#1e293b;padding:30px 40px;border-bottom:4px solid #475569;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:15px;vertical-align:middle;">
                  <img src="https://www.codelco.com/prontus_codelco/site/artic/20220408/imag/foto_0000000120220408100923/logo.svg" style="height:32px;filter:brightness(0) invert(1);" alt="CODELCO" />
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:11px;color:#94a3b8;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">GSYS MANTENIMIENTO DCH</div>
                  <div style="font-size:24px;color:#f8fafc;font-weight:bold;margin-top:4px;letter-spacing:-0.5px;">GSYS | Reporte Semanal KPI corporativo</div>
                </td>
              </tr>
            </table>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="background-color:#475569;color:#f8fafc;font-size:12px;font-weight:bold;padding:6px 14px;border-radius:30px;letter-spacing:1px;">
              SEMANA ${semana} · ${currentYear}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Resumen de KPI Horizontal Slim -->
  <tr>
    <td style="padding:30px 40px 10px 40px;">
      <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:15px;border-left:3px solid #64748b;padding-left:8px;">Indicadores Clave</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="20%" style="padding:0 5px 0 0;">
            <div style="border:1px solid #cbd5e1;background-color:#f8fafc;border-radius:8px;padding:12px 10px;text-align:center;">
              <div style="font-size:18px;font-weight:bold;color:#991b1b;">${indicadores.avisosPendientes}</div>
              <div style="font-size:9px;color:#64748b;font-weight:bold;margin-top:3px;text-transform:uppercase;">Avisos Pend.</div>
              <div style="background-color:#fee2e2;height:4px;border-radius:2px;margin-top:8px;"><div style="background-color:#ef4444;height:4px;width:${Math.min(100, (indicadores.avisosPendientes/20)*100)}%;border-radius:2px;"></div></div>
            </div>
          </td>
          <td width="20%" style="padding:0 5px;">
            <div style="border:1px solid #cbd5e1;background-color:#f8fafc;border-radius:8px;padding:12px 10px;text-align:center;">
              <div style="font-size:18px;font-weight:bold;color:#991b1b;">${indicadores.ordenesPendientes}</div>
              <div style="font-size:9px;color:#64748b;font-weight:bold;margin-top:3px;text-transform:uppercase;">Órdenes Pend.</div>
              <div style="background-color:#fee2e2;height:4px;border-radius:2px;margin-top:8px;"><div style="background-color:#ef4444;height:4px;width:${Math.min(100, (indicadores.ordenesPendientes/50)*100)}%;border-radius:2px;"></div></div>
            </div>
          </td>
          <td width="20%" style="padding:0 5px;">
            <div style="border:1px solid #cbd5e1;background-color:#f8fafc;border-radius:8px;padding:12px 10px;text-align:center;">
              <div style="font-size:18px;font-weight:bold;color:#1e3a8a;">${indicadores.trabajoPlanificado}%</div>
              <div style="font-size:9px;color:#64748b;font-weight:bold;margin-top:3px;text-transform:uppercase;">Trab. Plan.</div>
              <div style="background-color:#e0e7ff;height:4px;border-radius:2px;margin-top:8px;"><div style="background-color:${colorTP};height:4px;width:${indicadores.trabajoPlanificado}%;border-radius:2px;"></div></div>
            </div>
          </td>
          <td width="20%" style="padding:0 5px;">
            <div style="border:1px solid #cbd5e1;background-color:#f8fafc;border-radius:8px;padding:12px 10px;text-align:center;">
              <div style="font-size:18px;font-weight:bold;color:#1e3a8a;">${indicadores.programaSemanal}%</div>
              <div style="font-size:9px;color:#64748b;font-weight:bold;margin-top:3px;text-transform:uppercase;">Prog. Sem.</div>
              <div style="background-color:#e0e7ff;height:4px;border-radius:2px;margin-top:8px;"><div style="background-color:${colorPS};height:4px;width:${indicadores.programaSemanal}%;border-radius:2px;"></div></div>
            </div>
          </td>
          <td width="20%" style="padding:0 0 0 5px;">
            <div style="border:1px solid #cbd5e1;background-color:#f8fafc;border-radius:8px;padding:12px 10px;text-align:center;">
              <div style="font-size:18px;font-weight:bold;color:#1e3a8a;">${indicadores.planMatriz}%</div>
              <div style="font-size:9px;color:#64748b;font-weight:bold;margin-top:3px;text-transform:uppercase;">Plan Matriz</div>
              <div style="background-color:#e0e7ff;height:4px;border-radius:2px;margin-top:8px;"><div style="background-color:${colorPM};height:4px;width:${indicadores.planMatriz}%;border-radius:2px;"></div></div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Tablas 100% de Ancho Consecutivas y Modulares -->
  <tr>
    <td style="padding:20px 40px;">
      
      <h3 style="font-size:13px;font-weight:bold;margin:20px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#1e293b;border-bottom:1px solid #cbd5e1;padding-bottom:4px;border-left:3px solid #ef4444;padding-left:8px;">■ Avisos pendientes</h3>
      ${resumenAvisos.total > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;margin-bottom:25px;">
        <tr style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso Mantenimiento</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.Planif</td>
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Cantidad</td>
        </tr>
        ${resumenAvisos.distribucion.map(item => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-size:11px;color:#334155;">${item.proceso}</td>
            <td style="padding:8px 8px;font-size:11px;color:#334155;text-align:center;">${item.grPlanif}</td>
            <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#334155;text-align:center;">${item.cantidad}</td>
          </tr>
        `).join('')}
        <tr style="background-color:#334155;">
          <td colspan="2" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#ffffff;">Total Avisos Activos</td>
          <td style="padding:10px 12px;font-size:12px;font-weight:bold;color:#ffffff;text-align:center;">${resumenAvisos.total}</td>
        </tr>
      </table>` : `
      <div style="padding:15px;background-color:#f0fdf4;border:1px dashed #bbf7d0;border-radius:8px;color:#166534;font-size:11px;text-align:center;margin-bottom:25px;">
        No hay avisos pendientes en la base.
      </div>`}

      <!-- Ordenes -->
      <h3 style="font-size:13px;font-weight:bold;margin:20px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#1e293b;border-bottom:1px solid #cbd5e1;padding-bottom:4px;border-left:3px solid #ef4444;padding-left:8px;">■ Ordenes pendientes</h3>
      ${resumenOrdenes.total > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;margin-bottom:25px;">
        <tr style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso Mantenimiento</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.Planif</td>
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Cantidad</td>
        </tr>
        ${resumenOrdenes.distribucion.map(item => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-size:11px;color:#334155;">${item.proceso}</td>
            <td style="padding:8px 8px;font-size:11px;color:#334155;text-align:center;">${item.grPlanif}</td>
            <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#334155;text-align:center;">${item.cantidad}</td>
          </tr>
        `).join('')}
        <tr style="background-color:#334155;">
          <td colspan="2" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#ffffff;">Total Órdenes Backlog</td>
          <td style="padding:10px 12px;font-size:12px;font-weight:bold;color:#ffffff;text-align:center;">${resumenOrdenes.total}</td>
        </tr>
      </table>` : `
      <div style="padding:15px;background-color:#f0fdf4;border:1px dashed #bbf7d0;border-radius:8px;color:#166534;font-size:11px;text-align:center;margin-bottom:25px;">
        No hay órdenes pendientes en backlog.
      </div>`}

      <!-- Trabajo Planificado -->
      <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;border-left:3px solid #1e3a8a;padding-left:8px;">Cumplimiento Trabajo Planificado</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;margin-bottom:25px;">
        <tr style="background-color:#f8fafc;">
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">HH Plan.</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">Sin HR</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;">Imprev.</td>
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
        </tr>
        ${(() => {
          let tpLastProceso = '';
          return trabajoPlanificado.grupos.map(g => {
            const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
            if (g.proceso) tpLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 12px;font-size:11px;color:#334155;font-weight:bold;">${showProceso}</td>
              <td style="padding:9px 8px;font-size:11px;color:#334155;text-align:center;">${g.grPlanif}</td>
              <td style="padding:9px 8px;font-size:11px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:9px 8px;font-size:11px;text-align:right;color:#334155;">${formatValue(g.planificado)}</td>
              <td style="padding:9px 8px;font-size:11px;text-align:right;color:${g.sinHr > 0 ? '#b91c1c' : '#64748b'};">${formatValue(g.sinHr)}</td>
              <td style="padding:9px 8px;font-size:11px;text-align:right;color:${g.imprevistos > 0 ? '#b91c1c' : '#64748b'};">${formatValue(g.imprevistos)}</td>
              <td style="padding:9px 12px;text-align:center;">${getBadgeTP(g.cumplimiento)}</td>
            </tr>
            `;
          }).join('');
        })()}
        <tr style="background-color:#334155;">
          <td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
          <td style="padding:10px 8px;font-size:11px;color:#f8fafc;text-align:right;">${formatValue(trabajoPlanificado.total.planificado)}</td>
          <td style="padding:10px 8px;font-size:11px;color:#fca5a5;text-align:right;">${formatValue(trabajoPlanificado.total.sinHr)}</td>
          <td style="padding:10px 8px;font-size:11px;color:#fca5a5;text-align:right;">${formatValue(trabajoPlanificado.total.imprevistos)}</td>
          <td style="padding:10px 12px;text-align:center;">${getBadgeTP(trabajoPlanificado.total.cumplimiento)}</td>
        </tr>
      </table>

      <!-- Programa Semanal -->
      <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;border-left:3px solid #047857;padding-left:8px;">Prog. Semanal</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:25px;">
        <tr style="background-color:#f8fafc;">
          <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✓</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✗</td>
          <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
        </tr>
        ${(() => {
          let progLastProceso = '';
          return programaSemanal.grupos.map(g => {
            const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
            if (g.proceso) progLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 10px;font-size:11px;font-weight:bold;">${showProceso}</td>
              <td style="padding:8px 6px;font-size:11px;color:#334155;text-align:center;">${g.grPlanif}</td>
              <td style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:8px 6px;font-size:11px;color:#047857;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
              <td style="padding:8px 6px;font-size:11px;color:#b91c1c;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
              <td style="padding:8px 10px;text-align:center;">${getBadgeProgMatriz(g.cumplimiento)}</td>
            </tr>
            `;
          }).join('');
        })()}
      </table>

      <!-- Plan Matriz -->
      <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;border-left:3px solid #047857;padding-left:8px;">Plan Matriz</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <tr style="background-color:#f8fafc;">
          <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✓</td>
          <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✗</td>
          <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
        </tr>
        ${(() => {
          let matrizLastProceso = '';
          return planMatriz.grupos.map(g => {
            const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
            if (g.proceso) matrizLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 10px;font-size:11px;font-weight:bold;">${showProceso}</td>
              <td style="padding:8px 6px;font-size:11px;color:#334155;text-align:center;">${g.grPlanif}</td>
              <td style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:8px 6px;font-size:11px;color:#047857;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
              <td style="padding:8px 6px;font-size:11px;color:#b91c1c;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
              <td style="padding:8px 10px;text-align:center;">${getBadgeProgMatriz(g.cumplimiento)}</td>
            </tr>
            `;
          }).join('');
        })()}
      </table>

    </td>
  </tr>

  <!-- Nota Destacada - Bottom -->
  <tr>
    <td style="padding:10px 40px 30px 40px;">
      <div style="background-color:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;padding:16px 20px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
        <div style="font-size:12.5px;line-height:1.6;">
          <p style="margin:0 0 10px 0;">
            Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:#2563eb;font-weight:bold;text-decoration:none;border-bottom:1px solid #2563eb;">Francisco Toro</a> para su correspondiente revisión y validación.
          </p>
          <p style="margin:0 0 15px 0;color:#dc2626;font-weight:bold;">
            ⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.
          </p>
          
          <!-- Botón Corporativo Premium de Cobre Destacado -->
          <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#bb5726">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">Ver Dashboard de KPIs</center>
            </v:roundrect>
            <![endif]-->
            <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
          </div>
        </div>
      </div>
    </td>
  </tr>

  <!-- Footer Slim -->
  <tr>
    <td style="background-color:#0f172a;padding:20px 40px;color:#94a3b8;font-size:11px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <strong>DATAMART · GSYS Mantenimiento DCH</strong><br>
            Semana ${semana} · ${currentYear} · Generado por <a href="mailto:jose.contreras@monitoring.cl" style="color:#38bdf8;text-decoration:none;">José Contreras</a>
          </td>
          <td align="right" style="vertical-align:middle;color:#64748b;">
            Monitoring SPA
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</div>`;
}

// --- 3. PLANTILLA MINIMAL CLARO (EDITORIAL / ALTO NIVEL CON GRÁFICOS ELEGANTES) ---
function generateTemplate3(data) {
  const { semana, indicadores, resumenAvisos, resumenOrdenes, trabajoPlanificado, programaSemanal, planMatriz } = data;
  const currentYear = new Date().getFullYear();

  // Emojis deshabilitados para mantener estética editorial premium limpia.
  // Colores sutiles y elegantes para gráficos minimalistas.
  const colorTP = getBarColorTP(indicadores.trabajoPlanificado);
  const colorPS = getBarColorProgMatriz(indicadores.programaSemanal);
  const colorPM = getBarColorProgMatriz(indicadores.planMatriz);

  return `
<div style="background-color:#ffffff;padding:50px 0;font-family:'Georgia','Times New Roman',serif;color:#1e293b;line-height:1.6;">
<table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;margin:0 auto;background-color:#ffffff;">
  
  <!-- Cabecera Editorial -->
  <tr>
    <td style="border-bottom:2px solid #0f172a;padding-bottom:20px;text-align:left;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:top;">
            <span style="font-family:'Segoe UI',sans-serif;font-size:9.5px;letter-spacing:4px;text-transform:uppercase;font-weight:bold;color:#64748b;">REPORTABILIDAD CORPORATIVA DE KPIs</span>
            <h1 style="margin:5px 0 0 0;font-size:28px;font-weight:normal;color:#0f172a;letter-spacing:-0.5px;font-family:'Segoe UI',sans-serif;">GSYS | Reporte Semanal KPI corporativo</h1>
          </td>
          <td align="right" style="vertical-align:top;width:100px;">
            <img src="https://www.codelco.com/prontus_codelco/site/artic/20220408/imag/foto_0000000120220408100923/logo.svg" style="height:32px;" alt="CODELCO" />
          </td>
        </tr>
      </table>
      <div style="font-family:'Segoe UI',sans-serif;font-size:11px;color:#64748b;margin-top:6px;">Semana ${semana} &nbsp;·&nbsp; Año ${currentYear} &nbsp;·&nbsp; Gestión de Mantenimiento Chuquicamata</div>
    </td>
  </tr>

  <!-- Gráficos de barra ultra elegantes a una sola columna (Estilo Cuaderno de Gestión) -->
  <tr>
    <td style="padding:30px 0 10px 0;">
      <div style="font-family:'Segoe UI',sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#475569;margin-bottom:15px;">■ Desempeño Gráfico de Indicadores</div>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',sans-serif;font-size:11px;">
        <!-- TP -->
        <tr>
          <td width="30%" style="padding:6px 0;font-weight:bold;color:#334155;">Trabajo Planificado</td>
          <td width="10%" style="padding:6px 0;text-align:right;font-weight:bold;padding-right:15px;color:${colorTP};">${indicadores.trabajoPlanificado}%</td>
          <td width="60%" style="padding:6px 0;">
            <div style="background-color:#f1f5f9;height:6px;border-radius:3px;width:100%;">
              <div style="background-color:${colorTP};height:6px;border-radius:3px;width:${indicadores.trabajoPlanificado}%;"></div>
            </div>
          </td>
        </tr>
        <!-- PS -->
        <tr>
          <td width="30%" style="padding:6px 0;font-weight:bold;color:#334155;">Programa Semanal</td>
          <td width="10%" style="padding:6px 0;text-align:right;font-weight:bold;padding-right:15px;color:${colorPS};">${indicadores.programaSemanal}%</td>
          <td width="60%" style="padding:6px 0;">
            <div style="background-color:#f1f5f9;height:6px;border-radius:3px;width:100%;">
              <div style="background-color:${colorPS};height:6px;border-radius:3px;width:${indicadores.programaSemanal}%;"></div>
            </div>
          </td>
        </tr>
        <!-- PM -->
        <tr>
          <td width="30%" style="padding:6px 0;font-weight:bold;color:#334155;">Plan Matriz</td>
          <td width="10%" style="padding:6px 0;text-align:right;font-weight:bold;padding-right:15px;color:${colorPM};">${indicadores.planMatriz}%</td>
          <td width="60%" style="padding:6px 0;">
            <div style="background-color:#f1f5f9;height:6px;border-radius:3px;width:100%;">
              <div style="background-color:${colorPM};height:6px;border-radius:3px;width:${indicadores.planMatriz}%;"></div>
            </div>
          </td>
        </tr>
        <!-- Avisos -->
        <tr>
          <td width="30%" style="padding:6px 0;font-weight:bold;color:#334155;">Avisos Pendientes</td>
          <td width="10%" style="padding:6px 0;text-align:right;font-weight:bold;padding-right:15px;color:#ef4444;">${indicadores.avisosPendientes}</td>
          <td width="60%" style="padding:6px 0;">
            <div style="background-color:#f1f5f9;height:6px;border-radius:3px;width:100%;">
              <div style="background-color:#ef4444;height:6px;border-radius:3px;width:${Math.min(100, (indicadores.avisosPendientes / 20) * 100)}%;"></div>
            </div>
          </td>
        </tr>
        <!-- Ordenes -->
        <tr>
          <td width="30%" style="padding:6px 0;font-weight:bold;color:#334155;">Órdenes Pendientes</td>
          <td width="10%" style="padding:6px 0;text-align:right;font-weight:bold;padding-right:15px;color:#ef4444;">${indicadores.ordenesPendientes}</td>
          <td width="60%" style="padding:6px 0;">
            <div style="background-color:#f1f5f9;height:6px;border-radius:3px;width:100%;">
              <div style="background-color:#ef4444;height:6px;border-radius:3px;width:${Math.min(100, (indicadores.ordenesPendientes / 50) * 100)}%;"></div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Tablas Dinámicas Editorial Minimal -->
  <tr>
    <td style="padding:20px 0;">
      
      <!-- Avisos -->
      <h3 style="font-size:13px;font-weight:bold;margin:20px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">■ Avisos pendientes</h3>
      ${resumenAvisos.total > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;font-family:'Segoe UI',sans-serif;">
        <tr style="border-bottom:1px solid #0f172a;">
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;border-bottom:1.5px solid #0f172a;">Proceso Mantenimiento</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;width:100px;">Gr. Planif</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;width:100px;">Gr.planif.PM</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;width:80px;">Avisos</td>
        </tr>
        ${resumenAvisos.distribucion.map(item => `
          <tr>
            <td style="padding:7px 0;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.proceso}</td>
            <td style="padding:7px 0;font-size:11px;color:#334155;text-align:center;border-bottom:1px solid #f1f5f9;">${item.grPlanif}</td>
            <td style="padding:7px 0;font-size:11px;color:#334155;text-align:center;border-bottom:1px solid #f1f5f9;">${item.grPlanifPM}</td>
            <td style="padding:7px 0;font-size:11px;font-weight:bold;color:#ef4444;text-align:right;border-bottom:1px solid #f1f5f9;">${item.cantidad}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="3" style="padding:10px 0;font-size:11px;font-weight:bold;color:#0f172a;">TOTAL GENERAL</td>
          <td style="padding:10px 0;font-size:12px;font-weight:bold;color:#ef4444;text-align:right;">${resumenAvisos.total}</td>
        </tr>
      </table>` : `<p style="font-size:11px;font-style:italic;color:#64748b;font-family:'Segoe UI',sans-serif;margin-bottom:25px;">No se registran avisos pendientes.</p>`}

      <!-- Ordenes -->
      <h3 style="font-size:13px;font-weight:bold;margin:20px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">■ Ordenes pendientes</h3>
      ${resumenOrdenes.total > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;font-family:'Segoe UI',sans-serif;">
        <tr style="border-bottom:1px solid #0f172a;">
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;border-bottom:1.5px solid #0f172a;">Proceso Mantenimiento</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;width:100px;">Gr. Planif</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;width:100px;">Gr.planif.PM</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;width:80px;">Órdenes</td>
        </tr>
        ${resumenOrdenes.distribucion.map(item => `
          <tr>
            <td style="padding:7px 0;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.proceso}</td>
            <td style="padding:7px 0;font-size:11px;color:#334155;text-align:center;border-bottom:1px solid #f1f5f9;">${item.grPlanif}</td>
            <td style="padding:7px 0;font-size:11px;color:#334155;text-align:center;border-bottom:1px solid #f1f5f9;">${item.grPlanifPM}</td>
            <td style="padding:7px 0;font-size:11px;font-weight:bold;color:#ef4444;text-align:right;border-bottom:1px solid #f1f5f9;">${item.cantidad}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="3" style="padding:10px 0;font-size:11px;font-weight:bold;color:#0f172a;">TOTAL GENERAL</td>
          <td style="padding:10px 0;font-size:12px;font-weight:bold;color:#ef4444;text-align:right;">${resumenOrdenes.total}</td>
        </tr>
      </table>` : `<p style="font-size:11px;font-style:italic;color:#64748b;font-family:'Segoe UI',sans-serif;margin-bottom:25px;">No se registran órdenes pendientes.</p>`}

      <!-- Trabajo Planificado -->
      <h3 style="font-size:13px;font-weight:bold;margin:25px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">■ 2. Cumplimiento de Trabajo Planificado</h3>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;font-family:'Segoe UI',sans-serif;">
        <tr style="border-bottom:1px solid #0f172a;">
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;border-bottom:1.5px solid #0f172a;">Proceso</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">Gr. planif</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">Gr. planif.PM</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;">HH Plan.</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;">Sin HR</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;">Imprev.</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;">Total HH</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;width:90px;">Cumplimiento</td>
        </tr>
        ${(() => {
          let tpLastProceso = '';
          return trabajoPlanificado.grupos.map(g => {
            const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
            if (g.proceso) tpLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 0;font-size:11px;color:#334155;font-weight:bold;">${showProceso}</td>
              <td style="padding:8px 0;font-size:11px;color:#334155;text-align:center;">${g.grPlanif}</td>
              <td style="padding:8px 0;font-size:11px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:8px 0;font-size:11px;text-align:right;color:#334155;">${formatValue(g.planificado)}</td>
              <td style="padding:8px 0;font-size:11px;text-align:right;color:#334155;">${formatValue(g.sinHr)}</td>
              <td style="padding:8px 0;font-size:11px;text-align:right;color:#334155;">${formatValue(g.imprevistos)}</td>
              <td style="padding:8px 0;font-size:11px;font-weight:bold;text-align:right;color:#334155;">${formatValue(g.total)}</td>
              <td style="padding:8px 0;font-size:11px;text-align:center;font-weight:bold;color:${g.cumplimiento >= 0.8 ? '#16a34a' : '#ef4444'};">${Math.round(g.cumplimiento*100)}%</td>
            </tr>
            `;
          }).join('');
        })()}
        <tr style="font-weight:bold;color:#0f172a;">
          <td colspan="3" style="padding:10px 0;font-size:11px;">TOTAL GENERAL</td>
          <td style="padding:10px 0;font-size:11px;text-align:right;">${formatValue(trabajoPlanificado.total.planificado)}</td>
          <td style="padding:10px 0;font-size:11px;text-align:right;">${formatValue(trabajoPlanificado.total.sinHr)}</td>
          <td style="padding:10px 0;font-size:11px;text-align:right;">${formatValue(trabajoPlanificado.total.imprevistos)}</td>
          <td style="padding:10px 0;font-size:11px;text-align:right;">${formatValue(trabajoPlanificado.total.total)}</td>
          <td style="padding:10px 0;font-size:12px;text-align:center;color:${trabajoPlanificado.total.cumplimiento >= 0.8 ? '#16a34a' : '#ef4444'};">${Math.round(trabajoPlanificado.total.cumplimiento*100)}%</td>
        </tr>
      </table>

      <!-- Programa Semanal -->
      <h3 style="font-size:13px;font-weight:bold;margin:20px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">■ 3. Programa Semanal</h3>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;font-family:'Segoe UI',sans-serif;">
        <tr style="border-bottom:1px solid #0f172a;">
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;border-bottom:1.5px solid #0f172a;">Proceso</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">Gr. planif</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">Gr. planif.PM</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">✓</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">✗</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;">%</td>
        </tr>
        ${(() => {
          let progLastProceso = '';
          return programaSemanal.grupos.map(g => {
            const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
            if (g.proceso) progLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 0;font-size:11px;color:#334155;font-weight:bold;">${showProceso}</td>
              <td style="padding:7px 0;font-size:11px;color:#334155;text-align:center;">${g.grPlanif}</td>
              <td style="padding:7px 0;font-size:11px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:7px 0;font-size:11px;color:#16a34a;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
              <td style="padding:7px 0;font-size:11px;color:#ef4444;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
              <td style="padding:7px 0;font-size:11px;text-align:right;font-weight:bold;color:${g.cumplimiento >= 0.85 ? '#16a34a' : '#ef4444'};">${Math.round(g.cumplimiento*100)}%</td>
            </tr>
            `;
          }).join('');
        })()}
        <tr style="font-weight:bold;color:#0f172a;">
          <td colspan="3" style="padding:9px 0;">TOTAL</td>
          <td style="padding:9px 0;text-align:center;color:#16a34a;">${programaSemanal.total.cumple}</td>
          <td style="padding:9px 0;text-align:center;color:#ef4444;">${programaSemanal.total.noCumple}</td>
          <td style="padding:9px 0;text-align:right;color:${programaSemanal.total.cumplimiento >= 0.85 ? '#16a34a' : '#ef4444'};">${Math.round(programaSemanal.total.cumplimiento*100)}%</td>
        </tr>
      </table>

      <!-- Plan Matriz -->
      <h3 style="font-size:13px;font-weight:bold;margin:20px 0 10px 0;font-family:'Segoe UI',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">■ 4. Plan Matriz</h3>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:25px;font-family:'Segoe UI',sans-serif;">
        <tr style="border-bottom:1px solid #0f172a;">
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;border-bottom:1.5px solid #0f172a;">Proceso</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">Gr. planif</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">Gr. planif.PM</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">✓</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-bottom:1.5px solid #0f172a;">✗</td>
          <td style="padding:8px 0;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-bottom:1.5px solid #0f172a;">%</td>
        </tr>
        ${(() => {
          let matrizLastProceso = '';
          return planMatriz.grupos.map(g => {
            const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
            if (g.proceso) matrizLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 0;font-size:11px;color:#334155;font-weight:bold;">${showProceso}</td>
              <td style="padding:7px 0;font-size:11px;color:#334155;text-align:center;">${g.grPlanif}</td>
              <td style="padding:7px 0;font-size:11px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:7px 0;font-size:11px;color:#16a34a;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
              <td style="padding:7px 0;font-size:11px;color:#ef4444;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
              <td style="padding:7px 0;font-size:11px;text-align:right;font-weight:bold;color:${g.cumplimiento >= 0.85 ? '#16a34a' : '#ef4444'};">${Math.round(g.cumplimiento*100)}%</td>
            </tr>
            `;
          }).join('');
        })()}
        <tr style="font-weight:bold;color:#0f172a;">
          <td colspan="3" style="padding:9px 0;">TOTAL</td>
          <td style="padding:9px 0;text-align:center;color:#16a34a;">${planMatriz.total.cumple}</td>
          <td style="padding:9px 0;text-align:center;color:#ef4444;">${planMatriz.total.noCumple}</td>
          <td style="padding:9px 0;text-align:right;color:${planMatriz.total.cumplimiento >= 0.85 ? '#16a34a' : '#ef4444'};">${Math.round(planMatriz.total.cumplimiento*100)}%</td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- Nota Editorial Minimal -->
  <tr>
    <td style="border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:22px 0;margin:15px 0;font-family:'Segoe UI',sans-serif;">
      <div style="font-size:12.5px;color:#334155;line-height:1.65;">
        <p style="margin:0 0 10px 0;">
          Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:#0f172a;font-weight:bold;text-decoration:underline;">Francisco Toro</a> para su correspondiente revisión y validación.
        </p>
        <p style="margin:0 0 15px 0;color:#b91c1c;font-weight:bold;">
          ⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.
        </p>
        
        <!-- Botón Corporativo Premium de Cobre Destacado -->
        <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#bb5726">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">Ver Dashboard de KPIs</center>
          </v:roundrect>
          <![endif]-->
          <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
        </div>
      </div>
    </td>
  </tr>

  <!-- Pie de página simple -->
  <tr>
    <td style="padding-top:25px;font-family:'Segoe UI',sans-serif;font-size:10px;color:#64748b;text-align:left;">
      Información obtenida de DATAMART &nbsp;·&nbsp; GSYS Mantenimiento DCH<br>
      Semana ${semana} &nbsp;·&nbsp; ${currentYear} &nbsp;·&nbsp; Informe generado por <a href="mailto:jose.contreras@monitoring.cl" style="color:#334155;text-decoration:underline;font-weight:bold;">José Contreras</a>
    </td>
  </tr>
</table>
</div>`;
}

// --- 4. PLANTILLA TECNOLÓGICO DARK (MODERNO SLEEK / PANEL DE CONTROL) ---
function generateTemplate4(data) {
  const { semana, indicadores, resumenAvisos, resumenOrdenes, trabajoPlanificado, programaSemanal, planMatriz } = data;
  const currentYear = new Date().getFullYear();

  // Moderno Dark: Slate oscuro, fuentes del sistema limpias, colores luminiscentes modernos.
  const colorTP = getBarColorTP(indicadores.trabajoPlanificado);
  const colorPS = getBarColorProgMatriz(indicadores.programaSemanal);
  const colorPM = getBarColorProgMatriz(indicadores.planMatriz);

  return `
<div style="background-color:#0b0f19;padding:45px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#94a3b8;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;margin:0 auto;background-color:#161e2e;border:1px solid #2d3748;box-shadow:0 10px 30px rgba(0,0,0,0.3);border-radius:12px;overflow:hidden;">
  
  <!-- Cabecera Sleek Terminal -->
  <tr>
    <td style="background-color:#0b0f19;padding:24px 32px;border-bottom:1px solid #2d3748;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:15px;vertical-align:middle;">
                  <img src="https://www.codelco.com/prontus_codelco/site/artic/20220408/imag/foto_0000000120220408100923/logo.svg" style="height:30px;filter:brightness(0) invert(1);" alt="CODELCO" />
                </td>
                <td style="vertical-align:middle;">
                  <div style="color:#10b981;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">● SISTEMA DE MONITOREO DCH</div>
                  <div style="color:#f8fafc;font-size:22px;font-weight:bold;margin-top:4px;">GSYS | Reporte Semanal KPI corporativo</div>
                </td>
              </tr>
            </table>
          </td>
          <td align="right" style="vertical-align:middle;" width="130">
            <span style="background-color:#1e293b;border:1px solid #3b82f6;color:#3b82f6;font-size:11px;font-weight:bold;padding:5px 12px;border-radius:6px;font-family:monospace;display:inline-block;text-align:center;">
              SEMANA_SEM_${semana}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Gráficos tipo Dashboard Moderno -->
  <tr>
    <td style="padding:25px 32px 10px 32px;">
      <div style="color:#f8fafc;font-size:12px;font-weight:bold;margin-bottom:12px;letter-spacing:0.5px;">[DESEMPEÑO_GLOBAL]</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="33%" style="padding:4px;">
            <div style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;padding:16px 12px;text-align:center;">
              <div style="font-size:10px;color:#64748b;font-weight:bold;text-transform:uppercase;">TRAB_PLANIFICADO</div>
              <div style="font-size:24px;font-weight:bold;color:#f8fafc;margin:6px 0;">${indicadores.trabajoPlanificado}%</div>
              <div style="background-color:#1e293b;height:6px;border-radius:3px;width:100%;">
                <div style="background-color:${colorTP};height:6px;border-radius:3px;width:${indicadores.trabajoPlanificado}%;"></div>
              </div>
            </div>
          </td>
          <td width="33%" style="padding:4px;">
            <div style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;padding:16px 12px;text-align:center;">
              <div style="font-size:10px;color:#64748b;font-weight:bold;text-transform:uppercase;">PROG_SEMANAL</div>
              <div style="font-size:24px;font-weight:bold;color:#f8fafc;margin:6px 0;">${indicadores.programaSemanal}%</div>
              <div style="background-color:#1e293b;height:6px;border-radius:3px;width:100%;">
                <div style="background-color:${colorPS};height:6px;border-radius:3px;width:${indicadores.programaSemanal}%;"></div>
              </div>
            </div>
          </td>
          <td width="34%" style="padding:4px;">
            <div style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;padding:16px 12px;text-align:center;">
              <div style="font-size:10px;color:#64748b;font-weight:bold;text-transform:uppercase;">PLAN_MATRIZ</div>
              <div style="font-size:24px;font-weight:bold;color:#f8fafc;margin:6px 0;">${indicadores.planMatriz}%</div>
              <div style="background-color:#1e293b;height:6px;border-radius:3px;width:100%;">
                <div style="background-color:${colorPM};height:6px;border-radius:3px;width:${indicadores.planMatriz}%;"></div>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Grid de Detalle e Indicadores Críticos -->
  <tr>
    <td style="padding:15px 32px 10px 32px;">
      
      <!-- Avisos -->
      <div style="color:#f8fafc;font-size:12px;font-weight:bold;margin-bottom:8px;">■ Avisos pendientes</div>
      ${resumenAvisos.total > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;overflow:hidden;font-size:11px;margin-bottom:20px;">
        <tr style="background-color:#1e293b;color:#f8fafc;">
          <td style="padding:10px;font-weight:bold;">Proceso Mantenimiento</td>
          <td style="padding:10px;text-align:center;font-weight:bold;width:80px;">Gr. Planif</td>
          <td style="padding:10px;text-align:center;font-weight:bold;width:80px;">Gr.PM</td>
          <td style="padding:10px;text-align:right;font-weight:bold;width:80px;">Avisos</td>
        </tr>
        ${resumenAvisos.distribucion.map(item => `
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:9px 10px;color:#cbd5e1;">${item.proceso}</td>
            <td style="padding:9px 10px;text-align:center;color:#cbd5e1;">${item.grPlanif}</td>
            <td style="padding:9px 10px;text-align:center;color:#cbd5e1;">${item.grPlanifPM}</td>
            <td style="padding:9px 10px;text-align:right;font-weight:bold;color:#f87171;">${item.cantidad}</td>
          </tr>
        `).join('')}
        <tr style="background-color:#1e293b;font-weight:bold;color:#f8fafc;">
          <td colspan="3" style="padding:10px;">TOTAL GENERAL</td>
          <td style="padding:10px;text-align:right;color:#f87171;">${resumenAvisos.total}</td>
        </tr>
      </table>` : `<div style="background-color:#0b0f19;border:1px dashed #2d3748;padding:12px;text-align:center;font-size:11px;border-radius:8px;color:#10b981;margin-bottom:20px;">No se registran avisos pendientes</div>`}

      <!-- Ordenes -->
      <div style="color:#f8fafc;font-size:12px;font-weight:bold;margin-bottom:8px;">■ Ordenes pendientes</div>
      ${resumenOrdenes.total > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;overflow:hidden;font-size:11px;margin-bottom:20px;">
        <tr style="background-color:#1e293b;color:#f8fafc;">
          <td style="padding:10px;font-weight:bold;">Proceso Mantenimiento</td>
          <td style="padding:10px;text-align:center;font-weight:bold;width:80px;">Gr. Planif</td>
          <td style="padding:10px;text-align:center;font-weight:bold;width:80px;">Gr.PM</td>
          <td style="padding:10px;text-align:right;font-weight:bold;width:80px;">Órdenes</td>
        </tr>
        ${resumenOrdenes.distribucion.map(item => `
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:9px 10px;color:#cbd5e1;">${item.proceso}</td>
            <td style="padding:9px 10px;text-align:center;color:#cbd5e1;">${item.grPlanif}</td>
            <td style="padding:9px 10px;text-align:center;color:#cbd5e1;">${item.grPlanifPM}</td>
            <td style="padding:9px 10px;text-align:right;font-weight:bold;color:#f87171;">${item.cantidad}</td>
          </tr>
        `).join('')}
        <tr style="background-color:#1e293b;font-weight:bold;color:#f8fafc;">
          <td colspan="3" style="padding:10px;">TOTAL GENERAL</td>
          <td style="padding:10px;text-align:right;color:#f87171;">${resumenOrdenes.total}</td>
        </tr>
      </table>` : `<div style="background-color:#0b0f19;border:1px dashed #2d3748;padding:12px;text-align:center;font-size:11px;border-radius:8px;color:#10b981;margin-bottom:20px;">No se registran órdenes pendientes</div>`}

      <!-- Trabajo Planificado -->
      <div style="color:#f8fafc;font-size:12px;font-weight:bold;margin-bottom:8px;">■ 2. Cumplimiento de Trabajo Planificado</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;overflow:hidden;font-size:11px;margin-bottom:20px;">
        <tr style="background-color:#1e293b;color:#f8fafc;">
          <td style="padding:10px;">Proceso</td>
          <td style="padding:10px;text-align:center;">Gr. planif</td>
          <td style="padding:10px;text-align:center;">Gr. planif.PM</td>
          <td style="padding:10px;text-align:right;">HH Plan.</td>
          <td style="padding:10px;text-align:right;">Sin HR</td>
          <td style="padding:10px;text-align:right;">Imprev.</td>
          <td style="padding:10px;text-align:right;">Total HH</td>
          <td style="padding:10px;text-align:center;width:80px;">%</td>
        </tr>
        ${(() => {
          let tpLastProceso = '';
          return trabajoPlanificado.grupos.map(g => {
            const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
            if (g.proceso) tpLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:9px 10px;color:#cbd5e1;font-weight:bold;">${showProceso}</td>
              <td style="padding:9px 10px;text-align:center;color:#cbd5e1;">${g.grPlanif}</td>
              <td style="padding:9px 10px;text-align:center;color:#64748b;">${g.grPlanifPM}</td>
              <td style="padding:9px 10px;text-align:right;color:#cbd5e1;">${formatValue(g.planificado)}</td>
              <td style="padding:9px 10px;text-align:right;color:${g.sinHr > 0 ? '#f87171' : '#64748b'};">${formatValue(g.sinHr)}</td>
              <td style="padding:9px 10px;text-align:right;color:${g.imprevistos > 0 ? '#f87171' : '#64748b'};">${formatValue(g.imprevistos)}</td>
              <td style="padding:9px 10px;font-weight:bold;text-align:right;color:#f8fafc;">${formatValue(g.total)}</td>
              <td style="padding:9px 10px;text-align:center;font-weight:bold;color:${g.cumplimiento >= 0.8 ? '#10b981' : '#f87171'};">${Math.round(g.cumplimiento*100)}%</td>
            </tr>
            `;
          }).join('');
        })()}
      </table>

      <!-- Programa Semanal -->
      <div style="color:#f8fafc;font-size:12px;font-weight:bold;margin-bottom:8px;">■ 3. Programa Semanal</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;overflow:hidden;font-size:11px;margin-bottom:20px;">
        <tr style="background-color:#1e293b;color:#f8fafc;font-size:10px;">
          <td style="padding:8px;">Proceso</td>
          <td style="padding:8px;text-align:center;">Gr. planif</td>
          <td style="padding:8px;text-align:center;">Gr. planif.PM</td>
          <td style="padding:8px;text-align:center;">✓</td>
          <td style="padding:8px;text-align:center;">✗</td>
          <td style="padding:8px;text-align:right;">%</td>
        </tr>
        ${(() => {
          let progLastProceso = '';
          return programaSemanal.grupos.map(g => {
            const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
            if (g.proceso) progLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:8px;color:#cbd5e1;font-weight:bold;">${showProceso}</td>
              <td style="padding:8px;color:#cbd5e1;text-align:center;">${g.grPlanif}</td>
              <td style="padding:8px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:8px;color:#10b981;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
              <td style="padding:8px;color:#f87171;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
              <td style="padding:8px;text-align:right;font-weight:bold;color:${g.cumplimiento >= 0.85 ? '#10b981' : '#f87171'};">${Math.round(g.cumplimiento*100)}%</td>
            </tr>
            `;
          }).join('');
        })()}
      </table>

      <!-- Plan Matriz -->
      <div style="color:#f8fafc;font-size:12px;font-weight:bold;margin-bottom:8px;">■ 4. Plan Matriz</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0f19;border:1px solid #2d3748;border-radius:8px;overflow:hidden;font-size:11px;margin-bottom:20px;">
        <tr style="background-color:#1e293b;color:#f8fafc;font-size:10px;">
          <td style="padding:8px;">Proceso</td>
          <td style="padding:8px;text-align:center;">Gr. planif</td>
          <td style="padding:8px;text-align:center;">Gr. planif.PM</td>
          <td style="padding:8px;text-align:center;">✓</td>
          <td style="padding:8px;text-align:center;">✗</td>
          <td style="padding:8px;text-align:right;">%</td>
        </tr>
        ${(() => {
          let matrizLastProceso = '';
          return planMatriz.grupos.map(g => {
            const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
            if (g.proceso) matrizLastProceso = g.proceso;
            return `
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:8px;color:#cbd5e1;font-weight:bold;">${showProceso}</td>
              <td style="padding:8px;color:#cbd5e1;text-align:center;">${g.grPlanif}</td>
              <td style="padding:8px;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
              <td style="padding:8px;color:#10b981;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
              <td style="padding:8px;color:#f87171;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
              <td style="padding:8px;text-align:right;font-weight:bold;color:${g.cumplimiento >= 0.85 ? '#10b981' : '#f87171'};">${Math.round(g.cumplimiento*100)}%</td>
            </tr>
            `;
          }).join('');
        })()}
      </table>

    </td>
  </tr>

  <!-- Acción Requerida Terminal -->
  <tr>
    <td style="padding:20px 32px 32px 32px;">
      <div style="background-color:#0b0f19;border:1px dashed #ef4444;border-radius:8px;padding:20px;">
        <div style="font-size:12.5px;color:#ef4444;line-height:1.65;font-family:monospace;">
          <strong style="color:#ef4444;">[ACTION_REQUIRED]:</strong><br>
          <span style="color:#f8fafc;">Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:#3b82f6;font-weight:bold;text-decoration:none;border-bottom:1px solid #3b82f6;">Francisco Toro</a> para su correspondiente revisión y validación.</span><br>
          <span style="display:inline-block;margin-top:8px;margin-bottom:15px;font-weight:bold;color:#f87171;">⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.</span>
          
          <!-- Botón Corporativo Premium de Cobre Destacado -->
          <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#bb5726">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">Ver Dashboard de KPIs</center>
            </v:roundrect>
            <![endif]-->
            <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
          </div>
        </div>
      </div>
    </td>
  </tr>

  <!-- Footer Moderno -->
  <tr>
    <td style="background-color:#0b0f19;padding:20px 32px;color:#475569;font-size:10px;border-top:1px solid #2d3748;text-align:center;">
      DATAMART · GSYS Mantenimiento DCH &nbsp;·&nbsp; Semana ${semana} &nbsp;·&nbsp; ${currentYear} &nbsp;·&nbsp; Generado por José Contreras
    </td>
  </tr>
</table>
</div>`;
}

// --- 5. PLANTILLA PREMIUM AZUL (INFOGRÁFICO CON GRANDES GRÁFICOS Y GRADIENTES) ---
function generateTemplate5(data) {
  const { semana, indicadores, resumenAvisos, resumenOrdenes, trabajoPlanificado, programaSemanal, planMatriz } = data;
  const currentYear = new Date().getFullYear();

  const colorTP = getBarColorTP(indicadores.trabajoPlanificado);
  const colorPS = getBarColorProgMatriz(indicadores.programaSemanal);
  const colorPM = getBarColorProgMatriz(indicadores.planMatriz);

  const wAvisos = Math.min(100, Math.max(2, (indicadores.avisosPendientes / 50) * 100));
  const wOrdenes = Math.min(100, Math.max(2, (indicadores.ordenesPendientes / 50) * 100));

  return `
<div style="background-color:#e0e7ff;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;margin:0 auto;background-color:#ffffff;border-radius:16px;box-shadow:0 15px 30px rgba(30,41,59,0.08);overflow:hidden;">
  
  <!-- Banner Infográfico con Gradiente Premium -->
  <tr>
    <td style="background:linear-gradient(135deg,#1e3a8a 0%,#0284c7 100%);padding:40px;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:15px;vertical-align:middle;">
                  <img src="https://www.codelco.com/prontus_codelco/site/artic/20220408/imag/foto_0000000120220408100923/logo.svg" style="height:32px;filter:brightness(0) invert(1);" alt="CODELCO" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="background-color:rgba(255,255,255,0.18);color:#93c5fd;font-size:10px;font-weight:bold;padding:4px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">
                    Monitoreo Corporativo DCH
                  </span>
                  <h1 style="margin:8px 0 0 0;font-size:26px;font-weight:bold;letter-spacing:-0.5px;color:#ffffff;">GSYS | Reporte Semanal KPI corporativo</h1>
                  <div style="color:#e2e8f0;font-size:12px;margin-top:4px;">Resultados y análisis de desviaciones semanales</div>
                </td>
              </tr>
            </table>
          </td>
          <td align="right" width="100" style="vertical-align:middle;">
            <div style="background-color:rgba(255,255,255,0.1);border-radius:50%;width:80px;height:80px;text-align:center;box-sizing:border-box;border:2px solid rgba(255,255,255,0.25);display:inline-block;">
              <div style="font-size:10px;color:#93c5fd;margin-top:18px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">SEM</div>
              <div style="font-size:26px;font-weight:bold;line-height:1;margin-top:2px;">${semana}</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Gráficos de Alto Impacto Visual en Sección Destacada -->
  <tr>
    <td style="padding:30px 40px 10px 40px;">
      <div style="font-size:12px;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:1px;margin-bottom:15px;">■ Panel Visual de Indicadores</div>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- TP -->
          <td width="33%" style="padding:0 6px 0 0;">
            <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px 15px;text-align:center;">
              <div style="font-size:10px;color:#1e40af;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Trabajo Planificado</div>
              <div style="font-size:26px;font-weight:bold;color:#1e3a8a;margin:8px 0 10px 0;">${indicadores.trabajoPlanificado}%</div>
              <div style="background-color:#dbeafe;height:8px;border-radius:4px;width:100%;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#2563eb,#3b82f6);height:8px;border-radius:4px;width:${indicadores.trabajoPlanificado}%;"></div>
              </div>
            </div>
          </td>
          <!-- PS -->
          <td width="33%" style="padding:0 3px;">
            <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 15px;text-align:center;">
              <div style="font-size:10px;color:#166534;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Programa Semanal</div>
              <div style="font-size:26px;font-weight:bold;color:#15803d;margin:8px 0 10px 0;">${indicadores.programaSemanal}%</div>
              <div style="background-color:#dcfce7;height:8px;border-radius:4px;width:100%;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#16a34a,#4ade80);height:8px;border-radius:4px;width:${indicadores.programaSemanal}%;"></div>
              </div>
            </div>
          </td>
          <!-- PM -->
          <td width="34%" style="padding:0 0 0 6px;">
            <div style="background-color:#fef9c3;border:1px solid #fef08a;border-radius:12px;padding:20px 15px;text-align:center;">
              <div style="font-size:10px;color:#854d0e;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Plan Matriz</div>
              <div style="font-size:26px;font-weight:bold;color:#a16207;margin:8px 0 10px 0;">${indicadores.planMatriz}%</div>
              <div style="background-color:#fef9c3;height:8px;border-radius:4px;width:100%;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#ca8a04,#facc15);height:8px;border-radius:4px;width:${indicadores.planMatriz}%;"></div>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Tablas Dinámicas Estilizadas como Tarjetas Premium -->
  <tr>
    <td style="padding:20px 40px;">
      
      <!-- Avisos Card -->
      <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 4px 6px rgba(30,41,59,0.02);">
        <div style="font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:12px;border-bottom:2px solid #3b82f6;padding-bottom:6px;">■ Avisos pendientes</div>
        ${resumenAvisos.total > 0 ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:11px;">
          <tr style="color:#64748b;font-weight:bold;font-size:10px;">
            <td style="padding:6px 0;">PROCESO MANTENIMIENTO</td>
            <td style="padding:6px 0;text-align:center;width:100px;">GR. PLANIF</td>
            <td style="padding:6px 0;text-align:center;width:100px;">GR.PM</td>
            <td style="padding:6px 0;text-align:right;width:80px;">AVISOS</td>
          </tr>
          ${resumenAvisos.distribucion.map(item => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 0;color:#334155;">${item.proceso}</td>
              <td style="padding:8px 0;text-align:center;color:#334155;">${item.grPlanif}</td>
              <td style="padding:8px 0;text-align:center;color:#334155;">${item.grPlanifPM}</td>
              <td style="padding:8px 0;text-align:right;font-weight:bold;color:#ef4444;">${item.cantidad}</td>
            </tr>
          `).join('')}
          <tr style="font-size:12px;font-weight:bold;color:#1e3a8a;">
            <td colspan="3" style="padding:10px 0 0 0;">TOTAL GENERAL DE AVISOS</td>
            <td style="padding:10px 0 0 0;text-align:right;color:#ef4444;">${resumenAvisos.total}</td>
          </tr>
        </table>` : `<div style="font-size:11px;color:#15803d;font-style:italic;">No hay avisos registrados en esta semana.</div>`}
      </div>

      <!-- Ordenes Card -->
      <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 4px 6px rgba(30,41,59,0.02);">
        <div style="font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:12px;border-bottom:2px solid #3b82f6;padding-bottom:6px;">■ Ordenes pendientes</div>
        ${resumenOrdenes.total > 0 ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:11px;">
          <tr style="color:#64748b;font-weight:bold;font-size:10px;">
            <td style="padding:6px 0;">PROCESO MANTENIMIENTO</td>
            <td style="padding:6px 0;text-align:center;width:100px;">GR. PLANIF</td>
            <td style="padding:6px 0;text-align:center;width:100px;">GR.PM</td>
            <td style="padding:6px 0;text-align:right;width:80px;">ÓRDENES</td>
          </tr>
          ${resumenOrdenes.distribucion.map(item => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 0;color:#334155;">${item.proceso}</td>
              <td style="padding:8px 0;text-align:center;color:#334155;">${item.grPlanif}</td>
              <td style="padding:8px 0;text-align:center;color:#334155;">${item.grPlanifPM}</td>
              <td style="padding:8px 0;text-align:right;font-weight:bold;color:#ef4444;">${item.cantidad}</td>
            </tr>
          `).join('')}
          <tr style="font-size:12px;font-weight:bold;color:#1e3a8a;">
            <td colspan="3" style="padding:10px 0 0 0;">TOTAL ÓRDENES EN BACKLOG</td>
            <td style="padding:10px 0 0 0;text-align:right;color:#ef4444;">${resumenOrdenes.total}</td>
          </tr>
        </table>` : `<div style="font-size:11px;color:#15803d;font-style:italic;">No hay órdenes registradas en backlog.</div>`}
      </div>

      <!-- Trabajo Planificado Card -->
      <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 4px 6px rgba(30,41,59,0.02);">
        <div style="font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:12px;border-bottom:2px solid #3b82f6;padding-bottom:6px;">■ 2. Cumplimiento de Trabajo Planificado</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:11px;">
          <tr style="color:#64748b;font-weight:bold;font-size:10px;">
            <td style="padding:6px 0;">PROCESO</td>
            <td style="padding:6px 0;text-align:center;">GR. PLANIF</td>
            <td style="padding:6px 0;text-align:center;">GR.PM</td>
            <td style="padding:6px 0;text-align:right;">HH PLAN</td>
            <td style="padding:6px 0;text-align:right;">SIN HR</td>
            <td style="padding:6px 0;text-align:right;">IMPREV</td>
            <td style="padding:6px 0;text-align:right;">TOTAL</td>
            <td style="padding:6px 0;text-align:center;width:70px;">% CUMP</td>
          </tr>
          ${(() => {
            let tpLastProceso = '';
            return trabajoPlanificado.grupos.map(g => {
              const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
              if (g.proceso) tpLastProceso = g.proceso;
              return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 0;color:#334155;font-weight:bold;">${showProceso}</td>
                <td style="padding:8px 0;text-align:center;color:#334155;">${g.grPlanif}</td>
                <td style="padding:8px 0;text-align:center;color:#64748b;">${g.grPlanifPM}</td>
                <td style="padding:8px 0;text-align:right;color:#334155;">${formatValue(g.planificado)}</td>
                <td style="padding:8px 0;text-align:right;color:${g.sinHr > 0 ? '#ef4444' : '#64748b'};">${formatValue(g.sinHr)}</td>
                <td style="padding:8px 0;text-align:right;color:${g.imprevistos > 0 ? '#ef4444' : '#64748b'};">${formatValue(g.imprevistos)}</td>
                <td style="padding:8px 0;font-weight:bold;text-align:right;color:#334155;">${formatValue(g.total)}</td>
                <td style="padding:8px 0;text-align:center;">${getBadgeTP(g.cumplimiento)}</td>
              </tr>
              `;
            }).join('');
          })()}
          <tr style="font-size:12px;font-weight:bold;color:#1e3a8a;">
            <td colspan="3" style="padding:10px 0 0 0;">TOTAL GENERAL</td>
            <td style="padding:10px 0 0 0;text-align:right;">${formatValue(trabajoPlanificado.total.planificado)}</td>
            <td style="padding:10px 0 0 0;text-align:right;color:#ef4444;">${formatValue(trabajoPlanificado.total.sinHr)}</td>
            <td style="padding:10px 0 0 0;text-align:right;color:#ef4444;">${formatValue(trabajoPlanificado.total.imprevistos)}</td>
            <td style="padding:10px 0 0 0;text-align:right;">${formatValue(trabajoPlanificado.total.total)}</td>
            <td style="padding:10px 0 0 0;text-align:center;">${getBadgeTP(trabajoPlanificado.total.cumplimiento)}</td>
          </tr>
        </table>
      </div>

      <!-- Programa Semanal Card -->
      <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 4px 6px rgba(30,41,59,0.02);margin-bottom:20px;">
        <div style="font-size:12px;font-weight:bold;color:#1e3a8a;margin-bottom:10px;border-bottom:2px solid #3b82f6;padding-bottom:4px;">■ 3. Programa Semanal</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:10.5px;">
          <tr style="color:#64748b;font-weight:bold;">
            <td style="padding:6px 0;">PROCESO</td>
            <td style="padding:6px 0;text-align:center;">GR. PLANIF</td>
            <td style="padding:6px 0;text-align:center;">GR.PM</td>
            <td style="padding:6px 0;text-align:center;">✓</td>
            <td style="padding:6px 0;text-align:center;">✗</td>
            <td style="padding:6px 0;text-align:right;">%</td>
          </tr>
          ${(() => {
            let progLastProceso = '';
            return programaSemanal.grupos.map(g => {
              const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
              if (g.proceso) progLastProceso = g.proceso;
              return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 0;color:#334155;font-weight:bold;">${showProceso}</td>
                <td style="padding:7px 0;color:#334155;text-align:center;">${g.grPlanif}</td>
                <td style="padding:7px 0;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
                <td style="padding:7px 0;color:#16a34a;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
                <td style="padding:7px 0;color:#ef4444;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
                <td style="padding:7px 0;text-align:right;">${getBadgeProgMatriz(g.cumplimiento)}</td>
              </tr>
              `;
            }).join('');
          })()}
        </table>
      </div>

      <!-- Plan Matriz Card -->
      <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 4px 6px rgba(30,41,59,0.02);margin-bottom:20px;">
        <div style="font-size:12px;font-weight:bold;color:#1e3a8a;margin-bottom:10px;border-bottom:2px solid #3b82f6;padding-bottom:4px;">■ 4. Plan Matriz</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:10.5px;">
          <tr style="color:#64748b;font-weight:bold;">
            <td style="padding:6px 0;">PROCESO</td>
            <td style="padding:6px 0;text-align:center;">GR. PLANIF</td>
            <td style="padding:6px 0;text-align:center;">GR.PM</td>
            <td style="padding:6px 0;text-align:center;">✓</td>
            <td style="padding:6px 0;text-align:center;">✗</td>
            <td style="padding:6px 0;text-align:right;">%</td>
          </tr>
          ${(() => {
            let matrizLastProceso = '';
            return planMatriz.grupos.map(g => {
              const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
              if (g.proceso) matrizLastProceso = g.proceso;
              return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 0;color:#334155;font-weight:bold;">${showProceso}</td>
                <td style="padding:7px 0;color:#334155;text-align:center;">${g.grPlanif}</td>
                <td style="padding:7px 0;color:#64748b;text-align:center;">${g.grPlanifPM}</td>
                <td style="padding:7px 0;color:#16a34a;font-weight:bold;text-align:center;">${formatValue(g.cumple)}</td>
                <td style="padding:7px 0;color:#ef4444;font-weight:bold;text-align:center;">${formatValue(g.noCumple)}</td>
                <td style="padding:7px 0;text-align:right;">${getBadgeProgMatriz(g.cumplimiento)}</td>
              </tr>
              `;
            }).join('');
          })()}
        </table>
      </div>

    </td>
  </tr>

  <!-- Nota Premium -->
  <tr>
    <td style="padding:10px 40px 30px 40px;">
      <div style="background-color:#eff6ff;border-radius:12px;padding:20px;border:1px solid #bfdbfe;">
        <div style="font-size:12.5px;color:#1e3a8a;line-height:1.6;">
          <p style="margin:0 0 10px 0;">
            Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:#2563eb;font-weight:bold;text-decoration:none;border-bottom:1px solid #2563eb;">Francisco Toro</a> para su correspondiente revisión y validación.
          </p>
          <p style="margin:0 0 15px 0;color:#b91c1c;font-weight:bold;">
            ⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.
          </p>
          
          <!-- Botón Corporativo Premium de Cobre Destacado -->
          <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#bb5726">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">Ver Dashboard de KPIs</center>
            </v:roundrect>
            <![endif]-->
            <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
          </div>
        </div>
      </div>
    </td>
  </tr>

  <!-- Footer Infográfico -->
  <tr>
    <td style="background-color:#1e293b;padding:25px 40px;color:#94a3b8;font-size:11px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <strong>DATAMART · GSYS Mantenimiento DCH</strong><br>
            Semana ${semana} &nbsp;·&nbsp; ${currentYear} &nbsp;·&nbsp; Informe generado por <a href="mailto:jose.contreras@monitoring.cl" style="color:#38bdf8;text-decoration:none;font-weight:bold;">José Contreras</a>
          </td>
          <td align="right" style="vertical-align:middle;color:#64748b;font-weight:bold;">
            Monitoring SPA
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</div>`;
}

// --- 6. PLANTILLA CODELCO CORPORATIVO (ESTILO CORPORATIVO OSCURO CON COLORES OFICIALES) ---
/**
 * Genera el HTML de la plantilla 6 (CODELCO Corporativo) con una estética premium de alta fidelidad,
 * cabecera Teal (#209eb0), logotipo oficial en blanco, alternancia inteligente de color (#2c73b5)
 * en indicadores superiores para evitar repeticiones de Teal y tablas de 3 columnas en escala de grises.
 */
function generateTemplate6(data) {
  const { semana, indicadores, resumenAvisos, resumenOrdenes, trabajoPlanificado, programaSemanal, planMatriz } = data;
  const currentYear = new Date().getFullYear();

  // Colores de Codelco oficiales
  const codelcoCopper = '#bb5726';
  const codelcoGold = '#f4a700';
  const codelcoOrange = '#e96c28';
  const codelcoTeal = '#209eb0';
  const codelcoBlue = '#2c73b5'; // Azul corporativo para deduplicación
  const codelcoDark = '#334155'; // Gris pizarra profesional para partes oscuras de tablas/footer

  // Lógica de colores dinámicos oficiales Codelco
  const getCodelcoColorTP = (percentage) => {
    const tpTarget = data.email_settings?.tp_target || 80;
    if (percentage >= tpTarget) return '#1a6b3a'; // Verde
    if (percentage >= tpTarget - 10) return '#e8a020'; // Amarillo
    return '#c0392b'; // Rojo
  };

  const getCodelcoColorProgMatriz = (percentage) => {
    const pmTarget = data.email_settings?.pm_target || 85;
    if (percentage >= pmTarget) return '#1a6b3a'; // Verde
    if (percentage >= pmTarget - 10) return '#e8a020'; // Amarillo
    return '#c0392b'; // Rojo
  };

  const getCodelcoColorProgSemanal = (percentage) => {
    const psTarget = data.email_settings?.ps_target || 85;
    if (percentage >= psTarget) return '#1a6b3a'; // Verde
    if (percentage >= psTarget - 10) return '#e8a020'; // Amarillo
    return '#c0392b'; // Rojo
  };

  const getCodelcoColorAvisos = (count) => {
    const avTarget = data.email_settings?.avisos_target || 10;
    if (count === 0) return '#1a6b3a'; // Verde si es 0
    if (count < avTarget) return '#e8a020'; // Amarillo si < target
    return '#c0392b'; // Rojo si >= target
  };

  const getCodelcoColorOrdenes = (count) => {
    const ordTarget = data.email_settings?.ordenes_target || 10;
    if (count === 0) return '#1a6b3a'; // Verde si es 0
    if (count < ordTarget) return '#e8a020'; // Amarillo si < target
    return '#c0392b'; // Rojo si >= target
  };

  const getCodelcoBgColor = (color) => {
    if (color === '#c0392b') return '#f5e6e6'; // Fondo rojo claro
    if (color === '#e8a020') return '#fef5e6'; // Fondo amarillo claro
    if (color === '#1a6b3a') return '#e6f4f0'; // Fondo verde claro
    if (color === codelcoBlue) return '#eaf2fa';
    return '#e0f4f7';
  };

  // String concatenation pura sin comillas invertidas para evitar errores de sintaxis en Node.js
  const getCodelcoBadgeTP = (value) => {
    const percentage = value * 100;
    const color = getCodelcoColorTP(percentage);
    const bg = getCodelcoBgColor(color);
    const formatted = (percentage % 1 === 0) ? (Math.round(percentage) + '%') : (percentage.toFixed(1) + '%');
    return '<span style="background-color:' + bg + ';color:' + color + ';font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">' + formatted + '</span>';
  };

  const getCodelcoBadgeProgMatriz = (value) => {
    const percentage = value * 100;
    const color = getCodelcoColorProgMatriz(percentage);
    const bg = getCodelcoBgColor(color);
    const formatted = (percentage % 1 === 0) ? (Math.round(percentage) + '%') : (percentage.toFixed(1) + '%');
    return '<span style="background-color:' + bg + ';color:' + color + ';font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">' + formatted + '</span>';
  };

  /**
   * Genera el badge de cumplimiento para el Programa Semanal con el color dorado corporativo fijo (#f4a700).
   */
  const getCodelcoBadgeProgSemanal = (value) => {
    const percentage = value * 100;
    const color = codelcoGold; // #f4a700
    const bg = '#fef5e6'; // Fondo claro oficial para el dorado
    const formatted = (percentage % 1 === 0) ? (Math.round(percentage) + '%') : (percentage.toFixed(1) + '%');
    return '<span style="background-color:' + bg + ';color:' + color + ';font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">' + formatted + '</span>';
  };

  // Colores iniciales
  let colorTP = getCodelcoColorTP(indicadores.trabajoPlanificado);
  let colorPS = getCodelcoColorProgSemanal(indicadores.programaSemanal);
  let colorPM = getCodelcoColorProgMatriz(indicadores.planMatriz);
  let colorAvisos = getCodelcoColorAvisos(indicadores.avisosPendientes);
  let colorOrdenes = getCodelcoColorOrdenes(indicadores.ordenesPendientes);

  // Lógica de evitación de redundancia cromática: si todos son iguales, diversificar sin afectar lógica de umbrales
  // (Actualmente no aplicable con ROJO/AMARILLO/VERDE que se asignan por rangos específicos)

  // Tablas en tonos grises sutiles con 3 columnas (Proceso, Gr. planif, Gr. planif.PM)
  // Se oculta el proceso repetido (celdas combinadas de Excel) para dar limpieza visual
  let tpLastProceso = '';
  const tpRowsHtml = trabajoPlanificado.grupos.map(g => {
    const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
    if (g.proceso) {
      tpLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;">${showProceso}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${g.grPlanif}</td>
      <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;">${g.grPlanifPM}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.planificado)}</td>
      <td style="padding:9px 8px;font-size:11px;color:${g.sinHr > 0 ? codelcoOrange : '#64748b'};border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.sinHr)}</td>
      <td style="padding:9px 8px;font-size:11px;color:${g.imprevistos > 0 ? codelcoOrange : '#64748b'};border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.imprevistos)}</td>
      <td style="padding:9px 8px;font-size:11px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">${formatValue(g.total)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${getCodelcoBadgeTP(g.cumplimiento)}</td>
    </tr>
    `;
  }).join('');

  let progLastProceso = '';
  const progRowsHtml = programaSemanal.grupos.map(g => {
    const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
    if (g.proceso) {
      progLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:8px 10px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;font-weight:bold;">${showProceso}</td>
      <td style="padding:8px 6px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:center;">${g.grPlanif}</td>
      <td style="padding:8px 6px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">${g.grPlanifPM}</td>
      <td style="padding:8px 6px;font-size:11px;color:#1e293b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">${formatValue(g.cumple)}</td>
      <td style="padding:8px 6px;font-size:11px;color:#64748b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">${formatValue(g.noCumple)}</td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #f1f5f9;">${getCodelcoBadgeProgSemanal(g.cumplimiento)}</td>
    </tr>
    `;
  }).join('');

  let matrizLastProceso = '';
  const matrizRowsHtml = planMatriz.grupos.map(g => {
    const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
    if (g.proceso) {
      matrizLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:8px 10px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;font-weight:bold;">${showProceso}</td>
      <td style="padding:8px 6px;font-size:11px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:center;">${g.grPlanif}</td>
      <td style="padding:8px 6px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">${g.grPlanifPM}</td>
      <td style="padding:8px 6px;font-size:11px;color:#1e293b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">${formatValue(g.cumple)}</td>
      <td style="padding:8px 6px;font-size:11px;color:#64748b;font-weight:bold;text-align:center;border-bottom:1px solid #f1f5f9;">${formatValue(g.noCumple)}</td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #f1f5f9;">${getCodelcoBadgeProgMatriz(g.cumplimiento)}</td>
    </tr>
    `;
  }).join('');

  const avisosTableHtml = resumenAvisos.total > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
      <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.Planif</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.planif.PM</td>
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Avisos</td>
      </tr>
      ${resumenAvisos.distribucion.map(item => `
        <tr>
          <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;">${item.proceso}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${item.grPlanif}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${item.grPlanifPM}</td>
          <td style="padding:9px 12px;font-size:11px;font-weight:bold;color:#ef4444;border-bottom:1px solid #e2e8f0;text-align:center;">${item.cantidad}</td>
        </tr>
      `).join('')}
      <tr style="background-color:${codelcoCopper};">
        <td colspan="3" style="padding:11px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 12px;text-align:center;"><span style="background-color:#cbd5e1;color:#1e293b;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;">${resumenAvisos.total}</span></td>
      </tr>
    </table>` : `
    <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
      <div style="font-size:20px;margin-bottom:8px;">🎉</div>
      <div style="color:#0f6b3a;font-size:12px;font-weight:bold;">¡Excelente!</div>
      <div style="color:#334155;font-size:11px;margin-top:4px;">No hay avisos pendientes en este periodo.</div>
    </div>`;

  const ordenesTableHtml = resumenOrdenes.total > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:10px;">
      <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. Planif</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr.planif.PM</td>
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Órdenes</td>
      </tr>
      ${resumenOrdenes.distribucion.map(item => `
        <tr>
          <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;">${item.proceso}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${item.grPlanif}</td>
          <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;">${item.grPlanifPM}</td>
          <td style="padding:9px 12px;font-size:11px;font-weight:bold;color:#ef4444;border-bottom:1px solid #e2e8f0;text-align:center;">${item.cantidad}</td>
        </tr>
      `).join('')}
      <tr style="background-color:${codelcoCopper};">
        <td colspan="3" style="padding:11px 12px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 12px;text-align:center;"><span style="background-color:#cbd5e1;color:#1e293b;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;">${resumenOrdenes.total}</span></td>
      </tr>
    </table>` : `
    <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:10px;">
      <div style="font-size:20px;margin-bottom:8px;">🎯</div>
      <div style="color:#0f6b3a;font-size:12px;font-weight:bold;">¡Objetivo cumplido!</div>
      <div style="color:#334155;font-size:11px;margin-top:4px;">No hay órdenes pendientes en este periodo.</div>
    </div>`;

  const wAvisos = Math.min(100, Math.max(2, (indicadores.avisosPendientes / 50) * 100));
  const wOrdenes = Math.min(100, Math.max(2, (indicadores.ordenesPendientes / 50) * 100));

  // Botón Corporativo Premium Destacado
  const notaDestacadaHtml = `
  <tr>
    <td style="background-color:#ffffff;padding:24px 24px 10px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fdf0eb;border-left:4px solid ${codelcoCopper};border-radius:0 8px 8px 0;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;border-right:1px solid #cbd5e1;">
        <tr>
          <td style="padding:16px 20px;">
            <div style="font-size:12.5px;color:#334155;line-height:1.6;font-family:Calibri,Arial,sans-serif;">
              <p style="margin:0 0 12px 0;">
                Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Asimismo, se solicita enviar HOY el plan de acción a <a href="mailto:FToro007@codelco.cl" style="color:${codelcoCopper};font-weight:bold;text-decoration:underline;">Francisco Toro</a> para su correspondiente revisión y validación.
              </p>
              <p style="margin:0 0 15px 0;color:${codelcoOrange};font-weight:bold;font-style:italic;">
                ⚠️ Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.
              </p>
              
              <!-- Botón Corporativo Premium de Cobre Destacado -->
              <div style="text-align: center; margin-top: 15px; margin-bottom: 5px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#bb5726">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">Ver Dashboard de KPIs</center>
                </v:roundrect>
                <![endif]-->
                <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc&openReportSource=SubscribeOthers&experience=power-bi" style="background-color:#bb5726;background:linear-gradient(180deg, #bb5726 0%, #9e431b 100%);color:#ffffff;display:inline-block;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;line-height:42px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.2);border-top:1px solid #d46f3a;">Ver Dashboard de KPIs</a>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return `
<div style="background-color:#f8fafc;padding:30px 0;font-family:Calibri,Arial,sans-serif;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;margin:0 auto;box-shadow:0 10px 30px rgba(51,65,85,0.06);border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
 
<!-- Encabezado en Tono Teal Corporativo Premium con Logotipo Blanco de Alto Contraste -->
<tr>
  <td style="background-color:${codelcoTeal};padding:32px;border-bottom:4px solid ${codelcoCopper};">
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
            <div style="font-size:9px;color:${codelcoTeal};font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">SEMANA</div>
            <div style="font-size:32px;color:${codelcoTeal};font-weight:bold;line-height:1.1;">${semana}</div>
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
        <!-- Cajas de Indicadores a todo color con Deduplicación cromática aplicada -->
        <td width="19%" style="padding:4px;">
          <div style="background-color:${colorAvisos};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.15);">
            <div style="font-size:20px;">⚠️</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.avisosPendientes}</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Avisos</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.avisosPendientes===0?0:wAvisos}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="19%" style="padding:4px;">
          <div style="background-color:${colorOrdenes};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.15);">
            <div style="font-size:20px;">📋</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.ordenesPendientes}</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Órdenes</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.ordenesPendientes===0?0:wOrdenes}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="20%" style="padding:4px;">
          <div style="background-color:${colorTP};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
            <div style="font-size:20px;">📈</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.trabajoPlanificado}%</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Trab. Plan.</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.trabajoPlanificado}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="20%" style="padding:4px;">
          <div style="background-color:${colorPS};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
            <div style="font-size:20px;">✅</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.programaSemanal}%</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Prog. Sem.</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.programaSemanal}%;border-radius:2px;"></div></div>
          </div>
        </td>
        <td width="22%" style="padding:4px;">
          <div style="background-color:${colorPM};border-radius:8px;padding:14px 8px;text-align:center;color:#ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
            <div style="font-size:20px;">📄</div>
            <div style="font-size:24px;font-weight:bold;margin:4px 0;line-height:1;">${indicadores.planMatriz}%</div>
            <div style="font-size:8.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;opacity:0.9;">Plan Matriz</div>
            <div style="background-color:rgba(255,255,255,0.3);height:3px;border-radius:2px;margin-top:8px;"><div style="background-color:#ffffff;height:3px;width:${indicadores.planMatriz}%;border-radius:2px;"></div></div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
 
<!-- Tablas en Tonos Grises Profesionales -->
<tr>
  <td style="background-color:#ffffff;padding:10px 24px 16px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;">■ Avisos pendientes</div>
    ${avisosTableHtml}
    
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;margin-top:20px;">■ Ordenes pendientes</div>
    ${ordenesTableHtml}
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
      ${tpRowsHtml}
      <tr style="background-color:${codelcoCopper};">
        <td colspan="3" style="padding:11px 12px;font-size:12px;font-weight:bold;color:#ffffff;">TOTAL GENERAL</td>
        <td style="padding:11px 8px;font-size:11px;color:#cbd5e1;text-align:right;">${formatValue(trabajoPlanificado.total.planificado)}</td>
        <td style="padding:11px 8px;font-size:11px;color:#fca5a5;text-align:right;">${formatValue(trabajoPlanificado.total.sinHr)}</td>
        <td style="padding:11px 8px;font-size:11px;color:#fca5a5;text-align:right;">${formatValue(trabajoPlanificado.total.imprevistos)}</td>
        <td style="padding:11px 8px;font-size:12px;font-weight:bold;color:#ffffff;text-align:right;">${formatValue(trabajoPlanificado.total.total)}</td>
        <td style="padding:11px 12px;text-align:center;">${getCodelcoBadgeTP(trabajoPlanificado.total.cumplimiento)}</td>
      </tr>
    </table>
  </td>
</tr>
 
<tr>
  <td style="background-color:#ffffff;padding:10px 24px 26px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;">■ 3. Programa Semanal</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✓</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✗</td>
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
      </tr>
      ${progRowsHtml}
      <tr style="background-color:${codelcoCopper};">
        <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#a7f3d0;text-align:center;">${formatValue(programaSemanal.total.cumple)}</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#fca5a5;text-align:center;">${formatValue(programaSemanal.total.noCumple)}</td>
        <td style="padding:9px 10px;text-align:center;">${getCodelcoBadgeProgSemanal(programaSemanal.total.cumplimiento)}</td>
      </tr>
    </table>

    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:bold;margin-bottom:12px;margin-top:10px;">■ 4. Plan Matriz</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;">Proceso</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">Gr. planif.PM</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✓</td>
        <td style="padding:8px 6px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">✗</td>
        <td style="padding:8px 10px;font-size:10px;font-weight:bold;color:#475569;text-align:center;">%</td>
</tr>
      ${matrizRowsHtml}
      <tr style="background-color:${codelcoCopper};">
        <td colspan="3" style="padding:9px 10px;font-size:11px;font-weight:bold;color:#ffffff;">TOTAL</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#a7f3d0;text-align:center;">${formatValue(planMatriz.total.cumple)}</td>
        <td style="padding:9px 6px;font-size:12px;font-weight:bold;color:#fca5a5;text-align:center;">${formatValue(planMatriz.total.noCumple)}</td>
        <td style="padding:9px 10px;text-align:center;">${getCodelcoBadgeProgMatriz(planMatriz.total.cumplimiento)}</td>
      </tr>
    </table>
  </td>
</tr>

${notaDestacadaHtml}
 
<tr><td style="background-color:#f8fafc;height:20px;">&nbsp;</td></tr>
<tr>
  <td style="background-color:#1e293b;padding:25px 40px;color:#94a3b8;font-size:11px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
              <td>
          <strong>DATAMART · GSYS Mantenimiento DCH</strong><br>
          Semana ${semana} &nbsp;·&nbsp; ${currentYear} &nbsp;·&nbsp; Informe generado por <a href="mailto:jose.contreras@monitoring.cl" style="color:#38bdf8;text-decoration:none;font-weight:bold;">José Contreras</a>
        </td>
        <td align="right" style="vertical-align:middle;color:#64748b;font-weight:bold;">
          Monitoring SPA
        </td>
      </tr>
    </table>
  </td>
</tr>
</table>
</div>
`;
}

/**
 * Genera la plantilla 7 (CODELCO Corporativo Tradicional) compatible con motores HTML antiguos (como Outlook de escritorio antiguos).
 * Utiliza tablas tradicionales y estilos en línea simplificados, evitando floats y flexbox.
 */
function generateTemplate7(data) {
  // Comentario oculto con crédito solicitado
  const creditComment = "<!-- Creado por José Contreras Luna (jose.contreras@minitoring.cl) -->";

  const semana = data.semana || 0;
  const indicadores = data.indicadores || {};
  const resumenAvisos = data.resumenAvisos || {};
  const resumenOrdenes = data.resumenOrdenes || {};
  const trabajoPlanificado = data.trabajoPlanificado || {};
  const programaSemanal = data.programaSemanal || {};
  const planMatriz = data.planMatriz || {};

  // Obtener configuraciones de correo dinámicas
  const email_settings = data.email_settings || {};
  const header_tag = email_settings.header_tag || "■ &nbsp; DIVISIÓN CHUQUICAMATA &nbsp;·&nbsp; GSYS MANTENIMIENTO";
  const title = email_settings.title || "Reporte Semanal de KPIs Corporativos";
  const subtitle = email_settings.subtitle || "Sistema de Gestión & Mantenimiento Industrial";
  const body_p1 = email_settings.body_p1 || "Favor revisar la información y proceder de acuerdo con el flujograma establecido por directriz. Se solicita enviar HOY el plan de acción a Francisco Toro para su correspondiente revisión y validación.";
  const body_p2 = email_settings.body_p2 || "⚠️  Se enfatiza la importancia de generar oportunamente el plan, con el objetivo de corregir de manera inmediata las desviaciones detectadas.";
  const generado_nombre = email_settings.generado_nombre || "José Contreras Luna";
  const generado_email = email_settings.generado_email || "jose.contreras@monitoring.cl";

  // Thresholds desde email_settings con defaults
  const avisos_target = parseInt(email_settings.avisos_target) || 10;
  const ordenes_target = parseInt(email_settings.ordenes_target) || 10;
  const tp_target = parseInt(email_settings.tp_target) || 80;
  const ps_target = parseInt(email_settings.ps_target) || 85;
  const pm_target = parseInt(email_settings.pm_target) || 85;

  const currentYear = new Date().getFullYear();

  // Colores: ROJO (#c0392b), AMARILLO (#e8a020), VERDE (#1a6b3a)
  function getColorAvisos(val) {
    if (val <= avisos_target) return '#1a6b3a';
    if (val <= avisos_target + 10) return '#e8a020';
    return '#c0392b';
  }

  function getColorOrdenes(val) {
    if (val <= ordenes_target) return '#1a6b3a';
    if (val <= ordenes_target + 10) return '#e8a020';
    return '#c0392b';
  }

  function getColorTP(val) {
    if (val >= tp_target) return '#1a6b3a';
    if (val >= tp_target - 10) return '#e8a020';
    return '#c0392b';
  }

  function getColorProgMatriz(val) {
    if (val >= pm_target) return '#1a6b3a';
    if (val >= pm_target - 10) return '#e8a020';
    return '#c0392b';
  }

  function getColorProgSemanal(val) {
    if (val >= ps_target) return '#1a6b3a';
    if (val >= ps_target - 10) return '#e8a020';
    return '#c0392b';
  }

  function getBgLight(color) {
    if (color === '#c0392b') return '#fde8e8';
    if (color === '#e8a020') return '#fef5e0';
    return '#e6f7ed';
  }

  function getStatusIcon(val, isInverse) {
    if (isInverse) {
      if (val === 0) return '&#10003;';
      if (val < (isInverse === 'avisos' ? avisos_target : ordenes_target)) return '&#9888;';
      return '&#10007;';
    }
    if (val >= tp_target || val >= ps_target) return '&#10003;';
    if (val >= tp_target - 10 || val >= ps_target - 10) return '&#9888;';
    return '&#10007;';
  }

  // Thresholds para badges
  const tp_pct = Math.round(indicadores.trabajoPlanificado || 0);
  const ps_pct = Math.round(indicadores.programaSemanal || 0);
  const pm_pct = Math.round(indicadores.planMatriz || 0);
  const avisos_val = indicadores.avisosPendientes || 0;
  const ordenes_val = indicadores.ordenesPendientes || 0;

  const colorAvisos = getColorAvisos(avisos_val);
  const colorOrdenes = getColorOrdenes(ordenes_val);
  const colorTP = getColorTP(tp_pct);
  const colorPS = getColorProgSemanal(ps_pct);
  const colorPM = getColorProgMatriz(pm_pct);

  function getBadgeTP(value) {
    const pct = value * 100;
    const c = getColorTP(pct);
    const bg = getBgLight(c);
    const formatted = (pct % 1 === 0) ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
    return `<span style="background-color:${bg};color:${c};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">${formatted}</span>`;
  }

  function getBadgeProgMatriz(value) {
    const pct = value * 100;
    const c = getColorProgMatriz(pct);
    const bg = getBgLight(c);
    const formatted = (pct % 1 === 0) ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
    return `<span style="background-color:${bg};color:${c};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">${formatted}</span>`;
  }

  function getBadgeProgSemanal(value) {
    const pct = value * 100;
    const c = getColorProgSemanal(pct);
    const bg = getBgLight(c);
    const formatted = (pct % 1 === 0) ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
    return `<span style="background-color:${bg};color:${c};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">${formatted}</span>`;
  }

  function getStatusIconForVal(val, target, higherIsBetter) {
    if (higherIsBetter) {
      if (val >= target) return '&#10003;';
      if (val >= target - 10) return '&#9888;';
      return '&#10007;';
    }
    if (val <= target) return '&#10003;';
    if (val <= target + 10) return '&#9888;';
    return '&#10007;';
  }

  // Trabajo Planificado Rows
  let tpLastProceso = '';
  const tp_rows_html = (trabajoPlanificado.grupos || []).map((g) => {
    const showProceso = (g.proceso !== tpLastProceso) ? g.proceso : '';
    if (g.proceso) {
      tpLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">${showProceso}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${g.grPlanif || ''}</td>
      <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${data.use_pto_trabajo ? (g.ptoTrabajo || '') : (g.grPlanifPM || '')}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">${formatValue(g.planificado)}</td>
      <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">${formatValue(g.sinHr)}</td>
      <td style="padding:9px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">${formatValue(g.imprevistos)}</td>
      <td style="padding:9px 8px;font-size:11px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">${formatValue(g.total)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${getBadgeTP(g.cumplimiento || 0)}</td>
    </tr>
    `;
  }).join('') || '';

  // Programa Semanal Rows
  let progLastProceso = '';
  const prog_rows_html = (programaSemanal.grupos || []).map((g) => {
    const showProceso = (g.proceso !== progLastProceso) ? g.proceso : '';
    if (g.proceso) {
      progLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">${showProceso}</td>
      <td style="padding:8px 4px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${g.grPlanif || ''}</td>
      <td style="padding:8px 4px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${data.use_pto_trabajo ? (g.ptoTrabajo || '') : (g.grPlanifPM || '')}</td>
      <td style="padding:8px 4px;font-size:11px;color:#1a6b3a;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${formatValue(g.cumple)}</td>
      <td style="padding:8px 4px;font-size:11px;color:#cbd5e1;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${formatValue(g.noCumple)}</td>
      <td style="padding:8px 6px;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${getBadgeProgMatriz(g.cumplimiento || 0)}</td>
    </tr>
    `;
  }).join('') || '';

  // Plan Matriz Rows
  let matrizLastProceso = '';
  const matriz_rows_html = (planMatriz.grupos || []).map((g) => {
    const showProceso = (g.proceso !== matrizLastProceso) ? g.proceso : '';
    if (g.proceso) {
      matrizLastProceso = g.proceso;
    }
    return `
    <tr>
      <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">${showProceso}</td>
      <td style="padding:8px 4px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${g.grPlanif || ''}</td>
      <td style="padding:8px 4px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${data.use_pto_trabajo ? (g.ptoTrabajo || '') : (g.grPlanifPM || '')}</td>
      <td style="padding:8px 4px;font-size:11px;color:#1a6b3a;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${formatValue(g.cumple)}</td>
      <td style="padding:8px 4px;font-size:11px;color:#cbd5e1;font-weight:bold;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${formatValue(g.noCumple)}</td>
      <td style="padding:8px 6px;text-align:center;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${getBadgeProgMatriz(g.cumplimiento || 0)}</td>
    </tr>
    `;
  }).join('') || '';

  // Avisos Table
  let avisosTableHtml = '';
  if (resumenAvisos.total > 0) {
    const distRows = (resumenAvisos.distribucion || []).map(item => `
      <tr>
        <td style="padding:8px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${item.proceso || ''}</td>
        <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${item.grPlanif || ''}</td>
        <td style="padding:8px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${data.use_pto_trabajo ? (item.ptoTrabajo || '') : (item.grPlanifPM || '')}</td>
        <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#c62828;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${item.cantidad || 0}</td>
      </tr>
    `).join('');
    
    avisosTableHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:20px;">
        <tr style="background-color:#f1f5f9;border-bottom:1px solid #cbd5e1;">
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;font-family:Arial,sans-serif;">Proceso Mantenimiento</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;font-family:Arial,sans-serif;">Gr.Planif</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;font-family:Arial,sans-serif;">Gr.planif.PM</td>
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;font-family:Arial,sans-serif;">Cantidad</td>
        </tr>
        ${distRows}
        <tr style="background-color:#E55302;">
          <td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">TOTAL GENERAL</td>
          <td style="padding:10px 12px;text-align:center;color:#ffffff;font-weight:bold;font-size:11px;font-family:Arial,sans-serif;">${resumenAvisos.total || 0}</td>
        </tr>
      </table>
    `;
  } else {
    avisosTableHtml = `
      <table width="100%" cellpadding="15" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px dashed #cbd5e1;background-color:#fdf5f2;text-align:center;margin-bottom:20px;">
        <tr>
          <td style="font-family:Arial,sans-serif;color:#9a3210;font-size:11px;font-weight:bold;">
            ⚠️ No hay avisos pendientes en este período.
          </td>
        </tr>
      </table>
    `;
  }

  // Órdenes
  let ordenesTableHtml = '';
  if (resumenOrdenes.total > 0) {
    const distRows = (resumenOrdenes.distribucion || []).map(item => `
      <tr>
        <td style="padding:8px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">${item.proceso || ''}</td>
        <td style="padding:8px 8px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${item.grPlanif || ''}</td>
        <td style="padding:8px 8px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${data.use_pto_trabajo ? (item.ptoTrabajo || '') : (item.grPlanifPM || '')}</td>
        <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#c62828;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${item.cantidad || 0}</td>
      </tr>
    `).join('');
    
    ordenesTableHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:10px;">
        <tr style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;font-family:Arial,sans-serif;">Proceso Mantenimiento</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;font-family:Arial,sans-serif;">Gr.Planif</td>
          <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;font-family:Arial,sans-serif;">Gr.planif.PM</td>
          <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#475569;text-align:center;font-family:Arial,sans-serif;">Cantidad</td>
        </tr>
        ${distRows}
        <tr style="background-color:#E55302;">
          <td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">TOTAL GENERAL</td>
          <td style="padding:10px 12px;text-align:center;color:#ffffff;font-weight:bold;font-size:11px;font-family:Arial,sans-serif;">${resumenOrdenes.total || 0}</td>
        </tr>
      </table>
    `;
  } else {
    ordenesTableHtml = `
      <table width="100%" cellpadding="15" cellspacing="0" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;border:1px dashed #cbd5e1;background-color:#fdf5f2;text-align:center;margin-bottom:10px;">
        <tr>
          <td style="font-family:Arial,sans-serif;color:#9a3210;font-size:11px;font-weight:bold;">
            ⚠️ No hay órdenes pendientes en este período.
          </td>
        </tr>
      </table>
    `;
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  ${creditComment}
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>GSYS | Reporte Semanal KPI Corporativo</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .outlook-fix { display: block !important; }
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
 
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8edf2" style="background-color:#e8edf2;">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background-color:#ffffff;" bgcolor="#ffffff">

        <tr>
          <td height="4" bgcolor="#1a8fa0" style="font-size:0;line-height:0;background-color:#1a8fa0;">&nbsp;</td>
        </tr>

        <tr>
          <td bgcolor="#0d7a8c" style="padding:0;background-color:#0d7a8c;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="72" align="center" valign="middle" bgcolor="#0b6b7c" style="padding:22px 0;background-color:#0b6b7c;">
                  <div style="width:44px;height:44px;background-color:#bb5726;margin:0 auto;"></div>
                </td>

                <td valign="middle" style="padding:18px 16px 18px 12px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#7fd8e8;letter-spacing:2px;font-weight:bold;text-transform:uppercase;padding-bottom:4px;">
                        ${header_tag}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;line-height:1.2;padding-bottom:3px;">
                        ${title}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a8dde8;">
                        ${subtitle}
                      </td>
                    </tr>
                  </table>
                </td>

                <td align="right" valign="middle" style="padding:18px 20px 18px 0;white-space:nowrap;">
                  <table cellpadding="0" cellspacing="0" border="0" align="right">
                    <tr>
                      <td align="center" bgcolor="#bb5726" style="padding:4px 0 2px 0;background-color:#bb5726;width:64px;">
                        <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffd4b8;letter-spacing:2px;text-transform:uppercase;text-align:center;">SEMANA</div>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" bgcolor="#ffffff" style="padding:4px 0 6px 0;background-color:#ffffff;width:64px;">
                        <div style="font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:bold;color:#0d7a8c;line-height:1;text-align:center;">${semana}</div>
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

        <tr>
          <td height="3" bgcolor="#bb5726" style="font-size:0;line-height:0;background-color:#bb5726;">&nbsp;</td>
        </tr>

        <tr>
          <td bgcolor="#f8fafc" style="padding:0;background-color:#f8fafc;">
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

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:8px 16px 20px 16px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid ${colorAvisos};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">⚠️</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:${colorAvisos};line-height:1;">${avisos_val}</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 2px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#666;line-height:1;">Target: ${avisos_target}</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="${colorAvisos}" style="padding:5px;background-color:${colorAvisos};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">AVISOS</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid ${colorOrdenes};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">📋</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:${colorOrdenes};line-height:1;">${ordenes_val}</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 2px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#666;line-height:1;">Target: ${ordenes_target}</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="${colorOrdenes}" style="padding:5px;background-color:${colorOrdenes};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">ÓRDENES</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid ${colorTP};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">📈</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:${colorTP};line-height:1;">${tp_pct}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 2px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#666;line-height:1;">Target: ${tp_target}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="${colorTP}" style="padding:5px;background-color:${colorTP};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">TRAB. PLANIFICADO</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid ${colorPS};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">✅</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:${colorPS};line-height:1;">${ps_pct}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 2px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#666;line-height:1;">Target: ${ps_target}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="${colorPS}" style="padding:5px;background-color:${colorPS};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">PROG. SEMANAL</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="20%" style="padding:4px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-top:3px solid ${colorPM};">
                          <tr>
                            <td align="center" style="padding:12px 6px 6px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1;">📄</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 4px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:${colorPM};line-height:1;">${pm_pct}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 6px 2px 6px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#666;line-height:1;">Target: ${pm_target}%</div>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" bgcolor="${colorPM}" style="padding:5px;background-color:${colorPM};">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">PLAN MATRIZ</div>
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

        <tr>
          <td bgcolor="#ffffff" style="padding:0 20px 20px 20px;background-color:#ffffff;">
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
                  ${avisosTableHtml}
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="16" style="font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

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
                  ${ordenesTableHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td height="1" bgcolor="#e2e8f0" style="font-size:0;line-height:0;background-color:#e2e8f0;">&nbsp;</td>
        </tr>

        <tr>
          <td bgcolor="#ffffff" style="padding:20px;background-color:#ffffff;">
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
              ${tp_rows_html}
              <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
                <td colspan="3" style="padding:10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">
                  <span style="font-size:12px;margin-right:4px;">${getStatusIconForVal(tp_pct, tp_target, true)}</span> TOTAL GENERAL
                </td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${formatValue(trabajoPlanificado.total?.planificado)}</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${formatValue(trabajoPlanificado.total?.sinHr)}</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${formatValue(trabajoPlanificado.total?.imprevistos)}</td>
                <td align="right" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${formatValue(trabajoPlanificado.total?.total)}</td>
                <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${tp_pct}%</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td height="1" bgcolor="#e2e8f0" style="font-size:0;line-height:0;background-color:#e2e8f0;">&nbsp;</td>
        </tr>

        <tr>
          <td bgcolor="#ffffff" style="padding:20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr valign="top">

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
                    ${prog_rows_html}
                    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
                      <td colspan="3" style="padding:9px 8px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#334155;">
                        <span style="font-size:12px;margin-right:4px;">${getStatusIconForVal(ps_pct, ps_target, true)}</span> TOTAL
                      </td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">${formatValue(programaSemanal.total?.cumple)}</td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">${formatValue(programaSemanal.total?.noCumple)}</td>
                      <td align="center" bgcolor="#f1f5f9" style="padding:9px 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${ps_pct}%</td>
                    </tr>
                  </table>
                </td>

                <td width="4%">&nbsp;</td>

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
                    ${matriz_rows_html}
                    <tr bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
                      <td colspan="3" style="padding:9px 8px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#334155;">
                        <span style="font-size:12px;margin-right:4px;">${getStatusIconForVal(pm_pct, pm_target, true)}</span> TOTAL
                      </td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">${formatValue(planMatriz.total?.cumple)}</td>
                      <td align="center" style="padding:9px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;">${formatValue(planMatriz.total?.noCumple)}</td>
                      <td align="center" bgcolor="#f1f5f9" style="padding:9px 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#334155;background-color:#f1f5f9;">${pm_pct}%</td>
                    </tr>
                  </table>
                </td>

              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td bgcolor="#fdf5f2" style="padding:20px;background-color:#fdf5f2;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="4" bgcolor="#bb5726" style="background-color:#bb5726;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:14px 16px;background-color:#ffffff;border:1px solid #f0d0c4;border-left:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#334155;line-height:1.7;padding-bottom:12px;">
                        ${body_p1}
                      </td>
                    </tr>
                    <tr>
                      <td bgcolor="#fff8f5" style="padding:10px 12px;background-color:#fff8f5;border-left:3px solid #e96c28;">
                        <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a3210;font-weight:bold;">
                          ${body_p2}
                        </span>
                      </td>
                    </tr>
                    <tr><td height="14" style="font-size:0;line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td align="center">
                        <table cellpadding="0" cellspacing="0" border="0" align="center">
                          <tr>
                            <td bgcolor="#0d7a8c" style="background-color:#0d7a8c;padding:0;">
                              <a href="https://app.powerbi.com/groups/me/reports/25c6193c-221c-4a37-8482-7eaa6bdcf0b8/ReportSection2f3df3645adc487323d5?ctid=e9bc23bb-772e-4090-abc4-b9fd485041fc"
                                  style="display:inline-block;padding:11px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#0d7a8c;border:0;">
                                ▶ &nbsp;Ver Dashboard de KPIs
                              </a>
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

        <tr>
          <td height="3" bgcolor="#0d7a8c" style="font-size:0;line-height:0;background-color:#0d7a8c;">&nbsp;</td>
        </tr>
        <tr bgcolor="#bb5726" style="background-color:#bb5726;">
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr valign="middle">
                <td valign="middle">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#ffd4b8;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">
                    Fuente de datos
                  </div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#ffffff;font-weight:bold;">
                    DATAMART · GSYS Mantenimiento DCH
                  </div>
                </td>
                <td align="right" valign="middle">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#ffd4b8;padding-bottom:4px;">
                    Semana ${semana} &nbsp;·&nbsp; ${currentYear} &nbsp;·&nbsp; Monitoring
                  </div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#ffffff;">
                    Generado por&nbsp;
                    <a href="mailto:${generado_email}" style="color:#ffd4b8;text-decoration:none;font-weight:bold;">${generado_nombre}</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td height="4" bgcolor="#bb5726" style="font-size:0;line-height:0;background-color:#bb5726;">&nbsp;</td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

// --- EXPORT PRINCIPAL CON SELECTOR DE ESTRUCTURAS ---

/**
 * Genera la plantilla HTML completa y premium del reporte de KPIs
 * @param {object} data - Datos procesados por excelProcessor
 * @param {number} templateId - Plantilla a utilizar (1 a 7)
 * @returns {string} Plantilla HTML lista para envío de correo
 */
export function generateKpiEmailTemplate(data, templateId = 7) {
  switch (Number(templateId)) {
    case 1: return generateTemplate1(data);
    case 2: return generateTemplate2(data);
    case 3: return generateTemplate3(data);
    case 4: return generateTemplate4(data);
    case 5: return generateTemplate5(data);
    case 6: return generateTemplate6(data);
    case 7: return generateTemplate7(data);
    default: return generateTemplate7(data);
  }
}
