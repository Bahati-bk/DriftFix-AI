'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedScore } from '@/components/ui/animated-score';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app';
import {
  Building2,
  Database,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  GitBranch,
  Activity,
  BarChart3,
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

interface RepoBreakdown {
  repositoryId: string;
  repoName: string;
  repoOwner: string;
  language: string | null;
  framework: string;
  latestScore: number | null;
  totalFindings: number;
  openFindings: number;
  lastAnalysisAt: string | null;
  health: 'healthy' | 'warning' | 'critical';
}

interface RecentAnalysis {
  id: string;
  repoName: string;
  score: number;
  findingsCount: number;
  status: string;
  completedAt: string | null;
}

interface ComplianceTrendEntry {
  id: string;
  score: number;
  weekLabel: string;
  createdAt: string;
}

interface OrgDashboardData {
  orgName: string;
  totalRepos: number;
  overallScore: number | null;
  repoBreakdown: RepoBreakdown[];
  tierBreakdown: { blocking: number; warning: number; info: number };
  recentAnalyses: RecentAnalysis[];
  complianceTrend: ComplianceTrendEntry[];
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-yellow-400';
  if (score >= 60) return 'text-orange-400';
  return 'text-red-400';
}

function scoreRingColor(score: number): string {
  if (score >= 90) return 'stroke-emerald-400';
  if (score >= 75) return 'stroke-yellow-400';
  if (score >= 60) return 'stroke-orange-400';
  return 'stroke-red-400';
}

function scoreBgColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (score >= 75) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (score >= 60) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function healthBadge(health: string) {
  if (health === 'healthy') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Healthy</Badge>;
  if (health === 'warning') return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"><ShieldAlert className="h-3 w-3 mr-1" />Critical</Badge>;
}

function ScoreRing({ score, size = 120, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted/30"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={scoreRingColor(score)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function OrgDashboardView() {
  const [data, setData] = useState<OrgDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setView } = useAppStore();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/org-dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8" />
        <p className="text-sm">{error || 'No data available'}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  // Prepare trend chart data
  const trendData = data.complianceTrend.map((entry) => ({
    week: entry.weekLabel,
    score: entry.score,
  }));

  // Calculate score direction
  const scoreDirection =
    trendData.length >= 2
      ? trendData[trendData.length - 1].score - trendData[trendData.length - 2].score
      : 0;

  const healthyCount = data.repoBreakdown.filter((r) => r.health === 'healthy').length;
  const warningCount = data.repoBreakdown.filter((r) => r.health === 'warning').length;
  const criticalCount = data.repoBreakdown.filter((r) => r.health === 'critical').length;

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">{data.orgName}</h1>
            <p className="text-sm text-muted-foreground">Organization-wide compliance overview</p>
          </div>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* Overall Score Card */}
        <Card className="gradient-border col-span-2 sm:col-span-1 lg:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="relative">
              <ScoreRing score={data.overallScore ?? 0} size={56} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${scoreColor(data.overallScore ?? 0)}`}>
                  <AnimatedScore value={data.overallScore ?? 0} duration={1200} />
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Overall Score</p>
              <div className="flex items-center gap-1">
                {scoreDirection > 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : scoreDirection < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={`text-xs font-medium ${scoreDirection > 0 ? 'text-emerald-400' : scoreDirection < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {scoreDirection > 0 ? '+' : ''}{scoreDirection}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Repos */}
        <Card className="animate-stagger">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-muted-foreground">Repositories</p>
            </div>
            <p className="text-2xl font-bold animate-count-up">{data.totalRepos}</p>
          </CardContent>
        </Card>

        {/* Blocking Findings */}
        <Card className="animate-stagger" style={{ animationDelay: '50ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <p className="text-xs text-muted-foreground">Blocking</p>
            </div>
            <p className={`text-2xl font-bold animate-count-up ${data.tierBreakdown.blocking > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {data.tierBreakdown.blocking}
            </p>
          </CardContent>
        </Card>

        {/* Warning Findings */}
        <Card className="animate-stagger" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <p className="text-2xl font-bold animate-count-up text-yellow-400">{data.tierBreakdown.warning}</p>
          </CardContent>
        </Card>

        {/* Info Findings */}
        <Card className="animate-stagger" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-muted-foreground">Info</p>
            </div>
            <p className="text-2xl font-bold animate-count-up text-blue-400">{data.tierBreakdown.info}</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Trend + Repo Health Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Compliance Trend
              </CardTitle>
              {trendData.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {trendData.length} data points
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orgScoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <ReferenceLine y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="oklch(0.7 0.15 250)"
                    strokeWidth={2}
                    fill="url(#orgScoreGradient)"
                    dot={{ r: 3, fill: 'oklch(0.7 0.15 250)', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'oklch(0.7 0.15 250)', strokeWidth: 2, stroke: 'white' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                <BarChart3 className="h-5 w-5 mr-2 opacity-40" />
                No compliance history data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repo Health Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Repo Health
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Healthy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-muted-foreground">Healthy</span>
                </div>
                <span className="font-semibold text-emerald-400">{healthyCount}</span>
              </div>
              {data.totalRepos > 0 && (
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 animate-fill-bar"
                    style={{ width: `${(healthyCount / data.totalRepos) * 100}%` }}
                  />
                </div>
              )}
            </div>
            {/* Warning */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="text-muted-foreground">Warning</span>
                </div>
                <span className="font-semibold text-yellow-400">{warningCount}</span>
              </div>
              {data.totalRepos > 0 && (
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-yellow-400 animate-fill-bar"
                    style={{ width: `${(warningCount / data.totalRepos) * 100}%` }}
                  />
                </div>
              )}
            </div>
            {/* Critical */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="text-muted-foreground">Critical</span>
                </div>
                <span className="font-semibold text-red-400">{criticalCount}</span>
              </div>
              {data.totalRepos > 0 && (
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400 animate-fill-bar"
                    style={{ width: `${(criticalCount / data.totalRepos) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Repo Breakdown Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Repository Breakdown
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {data.repoBreakdown.length} repos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs">Repository</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs">Language</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs">Framework</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs text-right">Score</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs text-right">Open</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs text-right">Total</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Health</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Last Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {data.repoBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                      No repositories connected yet
                    </td>
                  </tr>
                ) : (
                  data.repoBreakdown.map((repo) => (
                    <tr
                      key={repo.repositoryId}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setView('repositories')}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[200px]" title={repo.repoOwner + '/' + repo.repoName}>
                            {repo.repoOwner}/{repo.repoName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {repo.language ? (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {repo.language}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="text-[10px] font-normal uppercase">
                          {repo.framework}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {repo.latestScore !== null ? (
                          <span className={`font-semibold ${scoreColor(repo.latestScore)}`}>
                            {repo.latestScore}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className={repo.openFindings > 0 ? 'font-medium text-orange-400' : 'text-muted-foreground'}>
                          {repo.openFindings}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {repo.totalFindings}
                      </td>
                      <td className="py-3 pr-4">{healthBadge(repo.health)}</td>
                      <td className="py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {repo.lastAnalysisAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(repo.lastAnalysisAt)}
                          </span>
                        ) : (
                          'Never'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Analyses */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Analyses
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setView('pull-requests')}
            >
              View all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recentAnalyses.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No analyses run yet. Use the Diff Analyzer to get started.
            </div>
          ) : (
            <div className="space-y-2 animate-stagger">
              {data.recentAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${scoreBgColor(analysis.score)} border`}>
                    <span className="text-xs font-bold">
                      {analysis.score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{analysis.repoName}</p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.findingsCount} finding{analysis.findingsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        analysis.status === 'completed'
                          ? 'border-emerald-500/30 text-emerald-400'
                          : 'border-yellow-500/30 text-yellow-400'
                      }`}
                    >
                      {analysis.status}
                    </Badge>
                    {analysis.completedAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {relativeTime(analysis.completedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
