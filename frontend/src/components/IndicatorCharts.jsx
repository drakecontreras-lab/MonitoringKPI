import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';

/* Paleta validada (dataviz skill: scripts/validate_palette.js) — categórica
   fija para composición de Trabajo Planificado, estado fijo (good/critical)
   para proporciones cumple/no-cumple. Cada rol tiene variante clara/oscura. */
const PALETTE = {
  light: {
    avisos: '#2a78d6', ordenes: '#eb6834',
    planificado: '#008300', sinHr: '#eda100', sinHorizonte: '#2a78d6', imprevistos: '#e34948',
    cumple: '#0ca30c', noCumple: '#d03b3b',
    grid: '#e2e8f0',
  },
  dark: {
    avisos: '#3987e5', ordenes: '#d95926',
    planificado: '#008300', sinHr: '#c98500', sinHorizonte: '#3987e5', imprevistos: '#e66767',
    cumple: '#0ca30c', noCumple: '#e66767',
    grid: '#2d3548',
  },
};

function useChartTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(target.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    });
    observer.observe(target, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

const ChartCard = ({ title, icon, subtitle, span, children }) => (
  <div className="glass-card flex-col gap-0.5" style={{ minWidth: 0, gridColumn: span ? '1 / -1' : undefined }}>
    <div>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
        <span className="material-icons" style={{ fontSize: '1.1rem', color: 'var(--secondary)' }}>{icon}</span>
        {title}
      </h3>
      {subtitle && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtitle}</span>}
    </div>
    {children}
  </div>
);

const CountTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, fontSize: '0.75rem', color: payload[0].color }}>{payload[0].name}: {payload[0].value}</p>
    </div>
  );
};

/* Tooltip para barras 100% apiladas: muestra el valor absoluto de cada
   segmento (guardado en __abs) en vez del porcentaje normalizado. */
const CompositionTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: 4 }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '0.75rem', color: e.color }}>
          {e.name}: {Math.round(e.payload[`__abs_${e.dataKey}`] ?? 0)} ({Math.round(e.value)}%)
        </p>
      ))}
    </div>
  );
};

const endLabel = (props) => {
  const { x, y, width, height, value } = props;
  if (value < 8) return null;
  return (
    <text x={x + width - 6} y={y + height / 2} textAnchor="end" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#fff">
      {Math.round(value)}%
    </text>
  );
};

/** Convierte un array de grupos en filas normalizadas a 100% (una por
 * categoría), ordenadas descendente por la primera clave (la "buena"). */
function toComposition(grupos, keys) {
  return (grupos || [])
    .map(g => {
      const abs = {}; let total = 0;
      keys.forEach(k => { abs[k] = Math.max(0, Number(g[k]) || 0); total += abs[k]; });
      const row = { name: g.proceso };
      keys.forEach(k => {
        row[k] = total > 0 ? (abs[k] / total) * 100 : 0;
        row[`__abs_${k}`] = abs[k];
      });
      row.__total = total;
      return row;
    })
    .filter(r => r.__total > 0)
    .sort((a, b) => b[keys[0]] - a[keys[0]]);
}

/**
 * Gráficos para los 5 indicadores del panel "Visualización de Indicadores",
 * a partir del kpiData de la sesión actual. Elegidos según el tipo de dato:
 * conteo por categoría → barra horizontal ordenada; composición/proporción
 * (cumple vs no-cumple, desglose de HH) → barra 100% apilada con % directo.
 */
