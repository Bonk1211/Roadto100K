import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { VerificationRun } from '../../lib/agentops.js';
import {
  CHART_COLORS,
  agentBars,
  cycleSeries,
  scamTypeBuckets,
  verdictDonut,
} from '../../lib/charts.js';

interface Props {
  runs: VerificationRun[];
}

export function AnalyticsStrip({ runs }: Props) {
  const [open, setOpen] = useState(true);
  const donut = verdictDonut(runs);
  const bars = agentBars(runs);
  const cycle = cycleSeries(runs);
  const scams = scamTypeBuckets(runs);
  const decidedTotal = donut.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-small-label uppercase tracking-wide" style={{ color: '#0055D4' }}>
          Analytics
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-pill px-3 py-1 text-small-label font-semibold transition-colors hover:bg-app-gray"
          style={{ color: '#0055D4', border: '1px solid #BFDBFE' }}
        >
          {open ? '▾ Hide charts' : '▸ Show charts'}
        </button>
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Verdict mix" subtitle={`${decidedTotal} cases`}>
            {decidedTotal === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={donut}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donut.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name) => [
                      `${v} (${decidedTotal > 0 ? Math.round((v / decidedTotal) * 100) : 0}%)`,
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {decidedTotal > 0 && (
              <div className="-mt-3 flex flex-wrap justify-center gap-2 text-[10px]">
                {donut.map((d) => (
                  <span key={d.key} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-pill"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="font-semibold text-text-primary">{d.name}</span>
                    <span className="text-muted-text">{d.value}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Agent throughput" subtitle="Verdicts / specialist">
            {bars.every((b) => b.blocks + b.warns + b.clears + b.inconclusive === 0) ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="22%">
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,85,212,0.06)' }} />
                  <Bar dataKey="blocks" stackId="v" fill={CHART_COLORS.block} />
                  <Bar dataKey="warns" stackId="v" fill={CHART_COLORS.warn} />
                  <Bar dataKey="clears" stackId="v" fill={CHART_COLORS.clear} />
                  <Bar dataKey="inconclusive" stackId="v" fill={CHART_COLORS.inconclusive} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Cycle time" subtitle="seconds per case">
            {cycle.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={cycle} margin={{ top: 6, right: 4, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="cycleStripGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.brandSoft} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART_COLORS.brandSoft} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="s" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v}s`, 'Cycle']}
                    labelFormatter={(l) => `Decided ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cycleSec"
                    stroke={CHART_COLORS.brand}
                    strokeWidth={2}
                    fill="url(#cycleStripGrad)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Scam types" subtitle="decisions per pattern">
            {scams.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={scams.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 4 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="type" type="category" width={88} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,85,212,0.06)' }} />
                  <Bar dataKey="block" stackId="t" fill={CHART_COLORS.block} />
                  <Bar dataKey="warn" stackId="t" fill={CHART_COLORS.warn} />
                  <Bar dataKey="clear" stackId="t" fill={CHART_COLORS.clear} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl bg-white p-3 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header className="mb-1">
        <p className="text-[10px] uppercase tracking-wide" style={{ color: '#0055D4' }}>
          {title}
        </p>
        <p className="text-[10px] text-muted-text">{subtitle}</p>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[120px] items-center justify-center rounded-md text-[10px] text-muted-text" style={{ backgroundColor: '#F8FAFC' }}>
      Waiting for data…
    </div>
  );
}

const axisTick = { fontSize: 10, fill: '#64748B', fontWeight: 600 };
const tooltipStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  fontSize: 11,
  padding: '6px 8px',
  boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
};
