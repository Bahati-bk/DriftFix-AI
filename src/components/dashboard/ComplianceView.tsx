'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';

const sevColors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#64748b' };

export function ComplianceView() {
  const [compliance, setCompliance] = useState<Record<string, unknown> | null>(null);
  const [trends, setTrends] = useState<Record<string, unknown>[]>([]);
  const [sevBreakdown, setSevBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const compRes = await fetch('/api/compliance');
        const trendRes = await fetch('/api/compliance?type=trends');
        const comp = await compRes.json();
        const trend = await trendRes.json();
        setCompliance(comp);
        setTrends(trend.history || []);
        setSevBreakdown(
          Object.entries(comp.severityBreakdown || {}).map(([name, value]: [string, number]) => ({
            name,
            value: Number(value),
            color: sevColors[name] || '#64748b',
          }))
          .filter((d: { value: number }) => d.value > 0),
        );
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-6 space-y-4"><div className="h-8 w-48 bg-muted rounded animate-pulse" /><div className="h-60 bg-muted rounded-lg animate-pulse" /><div className="h-60 bg-muted rounded-lg animate-pulse" /></div>;
  }

  const score = Number(compliance?.score || 0);
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const circ = 2 * Math.PI * 70;
  const off = circ - (score / 100) * circ;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">Organization-wide compliance posture and trends</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-border/50">
          <CardContent className="p-6 flex flex-col items-center">
            <svg className="w-44 h-44 -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="10" className="text-secondary" />
              <circle cx="80" cy="80" r="70" fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
            </svg>
            <div className="-mt-8 mb-16 text-center">
              <div className="text-4xl font-bold" style={{ color: scoreColor }}>{score}</div>
              <div className="text-xs text-muted-foreground">COMPLIANCE SCORE</div>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full mt-4 text-center">
              <div><div className="text-lg font-bold" style={{ color: scoreColor }}>{compliance?.criticalCount || 0}</div><div className="text-[10px] text-muted-foreground">Critical</div></div>
              <div><div className="text-lg font-bold" style={{ color: scoreColor }}>{compliance?.highCount || 0}</div><div className="text-[10px] text-muted-foreground">High</div></div>
              <div><div className="text-lg font-bold text-yellow-500">{compliance?.mediumCount || 0}</div><div className="text-[10px] text-muted-foreground">Medium</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Compliance Score Over Time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends as { weekLabel: string; score: number }[]}>
                  <defs>
                    <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="#a78bfa" fill="url(#tGrad)" strokeWidth={2} />
                </ResponsiveContainer>
              </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Findings by Severity</CardTitle></CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sevBreakdown} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} width={80} />
                    <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {sevBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Score Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sevBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {sevBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </PieChart>
                  <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {sevBreakdown.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span>{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center pb-4">
        DriftFix provides engineering compliance guidance. This is not legal advice or a certification.
      </p>
    </div>
  );
}
