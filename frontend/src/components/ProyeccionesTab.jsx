import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Pestaña Proyecciones.
 * Estado COMPLETAMENTE independiente de KpiCorporativosTab.
 * Props recibidas de App.jsx: defaultSemana, defaultFechaBase
 */
export default function ProyeccionesTab({ defaultSemana, defaultFechaBase }) {
  // ─── Estado de parámetros SAP ───
  const [proyParams, setProyParams] = useState({
    semana: defaultSemana || 'P10',
    fecha_base: defaultFechaBase || '19-01-2026',
    lista_uts: 'CDEE*\nCTAL*\nCHSS-SE*\nCHSS-SU*\nCHSS-PL*\nCHCO-IN-INF*',
    grupo_planif: 'CI0',
    grupo_planif_st: 'CI0, C89, C73, C70, C71, C72, C74, C84, CB1'
  });
  const [proyConfigTab, setProyConfigTab] = useState('corporativos');

  // ─── Estado del robot SAP (AISLADO de KpiCorporativosTab) ───
  const [proyRunning, setProyRunning] = useState(false);
  const [proyProgress, setProyProgress] = useState(0.0);
  const [proyProgressText, setProyProgressText] = useState('Inactivo');
  const [proyLogs, setProyLogs] = useState([]);
  const [proyVisor, setProyVisor] = useState('');
  const [activeProyModuleId, setActiveProyModuleId] = useState('proy_auto');

  // ─── MFA (exclusivo de esta pestaña) ───
  const [solicitarMfa, setSolicitarMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  // ─── Efectos ───

  useEffect(() => {
    if (defaultSemana) setProyParams(prev => ({ ...prev, semana: defaultSemana }));
  }, [defaultSemana]);

  useEffect(() => {
    if (defaultFechaBase) setProyParams(prev => ({ ...prev, fecha_base: defaultFechaBase }));
  }, [defaultFechaBase]);

  // Polling del robot SAP de Proyecciones (AISLADO - no toca KpiCorporativosTab)
  useEffect(() => {
    let interval;
    if (proyRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/status-modulos');
          const d = await res.json();
          setProyProgress(d.progreso);
          setProyProgressText(d.progreso_texto);
          setProyLogs(d.logs || []);
          if (d.visor) setProyVisor(d.visor);
          setSolicitarMfa(d.solicitar_mfa);
          // Solo detener el polling si NO hay MFA pendiente
          if (!d.solicitar_mfa && (d.progreso < 0.0 || d.progreso >= 1.0)) {
            setProyRunning(false);
            clearInterval(interval);
          }
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [proyRunning]);

  // ─── Handlers ───

  const lanzarRobot = async (moduloId, mode) => {
    setActiveProyModuleId(moduloId);
    setProyRunning(true);
    setProyProgress(0.05);
    setProyProgressText('Iniciando');
    setProyLogs([]);
    setProyVisor('');
    setSolicitarMfa(false);
    try {
      const utsArray = proyParams.lista_uts.split('\n').map(u => u.trim()).filter(u => u);
      const res = await fetch('/api/ejecutar-modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo_id: moduloId,
          params: {
            mode: mode,
            semana: proyParams.semana,
            fecha_base: proyParams.fecha_base,
            lista_uts: utsArray,
            grupo_planif: proyParams.grupo_planif,
            grupo_planif_st: proyParams.grupo_planif_st
          }
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al iniciar robot.');
    } catch (e) {
      setProyRunning(false);
      alert(e.message);
    }
  };

  const alternarPausa = async (moduloId) => {
    try {
      await fetch('/api/pausar-modulo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo_id: moduloId })
      });
    } catch (e) {}
  };

  const detenerRobot = async (moduloId) => {
    try {
      await fetch('/api/detener-modulo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo_id: moduloId })
      });
      setProyRunning(false);
    } catch (e) {}
  };

  const enviarMfa = async () => {
    if (!mfaCode) return;
    setMfaLoading(true);
    try {
      await fetch('/api/enviar-mfa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: mfaCode })
      });
      setMfaCode('');
      setSolicitarMfa(false);
    } catch (e) { alert('Error al enviar código MFA.'); }
    finally { setMfaLoading(false); }
  };

  // ─── RENDER ───
  return (
    <div className="dashboard-grid">
      {/* Panel izquierdo: configuración y botones del robot */}
      <div className="glass-card flex-col gap-1.5" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="card-title">
          <span className="material-icons text-indigo">smart_toy</span>
          <span>Configurar Robot SAP Fiori</span>
        </h2>

        {/* Sub-pestañas de configuración */}
        <div className="flex gap-0.5 mt-0.5 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <button type="button" className={`btn flex-1 ${proyConfigTab === 'corporativos' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem' }}
            onClick={() => setProyConfigTab('corporativos')}>
            KPIs Corporativos
          </button>
          <button type="button" className={`btn flex-1 ${proyConfigTab === 'st-rn' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem' }}
            onClick={() => setProyConfigTab('st-rn')}>
            Avisos y Órdenes ST / RN
          </button>
        </div>

        {proyConfigTab === 'corporativos' ? (
          <>
            <div className="form-group">
              <label>Semana de Proyección (ej: P10)</label>
              <input type="text" className="form-control" value={proyParams.semana}
                onChange={(e) => setProyParams({ ...proyParams, semana: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Fecha Base Asignada (dd-mm-yyyy)</label>
              <input type="text" className="form-control" value={proyParams.fecha_base}
                onChange={(e) => setProyParams({ ...proyParams, fecha_base: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Grupo de Planificación (Fase 2 - DIEA)</label>
              <input type="text" className="form-control" value={proyParams.grupo_planif}
                onChange={(e) => setProyParams({ ...proyParams, grupo_planif: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Unidades Técnicas a Consultar (Una por fila)</label>
              <textarea className="form-control h-120 font-mono" value={proyParams.lista_uts}
                onChange={(e) => setProyParams({ ...proyParams, lista_uts: e.target.value })} />
            </div>
          </>
        ) : (
          <div className="form-group">
            <label>Grupos de Planificación ST (Separados por coma)</label>
            <input type="text" className="form-control" value={proyParams.grupo_planif_st}
              onChange={(e) => setProyParams({ ...proyParams, grupo_planif_st: e.target.value })} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-dark)', marginTop: '0.4rem', display: 'block' }}>
              Configura los subtenientes de Socios Técnicos y repuestos nacionales para descargas de la Fase 3.
            </span>
          </div>
        )}

        {/* Botones principales */}
        <div className="flex-col gap-0.5" style={{ marginTop: '1rem' }}>
          <button onClick={() => lanzarRobot('proy_auto', 'full')} disabled={proyRunning}
            className="btn btn-primary w-full flex-center gap-0.5">
            <span className="material-icons">play_circle</span>
            <span>Ejecutar Descargas SAP Completas</span>
          </button>
          <button onClick={() => lanzarRobot('proy_macro', 'macro')} disabled={proyRunning}
            className="btn btn-secondary w-full flex-center gap-0.5">
            <span className="material-icons">settings_applications</span>
            <span>Ejecutar Macro de Consolidación</span>
          </button>
        </div>

        {/* Fases de descarga individuales */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted-light)', marginBottom: '0.75rem' }}>Fases de Descarga</h3>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#3B82F6', marginBottom: '0.25rem' }}>Fase 1: Unidades Técnicas (UTs)</div>
            <div className="flex gap-0.25">
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'avisos_ut')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>AVI</button>
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'ots_ut')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>OTS</button>
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'ordenes_ut')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>37N</button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#8B5CF6', marginBottom: '0.25rem' }}>Fase 2: Por Grupo (DIEA)</div>
            <div className="flex gap-0.25">
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'avisos_diea')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>AVI</button>
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'ots_diea')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>OTS</button>
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'ordenes_diea')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>37N</button>
            </div>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#F59E0B', marginBottom: '0.25rem' }}>Fase 3: Servicios Terceros (ST)</div>
            <div className="flex gap-0.25">
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'avisos_st')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>AVI ST</button>
              <button disabled={proyRunning} onClick={() => lanzarRobot('proy_auto', 'ots_st')} className="btn btn-secondary flex-1" style={{ padding: '0.35rem', fontSize: '0.75rem' }}>OTS ST</button>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho: visor y consola HUD */}
      <div className="flex-col gap-2">
        {/* Visor en vivo */}
        <div className="glass-card flex-col gap-1" style={{ minHeight: '260px' }}>
          <h2 className="card-title">
            <span className="material-icons text-cyan">videocam</span>
            <span>Visor Automatización</span>
          </h2>

          <div className="live-screencast-container">
            {proyVisor ? (
              <img src={`data:image/jpeg;base64,${proyVisor}`} alt="Transmisión del navegador" className="screencast-img" />
            ) : (
              <div className="screencast-placeholder">
                <span className="material-icons flex-center">tv_off</span>
                <p>Esperando transmisión del robot...</p>
              </div>
            )}
          </div>

          {/* Barra de progreso y controles */}
          {proyRunning && (
            <div style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem' }} className="flex-col gap-0.5">
              <div className="flex-between">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-light)' }}>
                  Progreso: <strong style={{ color: 'var(--secondary)' }}>{proyProgressText}</strong>
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{Math.round(proyProgress * 100)}%</span>
              </div>
              <div className="progress-bar-wrapper">
                <div className="progress-bar-fill" style={{ width: `${proyProgress * 100}%` }}></div>
              </div>
              <div className="flex-between gap-1 w-full" style={{ marginTop: '0.5rem' }}>
                <button onClick={() => alternarPausa(activeProyModuleId)} className="btn btn-secondary flex-1 flex-center gap-0.25" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>
                  <span className="material-icons" style={{ fontSize: '1.1rem' }}>pause_circle</span>
                  <span>Pausar</span>
                </button>
                <button onClick={() => detenerRobot(activeProyModuleId)} className="btn btn-danger flex-1 flex-center gap-0.25" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>
                  <span className="material-icons" style={{ fontSize: '1.1rem' }}>stop_circle</span>
                  <span>Detener</span>
                </button>
              </div>
            </div>
          )}

          {/* Modal MFA — renderizado en document.body via Portal para que sea visible
               incluso cuando el tab está oculto con display:none */}
          {solicitarMfa && createPortal(
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 8, 22, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div className="glass-card flex-col gap-1 text-center animate-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#162130', alignItems: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
                <span className="material-icons text-warning" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>security</span>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Microsoft Authenticator</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                  El robot ha detectado una pantalla de seguridad MFA. Ingresa el código numérico para reanudar la automatización SAP.
                </p>
                <input type="text" maxLength="8" placeholder="000000"
                  className="form-control font-mono text-center font-bold"
                  style={{ width: '150px', letterSpacing: '4px', fontSize: '1.4rem', margin: '1rem auto' }}
                  value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enviarMfa(); }} />
                <div className="flex gap-1" style={{ width: '100%', marginTop: '0.5rem' }}>
                  <button onClick={() => { detenerRobot(activeProyModuleId); setSolicitarMfa(false); }} className="btn btn-secondary flex-1">Cancelar</button>
                  <button onClick={enviarMfa} disabled={mfaLoading || !mfaCode} className="btn btn-primary flex-2">{mfaLoading ? 'Enviando...' : 'Reanudar'}</button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Consola HUD de Logs */}
        <div className="glass-card flex-col gap-1" style={{ flex: 1, minHeight: '200px' }}>
          <h2 className="card-title">
            <span className="material-icons text-indigo">terminal</span>
            <span>Consola HUD de logs en tiempo real</span>
          </h2>
          <div className="hud-console font-mono">
            {proyLogs.length > 0 ? (
              proyLogs.map((log, idx) => (
                <div key={idx} className={`console-line ${log.level}`}>
                  <span className="line-time">[{log.time}]</span>
                  <span className="line-text">{log.text}</span>
                </div>
              ))
            ) : (
              <div className="console-placeholder text-center text-muted">
                Consola HUD inactiva. Lanza el robot para auditar los registros en background.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
