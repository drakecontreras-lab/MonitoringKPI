import React from 'react';
import { generateKpiEmailTemplate } from '../utils/emailTemplate';

/**
 * Componente que renderiza la previsualización del correo con selector de plantilla.
 * Forzado para usar únicamente la plantilla Codelco Outlook Tradicional.
 *
 * @param {object} props.kpiData - Datos de KPI procesados en el backend.
 * @param {boolean} props.sending - Estado de envío en curso.
 * @param {function} props.onSendTestEmail - Callback para enviar el correo de prueba.
 * @param {object} props.emailSettings - Parámetros editables de correo a previsualizar.
 */
export default function EmailPreview({ kpiData, sending, onSendTestEmail, onSendRealEmail, emailSettings, setEmailSettings, onSaveEmailSettings, includePowerBI, setIncludePowerBI, selectedTemplate, setSelectedTemplate }) {
  const [showTemplateEditor, setShowTemplateEditor] = React.useState(false);

  /**
   * Genera el HTML del correo.
   * @returns {string|null}
   */
  const getCompiledHtml = () => {
    if (!kpiData) return null;
    const dataWithSettings = {
      ...kpiData,
      email_settings: emailSettings
    };
    return generateKpiEmailTemplate(dataWithSettings, selectedTemplate || 7);
  };

  const emailHtml = getCompiledHtml();

  return (
    <div className="glass-card" style={{ flexGrow: 1, minHeight: '500px', position: 'relative' }}>
      <div className="preview-header-bar">
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>
          <i className="bi bi-eye-fill" style={{ marginRight: '8px', color: 'var(--secondary)' }}></i>
          Previsualización del Correo
        </h3>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="preview-status-indicator">
            <div className={`preview-status-dot ${kpiData ? 'active' : ''}`}></div>
            <span>{kpiData ? 'Reporte Listo' : 'Esperando Archivos'}</span>
          </div>

          {kpiData && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={includePowerBI || false}
                  onChange={(e) => setIncludePowerBI(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Adjuntar Captura Power BI</span>
              </label>
              
              <select
                className="form-control"
                style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', marginRight: '0.2rem' }}
                value={selectedTemplate || 7}
                onChange={(e) => setSelectedTemplate(Number(e.target.value))}
              >
                <option value={7}>Plantilla 7 (Actual c/ Targets)</option>
                <option value={6}>Plantilla 6</option>
                <option value={5}>Plantilla 5</option>
                <option value={4}>Plantilla 4</option>
                <option value={3}>Plantilla 3</option>
                <option value={2}>Plantilla 2</option>
                <option value={1}>Plantilla 1</option>
              </select>

              <button
                onClick={() => setShowTemplateEditor(true)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <i className="bi bi-pencil-square"></i> Editar Plantilla
              </button>
              <button
                onClick={onSendTestEmail}
                disabled={sending}
                className="btn btn-warning"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#000' }}
              >
                {sending ? (
                  <><i className="bi bi-arrow-clockwise spin"></i> ...</>
                ) : (
                  <><i className="bi bi-envelope-exclamation"></i> Prueba</>
                )}
              </button>
              <button
                onClick={onSendRealEmail}
                disabled={sending}
                className="btn btn-success"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {sending ? (
                  <><i className="bi bi-arrow-clockwise spin"></i> Enviando...</>
                ) : (
                  <><i className="bi bi-send-check-fill"></i> Enviar Correo</>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="preview-container" style={{ marginTop: '0.5rem', flexGrow: 1 }}>
        {emailHtml ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              📧 El correo se enviará en formato HTML responsivo en español, estructurado para compatibilidad corporativa con Outlook (Codelco Outlook Tradicional).
            </span>
            <div className="preview-frame-wrapper" style={{ flexGrow: 1, borderRadius: 'var(--radius-sm)' }}>
              <iframe
                key={kpiData ? `loaded-${kpiData.semana}-t7` : 'empty'}
                title="Previsualización de Correo Corporativo"
                className="preview-iframe"
                srcDoc={emailHtml}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        ) : (
          <div className="no-data-placeholder">
            <i className="bi bi-envelope-open-fill no-data-icon"></i>
            <h4 style={{ color: '#fff' }}>No hay informe que previsualizar</h4>
            <p style={{ fontSize: '0.85rem', maxWidth: '350px' }}>
              Los informes se autogeneran una vez que subes los archivos Excel de KPI y especificas la semana de trabajo.
            </p>
          </div>
        )}
      </div>

      {showTemplateEditor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 8, 22, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div className="glass-card animate-scale-up" style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '1.5rem',
            borderRadius: '12px',
            backgroundColor: '#162130',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed rgba(255,255,255,0.15)', paddingBottom: '0.75rem', marginBottom: '1rem', flexShrink: 0 }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-pencil-square" style={{ color: 'var(--indigo)' }}></i>
              Editar Campos de la Plantilla
            </h3>
            <button 
              onClick={() => setShowTemplateEditor(false)}
              style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Texto Superior de División (Header Tag)</label>
              <input
                type="text"
                className="form-control"
                value={emailSettings.header_tag || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, header_tag: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Título del Reporte</label>
              <input
                type="text"
                className="form-control"
                value={emailSettings.title || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Subtítulo del Reporte</label>
              <input
                type="text"
                className="form-control"
                value={emailSettings.subtitle || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, subtitle: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Párrafo 1 del Cuerpo</label>
              <textarea
                className="form-control"
                style={{ height: '80px', resize: 'vertical' }}
                value={emailSettings.body_p1 || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, body_p1: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Párrafo 2 del Cuerpo (Destacado)</label>
              <textarea
                className="form-control"
                style={{ height: '60px', resize: 'vertical' }}
                value={emailSettings.body_p2 || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, body_p2: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Generado por (Nombre)</label>
              <input
                type="text"
                className="form-control"
                value={emailSettings.generado_nombre || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, generado_nombre: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Generado por (Email)</label>
              <input
                type="text"
                className="form-control"
                value={emailSettings.generado_email || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, generado_email: e.target.value })}
              />
            </div>

            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <h4 style={{ color: '#a0aec0', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1rem' }}>🎯</span> Umbrales de Indicadores
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Avisos (Target verde)</label>
                  <input type="number" className="form-control" min="0"
                    value={emailSettings.avisos_target || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, avisos_target: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Órdenes (Target verde)</label>
                  <input type="number" className="form-control" min="0"
                    value={emailSettings.ordenes_target || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, ordenes_target: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Trab. Planificado (% Target)</label>
                  <input type="number" className="form-control" min="0" max="100"
                    value={emailSettings.tp_target || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, tp_target: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Prog. Semanal (% Target)</label>
                  <input type="number" className="form-control" min="0" max="100"
                    value={emailSettings.ps_target || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, ps_target: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Plan Matriz (% Target)</label>
                  <input type="number" className="form-control" min="0" max="100"
                    value={emailSettings.pm_target || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, pm_target: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.5rem', lineHeight: '1.4' }}>
                <strong>Colores:</strong> Verde = cumple target · Amarillo = hasta 10 menos · Rojo = bajo eso
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowTemplateEditor(false)}
              className="btn btn-outline"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSaveEmailSettings();
                setShowTemplateEditor(false);
              }}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
            >
              Guardar y Cerrar
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
