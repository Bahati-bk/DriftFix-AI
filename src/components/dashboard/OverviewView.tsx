'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/app';
import { AlertTriangle, CheckCircle2, GitPullRequest, ShieldCheck, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from 'recharts';

const severityColorMap: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#64748b' };

export function OverviewView() {
  const selectFinding = useAppStore((s) => s.selectFinding);
  const selectPR = useAppStore((s) => s.selectPR);
  const [data, setData] = useState<{ compliance: Record<string, unknown>; findings: unknown[]; evidence: unknown[]; trends: unknown[]; stats: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/compliance').then(r => r.json()),
      fetch('/api/findings?limit=5').then(r => r.json()),
      fetch('/api/evidence?limit=5').then(r => r.json()),
      fetch('/api/compliance?type=trends').then(r => r.json()),
    ]).then(([compliance, findings, evidence, trends]) => {
      const allFindings = findings.findings || [];
      const open = allFindings.filter((f: Record<string, string>) => f.status === 'OPEN' || f.status === 'IN_REVIEW');
      const critical = open.filter((f: Record<string, string>) => f.severity === 'CRITICAL');
      setData({
        compliance,
        findings: allFindings,
        evidence: evidence.records || [],
        trends: trends.history || [],
        stats: {
          openFindings: open.length,
          criticalFindings: critical.length,
          prsAnalyzed: compliance.prsAnalyzed || 0,
          resolved: compliance.resolvedCount || 0,
          evidenceRecords: compliance.evidenceCount || 0,
        },
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="p-6 space-y-4"><div className="h-8 w-48 bg-muted rounded animate-pulse" /><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div></div>;
  }

  const score = Number(data.compliance.score || 0);
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  const sevData = Object.entries(
    (data.findings as Record<string, string>[]).reduce((acc: Record<string, number>, f) => {
      const s = f.severity || 'LOW';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value, color: severityColorMap[name] || '#64748b' }));

  const stats = [
    { label: 'Open Findings', value: data.stats.openFindings, icon: AlertTriangle, color: 'text-orange-500' },
    { label: 'Critical', value: data.stats.criticalFindings, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'PRs Analyzed', value: data.stats.prsAnalyzed, icon: GitPullRequest, color: 'text-primary' },
    { label: 'Risks Resolved', value: data.stats.resolved, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Evidence Records', value: data.stats.evidenceRecords, icon: FileText, color: 'text-primary' },
  ];

  const evtTypeColors: Record<string, string> = {
    FINDING_DETECTED: 'bg-red-500/20 text-red-400',
    FINDING_RESOLVED: 'bg-emerald-500/20 text-emerald-400',
    FINDING_DISMISSED: 'bg-slate-500/20 text-slate-400',
    PR_ANALYZED: 'bg-primary/20 text-primary',
    REPOSITORY_CONNECTED: 'bg-blue-500/20 text-blue-400',
    SCORE_UPDATED: 'bg-yellow-500/20 text-yellow-400',
    POLICY_CHANGED: 'bg-purple-500/20 text-purple-400',
    AUDIT_REPORT_GENERATED: 'bg-emerald-500/20 text-emerald-400',
    INTEGRATION_CONNECTED: 'bg-blue-500/20 text-blue-400',
    COMPLIANCE_POSTURE_CHANGED: 'bg-emerald-500/20 text-emerald-400',
    FINDING_ACKNOWLEDGED: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time compliance posture for your organization</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score gauge */}
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Compliance Posture</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                <circle cx="60" cy="60" r="54" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: scoreColor }}>{score}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">out of 100</span>
              </div>
            </div>
            <div className="text-sm mt-3 font-medium" style={{ color: scoreColor }}>
              {score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 70 ? 'Fair' : score >= 60 ? 'Needs Attention' : 'Critical'}
            </div>
          </CardContent>
        </Card>

        {/* Trend chart */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Compliance Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trends as { weekLabel: string; score: number }[]}>
                  <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: 'oklch(0.17 0.008 260)', border: '1px solid oklch(0.28 0.01 260)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="#a78bfa" fill="url(#scoreGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent findings */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Findings</CardTitle>
            <button onClick={() => useAppStore.getState().setView('findings')} className="text-xs text-primary hover:underline">View all →</button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data.findings as Record<string, unknown>[]).slice(0, 5).map((f, i) => (
                <button key={i} onClick={() => selectFinding(String(f.id))} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left">
                  <Badge className={`severity-${(f.severity as string)?.toLowerCase()} text-[10px] px-1.5 py-0 font-bold`}>{f.severity as string}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.title as string}</div>
                    <div className="text-xs text-muted-foreground truncate">{f.filePath as string}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={f.status === 'OPEN' ? 'destructive' : 'secondary'} className="text-[10px]">{f.status as string}</Badge>
                  </div>
                </button>
              ))}
              {(data.findings as unknown[]).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No findings yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Severity breakdown */}
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Severity Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sevData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                    {sevData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: 'oklch(0.17 0.008 260)', border: '1px solid oklch(0.28 0.01 260)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {sevData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span>{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
          <button onClick={() => useAppStore.getState().setView('evidence')} className="text-xs text-primary hover:underline">View ledger →</button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(data.evidence as Record<string, string>[]).map((evt, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <Badge className={`text-[10px] px-1.5 py-0 border-0 ${evtTypeColors[evt.eventType || ''] || 'bg-secondary text-muted-foreground'}`}>{evt.eventType?.replace(/_/g, ' ')}</Badge>
                <span className="text-sm text-muted-foreground flex-1 truncate">{evt.actor}</span>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(evt.createdAt || '').toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground text-center pb-4">
        DriftFix provides engineering compliance guidance and evidence automation. It is not legal advice or a certification.
      </p>
    </div>
  );
}