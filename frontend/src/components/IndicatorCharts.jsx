import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const C = {
  indigo: '#6366f1',
  purple: '#a855f7',
  orange: '#f97316',
  green:  '#10b981',
  red:    '#ef4444',
  cyan:   '#06b6d4',
  primary:'#3b82f6',
};

const ChartCard = ({ title, icon, children }) => (
  <div className="glass-card flex-col gap-0.5" style={{ minWidth: 0 }}>
    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
      <span className="material-icons" style={{ fontSize: '1.1rem', color: 'var(--secondary)' }}>{icon}</span>
      {title}
    </h3>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: 4 }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '0.75rem', color: e.color }}>{e.name}: {e.value}</p>
      ))}
    </div>
  );
};

/**
 * Gráficos compactos para los 5 indicadores del panel "Visualización de
 * Indicadores", a partir del kpiData de la sesión actual (sin consultar
 * histórico en Supabase — para eso está la sub-pestaña Dashboard).
 */
export default function IndicatorCharts({ kpiData }) {
  if (!kpiData) return null;

  const avisosData = (kpiData.resumenAvisos?.distribucion || []).map(g => ({ name: g.proceso || g.grPlanif, cantidad: g.cantidad || 0 }));
  const ordenesData = (kpiData.resumenOrdenes?.distribucion || []).map(g => ({ name: g.proceso || g.grPlanif, cantidad: g.cantidad || 0 }));
  const trabajoData = (kpiData.trabajoPlanificado?.grupos || []).map(g => ({
    name: g.proceso, Planificado: Math.round(g.planificado || 0), 'Sin HR': Math.round(g.sinHr || 0),
    'Sin Horizonte': Math.round(g.sinHorizonte || 0), Imprevistos: Math.round(g.imprevistos || 0)
  }));
  const progData = (kpiData.programaSemanal?.grupos || []).map(g => ({ name: g.proceso, Cumple: Math.round(g.cumple || 0), 'No Cumple': Math.round(g.noCumple || 0) }));
  const matrizData = (kpiData.planMatriz?.grupos || []).map(g => ({ name: g.proceso, Cumple: Math.round(g.cumple || 0), 'No Cumple': Math.round(g.noCumple || 0) }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
      <ChartCard title="Avisos Pendientes" icon="notification_important">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={avisosData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cantidad" name="Avisos" fill={C.orange} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Órdenes Pendientes" icon="assignment_late">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ordenesData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cantidad" name="Órdenes" fill={C.red} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="% Trabajo Planificado" icon="insights">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trabajoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
            <Bar dataKey="Planificado" stackId="a" fill={C.indigo} />
            <Bar dataKey="Sin HR" stackId="a" fill={C.purple} />
            <Bar dataKey="Sin Horizonte" stackId="a" fill={C.cyan} />
            <Bar dataKey="Imprevistos" stackId="a" fill={C.orange} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Programa Semanal" icon="date_range">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={progData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
            <Bar dataKey="Cumple" stackId="a" fill={C.green} />
            <Bar dataKey="No Cumple" stackId="a" fill={C.red} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Plan Matriz" icon="view_list">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={matrizData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
            <Bar dataKey="Cumple" stackId="a" fill={C.cyan} />
            <Bar dataKey="No Cumple" stackId="a" fill={C.purple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
