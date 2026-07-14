import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const PROJECTION_OPTIONS = [
  { key: 'avisos', label: 'Avisos' },
  { key: 'ordenes', label: 'Órdenes' },
  { key: 'trabajo_planificado', label: 'Trabajo Planificado' },
  { key: 'programa_semanal', label: 'Programa Semanal' },
  { key: 'plan_matriz', label: 'Plan Matriz' }
];

export default function ProyeccionesTab({ defaultSemana, defaultFechaBase, onOpenSettings, user }) {
  const [proySubTab, setProySubTab] = useState('dashboard');
  const [proyParams, setProyParams] = useState({
    semana: defaultSemana || '23',
    fecha_base: defaultFechaBase || '19-01-2026',
    lista_uts: 'CDEE*\nCTAL*\nCHSS-SE*\nCHSS-SU*\nCHSS-PL*\nCHCO-IN-INF*',
    grupos_planif: 'CI0\nC89\nC73\nC70\nC71\nC72\nC74\nC84\nCB1',
    selected_projections: ['avisos','ordenes','trabajo_planificado','programa_semanal','plan_matriz']
  });

  const [activarUTs, setActivarUTs] = useState(true);
  const [activarGrupos, setActivarGrupos] = useState(true);
  const [showVencModal, setShowVencModal] = useState(false);
  const [diasVencAvisos, setDiasVencAvisos] = useState(7);
  const [diasVencOrdenes, setDiasVencOrdenes] = useState(21);

  const [proyRunning, setProyRunning] = useState(false);
  const [proyProgress, setProyProgress] = useState(0.0);
  const [proyProgressText, setProyProgressText] = useState('Inactivo');
  const [proyLogs, setProyLogs] = useState([]);
  const proyConsoleRef = useRef(null);
  const [proyVisor, setProyVisor] = useState('');
  const [solicitarMfa, setSolicitarMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const [avisosP1, setAvisosP1] = useState([]);
  const [proyData, setProyData] = useState(null);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [usePtoTrabajo, setUsePtoTrabajo] = useState(false);

  const [recipients, setRecipients] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('Reporte de Proyecciones - GSYS Mantenimiento DCH');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ success: false, error: '', message: '' });

  useEffect(() => { if (defaultSemana) setProyParams(prev => ({ ...prev, semana: defaultSemana })); }, [defaultSemana]);
  useEffect(() => {
    if (proyConsoleRef.current) proyConsoleRef.current.scrollTop = proyConsoleRef.current.scrollHeight;
  }, [proyLogs]);
  useEffect(() => { if (defaultFechaBase) setProyParams(prev => ({ ...prev, fecha_base: defaultFechaBase })); }, [defaultFechaBase]);
  useEffect(() => { setSubject(`Reporte de Proyecciones - GSYS Mantenimiento DCH - Semana ${proyParams.semana}`); }, [proyParams.semana]);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.recipients) setRecipients(data.recipients);
        if (data.cc) setCc(data.cc);
      } catch (e) {}
    };
    cargar();
  }, []);

  const cargarAvisosP1 = async () => {
    try {
      const res = await fetch(`/api/proy/avisos-p1?fecha_base=${proyParams.fecha_base}`);
      const data = await res.json();
      if (data.success) setAvisosP1(data.avisos || []);
    } catch (e) {}
  };

  useEffect(() => {
    if (!proyRunning) return;
    const interval = setInterval(() => cargarAvisosP1(), 5000);
    return () => clearInterval(interval);
  }, [proyRunning, proyParams.fecha_base]);

  useEffect(() => {
    let interval;
    if (proyRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/status-modulos');
          const d = await res.json();
          const proy = d.proy || {};
          setProyProgress(proy.progreso || 0);
          setProyProgressText(proy.progreso_texto || 'Inactivo');
          setProyLogs(proy.logs || []);
          if (proy.visor) setProyVisor(proy.visor);
          setSolicitarMfa(proy.solicitar_mfa || false);
          if (!proy.solicitar_mfa && (proy.progreso < 0.0 || proy.progreso >= 1.0)) {
            setProyRunning(false);
            clearInterval(interval);
            cargarAvisosP1();
            try {
              const resSummary = await fetch('/api/proy/latest-summary');
              const dataSummary = await resSummary.json();
              if (dataSummary.success) setProyData(dataSummary);
            } catch (e) {}
          }
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [proyRunning]);

  const toggleProjection = (key) => {
    setProyParams(prev => ({
      ...prev,
      selected_projections: prev.selected_projections.includes(key)
        ? prev.selected_projections.filter(k => k !== key)
        : [...prev.selected_projections, key]
    }));
  };

  const lanzarRobot = async () => {
    setProyRunning(true);
    setProyProgress(0.05);
    setProyProgressText('Iniciando');
    setProyLogs([]);
    setProyVisor('');
    setSolicitarMfa(false);
    try {
      const utsArray = activarUTs ? proyParams.lista_uts.split('\n').map(u => u.trim()).filter(u => u) : [];
      const gruposArray = activarGrupos ? proyParams.grupos_planif.split('\n').map(g => g.trim()).filter(g => g) : [];
      const grupoPlanif = gruposArray[0] || 'CI0';
      const res = await fetch('/api/ejecutar-modulo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo_id: 'proy_auto',
          params: {
            mode: 'full_proyecciones',
            semana: proyParams.semana,
            fecha_base: proyParams.fecha_base,
            lista_uts: utsArray,
            grupo_planif: gruposArray.join(', '),
            grupo_planif_st: gruposArray.join(', '),
            activar_uts: activarUTs,
            activar_grupos: activarGrupos,
            selected_projections: proyParams.selected_projections,
            dias_venc_avisos: diasVencAvisos,
            dias_venc_ordenes: diasVencOrdenes,
            use_pto_trabajo: usePtoTrabajo
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

  const detenerRobot = async () => {
    try {
      await fetch('/api/detener-modulo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo_id: 'proy_auto' }) });
      setProyRunning(false);
    } catch (e) {}
  };

  const enviarMfa = async () => {
    if (!mfaCode) return;
    setMfaLoading(true);
    try {
      await fetch('/api/enviar-mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: mfaCode, contexto: 'proy' }) });
      setMfaCode('');
      setSolicitarMfa(false);
    } catch (e) { alert('Error al enviar código MFA.'); }
    finally { setMfaLoading(false); }
  };

  const generarExcel = async () => {
    setGeneratingExcel(true);
    try {
      const res = await fetch('/api/proy/generate-excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana: proyParams.semana, fecha_base: proyParams.fecha_base, dias_venc_avisos: diasVencAvisos, dias_venc_ordenes: diasVencOrdenes, use_pto_trabajo: usePtoTrabajo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar Excel.');
      setProyData(data);
      alert(data.message || 'Excel generado correctamente.');
    } catch (e) { alert('Error: ' + e.message); }
    finally { setGeneratingExcel(false); }
  };

  const enviarCorreo = async (esPrueba = false) => {
    if (!user?.preferred_username) { setEmailStatus({ success: false, error: 'Debe iniciar sesión con su cuenta Microsoft.', message: '' }); return; }
    const dest = esPrueba ? (user?.preferred_username || '') : recipients;
    if (!dest) { setEmailStatus({ success: false, error: 'Faltan destinatarios.', message: '' }); return; }
    setSendingEmail(true);
    try {
      const res = await fetch('/api/proy/send-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: dest, cc: cc, subject: esPrueba ? `[PRUEBA] ${subject}` : subject, proyData: { ...proyData, semana: proyParams.semana, avisos_p1: avisosP1 } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar.');
      setEmailStatus({ success: true, error: '', message: data.message });
    } catch (e) { setEmailStatus({ success: false, error: e.message, message: '' }); }
    finally { setSendingEmail(false); }
  };

  const PROY_TEAL = '#0d7a8c';
  const PROY_ORANGE = '#bb5726';
  const grupoColLabel = usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif';

  const renderProyPctBadge = (val) => {
    const pct = (val || 0) * 100;
    let className = 'pct-badge error';
    if (pct >= 95) className = 'pct-badge success';
    else if (pct >= 70) className = 'pct-badge warning';
    return <span className={className}>{pct % 1 === 0 ? Math.round(pct) : pct.toFixed(1)}%</span>;
  };

  const renderProyKpiCards = (resumen) => (
    <div className="flex gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
      <div className="glass-card flex-col gap-0.5" style={{ borderTop: `3px solid ${PROY_TEAL}` }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: PROY_TEAL }}>Avisos Pendientes</span>
        <span className="font-number font-bold" style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{resumen.avisos?.total ?? 0}</span>
      </div>
      <div className="glass-card flex-col gap-0.5" style={{ borderTop: `3px solid ${PROY_TEAL}` }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: PROY_TEAL }}>Órdenes Pendientes</span>
        <span className="font-number font-bold" style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{resumen.ordenes?.total ?? 0}</span>
      </div>
      <div className="glass-card flex-col gap-0.5" style={{ borderTop: `3px solid ${PROY_ORANGE}` }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: PROY_ORANGE }}>% Trabajo Planificado</span>
        <span className="font-number font-bold" style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{Math.round((resumen.trabajoPlanificado?.cumplimiento || 0) * 100)}%</span>
      </div>
      <div className="glass-card flex-col gap-0.5" style={{ borderTop: `3px solid ${PROY_ORANGE}` }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: PROY_ORANGE }}>% Programa Semanal</span>
        <span className="font-number font-bold" style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{Math.round((resumen.programaSemanal?.cumplimiento || 0) * 100)}%</span>
      </div>
      <div className="glass-card flex-col gap-0.5" style={{ borderTop: `3px solid ${PROY_ORANGE}` }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: PROY_ORANGE }}>% Plan Matriz</span>
        <span className="font-number font-bold" style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{Math.round((resumen.planMatriz?.cumplimiento || 0) * 100)}%</span>
      </div>
    </div>
  );

  const renderProyDistribucionTable = (title, icon, distribucion) => (
    <div className="glass-card flex-col gap-1">
      <h2 className="card-title"><span className="material-icons" style={{ color: PROY_TEAL }}>{icon}</span><span style={{ color: PROY_TEAL }}>{title}</span></h2>
      <div className="responsive-table-wrapper">
        <table className="premium-table">
          <thead><tr style={{ background: 'rgba(13,122,140,0.1)' }}><th style={{ color: PROY_TEAL }}>{grupoColLabel}</th><th className="text-center" style={{ color: PROY_TEAL }}>Cantidad</th></tr></thead>
          <tbody>
            {(distribucion || []).map((g, idx) => (
              <tr key={idx}>
                <td>{g.grupo}{g.desc ? ` - ${g.desc}` : ''}</td>
                <td className="text-center font-number">{g.cantidad}</td>
              </tr>
            ))}
            {(!distribucion || distribucion.length === 0) && (<tr><td colSpan="2" className="text-center text-muted">Sin datos</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProyCumplimientoTable = (title, icon, grupos) => (
    <div className="glass-card flex-col gap-1">
      <h2 className="card-title"><span className="material-icons" style={{ color: PROY_ORANGE }}>{icon}</span><span style={{ color: PROY_ORANGE }}>{title}</span></h2>
      <div className="responsive-table-wrapper">
        <table className="premium-table">
          <thead>
            <tr style={{ background: 'rgba(187,87,38,0.1)' }}>
              <th style={{ color: PROY_ORANGE }}>{grupoColLabel}</th>
              <th className="text-center" style={{ color: PROY_ORANGE }}>Cumple</th>
              <th className="text-center" style={{ color: PROY_ORANGE }}>No Cumple</th>
              <th className="text-center" style={{ color: PROY_ORANGE }}>Total</th>
              <th className="text-center" style={{ color: PROY_ORANGE }}>%Cumpl</th>
            </tr>
          </thead>
          <tbody>
            {(grupos || []).map((g, idx) => (
              <tr key={idx}>
                <td>{g.grupo}{g.desc ? ` - ${g.desc}` : ''}</td>
                <td className="text-center font-number">{g.cumple}</td>
                <td className="text-center font-number">{g.noCumple}</td>
                <td className="text-center font-number font-bold">{g.total}</td>
                <td className="text-center">{renderProyPctBadge(g.cumplimiento)}</td>
              </tr>
            ))}
            {(!grupos || grupos.length === 0) && (<tr><td colSpan="5" className="text-center text-muted">Sin datos</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProyDashboard = () => (
    proyData?.resumen && (
      <div className="flex-col gap-1.5">
        {renderProyKpiCards(proyData.resumen)}
        {renderProyDistribucionTable('Avisos Pendientes por ' + grupoColLabel, 'assignment_late', proyData.resumen.avisos?.distribucion)}
        {renderProyDistribucionTable('Órdenes Pendientes por ' + grupoColLabel, 'build_circle', proyData.resumen.ordenes?.distribucion)}
        {renderProyCumplimientoTable('Trabajo Planificado', 'fact_check', proyData.resumen.trabajoPlanificado?.grupos)}
        {renderProyCumplimientoTable('Programa Semanal', 'event_available', proyData.resumen.programaSemanal?.grupos)}
        {renderProyCumplimientoTable('Plan Matriz', 'grid_view', proyData.resumen.planMatriz?.grupos)}
      </div>
    )
  );

  const renderAvisosP1Table = () => (
    avisosP1.length > 0 && (
      <div className="glass-card flex-col gap-1">
        <h2 className="card-title"><span className="material-icons" style={{ color: '#c62828' }}>priority_high</span><span>Avisos Prioridad 1 ({avisosP1.length})</span></h2>
        <div className="responsive-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table className="premium-table">
            <thead><tr><th>Aviso</th><th className="text-center">Pri.</th><th>UT</th><th>Descripción</th><th className="text-center">Fecha</th><th className="text-center">Días</th><th className="text-center">Estado</th></tr></thead>
            <tbody>
              {avisosP1.map((a, idx) => (
                <tr key={idx}>
                  <td className="font-number">{a.aviso}</td>
                  <td className="text-center font-bold" style={{ color: '#c62828' }}>{a.prioridad}</td>
                  <td>{a.ut}</td><td>{a.descripcion}</td>
                  <td className="text-center">{a.fecha_aviso}</td>
                  <td className="text-center font-number">{a.dias_transcurridos}</td>
                  <td className="text-center"><span className="pct-badge error">{a.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  );

  return (
    <div className="kpis-container">
      <div className="sub-tab-navigation flex gap-2 mb-2">
        <button className={`btn ${proySubTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setProySubTab('dashboard')}><span className="material-icons">precision_manufacturing</span> Dashboard</button>
        <button className={`btn ${proySubTab === 'visualizacion' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setProySubTab('visualizacion')}><span className="material-icons">bar_chart</span> Visualización</button>
        <button className={`btn ${proySubTab === 'envio' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setProySubTab('envio')}><span className="material-icons">preview</span> Previsualizar y Enviar</button>
      </div>

      {proySubTab === 'dashboard' && (
        <div className="dashboard-grid">
          <div className="glass-card flex-col gap-1.5" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="card-title"><span className="material-icons text-indigo">smart_toy</span><span>Configurar Proyecciones SAP</span></h2>
            <div className="form-group flex-row gap-1" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1 }}><label>Semana</label><input type="text" className="form-control" value={proyParams.semana} onChange={(e) => setProyParams({ ...proyParams, semana: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Fecha Base (dd-mm-yyyy)</label><input type="text" className="form-control" value={proyParams.fecha_base} onChange={(e) => setProyParams({ ...proyParams, fecha_base: e.target.value })} /></div>
            </div>
            <div className="form-group" style={{ background: 'rgba(59,130,246,0.05)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <label style={{ fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: activarUTs ? '0.5rem' : 0 }}>
                <input type="checkbox" checked={activarUTs} onChange={(e) => setActivarUTs(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span className="material-icons" style={{ color: activarUTs ? '#3b82f6' : 'var(--text-muted)' }}>location_on</span> Activar Ubicaciones Técnicas
              </label>
              {activarUTs && <textarea className="form-control h-120 font-mono" value={proyParams.lista_uts} onChange={(e) => setProyParams({ ...proyParams, lista_uts: e.target.value })} placeholder="Una UT por línea" style={{ marginTop: '0.5rem' }} />}
            </div>
            <div className="form-group" style={{ background: 'rgba(139,92,246,0.05)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <label style={{ fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: activarGrupos ? '0.5rem' : 0 }}>
                <input type="checkbox" checked={activarGrupos} onChange={(e) => setActivarGrupos(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span className="material-icons" style={{ color: activarGrupos ? '#8b5cf6' : 'var(--text-muted)' }}>group_work</span> Activar Grupos de Planificación
              </label>
              {activarGrupos && <textarea className="form-control h-80 font-mono" value={proyParams.grupos_planif} onChange={(e) => setProyParams({ ...proyParams, grupos_planif: e.target.value })} placeholder="Un grupo por línea" style={{ marginTop: '0.5rem' }} />}
            </div>
            <div className="form-group" style={{ background: 'rgba(13,122,140,0.06)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(13,122,140,0.25)' }}>
              <label style={{ fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <input type="checkbox" checked={usePtoTrabajo} onChange={(e) => setUsePtoTrabajo(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span className="material-icons" style={{ color: usePtoTrabajo ? '#0d7a8c' : 'var(--text-muted)' }}>engineering</span> Agrupar por Puesto de Trabajo
              </label>
              <span style={{ fontSize: '0.72rem', color: '#0d7a8c', marginTop: '0.35rem', display: 'block' }}>{usePtoTrabajo ? 'El resumen se agrupará por Puesto de Trabajo.' : 'El resumen se agrupará por Grupo de Planificación.'}</span>
            </div>
            <div className="form-group">
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Proyecciones a Obtener</label>
              <div className="flex-col gap-0.5">
                {PROJECTION_OPTIONS.map(opt => (
                  <label key={opt.key} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: '6px', background: proyParams.selected_projections.includes(opt.key) ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
                    <input type="checkbox" checked={proyParams.selected_projections.includes(opt.key)} onChange={() => toggleProjection(opt.key)} style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: proyParams.selected_projections.includes(opt.key) ? 600 : 400 }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setShowVencModal(true)} className="btn btn-outline w-full flex-center gap-0.5" style={{ fontSize: '0.82rem' }}>
              <span className="material-icons">schedule</span><span>Configurar Vencimientos ({diasVencAvisos}/{diasVencOrdenes} días)</span>
            </button>
            <button onClick={lanzarRobot} disabled={proyRunning || proyParams.selected_projections.length === 0} className="btn btn-primary w-full flex-center gap-0.5" style={{ marginTop: '0.5rem' }}>
              <span className="material-icons">play_circle</span><span>{proyRunning ? 'Ejecutando...' : 'Ejecutar Seleccionadas'}</span>
            </button>
            {proyRunning && (
              <div className="flex gap-0.5" style={{ marginTop: '0.5rem' }}>
                <button onClick={detenerRobot} className="btn btn-danger flex-1 flex-center gap-0.25" style={{ padding: '0.4rem', fontSize: '0.8rem' }}><span className="material-icons" style={{ fontSize: '1.1rem' }}>stop_circle</span><span>Detener</span></button>
              </div>
            )}
          </div>

          <div className="flex-col gap-2">
            {renderAvisosP1Table()}
            <div className="glass-card flex-col gap-1" style={{ minHeight: '260px' }}>
              <h2 className="card-title"><span className="material-icons text-cyan">videocam</span><span>Visor Automatización</span></h2>
              <div className="live-screencast-container">
                {proyVisor ? <img src={`data:image/jpeg;base64,${proyVisor}`} alt="Transmisión" className="screencast-img" /> : (
                  <div className="screencast-placeholder"><span className="material-icons flex-center">tv_off</span><p>Esperando transmisión del robot...</p></div>
                )}
              </div>
              {proyRunning && (
                <div style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem' }} className="flex-col gap-0.5">
                  <div className="flex-between">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-light)' }}>Progreso: <strong style={{ color: 'var(--secondary)' }}>{proyProgressText}</strong></span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{Math.round(proyProgress * 100)}%</span>
                  </div>
                  <div className="progress-bar-wrapper"><div className="progress-bar-fill" style={{ width: `${proyProgress * 100}%` }}></div></div>
                </div>
              )}
              {solicitarMfa && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,8,22,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                  <div className="glass-card flex-col gap-1 text-center animate-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', borderRadius: '12px', backgroundColor: '#162130', alignItems: 'center' }}>
                    <span className="material-icons text-warning" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>security</span>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Microsoft Authenticator</h3>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>El robot requiere código MFA para reanudar.</p>
                    <input type="text" maxLength="8" placeholder="000000" className="form-control font-mono text-center font-bold" style={{ width: '150px', letterSpacing: '4px', fontSize: '1.4rem', margin: '1rem auto' }} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enviarMfa(); }} />
                    <div className="flex gap-1" style={{ width: '100%' }}>
                      <button onClick={() => { detenerRobot(); setSolicitarMfa(false); }} className="btn btn-secondary flex-1">Cancelar</button>
                      <button onClick={enviarMfa} disabled={mfaLoading || !mfaCode} className="btn btn-primary flex-2">{mfaLoading ? 'Enviando...' : 'Reanudar'}</button>
                    </div>
                  </div>
                </div>, document.body
              )}
            </div>
            <div className="glass-card flex-col gap-1" style={{ flex: 1, minHeight: '200px' }}>
              <h2 className="card-title"><span className="material-icons text-indigo">terminal</span><span>Consola HUD</span></h2>
              <div ref={proyConsoleRef} className="hud-console font-mono">
                {proyLogs.length > 0 ? proyLogs.map((log, idx) => (<div key={idx} className={`console-line ${log.level}`}><span className="line-time">[{log.time}]</span><span className="line-text">{log.text}</span></div>)) : (<div className="console-placeholder text-center text-muted">Consola HUD inactiva.</div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {proySubTab === 'visualizacion' && (
        <div className="flex-col gap-2">
          <div className="glass-card flex-col gap-1.5">
            <h2 className="card-title"><span className="material-icons text-indigo">table_chart</span><span>Reporte Consolidado de Proyecciones</span></h2>
            {proyData ? (
              <>
                <div className="flex-between w-full">
                  <div className="flex-center gap-1"><span className="material-icons text-green" style={{ fontSize: '2.5rem' }}>feed</span><div><div className="download-title">Reporte Consolidado</div><div className="download-subtitle">{proyData.filename}</div></div></div>
                  <div className="flex gap-0.5">
                    <button className="btn btn-outline flex-center gap-0.5" onClick={generarExcel} disabled={generatingExcel}>{generatingExcel ? <><span className="spinner-mini"></span><span>Generando...</span></> : <><span className="material-icons">refresh</span><span>Regenerar</span></>}</button>
                    <button className="btn btn-success flex-center gap-0.5" onClick={async () => { if (window.pywebview?.api) { const s = await window.pywebview.api.save_excel(proyData.filename); if (s) alert('Descargado.'); } else { window.location.href = proyData.downloadUrl; } }}><span className="material-icons">download</span><span>Descargar</span></button>
                  </div>
                </div>
                {renderAvisosP1Table()}
                {renderProyDashboard()}
              </>
            ) : (
              <div className="flex-center flex-col" style={{ minHeight: '300px' }}>
                <span className="material-icons text-muted" style={{ fontSize: '4rem', marginBottom: '1rem' }}>analytics</span>
                <h3 className="text-muted-light">No hay reporte generado</h3>
                <button className="btn btn-primary mt-1" onClick={generarExcel} disabled={generatingExcel}>{generatingExcel ? 'Generando...' : 'Generar Excel Consolidado'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {proySubTab === 'envio' && (
        <div className="flex-col gap-2">
          <div className="glass-card flex-col gap-1.5">
            <h2 className="card-title"><span className="material-icons text-indigo">mail</span><span>Envío de Reporte de Proyecciones</span></h2>
            <div className="form-group"><label>Destinatarios (separados por coma)</label><textarea required placeholder="destinatario1@codelco.cl" className="form-control h-80" style={{ resize: 'none' }} value={recipients} onChange={(e) => setRecipients(e.target.value)} /></div>
            <div className="form-group"><label>CC</label><textarea placeholder="copia1@codelco.cl" className="form-control h-60" style={{ resize: 'none' }} value={cc} onChange={(e) => setCc(e.target.value)} /></div>
            <div className="form-group"><label>Asunto</label><input type="text" required className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            {proyData && (
              <div className="flex-between mt-1" style={{ background: 'rgba(16,185,129,0.05)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex-center gap-0.5"><span className="material-icons text-green">attach_file</span><span style={{ fontSize: '0.85rem' }}>{proyData.filename}</span></div>
                <button className="btn btn-success flex-center gap-0.5" onClick={async () => { if (window.pywebview?.api) await window.pywebview.api.save_excel(proyData.filename); else window.location.href = proyData.downloadUrl; }}><span className="material-icons">download</span><span>Descargar</span></button>
              </div>
            )}
            <div className="flex gap-1 mt-1">
              <button onClick={() => enviarCorreo(true)} disabled={sendingEmail} className="btn btn-warning flex-1 flex-center gap-0.5"><span className="material-icons">science</span><span>{sendingEmail ? 'Enviando...' : 'Prueba'}</span></button>
              <button onClick={() => enviarCorreo(false)} disabled={sendingEmail} className="btn btn-success flex-1 flex-center gap-0.5"><span className="material-icons">send</span><span>{sendingEmail ? 'Enviando...' : 'Enviar'}</span></button>
            </div>
            {emailStatus.error && <div className="alert error mt-1"><span className="material-icons">error</span><span>{emailStatus.error}</span></div>}
            {emailStatus.success && <div className="alert success mt-1"><span className="material-icons">check_circle</span><span>{emailStatus.message}</span></div>}
          </div>
          {proyData && (
            <div className="glass-card" style={{ flexGrow: 1, minHeight: '500px' }}>
              <div className="preview-header-bar"><h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Previsualización del Correo</h3></div>
              <div className="preview-frame-wrapper" style={{ flexGrow: 1, height: '600px' }}>
                <iframe title="Preview Proyecciones" srcDoc={generateProyPreviewHtml(proyData, avisosP1, proyParams.semana, usePtoTrabajo)} sandbox="allow-same-origin" style={{ width: '100%', height: '100%', border: 0 }} />
              </div>
            </div>
          )}
        </div>
      )}

      {showVencModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,8,22,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-card flex-col gap-1" style={{ width: '100%', maxWidth: '420px', padding: '2rem', borderRadius: '12px', backgroundColor: '#162130' }}>
            <div className="flex-between mb-1"><h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span className="material-icons text-warning">schedule</span> Configurar Vencimientos</h3><button onClick={() => setShowVencModal(false)} style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button></div>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>Días para considerar un aviso/orden como vencido.</p>
            <div className="form-group mt-1">
              <label style={{ color: '#cbd5e0', fontSize: '0.82rem', fontWeight: 600 }}>Avisos: vencido después de (días)</label>
              <input type="number" min="1" max="60" className="form-control" value={diasVencAvisos} onChange={(e) => setDiasVencAvisos(Math.max(1, Number(e.target.value) || 7))} />
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>Los avisos de prioridad 1 siempre se consideran vencidos.</span>
            </div>
            <div className="form-group">
              <label style={{ color: '#cbd5e0', fontSize: '0.82rem', fontWeight: 600 }}>Órdenes: vencido después de (días)</label>
              <input type="number" min="1" max="60" className="form-control" value={diasVencOrdenes} onChange={(e) => setDiasVencOrdenes(Math.max(1, Number(e.target.value) || 21))} />
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>Ej: 21 = vencido después de 21 días.</span>
            </div>
            <div className="flex gap-1 mt-1" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setShowVencModal(false)} className="btn btn-outline" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Cancelar</button>
              <button onClick={() => setShowVencModal(false)} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}>Guardar</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

/**
 * Genera el HTML de previsualización del correo de Proyecciones.
 * Replica exactamente las tablas que arma el backend (proy_email_sender.py,
 * generate_proy_email_template): Pendientes (Avisos/Órdenes) y Cumplimiento
 * (%), agrupadas por Grupo de Planificación o Puesto de Trabajo según
 * usePtoTrabajo — mismas columnas que usa KPI Corporativos.
 */
function generateProyPreviewHtml(proyData, avisosP1, semana, usePtoTrabajo) {
  const labelGrupo = usePtoTrabajo ? 'Puesto de Trabajo' : 'Grupo de Planificación';
  const resumen = proyData?.resumen || {};

  const p1Rows = avisosP1.map(a => `<tr><td style="padding:8px;text-align:center;">${a.aviso}</td><td style="padding:8px;text-align:center;color:#c62828;font-weight:bold;">${a.prioridad}</td><td style="padding:8px;">${a.ut}</td><td style="padding:8px;">${a.descripcion}</td><td style="padding:8px;text-align:center;">${a.fecha_aviso}</td><td style="padding:8px;text-align:center;color:#c62828;font-weight:bold;">${a.dias_transcurridos}</td><td style="padding:8px;text-align:center;background:#c62828;color:#fff;font-weight:bold;">${a.estado}</td></tr>`).join('');

  const p1TableHtml = avisosP1.length > 0
    ? `<table width="100%" border="1" bordercolor="#cbd5e1" style="border-collapse:collapse;"><tr style="background:#c62828;color:#fff;"><td style="padding:8px;text-align:center;font-size:10px;font-weight:bold;">Aviso</td><td style="padding:8px;text-align:center;font-size:10px;font-weight:bold;">Pri.</td><td style="padding:8px;font-size:10px;font-weight:bold;">UT</td><td style="padding:8px;font-size:10px;font-weight:bold;">Descripción</td><td style="padding:8px;text-align:center;font-size:10px;font-weight:bold;">Fecha</td><td style="padding:8px;text-align:center;font-size:10px;font-weight:bold;">Días</td><td style="padding:8px;text-align:center;font-size:10px;font-weight:bold;">Estado</td></tr>${p1Rows}</table>`
    : '<p style="color:#166534;font-weight:bold;">✓ No hay avisos de prioridad 1.</p>';

  // ── Tabla 1: Pendientes (Avisos y Órdenes) por grupo ──
  const avisosDist = {};
  (resumen.avisos?.distribucion || []).forEach(item => { avisosDist[item.grupo] = item.cantidad; });
  const ordenesDist = {};
  (resumen.ordenes?.distribucion || []).forEach(item => { ordenesDist[item.grupo] = item.cantidad; });
  const gruposPendientes = Array.from(new Set([...Object.keys(avisosDist), ...Object.keys(ordenesDist)])).sort();

  const pendientesRows = gruposPendientes.map(grupo => `
    <tr>
      <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">${grupo}</td>
      <td style="padding:9px 8px;font-size:11px;color:#c62828;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${avisosDist[grupo] || 0}</td>
      <td style="padding:9px 8px;font-size:11px;color:#e96c28;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${ordenesDist[grupo] || 0}</td>
    </tr>`).join('') + `
    <tr style="background-color:#f0f4f8;font-weight:bold;">
      <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">TOTAL</td>
      <td style="padding:9px 8px;font-size:11px;color:#c62828;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${resumen.avisos?.total || 0}</td>
      <td style="padding:9px 8px;font-size:11px;color:#e96c28;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${resumen.ordenes?.total || 0}</td>
    </tr>`;

  const pendientesTableHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dde3ea" style="border-collapse:collapse;border:1px solid #dde3ea;margin-bottom:20px;">
      <tr bgcolor="#E55302" style="background-color:#E55302;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">${labelGrupo}</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Avisos</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">Órdenes</td>
      </tr>
      ${pendientesRows}
    </table>`;

  // ── Tabla 2: Cumplimiento (%) por grupo ──
  const tpGrupos = {};
  (resumen.trabajoPlanificado?.grupos || []).forEach(item => { tpGrupos[item.grupo] = item.cumplimiento; });
  const psGrupos = {};
  (resumen.programaSemanal?.grupos || []).forEach(item => { psGrupos[item.grupo] = item.cumplimiento; });
  const pmGrupos = {};
  (resumen.planMatriz?.grupos || []).forEach(item => { pmGrupos[item.grupo] = item.cumplimiento; });
  const gruposCumpl = Array.from(new Set([...Object.keys(tpGrupos), ...Object.keys(psGrupos), ...Object.keys(pmGrupos)])).sort();

  const fmtPct = (v) => (v === undefined || v === null) ? '—' : `${Math.round(v * 100)}%`;

  const cumplimientoRows = gruposCumpl.map(grupo => `
    <tr>
      <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">${grupo}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">${fmtPct(tpGrupos[grupo])}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${fmtPct(psGrupos[grupo])}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${fmtPct(pmGrupos[grupo])}</td>
    </tr>`).join('') + `
    <tr style="background-color:#f0f4f8;font-weight:bold;">
      <td style="padding:9px 12px;font-size:11px;color:#334155;border-bottom:1px solid #e2e8f0;font-weight:bold;font-family:Arial,sans-serif;">TOTAL</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;">${fmtPct(resumen.trabajoPlanificado?.cumplimiento)}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${fmtPct(resumen.programaSemanal?.cumplimiento)}</td>
      <td style="padding:9px 8px;font-size:11px;color:#334155;font-weight:bold;border-bottom:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">${fmtPct(resumen.planMatriz?.cumplimiento)}</td>
    </tr>`;

  const cumplimientoTableHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dde3ea" style="border-collapse:collapse;border:1px solid #dde3ea;margin-bottom:20px;">
      <tr bgcolor="#E55302" style="background-color:#E55302;">
        <td style="padding:10px 12px;font-size:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">${labelGrupo}</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:right;font-family:Arial,sans-serif;">% Trab. Plan.</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">% Prog. Sem.</td>
        <td style="padding:10px 8px;font-size:10px;font-weight:bold;color:#ffffff;text-align:center;font-family:Arial,sans-serif;">% Plan Matriz</td>
      </tr>
      ${cumplimientoRows}
    </table>`;

  const areaTableHtml = Object.keys(resumen).length > 0 ? (pendientesTableHtml + cumplimientoTableHtml) : '<p style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;">No hay datos de resumen.</p>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;font-family:Arial;}</style></head><body>
    <div style="background:#e8edf2;padding:24px;"><table width="816" style="max-width:816px;width:100%;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#0d7a8c;padding:18px 20px;"><div style="color:#7fd8e8;font-size:9px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">DIVISIÓN CHUQUICAMATA · GSYS</div><div style="color:#fff;font-size:19px;font-weight:bold;">Reporte de Proyecciones de Planificación</div><div style="color:#a8dde8;font-size:11px;margin-top:3px;">Semana ${semana}</div></td></tr>
      <tr><td style="padding:20px;">
        <div style="font-size:11px;color:#c62828;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;border-left:3px solid #c62828;padding-left:8px;">Avisos Prioridad 1 (${avisosP1.length})</div>
        ${p1TableHtml}
        <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;margin-top:20px;border-left:3px solid #0d7a8c;padding-left:8px;">Resumen por ${labelGrupo}</div>
        ${areaTableHtml}
      </td></tr>
      <tr><td style="background:#bb5726;padding:16px 20px;"><div style="color:#ffd4b8;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Fuente de datos</div><div style="color:#fff;font-size:10px;font-weight:bold;margin-top:4px;">Semana ${semana} · Monitoring</div></td></tr>
    </table></div>
  </body></html>`;
}
