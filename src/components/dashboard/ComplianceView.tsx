'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedScore } from '@/components/ui/animated-score';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip as RTooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowRight, Target } from 'lucide-react';
import { useAppStore } from '@/stores/app';

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

const TARGET_SCORE = 80;

export function ComplianceView() {
  const setView = useAppStore((s) => s.setView);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const [compliance, setCompliance] = useState<Record<string, unknown> | null>(null);
  const [trends, setTrends] = useState<Record<string, unknown>[]>([]);
  const [sevBreakdown, setSevBreakdown] = useState<{ name: string; value: number; color: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const navigateToFindings = useCallback((severity?: string) => {
    if (severity) {
      setSearchQuery('');
      useAppStore.getState().setView('findings');
    } else {
      setView('findings');
    }
  }, [setView, setSearchQuery]);

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
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const score = Number(compliance?.score || 0);
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const radius = 70;
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

  const scoreLabel = score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Work';
  const gapToTarget = TARGET_SCORE - score;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compliance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organization-wide compliance posture and trends
          </p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary hidden sm:flex gap-1.5">
          <Target className="h-3 w-3" />
          Target: {TARGET_SCORE}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score Gauge - More compact */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${radius * 2 + 20} ${radius * 2 + 20}`}>
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
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
                  strokeWidth="10"
                  className="text-secondary"
                />
                <circle
                  cx={radius + 10}
                  cy={radius + 10}
                  r={radius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={off}
                  filter="url(#glow)"
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
                {/* Target marker */}
                {TARGET_SCORE < 100 && (
                  <circle
                    cx={radius + 10}
                    cy={radius + 10}
                    r={radius}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    strokeDasharray={`${(circ * TARGET_SCORE) / 100} ${circ}`}
                    strokeDashoffset={0}
                    strokeOpacity={0.5}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-extrabold tracking-tight" style={{ color: scoreColor }}>
                  <AnimatedScore value={score} duration={1200} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tracking-wider uppercase">{scoreLabel}</div>
              </div>
            </div>

            {/* Trend + Gap */}
            <div className="flex items-center gap-4 mt-4">
              {trends.length >= 2 ? (
                <div className="flex items-center gap-1.5">
                  <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                  <span className={`text-sm font-semibold ${trendColor}`}>
                    {trendChange > 0 ? `+${trendChange}` : trendChange}
                  </span>
                  <span className="text-[10px] text-muted-foreground">trend</span>
                </div>
              ) : null}
              {gapToTarget > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{gapToTarget}pts</span> to target
                </div>
              )}
            </div>

            {/* Severity counts - clickable */}
            <div className="grid grid-cols-4 gap-4 w-full text-center mt-5 pt-4 border-t border-border/50">
              {[
                { label: 'Critical', count: Number(compliance?.criticalCount || 0), color: 'text-red-400', sev: 'CRITICAL' },
                { label: 'High', count: Number(compliance?.highCount || 0), color: 'text-orange-400', sev: 'HIGH' },
                { label: 'Medium', count: Number(compliance?.mediumCount || 0), color: 'text-yellow-400', sev: 'MEDIUM' },
                { label: 'Low', count: totalFindings - Number(compliance?.criticalCount || 0) - Number(compliance?.highCount || 0) - Number(compliance?.mediumCount || 0), color: 'text-slate-400', sev: 'LOW' },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => navigateToFindings(s.sev)}
                  className="group flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                >
                  <div className={`text-lg font-bold ${s.color}`}>{Math.max(0, s.count)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compliance Score Trend
              </CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-emerald-500 rounded" style={{ borderStyle: 'dashed' }} />
                  <span>Target ({TARGET_SCORE})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-violet-400 rounded" />\n                  <span>Actual</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
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
                  <ReferenceLine
                    y={TARGET_SCORE}
                    stroke="#22c55e"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    label={{
                      value: 'Target',
                      position: 'right',
                      fill: '#22c55e',
                      fontSize: 10,
                    }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#a78bfa" fill="url(#tGrad)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Findings by Severity
              </CardTitle>
              <Button
                variant="ghost" size="sm"
                className="text-xs gap-1 h-7 text-primary"
                onClick={() => navigateToFindings()}
              >
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3.5 pt-1">
              {sevBreakdown.map((s) => {
                const pct = totalFindings > 0 ? (s.value / totalFindings) * 100 : 0;
                return (
                  <button
                    key={s.name}
                    className="w-full text-left group"
                    onClick={() => navigateToFindings(s.name)}
                  >
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{s.value}</span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </button>
                );
              })}
              {sevBreakdown.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm text-muted-foreground">No open findings — looking good!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Framework Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 pt-2">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 border-emerald-500/30 text-emerald-400">SOC 2</Badge>
                    <span className="text-xs text-muted-foreground">Trust Service Criteria</span>
                  </div>
                  <span className="font-bold text-sm tabular-nums" style={{ color: scoreColor }}>{score}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${score}%`, backgroundColor: scoreColor }}
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy'].map((c) => (
                    <span key={c} className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 border-blue-500/30 text-blue-400">GDPR</Badge>
                    <span className="text-xs text-muted-foreground">Data Protection</span>
                  </div>
                  <span className="font-bold text-sm tabular-nums" style={{ color: scoreColor }}>{Math.max(score - 5, 0)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(score - 5, 0)}%`, backgroundColor: scoreColor }}
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['Data Protection', 'Consent', 'Right to Erasure', 'Portability', 'DPO'].map((c) => (
                    <span key={c} className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground text-center pb-4">
        DriftFix provides engineering compliance guidance. This is not legal advice or a certification.
      </p>
    </div>
  );
}
