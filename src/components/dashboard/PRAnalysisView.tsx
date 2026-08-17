'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';
import {
  ArrowLeft,
  GitPullRequest,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  Brain,
  Shield,
  Clock,
} from 'lucide-react';

interface Finding {
  id: string;
  title: string;
  severity: string;
  confidence: number;
  status: string;
  filePath: string;
  category: string;
}

interface Analysis {
  id: string;
  status: string;
  score: number;
  filesAnalyzed: number;
  findingsCount: number;
  durationMs: number;
  summary: string;
  createdAt: string;
  completedAt: string;
  pullRequest: {
    id: string;
    number: number;
    title: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    repository: {
      id: string;
      fullName: string;
    };
  };
  findings: Finding[];
}

const pipelineSteps = [
  { key: 'diff', label: 'Parse Diff', icon: FileCode, color: 'text-blue-400' },
  { key: 'rules', label: 'Rules Engine', icon: Eye, color: 'text-cyan-400' },
  { key: 'ai', label: 'AI Analysis', icon: Brain, color: 'text-purple-400' },
  { key: 'map', label: 'Map Controls', icon: Shield, color: 'text-emerald-400' },
  { key: 'score', label: 'Calculate Score', icon: CheckCircle2, color: 'text-amber-400' },
];

export default function PRAnalysisView() {
  const { selectedPRId, selectPR, selectFinding } = useAppStore();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(!!selectedPRId);
  const [pipelineProgress, setPipelineProgress] = useState(0);

  useEffect(() => {
    if (!selectedPRId) {
      return;
    }

    // Animate pipeline progress
    const interval = setInterval(() => {
      setPipelineProgress((prev) => {
        if (prev >= 5) {
          clearInterval(interval);
          return 5;
        }
        return prev + 1;
      });
    }, 400);

    fetch(`/api/analyses/${selectedPRId}`)
      .then((r) => r.json())
      .then((data) => {
        setAnalysis(data.analysisRun || data.analysis || data);
      })
      .catch(() => {
        toast.error('Failed to load analysis');
      })
      .finally(() => {
        clearInterval(interval);
        setLoading(false);
      });

    return () => clearInterval(interval);
  }, [selectedPRId]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!analysis || !analysis.pullRequest) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => selectPR(null)} className="gap-2">
          <ArrowLeft className="size-4" /> Back to Pull Requests
        </Button>
        <Card className="p-12 text-center">
          <GitPullRequest className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No analysis found</h3>
          <p className="text-sm text-muted-foreground">This pull request has not been analyzed yet.</p>
        </Card>
      </div>
    );
  }

  const pr = analysis.pullRequest;
  const scoreColor = analysis.score >= 80 ? 'text-emerald-400' : analysis.score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => selectPR(null)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <GitPullRequest className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">PR #{pr.number}</h2>
              <Badge variant="outline" className="text-[10px]">{analysis.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{pr.title}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${scoreColor}`}>{analysis.score}</div>
          <p className="text-xs text-muted-foreground">Compliance Score</p>
        </div>
      </div>

      {/* PR Info */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Repository</p>
              <p className="font-medium mt-1">{pr.repository.fullName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Author</p>
              <p className="font-medium mt-1">{pr.author}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Branches</p>
              <p className="font-medium mt-1">
                <code className="text-primary/80">{pr.sourceBranch}</code> → <code>{pr.targetBranch}</code>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Duration</p>
              <p className="font-medium mt-1 flex items-center gap-1">
                <Clock className="size-3" /> {analysis.durationMs ? `${(analysis.durationMs / 1000).toFixed(1)}s` : '-'}
              </p>
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
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {pipelineSteps.map((step, i) => {
              const isComplete = i < pipelineProgress && analysis.status === 'completed';
              const isRunning = i === pipelineProgress - 1 && analysis.status === 'completed';
              return (
                <div key={step.key} className="flex items-center gap-2 shrink-0">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      isComplete
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isRunning
                          ? 'border-primary/30 bg-primary/5 animate-pulse-glow'
                          : 'border-border bg-card'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : isRunning ? (
                      <Loader2 className="size-4 text-primary animate-spin" />
                    ) : (
                      <step.icon className={`size-4 ${step.color} opacity-40`} />
                    )}
                    <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div className={`w-6 h-px ${isComplete ? 'bg-emerald-500/30' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {analysis.summary && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Findings */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-400" />
          Findings ({analysis.findings?.length ?? analysis.findingsCount ?? 0})
        </h3>
        <div className="space-y-2">
          {(analysis.findings || []).map((f) => (
            <Card
              key={f.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => selectFinding(f.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Badge className={`severity-${f.severity.toLowerCase()} text-[10px]`}>
                  {f.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.filePath} • {f.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{Math.round(f.confidence * 100)}%</p>
                  <p className="text-[10px] text-muted-foreground">confidence</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!analysis.findings || analysis.findings.length === 0) && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No findings detected in this analysis.
            </Card>
          )}
        </div>
      </div>

      {/* Files Analyzed */}
      {analysis.filesAnalyzed > 0 && (
        <Card>
          <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCode className="size-4" />
            Files Analyzed ({analysis.filesAnalyzed})
          </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {analysis.filesAnalyzed} file{analysis.filesAnalyzed !== 1 ? 's' : ''} analyzed in this pull request.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}