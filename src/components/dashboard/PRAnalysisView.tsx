'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';
import {
  ArrowLeft, GitPullRequest, FileCode, CheckCircle2,
  AlertTriangle, Loader2, Eye, Brain, Shield, Clock,
  ArrowRight, User, FolderGit2, Timer, Hash,
} from 'lucide-react';

interface Finding {
  id: string; title: string; severity: string;
  confidence: number; status: string; filePath: string; category: string;
}

interface PRData {
  pullRequest: {
    id: string; number: number; title: string; author: string;
    sourceBranch: string; targetBranch: string;
    repository: { id: string; fullName: string };
  };
  analysisRun: {
    id: string; status: string; score: number; filesAnalyzed: number;
    findingsCount: number; durationMs: number; summary: string;
    findings: Finding[];
  } | null;
}

const pipelineSteps = [
  { key: 'diff', label: 'Parse Diff', icon: FileCode, color: 'text-cyan-400' },
  { key: 'rules', label: 'Rules Engine', icon: Eye, color: 'text-blue-400' },
  { key: 'ai', label: 'AI Analysis', icon: Brain, color: 'text-purple-400' },
  { key: 'map', label: 'Map Controls', icon: Shield, color: 'text-emerald-400' },
  { key: 'score', label: 'Score', icon: CheckCircle2, color: 'text-amber-400' },
];

