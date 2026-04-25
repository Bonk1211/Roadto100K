import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardStats } from 'shared';

interface Props {
  stats: DashboardStats | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  accent: string;
  series: number[];
}

export function StatsBar({ stats }: Props) {
  const [series, setSeries] = useState({
    alerts: ringSeries(20, 4, 9),
    risk: ringSeries(20, 6000, 22000),
    blocked: ringSeries(20, 0, 6),
    latency: ringSeries(20, 120, 320),
  });

  // Roll the sparklines forward whenever fresh stats arrive.
  useEffect(() => {
    if (!stats) return;
    setSeries((prev) => ({
      alerts: pushTrim(prev.alerts, stats.open_alerts),
      risk: pushTrim(prev.risk, stats.rm_at_risk),
      blocked: pushTrim(prev.blocked, stats.blocked_today),
      latency: pushTrim(prev.latency, stats.avg_response_ms),
    }));
  }, [stats]);

  const open = stats?.open_alerts ?? 0;
  const rm = stats?.rm_at_risk ?? 0;
  const blocked = stats?.blocked_today ?? 0;
  const latency = stats?.avg_response_ms ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Open alerts"
        value={String(open)}
        hint="Awaiting agent review"
        accent="#0055D4"
        series={series.alerts}
      />
      <MetricCard
        label="RM at risk today"
        value={`RM ${rm.toLocaleString('en-MY')}`}
        hint="Sum of unresolved transactions"
        accent="#DC2626"
        series={series.risk}
      />
      <MetricCard
        label="Blocked today"
        value={String(blocked)}
        hint="Stopped before funds left"
        accent="#16A34A"
        series={series.blocked}
      />
      <MetricCard
        label="Avg response"
        value={`${latency} ms`}
        hint="Rule + EAS + Bedrock pipeline"
        accent="#FF8A00"
        series={series.latency}
      />
    </div>
  );
}

function MetricCard({ label, value, hint, accent, series }: MetricCardProps) {
  const data = series.map((v, i) => ({ i, v }));
  return (
    <div
      className="flex flex-col rounded-lg bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            {label}
          </p>
          <p
            className="mt-1 font-bold leading-tight text-text-primary"
            style={{ fontSize: '26px' }}
          >
            {value}
          </p>
          <p className="mt-1 text-caption text-muted-text">{hint}</p>
        </div>
        <span
          className="inline-block h-2 w-2 rounded-pill"
          style={{ backgroundColor: accent }}
        />
      </div>

      <div className="mt-3 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              cursor={{ stroke: accent, strokeOpacity: 0.2 }}
              contentStyle={{
                background: '#071B33',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 12,
              }}
              labelFormatter={() => label}
              formatter={(val: number) => [val.toLocaleString('en-MY'), '']}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={accent}
              strokeWidth={2}
              fill={`url(#grad-${label})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ringSeries(n: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const wave = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
    out.push(Math.round(lo + (hi - lo) * (0.4 + wave * 0.6)));
  }
  return out;
}

function pushTrim(prev: number[], next: number): number[] {
  const out = prev.slice(1);
  out.push(next);
  return out;
}
