'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const sevColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#64748b',
};

const sevLabels: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export function ComplianceView() {
  const [compliance, setCompliance] = useState<Record<string, unknown> | null>(null);
  const [trends, setTrends] = useState<Record<string, unknown>[]>([]);
  const [sevBreakdown, setSevBreakdown] = useState<{ name: string; value: number; color: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [compRes, trendRes] = await Promise.all([
          fetch('/api/compliance'),
          fetch('/api/compliance?type=trends'),
        ]);
        const comp = await compRes.json();
        const trend = await trendRes.json();
        setCompliance(comp);
        setTrends(trend.history || []);
        const breakdown = (
          Object.entries(comp.severityBreakdown || {}).map(
            ([name, value]: [string, number]) => ({
              name,
              value: Number(value),
              color: sevColors[name] || '#64748b',
              label: sevLabels[name] || name,
            }),
          ) as { name: string; value: number; color: string; label: string }[]
        ).filter((d) => d.value > 0);
        setSevBreakdown(breakdown);
      } catch {
        /* empty */
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const score = Number(compliance?.score || 0);
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const radius = 90;
  const circ = 2 * Math.PI * radius;
  const off = circ - (score / 100) * circ;

  const totalFindings = sevBreakdown.reduce((sum, s) => sum + s.value, 0);

  const trendScores = trends.map((t) => Number(t.score || 0));
  const trendChange =
    trendScores.length >= 2
      ? trendScores[trendScores.length - 1] - trendScores[0]
      : 0;

  const TrendIcon = trendChange > 0 ? TrendingUp : trendChange < 0 ? TrendingDown : Minus;
  const trendColor = trendChange > 0 ? 'text-emerald-400' : trendChange < 0 ? 'text-red-400' : 'text-muted-foreground';

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">Organization-wide compliance posture and trends</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="relative">
            <svg className="w-64 h-64 -rotate-90" viewBox={`0 0 ${radius * 2 + 20} ${radius * 2 + 20}`}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle
                cx={radius + 10}
                cy={radius + 10}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-secondary"
              />
              <circle
                cx={radius + 10}
                cy={radius + 10}
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={off}
                filter="url(#glow)"
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-bold" style={{ color: scoreColor }}>
                {score}
              </div>
              <div className="text-xs text-muted-foreground mt-1 tracking-wider">COMPLIANCE SCORE</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-6">
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            <span className={`text-sm font-medium ${trendColor}`}>
              {trendChange > 0 ? `+${trendChange}` : trendChange}
            </span>
            <span className="text-xs text-muted-foreground">vs first recorded</span>
          </div>

          <div className="grid grid-cols-4 gap-6 w-full text-center">
            <div>
              <div className="text-xl font-bold text-red-400">{compliance?.criticalCount || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Critical</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-400">{compliance?.highCount || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">High</div>
            </div>
            <div>
              <div className="text-xl font-bold text-yellow-400">{compliance?.mediumCount || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Medium</div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-400">{compliance?.lowCount || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Low</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends as { weekLabel: string; score: number }[]}>
                  <defs>
                    <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="#a78bfa" fill="url(#tGrad)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Findings by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {sevBreakdown.map((s) => {
                const pct = totalFindings > 0 ? (s.value / totalFindings) * 100 : 0;
                return (
                  <div key={s.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-muted-foreground">{s.label}</span>
                      </div>
                      <span className="font-semibold">{s.value}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
              {sevBreakdown.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No findings to display</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Framework Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">SOC 2</span>
                <span className="font-bold" style={{ color: scoreColor }}>{score}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%`, backgroundColor: scoreColor }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Security, Availability, Processing Integrity, Confidentiality, Privacy
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">GDPR</span>
                <span className="font-bold" style={{ color: scoreColor }}>{Math.max(score - 5, 0)}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(score - 5, 0)}%`, backgroundColor: scoreColor }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Data Protection, Consent Management, Right to Erasure, Data Portability
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center pb-4">
        DriftFix provides engineering compliance guidance. This is not legal advice or a certification.
      </p>
    </div>
  );
}