const severityConfig: Record<string, { color: string; border: string; bg: string }> = {
  critical: { color: 'text-red-400', border: 'border-l-red-500', bg: 'bg-red-500/10' },
  high: { color: 'text-orange-400', border: 'border-l-orange-500', bg: 'bg-orange-500/10' },
  medium: { color: 'text-yellow-400', border: 'border-l-yellow-500', bg: 'bg-yellow-500/10' },
  low: { color: 'text-emerald-400', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10' },
  info: { color: 'text-cyan-400', border: 'border-l-cyan-500', bg: 'bg-cyan-500/10' },
};

const statusDot: Record<string, string> = {
  completed: 'bg-emerald-500',
  running: 'bg-amber-500 animate-pulse',
  pending: 'bg-muted-foreground/30',
  failed: 'bg-red-500',
};

export function PRAnalysisView() {
  const { selectedPRId, selectPR, selectFinding } = useAppStore();
  const [data, setData] = useState<PRData | null>(null);
  const [loading, setLoading] = useState(!!selectedPRId);
  const [pipelineProgress, setPipelineProgress] = useState(0);

  useEffect(() => {
    if (!selectedPRId) return;
    const interval = setInterval(() => {
      setPipelineProgress((p) => (p >= 5 ? (clearInterval(interval), 5) : p + 1));
    }, 400);
    fetch(`/api/pull-requests/${selectedPRId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error('Failed to load PR'))
      .finally(() => {
        clearInterval(interval);
        setLoading(false);
      });
    return () => clearInterval(interval);
  }, [selectedPRId]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const analysis = data?.analysisRun;
  const pr = data?.pullRequest;

  if (!pr) {
    return (
      <div className="space-y-4 p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectPR(null)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" /> Back to Pull Requests
        </Button>
        <Card className="p-12 text-center">
          <GitPullRequest className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No analysis found</h3>
          <p className="text-sm text-muted-foreground">
            This pull request has not been analyzed yet.
          </p>
        </Card>
      </div>
    );
  }

  const score = analysis?.score ?? 100;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const scoreBg = score >= 80 ? 'border-emerald-500/30 bg-emerald-500/5' : score >= 60 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5';
  const prStatus = analysis?.status || 'pending';
  const findings = analysis?.findings || [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* PR Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => selectPR(null)}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <GitPullRequest className="size-5 text-primary" />
                <span className="text-sm text-muted-foreground">Pull Request</span>
              </div>
              <Badge className="text-base font-bold px-3 py-0.5 h-7">
                #{pr.number}
              </Badge>
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-primary/30`}
                >
                  {pr.author?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium">{pr.author}</span>
              </div>
            </div>
            <h2 className="text-lg font-semibold mt-1.5">{pr.title}</h2>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <code className="px-2 py-0.5 rounded bg-secondary text-primary/80 text-xs font-mono">
                {pr.sourceBranch}
              </code>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="px-2 py-0.5 rounded bg-secondary text-xs font-mono">
                {pr.targetBranch}
              </code>
              <Badge
                variant="outline"
                className="ml-2 text-xs gap-1.5 border-border/50"
              >
                <span className={`h-2 w-2 rounded-full ${statusDot[prStatus] || statusDot.pending}`} />
                {prStatus.charAt(0).toUpperCase() + prStatus.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Score Card */}
        <Card className={`border ${scoreBg} min-w-[120px] text-center`}>
          <CardContent className="p-4">
            <div className={`text-4xl font-extrabold tracking-tight ${scoreColor}`}>{score}</div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">Compliance Score</div>
          </CardContent>
        </Card>
      </div>

      {/* Meta Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-2.5">
              <FolderGit2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Repository</p>
                <p className="font-medium mt-0.5">{pr.repository.fullName}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Author</p>
                <p className="font-medium mt-0.5">{pr.author}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Files Analyzed</p>
                <p className="font-medium mt-0.5">{analysis?.filesAnalyzed ?? '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Timer className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="font-medium mt-0.5">
                  {analysis?.durationMs ? `${(analysis.durationMs / 1000).toFixed(1)}s` : '-'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Analysis Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {pipelineSteps.map((step, i) => {
              const done = i < pipelineProgress && analysis?.status === 'completed';
              const running = i === pipelineProgress - 1 && analysis?.status === 'completed';
              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`relative flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all min-w-[110px] justify-center ${
                        done
                          ? 'border-emerald-500/40 bg-emerald-500/5 shadow-sm shadow-emerald-500/5'
                          : running
                            ? 'border-primary/40 bg-primary/5 animate-pulse'
                            : 'border-border/60 bg-card'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                      ) : running ? (
                        <Loader2 className="size-5 text-primary animate-spin shrink-0" />
                      ) : (
                        <step.icon className={`size-5 ${step.color} opacity-40 shrink-0`} />
                      )}
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          done ? 'text-emerald-300' : running ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </span>
                      {done && (
                        <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div className="flex items-center mx-1 self-center">
                      <div
                        className={`h-0.5 w-8 rounded-full transition-all ${
                          done ? 'bg-emerald-500/40' : 'bg-border'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      {analysis?.summary && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Findings List */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-400" />
          Findings
          <Badge variant="secondary" className="text-xs font-normal">
            {findings.length}
          </Badge>
        </h3>
        <div className="space-y-2">
          {findings.map((f) => {
            const sev = severityConfig[f.severity.toLowerCase()] || severityConfig.info;
            return (
              <Card
                key={f.id}
                className={`hover:border-primary/30 transition-colors cursor-pointer border-l-2 ${sev.border} border-border/50`}
                onClick={() => selectFinding(f.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge
                          className={`text-[10px] font-semibold border-0 ${sev.bg} ${sev.color}`}
                        >
                          {f.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-normal border-border/50">
                          {f.category}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium leading-snug">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {f.filePath}
                      </p>
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <div className="text-xs text-muted-foreground mb-1.5 text-right">
                        Confidence
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Progress
                          value={f.confidence * 100}
                          className="h-1.5 w-14"
                        />
                        <span className="text-xs font-medium w-9 text-right">
                          {Math.round(f.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {findings.length === 0 && (
            <Card className="p-8 text-center border-dashed">
              <CheckCircle2 className="size-8 mx-auto text-emerald-400/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No findings detected in this analysis.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Files Analyzed Footer */}
      {(analysis?.filesAnalyzed ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCode className="size-4" />
              Files Analyzed ({analysis?.filesAnalyzed})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {analysis?.filesAnalyzed} file{(analysis?.filesAnalyzed ?? 0) !== 1 ? 's' : ''} analyzed in this pull request.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
