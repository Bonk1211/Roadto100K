import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  fmtSec,
  scamTypeBuckets,
  verdictDonut,
} from '../../lib/charts.js';

interface Props {
  runs: VerificationRun[];
}

export function AnalyticsRow({ runs }: Props) {
  const donut = verdictDonut(runs);
  const bars = agentBars(runs);
  const cycle = cycleSeries(runs);
  const scamBuckets = scamTypeBuckets(runs);
  const decidedTotal = donut.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-4" title="Verdict mix" subtitle={`Across ${decidedTotal} decisions`}>
        {decidedTotal === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={donut}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={88}
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
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={legendStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        {decidedTotal > 0 && (
          <div className="mt-1 text-center">
            <p className="text-[28px] font-bold text-text-primary">{decidedTotal}</p>
            <p className="text-small-label uppercase tracking-wide text-muted-text">total decided</p>
          </div>
        )}
      </Card>

      <Card className="lg:col-span-4" title="Agent throughput" subtitle="Verdicts per specialist">
        {bars.every((b) => b.blocks + b.warns + b.clears + b.inconclusive === 0) ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bars} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,85,212,0.06)' }} />
              <Legend wrapperStyle={legendStyle} iconType="circle" />
              <Bar dataKey="blocks" name="Block" stackId="v" fill={CHART_COLORS.block} radius={[0, 0, 0, 0]} />
              <Bar dataKey="warns" name="Warn" stackId="v" fill={CHART_COLORS.warn} />
              <Bar dataKey="clears" name="Clear" stackId="v" fill={CHART_COLORS.clear} />
              <Bar dataKey="inconclusive" name="Incon." stackId="v" fill={CHART_COLORS.inconclusive} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="lg:col-span-4" title="Cycle time" subtitle="Seconds per case (oldest → newest)">
        {cycle.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cycle} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
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
                strokeWidth={2.5}
                fill="url(#cycleGrad)"
                dot={{ r: 3, stroke: CHART_COLORS.brand, fill: '#FFFFFF', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        className="lg:col-span-12"
        title="Scam type breakdown"
        subtitle="How many decisions per detected pattern"
      >
        {scamBuckets.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scamBuckets} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }} barCategoryGap="28%">
              <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="type" type="category" width={140} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,85,212,0.06)' }} />
              <Legend wrapperStyle={legendStyle} iconType="circle" />
              <Bar dataKey="block" name="Block" stackId="t" fill={CHART_COLORS.block} radius={[0, 0, 0, 0]} />
              <Bar dataKey="warn" name="Warn" stackId="t" fill={CHART_COLORS.warn} />
              <Bar dataKey="clear" name="Clear" stackId="t" fill={CHART_COLORS.clear} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-card ${className}`}
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header>
        <p className="text-small-label uppercase tracking-wide" style={{ color: '#0055D4' }}>
          {title}
        </p>
        <p className="text-caption text-muted-text">{subtitle}</p>
      </header>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-md text-caption text-muted-text" style={{ backgroundColor: '#F8FAFC' }}>
      Waiting for first decision…
    </div>
  );
}

const axisTick = { fontSize: 11, fill: '#64748B', fontWeight: 600 };
const tooltipStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  fontSize: 12,
  padding: '8px 10px',
  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
};
const legendStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  paddingTop: 4,
};
