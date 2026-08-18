'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedScore } from '@/components/ui/animated-score';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  FileBarChart,
  Search,
} from 'lucide-react';
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

const severityColorMap: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#64748b',
};

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

const evtDotColors: Record<string, string> = {
  FINDING_DETECTED: 'bg-red-500',
  FINDING_RESOLVED: 'bg-emerald-500',
  FINDING_DISMISSED: 'bg-slate-500',
  PR_ANALYZED: 'bg-primary',
  REPOSITORY_CONNECTED: 'bg-blue-500',
  SCORE_UPDATED: 'bg-yellow-500',
  POLICY_CHANGED: 'bg-purple-500',
  AUDIT_REPORT_GENERATED: 'bg-emerald-500',
  INTEGRATION_CONNECTED: 'bg-blue-500',
  COMPLIANCE_POSTURE_CHANGED: 'bg-emerald-500',
  FINDING_ACKNOWLEDGED: 'bg-yellow-500',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr || '').getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo} month${diffMo > 1 ? 's' : ''} ago`;
}

function formatEventType(type: string): string {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';
}

interface ComplianceData {
  score: number;
  severityBreakdown: Record<string, number>;
  prsAnalyzed: number;
  resolvedCount: number;
  evidenceCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  openFindings: number;
}

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  confidence: number;
  filePath: string;
  category: string;
  lineStart: number;
  createdAt: string;
}

interface EvidenceRecord {
  id: string;
  eventType: string;
  actor: string;
  payload: string;
  hash: string;
  createdAt: string;
}

interface TrendPoint {
  weekLabel: string;
  score: number;
}

interface PullRequest {
  id: string;
  number: number;
  title: string;
  status: string;
  sourceBranch: string;
  targetBranch: string;
}

interface ViewData {
  compliance: ComplianceData;
  findings: Finding[];
  evidence: EvidenceRecord[];
  trends: TrendPoint[];
  pullRequests: PullRequest[];
  stats: {
    openFindings: number;
    criticalFindings: number;
    prsAnalyzed: number;
    resolved: number;
    evidenceRecords: number;
  };
}

export function OverviewView() {
  const selectFinding = useAppStore((s) => s.selectFinding);
  const selectPR = useAppStore((s) => s.selectPR);
  const setView = useAppStore((s) => s.setView);
  const [data, setData] = useState<ViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/compliance').then((r) => r.json()),
      fetch('/api/findings?limit=5').then((r) => r.json()),
      fetch('/api/evidence?limit=5').then((r) => r.json()),
      fetch('/api/compliance?type=trends').then((r) => r.json()),
      fetch('/api/pull-requests?limit=3').then((r) => r.json()),
    ]).then(([compliance, findings, evidence, trends, prs]) => {
      const allFindings = findings.findings || [];
      const open = allFindings.filter(
        (f: Finding) => f.status === 'OPEN' || f.status === 'IN_REVIEW'
      );
      const critical = open.filter((f: Finding) => f.severity === 'CRITICAL');
      setData({
        compliance,
        findings: allFindings,
        evidence: evidence.records || [],
        trends: trends.history || [],
        pullRequests: prs.pullRequests || [],
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

  const handleRunAnalysis = useCallback(async () => {
    setActionLoading('analyze');
    try {
      await fetch('/api/demo/analyze', { method: 'POST' });
      toast.success('Analysis started successfully');
      setView('findings');
    } catch {
      toast.error('Failed to start analysis');
    } finally {
      setActionLoading(null);
    }
  }, [setView]);

  const handleGenerateReport = useCallback(async () => {
    setActionLoading('report');
    try {
      await fetch('/api/reports', { method: 'POST' });
      toast.success('Report generation started');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleViewEvidence = useCallback(() => {
    setView('evidence');
  }, [setView]);

  if (loading || !data) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-64 bg-muted rounded-lg animate-pulse lg:col-span-2" />
        </div>
      </div>
    );
  }

  const score = Number(data.compliance.score || 0);
  const scoreColor =
    score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const scoreGlow =
    score >= 80
      ? '0 0 40px rgba(34,197,94,0.35), 0 0 80px rgba(34,197,94,0.15)'
      : score >= 60
        ? '0 0 40px rgba(234,179,8,0.35), 0 0 80px rgba(234,179,8,0.15)'
        : '0 0 40px rgba(239,68,68,0.35), 0 0 80px rgba(239,68,68,0.15)';
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (score / 100) * circumference;

  const scoreLabel =
    score >= 90
      ? 'Excellent'
      : score >= 80
        ? 'Good'
        : score >= 70
          ? 'Fair'
          : score >= 60
            ? 'Needs Attention'
            : 'Critical';

  const trends = data.trends as TrendPoint[];
  const trendChange =
    trends.length >= 2
      ? Number(trends[trends.length - 1].score) - Number(trends[0].score)
      : 0;
  const trendPositive = trendChange >= 0;

  const severityBreakdown = [
    { name: 'CRITICAL', count: data.compliance.criticalCount || 0, color: '#ef4444', barClass: 'bg-red-500' },
    { name: 'HIGH', count: data.compliance.highCount || 0, color: '#f97316', barClass: 'bg-orange-500' },
    { name: 'MEDIUM', count: data.compliance.mediumCount || 0, color: '#eab308', barClass: 'bg-yellow-500' },
    { name: 'LOW', count: Math.max(0, (data.compliance.openFindings || 0) - (data.compliance.criticalCount || 0) - (data.compliance.highCount || 0) - (data.compliance.mediumCount || 0)), color: '#64748b', barClass: 'bg-slate-500' },
  ];

  const maxSevCount = Math.max(1, ...severityBreakdown.map((s) => s.count));

  const stats = [
    { label: 'Open Findings', value: data.stats.openFindings, icon: AlertTriangle, color: 'text-orange-500', iconBg: 'bg-orange-500/15', accent: 'border-r-orange-500/40' },
    { label: 'Critical', value: data.stats.criticalFindings, icon: AlertTriangle, color: 'text-red-500', iconBg: 'bg-red-500/15', accent: 'border-r-red-500/40' },
    { label: 'PRs Analyzed', value: data.stats.prsAnalyzed, icon: GitPullRequest, color: 'text-primary', iconBg: 'bg-primary/15', accent: 'border-r-primary/40' },
    { label: 'Risks Resolved', value: data.stats.resolved, icon: CheckCircle2, color: 'text-emerald-500', iconBg: 'bg-emerald-500/15', accent: 'border-r-emerald-500/40' },
    { label: 'Evidence Records', value: data.stats.evidenceRecords, icon: FileText, color: 'text-violet-500', iconBg: 'bg-violet-500/15', accent: 'border-r-violet-500/40' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time compliance posture for your organization
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`border-border/50 border-r-2 ${s.accent} hover:border-primary/30 transition-colors`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`rounded-full ${s.iconBg} p-1.5`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hero Score + Trend Chart */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score gauge */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compliance Posture
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            <div className="relative w-44 h-44">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-secondary"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{
                    transition: 'stroke-dashoffset 1.2s ease-out',
                    filter: `drop-shadow(${scoreGlow})`,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-5xl font-extrabold tracking-tight"
                  style={{
                    color: scoreColor,
                    textShadow: scoreGlow,
                  }}
                >
                  <AnimatedScore value={score} duration={1200} />
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  out of 100
                </span>
              </div>
            </div>
            <div
              className="text-base mt-4 font-semibold"
              style={{ color: scoreColor }}
            >
              {scoreLabel}
            </div>
            {trends.length >= 2 && (
              <div className="flex items-center gap-1 mt-2">
                {trendPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-medium ${trendPositive ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {trendPositive ? '+' : ''}{trendChange}
                </span>
                <span className="text-xs text-muted-foreground ml-1">vs first week</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend chart */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compliance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.28 0.01 260)"
                  />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: 'oklch(0.17 0.008 260)',
                      border: '1px solid oklch(0.28 0.01 260)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#22c55e"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    label={{
                      value: 'Good',
                      position: 'right',
                      fill: 'oklch(0.55 0.02 145)',
                      fontSize: 10,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#a78bfa"
                    fill="url(#scoreGrad)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Findings + Severity Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-border/50 hover:border-primary/30 transition-colors lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Findings
            </CardTitle>
            <button
              onClick={() => setView('findings')}
              className="text-xs text-primary hover:underline"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {data.findings.slice(0, 5).map((f) => (
                <button
                  key={f.id}
                  onClick={() => selectFinding(String(f.id))}
                  className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: severityColorMap[f.severity] || '#64748b',
                    }}
                  />
                  <Badge
                    className={`severity-${f.severity?.toLowerCase()} text-[10px] px-1.5 py-0 font-bold`}
                  >
                    {f.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.title}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {f.filePath}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${f.confidence || 0}%`,
                              backgroundColor:
                                (f.confidence || 0) >= 80
                                  ? '#22c55e'
                                  : (f.confidence || 0) >= 50
                                    ? '#eab308'
                                    : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                          {f.confidence || 0}%
                        </span>
                      </div>
                      <Badge
                        variant={f.status === 'OPEN' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {f.status}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
              {data.findings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No findings yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Severity Breakdown - horizontal bars */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Severity Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {severityBreakdown.map((sev) => (
                <div key={sev.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: sev.color }}
                      />
                      <span className="text-sm font-medium">{sev.name}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{sev.count}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${sev.barClass}`}
                      style={{
                        width: `${maxSevCount > 0 ? (sev.count / maxSevCount) * 100 : 0}%`,
                        transition: 'width 0.8s ease-out',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRunAnalysis}
              disabled={actionLoading === 'analyze'}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {actionLoading === 'analyze' ? 'Analyzing...' : 'Run Analysis'}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateReport}
              disabled={actionLoading === 'report'}
              className="gap-2"
            >
              <FileBarChart className="h-4 w-4" />
              {actionLoading === 'report' ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleViewEvidence}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              View Evidence
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed + Recent PRs */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
            <button
              onClick={() => setView('evidence')}
              className="text-xs text-primary hover:underline"
            >
              View ledger →
            </button>
          </CardHeader>
          <CardContent>
            <div className="relative max-h-64 overflow-y-auto">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-0.5">
                {data.evidence.map((evt, i) => (
                  <div key={evt.id || i} className="flex items-start gap-4 py-2 relative">
                    <div
                      className={`h-3.5 w-3.5 rounded-full shrink-0 mt-0.5 ring-4 ring-background z-10 ${evtDotColors[evt.eventType || ''] || 'bg-secondary'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[10px] px-1.5 py-0 border-0 ${evtTypeColors[evt.eventType || ''] || 'bg-secondary text-muted-foreground'}`}
                        >
                          {formatEventType(evt.eventType)}
                        </Badge>
                        <span className="text-sm text-muted-foreground truncate">
                          {evt.actor}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {relativeTime(evt.createdAt)}
                    </span>
                  </div>
                ))}
                {data.evidence.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No activity yet
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Pull Requests */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Pull Requests
            </CardTitle>
            <button
              onClick={() => setView('pull-requests')}
              className="text-xs text-primary hover:underline"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {data.pullRequests.map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => selectPR(String(pr.id))}
                  className="w-full flex items-start gap-3 p-2.5 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <GitPullRequest className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pr.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">#{pr.number}</span>
                      <span className="mx-1.5">·</span>
                      <span>{pr.sourceBranch}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span>{pr.targetBranch}</span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      pr.status === 'MERGED'
                        ? 'default'
                        : pr.status === 'OPEN'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="text-[10px] shrink-0"
                  >
                    {pr.status}
                  </Badge>
                </button>
              ))}
              {data.pullRequests.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pull requests yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground text-center pb-4">
        DriftFix provides engineering compliance guidance and evidence automation. It is not
        legal advice or a certification.
      </p>
    </div>
  );
}