export default function IndicatorCharts({ kpiData }) {
  const theme = useChartTheme();
  const C = PALETTE[theme];
  if (!kpiData) return null;

  const avisosData = (kpiData.resumenAvisos?.distribucion || [])
    .map(g => ({ name: g.proceso || g.grPlanif, cantidad: g.cantidad || 0 }))
    .filter(r => r.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);
  const ordenesData = (kpiData.resumenOrdenes?.distribucion || [])
    .map(g => ({ name: g.proceso || g.grPlanif, cantidad: g.cantidad || 0 }))
    .filter(r => r.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  const trabajoData = toComposition(kpiData.trabajoPlanificado?.grupos, ['planificado', 'sinHr', 'sinHorizonte', 'imprevistos']);
  const progData = toComposition(kpiData.programaSemanal?.grupos, ['cumple', 'noCumple']);
  const matrizData = toComposition(kpiData.planMatriz?.grupos, ['cumple', 'noCumple']);

  const rowHeight = 26;
  const hFor = (n) => Math.max(120, n * rowHeight + 40);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
      <ChartCard title="Avisos Pendientes" icon="notification_important" subtitle="Cantidad por proceso">
        <ResponsiveContainer width="100%" height={hFor(avisosData.length)}>
          <BarChart data={avisosData} layout="vertical" margin={{ left: 10, right: 24, top: 5, bottom: 5 }} barCategoryGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Bar dataKey="cantidad" name="Avisos" fill={C.avisos} radius={[0, 4, 4, 0]} maxBarSize={16}>
              <LabelList dataKey="cantidad" position="right" fill="var(--text-main)" fontSize={10} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Órdenes Pendientes" icon="assignment_late" subtitle="Cantidad por proceso">
        <ResponsiveContainer width="100%" height={hFor(ordenesData.length)}>
          <BarChart data={ordenesData} layout="vertical" margin={{ left: 10, right: 24, top: 5, bottom: 5 }} barCategoryGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Bar dataKey="cantidad" name="Órdenes" fill={C.ordenes} radius={[0, 4, 4, 0]} maxBarSize={16}>
              <LabelList dataKey="cantidad" position="right" fill="var(--text-main)" fontSize={10} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="% Trabajo Planificado" icon="insights" subtitle="Composición de HH por proceso, ordenado por % planificado" span>
        <ResponsiveContainer width="100%" height={hFor(trabajoData.length)}>
          <BarChart data={trabajoData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }} barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CompositionTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} formatter={(v) => ({ planificado: 'Planificado', sinHr: 'Sin HR', sinHorizonte: 'Sin Horizonte', imprevistos: 'Imprevistos' }[v] || v)} />
            <Bar dataKey="planificado" name="Planificado" stackId="a" fill={C.planificado}>
              <LabelList content={endLabel} />
            </Bar>
            <Bar dataKey="sinHr" name="Sin HR" stackId="a" fill={C.sinHr} />
            <Bar dataKey="sinHorizonte" name="Sin Horizonte" stackId="a" fill={C.sinHorizonte} />
            <Bar dataKey="imprevistos" name="Imprevistos" stackId="a" fill={C.imprevistos} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Programa Semanal" icon="date_range" subtitle="% cumplimiento por proceso">
        <ResponsiveContainer width="100%" height={hFor(progData.length)}>
          <BarChart data={progData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }} barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CompositionTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} formatter={(v) => ({ cumple: 'Cumple', noCumple: 'No Cumple' }[v] || v)} />
            <Bar dataKey="cumple" name="Cumple" stackId="a" fill={C.cumple}>
              <LabelList content={endLabel} />
            </Bar>
            <Bar dataKey="noCumple" name="No Cumple" stackId="a" fill={C.noCumple} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Plan Matriz" icon="view_list" subtitle="% cumplimiento por proceso">
        <ResponsiveContainer width="100%" height={hFor(matrizData.length)}>
          <BarChart data={matrizData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }} barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
            <Tooltip content={<CompositionTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} formatter={(v) => ({ cumple: 'Cumple', noCumple: 'No Cumple' }[v] || v)} />
            <Bar dataKey="cumple" name="Cumple" stackId="a" fill={C.cumple}>
              <LabelList content={endLabel} />
            </Bar>
            <Bar dataKey="noCumple" name="No Cumple" stackId="a" fill={C.noCumple} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
