'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { AlertTrendPoint, ScoreTrendPoint } from '@/lib/audit-trends'

interface TrendChartsProps {
  scoreTrend: ScoreTrendPoint[]
  alertTrend: AlertTrendPoint[]
}

const scorePalette = {
  performance: '#67e8f9',
  accessibility: '#a7f3d0',
  bestPractices: '#fda4af',
  seo: '#c4b5fd',
}

export function TrendCharts({ scoreTrend, alertTrend }: TrendChartsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Trends</p>
          <h2 className="text-xl font-semibold text-white">Score trends</h2>
          <p className="text-sm leading-6 text-slate-300">
            Recent Lighthouse score movement for the selected URL.
          </p>
        </div>

        <div className="mt-6 h-80">
          {scoreTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="label"
                  stroke="rgba(226,232,240,0.55)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="rgba(226,232,240,0.55)"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    color: '#fff',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="performance"
                  stroke={scorePalette.performance}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="accessibility"
                  stroke={scorePalette.accessibility}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bestPractices"
                  stroke={scorePalette.bestPractices}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="seo"
                  stroke={scorePalette.seo}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-6 text-sm text-slate-400">
              Run another audit to build a score trend.
            </div>
          )}
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Trends</p>
          <h2 className="text-xl font-semibold text-white">Alert trends</h2>
          <p className="text-sm leading-6 text-slate-300">
            Threshold drops grouped by the audit that triggered them.
          </p>
        </div>

        <div className="mt-6 h-80">
          {alertTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="label"
                  stroke="rgba(226,232,240,0.55)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="rgba(226,232,240,0.55)"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    color: '#fff',
                  }}
                  formatter={(value, name) => {
                    if (name === 'alertCount') {
                      return [value, 'Alerts']
                    }

                    if (name === 'totalDelta') {
                      return [value, 'Total score delta']
                    }

                    return [value, String(name)]
                  }}
                />
                <Legend />
                <Bar dataKey="totalDelta" name="Total score delta" fill="#fb7185" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-6 text-sm text-slate-400">
              Save an alert rule and run another audit to see alert history here.
            </div>
          )}
        </div>

        {alertTrend.length > 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Bars show the combined score delta for each alerted audit. Negative values mean a
            regression.
          </p>
        ) : null}
      </article>
    </section>
  )
}
