import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line, Cell, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { supabase } from '../utils/supabaseClient';
import html2pdf from 'html2pdf.js';

/* ─── Paleta de colores premium ─── */
const C = {
  primary: '#3b82f6',
  cyan:    '#06b6d4',
  green:   '#10b981',
  yellow:  '#f59e0b',
  red:     '#ef4444',
  indigo:  '#6366f1',
  purple:  '#a855f7',
  orange:  '#f97316',
};

/* ─── Tooltip personalizado ─── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 140 }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: 6 }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '0.8rem', color: e.color }}>
          <strong>{e.name}:</strong> {typeof e.value === 'number' && e.name.includes('%') ? `${Math.round(e.value * 100)}%` : e.value}
        </p>
      ))}
    </div>
  );
};

/* ─── Formatters ─── */
const fmtPct = (v) => `${Math.round(v * 100)}%`;
const semColors = (v) => v >= 0.95 ? C.green : v >= 0.70 ? C.yellow : C.red;

/* ─── Estilo de sección ─── */
const SectionCard = ({ title, icon, children, noPrint }) => (
  <div className="glass-card" style={{ marginBottom: '2rem', pageBreakInside: 'avoid', display: noPrint ? 'none' : 'block' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem', borderBottom: '1px solid var(--bg-card-border)', paddingBottom: '0.8rem' }}>
      <span className="material-icons" style={{ color: C.cyan, fontSize: '1.4rem' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{title}</span>
    </div>
    {children}
  </div>
);

export default function KpiDashboardCharts({ data: initialData, semana: currentWeek }) {
  const printRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dbData, setDbData] = useState(null);
  
  // Filtros
  const [weeks, setWeeks] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || '');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  
  // Efecto inicial: Cargar opciones de filtros
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        // Cargar Semanas Disponibles
        const { data: reports, error: rErr } = await supabase.from('kpi_reports').select('semana, anio, area_id').order('semana', { ascending: false });
        if (rErr) throw rErr;
        
        if (reports && reports.length > 0) {
          const uniqueWeeks = [...new Set(reports.map(r => r.semana))];
          setWeeks(uniqueWeeks);
          if (!selectedWeek || !uniqueWeeks.includes(Number(selectedWeek))) {
            setSelectedWeek(uniqueWeeks[0]);
          }
          
          // Cargar Áreas
          const { data: areasData, error: aErr } = await supabase.from('areas').select('id, nombre, gerencia_id');
          if (aErr) throw aErr;
          
          if (areasData && areasData.length > 0) {
            setAreas(areasData);
            if (!selectedAreaId) setSelectedAreaId(areasData[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching filters from Supabase:', err);
      }
    };
    
    fetchFilters();
  }, []);

  // Efecto: Cargar datos históricos cuando cambian los filtros
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedWeek || !selectedAreaId) return;
      
      setLoading(true);
      try {
        const { data: report, error: rErr } = await supabase
          .from('kpi_reports')
          .select('id')
          .eq('semana', selectedWeek)
          .eq('area_id', selectedAreaId)
          .single();
          
        if (rErr) {
          setDbData(null);
          setLoading(false);
          return;
        }

        const { data: metrics, error: mErr } = await supabase
          .from('kpi_metrics')
          .select('*')
          .eq('report_id', report.id);
          
        if (mErr) throw mErr;

        // Reconstruir estructura original desde los metadatos
        const reconstructed = {
          resumenAvisos: { distribucion: [], total: 0 },
          resumenOrdenes: { distribucion: [], total: 0 },
          trabajoPlanificado: { grupos: [], total: {} },
          programaSemanal: { grupos: [], total: {} },
          planMatriz: { grupos: [], total: {} },
          indicadores: {}
        };

        metrics.forEach(m => {
          const meta = m.metadata || {};
          if (m.kpi_type === 'avisos_pendientes') reconstructed.resumenAvisos.distribucion.push(meta);
          if (m.kpi_type === 'ordenes_pendientes') reconstructed.resumenOrdenes.distribucion.push(meta);
          if (m.kpi_type === 'trabajo_planificado') reconstructed.trabajoPlanificado.grupos.push(meta);
          if (m.kpi_type === 'programa_semanal') reconstructed.programaSemanal.grupos.push(meta);
          if (m.kpi_type === 'plan_matriz') reconstructed.planMatriz.grupos.push(meta);
        });

        // Helper para recalcular totales e indicadores
        const calcTotal = (groups, keys) => {
          const sum = {}; keys.forEach(k => sum[k] = 0);
          groups.forEach(g => keys.forEach(k => sum[k] += (Number(g[k]) || 0)));
          return sum;
        };

        reconstructed.resumenAvisos.total = calcTotal(reconstructed.resumenAvisos.distribucion, ['cantidad']).cantidad;
        reconstructed.resumenOrdenes.total = calcTotal(reconstructed.resumenOrdenes.distribucion, ['cantidad']).cantidad;
        
        const tpTotals = calcTotal(reconstructed.trabajoPlanificado.grupos, ['planificado', 'sinHr', 'imprevistos', 'total']);
        tpTotals.cumplimiento = tpTotals.total > 0 ? tpTotals.planificado / tpTotals.total : 0;
        reconstructed.trabajoPlanificado.total = tpTotals;

        const psTotals = calcTotal(reconstructed.programaSemanal.grupos, ['cumple', 'noCumple', 'total']);
        psTotals.cumplimiento = psTotals.total > 0 ? psTotals.cumple / psTotals.total : 0;
        reconstructed.programaSemanal.total = psTotals;

        const pmTotals = calcTotal(reconstructed.planMatriz.grupos, ['cumple', 'noCumple', 'total']);
        pmTotals.cumplimiento = pmTotals.total > 0 ? pmTotals.cumple / pmTotals.total : 0;
        reconstructed.planMatriz.total = pmTotals;

        reconstructed.indicadores = {
          avisosPendientes: reconstructed.resumenAvisos.total,
          ordenesPendientes: reconstructed.resumenOrdenes.total,
          trabajoPlanificado: Math.round(tpTotals.cumplimiento * 100),
          programaSemanal: Math.round(psTotals.cumplimiento * 100),
          planMatriz: Math.round(pmTotals.cumplimiento * 100)
        };

        setDbData(reconstructed);
      } catch (err) {
        console.error('Error fetching historical data:', err);
        setDbData(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedWeek, selectedAreaId]);

  // Si hay initialData (nuevo excel subido), prevalece. Sino, usamos el de DB.
  const displayData = initialData || dbData;

  const handlePdfExport = () => {
    const element = document.getElementById('kpi-dashboard-print');
    
    // Configuración para html2pdf
    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Dashboard_KPI_Semana_${selectedWeek || currentWeek}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'letter', orientation: 'landscape' }
    };
    
    // Inyectamos estilo temporal para ocultar cosas
    const style = document.createElement('style');
    style.innerHTML = `
      .no-print { display: none !important; }
      .glass-card { box-shadow: none !important; border: 1px solid #ddd !important; background: #fff !important; }
      .premium-table th { background: #f0f0f0 !important; color: #000 !important; }
      .premium-table td { color: #333 !important; }
      * { color: #000; }
    `;
    document.head.appendChild(style);
    
    html2pdf().set(opt).from(element).save().then(() => {
      document.head.removeChild(style);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', width: '100%' }}>
      {/* Barra de Filtros */}
      <div className="glass-card flex-col gap-1 no-print" style={{ marginBottom: '1.5rem', padding: '1rem 1.2rem' }}>
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="material-icons" style={{ color: C.cyan }}>filter_alt</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>
              Filtros e Histórico de Dashboard
            </span>
          </div>
          <button onClick={handlePdfExport} className="btn btn-primary flex-center gap-0.5" disabled={!displayData}>
            <span className="material-icons">download</span>
            <span>Generar y Descargar PDF</span>
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          <div className="form-group">
            <label>Área / Superintendencia</label>
            <select className="form-control" value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
              <option value="">Seleccione Área...</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Semana</label>
            <select className="form-control" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
              <option value="">Seleccione Semana...</option>
              {weeks.map(w => <option key={w} value={w}>Semana {w}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="glass-card flex-center" style={{ padding: '3rem', color: 'var(--text-muted)' }}>
          <span className="material-icons" style={{ fontSize: '2rem', animation: 'spin 2s linear infinite' }}>sync</span>
          <span style={{ marginLeft: '1rem' }}>Cargando datos históricos...</span>
        </div>
      )}

      {!loading && !displayData && (
        <div className="glass-card flex-center" style={{ padding: '3rem', color: 'var(--text-muted)' }}>
          No hay datos disponibles para el filtro seleccionado.
        </div>
      )}

      {/* ─── Contenido imprimible ─── */}
      {!loading && displayData && (
        <div id="kpi-dashboard-print" ref={printRef} style={{ background: 'var(--bg-app)', color: 'var(--text-main)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
             <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>DASHBOARD KPI MANTENIMIENTO</h1>
             <p style={{ color: 'var(--text-muted)' }}>Semana: {selectedWeek || currentWeek} | Área seleccionada</p>
          </div>

          <SectionCard title="Resumen Ejecutivo" icon="dashboard">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
              {[
                { label: 'Avisos Pend.', val: displayData.indicadores.avisosPendientes, icon: 'notification_important', reverse: true },
                { label: 'Órdenes Pend.', val: displayData.indicadores.ordenesPendientes, icon: 'assignment_late', reverse: true },
                { label: '% Trab.Plan.', val: displayData.indicadores.trabajoPlanificado, icon: 'insights', isPercent: true },
                { label: 'Prog.Semanal', val: displayData.indicadores.programaSemanal, icon: 'date_range', isPercent: true },
                { label: 'Plan Matriz', val: displayData.indicadores.planMatriz, icon: 'view_list', isPercent: true },
              ].map(({ label, val, icon, reverse, isPercent }) => {
                const status = reverse
                  ? (val === 0 ? 'success' : val < 10 ? 'warning' : 'danger')
                  : (val >= 85 ? 'success' : val >= 70 ? 'warning' : 'danger');
                const bg = status === 'success' ? 'linear-gradient(135deg,#10b981,#059669)' : status === 'warning' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#ef4444,#dc2626)';
                return (
                  <div key={label} style={{ background: bg, borderRadius: 14, padding: '1.2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                    <span className="material-icons" style={{ fontSize: '2rem', opacity: 0.85 }}>{icon}</span>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>{val}{isPercent ? '%' : ''}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.9, textAlign: 'center', fontWeight: 600 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Análisis de Trabajo Planificado" icon="insights">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={(displayData.trabajoPlanificado?.grupos || []).map(g => ({...g, Planificado: Math.round(g.planificado), 'Sin HR': Math.round(g.sinHr), Imprevistos: Math.round(g.imprevistos)}))} margin={{ top: 20, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" vertical={false} />
                <XAxis dataKey="proceso" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={fmtPct} tick={{ fill: C.cyan, fontSize: 11 }} domain={[0, 1]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.9rem' }} />
                <Bar yAxisId="left" dataKey="Planificado" stackId="a" fill={C.indigo} radius={[0,0,0,0]} />
                <Bar yAxisId="left" dataKey="Sin HR" stackId="a" fill={C.purple} radius={[0,0,0,0]} />
                <Bar yAxisId="left" dataKey="Imprevistos" stackId="a" fill={C.orange} radius={[4,4,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="cumplimiento" name="Cumplimiento %" stroke={C.cyan} strokeWidth={4} dot={{ r: 6, fill: C.cyan, strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Programa Semanal vs Plan Matriz" icon="compare_arrows">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h4 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>Programa Semanal</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={(displayData.programaSemanal?.grupos || []).map(g => ({...g, Cumple: Math.round(g.cumple), 'No Cumple': Math.round(g.noCumple)}))} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" vertical={false} />
                    <XAxis dataKey="proceso" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={fmtPct} tick={{ fill: C.yellow, fontSize: 10 }} domain={[0, 1]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Bar yAxisId="left" dataKey="Cumple" stackId="a" fill={C.green} radius={[0,0,0,0]} />
                    <Bar yAxisId="left" dataKey="No Cumple" stackId="a" fill={C.red} radius={[4,4,0,0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumplimiento" name="Cump.%" stroke={C.yellow} strokeWidth={3} dot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>Plan Matriz</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={(displayData.planMatriz?.grupos || []).map(g => ({...g, Cumple: Math.round(g.cumple), 'No Cumple': Math.round(g.noCumple)}))} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" vertical={false} />
                    <XAxis dataKey="proceso" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={fmtPct} tick={{ fill: C.primary, fontSize: 10 }} domain={[0, 1]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Bar yAxisId="left" dataKey="Cumple" stackId="a" fill={C.cyan} radius={[0,0,0,0]} />
                    <Bar yAxisId="left" dataKey="No Cumple" stackId="a" fill={C.purple} radius={[4,4,0,0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumplimiento" name="Cump.%" stroke={C.primary} strokeWidth={3} dot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>
          
          <SectionCard title="Backlog de Pendientes (Avisos y Órdenes)" icon="assignment">
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(displayData.resumenAvisos?.distribucion || []).map(g => ({ name: g.proceso || g.grPlanif, cantidad: g.cantidad || 0 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cantidad" name="Avisos" fill={C.orange} radius={[0, 6, 6, 0]} label={{ position: 'right', fill: 'var(--text-main)', fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(displayData.resumenOrdenes?.distribucion || []).map(g => ({ name: g.proceso || g.grPlanif, cantidad: g.cantidad || 0 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cantidad" name="Órdenes" fill={C.red} radius={[0, 6, 6, 0]} label={{ position: 'right', fill: 'var(--text-main)', fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
             </div>
          </SectionCard>

          {/* ═══ HOJA 2+: Tablas de detalle para el PDF ═══ */}
          <div style={{ pageBreakBefore: 'always', paddingTop: '2rem' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Detalle de Datos Semanales</h2>
            
            <SectionCard title="Detalle: % Trabajo Planificado" icon="insights">
              <table className="premium-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead><tr><th>Proceso</th><th>Gr.Planif</th><th>Gr.Planif PM</th><th className="text-right">Planificado</th><th className="text-right">Sin HR</th><th className="text-right">Imprevistos</th><th className="text-right">Total HH</th><th className="text-center">Cumpl.</th></tr></thead>
                <tbody>
                  {(displayData.trabajoPlanificado?.grupos || []).map((g, i) => (
                    <tr key={i}>
                      <td>{g.proceso}</td><td>{g.grPlanif}</td><td>{g.grPlanifPM}</td>
                      <td className="text-right font-number">{Math.round(g.planificado)}</td>
                      <td className="text-right font-number">{Math.round(g.sinHr)}</td>
                      <td className="text-right font-number">{Math.round(g.imprevistos)}</td>
                      <td className="text-right font-number font-bold">{Math.round(g.total)}</td>
                      <td className="text-center"><span style={{ color: semColors(g.cumplimiento), fontWeight: 700 }}>{Math.round(g.cumplimiento * 100)}%</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="footer-row"><td colSpan="3">TOTAL</td><td className="text-right font-number">{Math.round(displayData.trabajoPlanificado?.total?.planificado || 0)}</td><td className="text-right font-number">{Math.round(displayData.trabajoPlanificado?.total?.sinHr || 0)}</td><td className="text-right font-number">{Math.round(displayData.trabajoPlanificado?.total?.imprevistos || 0)}</td><td className="text-right font-number font-bold">{Math.round(displayData.trabajoPlanificado?.total?.total || 0)}</td><td className="text-center font-bold" style={{ color: semColors(displayData.trabajoPlanificado?.total?.cumplimiento || 0) }}>{Math.round((displayData.trabajoPlanificado?.total?.cumplimiento || 0) * 100)}%</td></tr></tfoot>
              </table>
            </SectionCard>

            {[['Programa Semanal', 'date_range', displayData.programaSemanal], ['Plan Matriz', 'view_list', displayData.planMatriz]].map(([title, icon, sec]) => (
              <SectionCard key={title} title={`Detalle: ${title}`} icon={icon}>
                <table className="premium-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead><tr><th>Proceso</th><th>Gr.Planif</th><th>Gr.Planif PM</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total</th><th className="text-center">Cumpl.</th></tr></thead>
                  <tbody>
                    {(sec?.grupos || []).map((g, i) => (
                      <tr key={i}>
                        <td>{g.proceso}</td><td>{g.grPlanif}</td><td>{g.grPlanifPM}</td>
                        <td className="text-center font-number">{Math.round(g.cumple)}</td>
                        <td className="text-center font-number">{Math.round(g.noCumple)}</td>
                        <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                        <td className="text-center"><span style={{ color: semColors(g.cumplimiento), fontWeight: 700 }}>{Math.round(g.cumplimiento * 100)}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="footer-row"><td colSpan="3">TOTAL</td><td className="text-center font-number">{Math.round(sec?.total?.cumple || 0)}</td><td className="text-center font-number">{Math.round(sec?.total?.noCumple || 0)}</td><td className="text-center font-number font-bold">{Math.round(sec?.total?.total || 0)}</td><td className="text-center font-bold" style={{ color: semColors(sec?.total?.cumplimiento || 0) }}>{Math.round((sec?.total?.cumplimiento || 0) * 100)}%</td></tr></tfoot>
                </table>
              </SectionCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
