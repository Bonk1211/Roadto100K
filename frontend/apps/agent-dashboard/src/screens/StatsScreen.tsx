import { useEffect, useMemo, useState } from 'react';
import {
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
import type { Alert } from 'shared';
import { fetchAlerts, fetchStats } from '../lib/api.js';
import { StatsBar } from '../components/StatsBar.js';

const SCAM_COLORS = ['#DC2626', '#FF8A00', '#0055D4', '#16A34A', '#9D174D', '#6B7280'];

export function StatsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState(null as Awaited<ReturnType<typeof fetchStats>> | null);

  useEffect(() => {
    Promise.all([fetchAlerts(), fetchStats()])
      .then(([a, s]) => {
        setAlerts(a);
        setStats(s);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      });
  }, []);

  const byScamType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) {
      const k = a.explanation.scam_type;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const byBand = useMemo(() => {
    const buckets = { Low: 0, Medium: 0, High: 0 };
    for (const a of alerts) {
      if (a.score < 40) buckets.Low += 1;
      else if (a.score < 71) buckets.Medium += 1;
      else buckets.High += 1;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  return (
    <div className="flex h-full flex-col gap-6">
      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Alerts by risk band">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byBand}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" />
              <YAxis allowDecimals={false} stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  background: '#071B33',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {byBand.map((b, i) => (
                  <Cell
                    key={b.name}
                    fill={['#16A34A', '#FFE600', '#DC2626'][i] ?? '#005BAC'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Alerts by scam type">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={byScamType}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                paddingAngle={2}
                label={({ name, value }) => `${name} (${value})`}
              >
                {byScamType.map((_, i) => (
                  <Cell key={i} fill={SCAM_COLORS[i % SCAM_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#071B33',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <h3 className="mb-4 text-card-title text-text-primary">{title}</h3>
      {children}
    </section>
  );
}
