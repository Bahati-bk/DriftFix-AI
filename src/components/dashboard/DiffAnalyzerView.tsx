'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import {
  Terminal, Play, Loader2, ShieldCheck, ShieldX, Ban, AlertTriangle, Info, FileCode2,
} from 'lucide-react';
import type { AnalysisResult, RuleFinding, ActionTier } from '@/lib/rule-engine/types';

// ── Tier styling ──────────────────────────────────────────────────────────

const tierStyle: Record<ActionTier, { badge: string; icon: typeof Ban; color: string }> = {
  BLOCKING: {
    badge: 'bg-red-500/15 text-red-400 border-red-500/30 font-bold',
    icon: Ban,
    color: 'text-red-400',
  },
  WARNING: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold',
    icon: AlertTriangle,
    color: 'text-amber-400',
  },
  INFO: {
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: Info,
    color: 'text-blue-400',
  },
};

// ── Finding Card ──────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: RuleFinding }) {
  const ts = tierStyle[finding.tier];
  const TierIcon = ts.icon;

  return (
    <Card className="border-border/50 card-hover rounded-xl animate-stagger">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-[10px] border px-1.5 py-0 ${ts.badge}`}>
            <TierIcon className="h-3 w-3 mr-1" />
            {finding.tier}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
            {finding.rule_id}
          </Badge>
          <span className="text-sm font-semibold">{finding.rule_name}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{finding.file}</span>
          <span>line {finding.line}</span>
        </div>

        <pre className="p-2.5 rounded-lg bg-secondary/60 border border-border/40 text-xs font-mono text-secondary-bright overflow-x-auto whitespace-pre-wrap break-all">
          {finding.match_content}
        </pre>

        <p className="text-sm text-secondary-bright">{finding.explanation}</p>

        <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-secondary-bright">
          <span className="font-semibold text-emerald-400">Fix: </span>
          {finding.suggested_fix}
        </div>

        {finding.framework_citations.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {finding.framework_citations.map((c, i) => (
              <span key={i} className="tag-pill text-[10px]">
                {c.control} — {c.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Results Panel ─────────────────────────────────────────────────────────

function ResultsPanel({ result, loading }: { result: AnalysisResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Terminal className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-semibold text-muted-foreground mb-1">No results yet</h3>
        <p className="text-xs text-secondary-bright">Paste a diff and click Analyze to see compliance findings.</p>
      </div>
    );
  }

  const { summary, findings, check_conclusion } = result;

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      {/* Summary Card */}
      <Card className="border-border/50 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">Summary</span>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                {summary.total} findings across {summary.files_scanned} file{summary.files_scanned !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs px-2 py-0.5 border ${tierStyle.BLOCKING.badge}`}>
              <Ban className="h-3 w-3 mr-1" />{summary.blocking} BLOCKING
            </Badge>
            <Badge className={`text-xs px-2 py-0.5 border ${tierStyle.WARNING.badge}`}>
              <AlertTriangle className="h-3 w-3 mr-1" />{summary.warning} WARNING
            </Badge>
            <Badge className={`text-xs px-2 py-0.5 border ${tierStyle.INFO.badge}`}>
              <Info className="h-3 w-3 mr-1" />{summary.info} INFO
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Check Conclusion */}
      <Card className={`border-border/50 rounded-xl ${check_conclusion === 'failure' ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
        <CardContent className="p-4 flex items-center gap-3">
          {check_conclusion === 'failure' ? (
            <>
              <ShieldX className={`h-6 w-6 ${tierStyle.BLOCKING.color} shrink-0`} />
              <div>
                <p className={`text-sm font-bold ${tierStyle.BLOCKING.color}`}>
                  ❌ Check would FAIL ({summary.blocking} blocking finding{summary.blocking !== 1 ? 's' : ''})
                </p>
                <p className="text-xs text-secondary-bright mt-0.5">Resolve all BLOCKING findings to pass.</p>
              </div>
            </>
          ) : (
            <>
              <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-400">
                  ✅ Check would PASS
                </p>
                <p className="text-xs text-secondary-bright mt-0.5">No blocking findings detected.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Findings List */}
      {findings.length > 0 ? (
        <div className="space-y-3">
          {findings.map((finding, i) => (
            <FindingCard key={`${finding.rule_id}-${finding.file}-${finding.line}`} finding={finding} />
          ))}
        </div>
      ) : (
        <Card className="border-border/50 rounded-xl">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-500/50 mx-auto mb-3" />
            <p className="text-sm font-semibold">No compliance findings</p>
            <p className="text-xs text-secondary-bright mt-1">The diff passed all compliance checks.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main DiffAnalyzerView ─────────────────────────────────────────────────

export function DiffAnalyzerView() {
  const [diffText, setDiffText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    const trimmed = diffText.trim();
    if (!trimmed) {
      toast.error('Please paste a diff before analyzing');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/analyze-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success(`Analysis complete: ${data.summary?.total ?? 0} findings`);
      } else {
        toast.error(data.error || 'Analysis failed');
      }
    } catch {
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="section-header shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PR Diff Analyzer</h1>
            <p className="text-secondary-bright text-sm mt-0.5">
              Paste a unified diff to test compliance rules in real-time
            </p>
          </div>
        </div>
      </div>

      {/* Resizable Two-Panel Layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="rounded-xl border border-border/50 overflow-hidden">
          {/* Left: Diff Input */}
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="flex flex-col h-full bg-card">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Unified Diff</span>
                </div>
                <span className="text-[10px] text-secondary-bright font-mono">{diffText.split('\n').length} lines</span>
              </div>
              <textarea
                value={diffText}
                onChange={(e) => setDiffText(e.target.value)}
                placeholder={`Paste your unified diff here...

diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,6 +10,8 @@ export function handler() {
+  const apiKey = 'sk-12345secretkey';
+  fetch('https://api.stripe.com/v1/charges')
 }`}
                className="flex-1 w-full p-4 bg-background text-sm text-foreground font-mono resize-none focus:outline-none placeholder:text-muted-foreground/40"
                spellCheck={false}
              />
              <div className="px-4 py-3 border-t border-border/50 shrink-0">
                <Button
                  onClick={handleAnalyze}
                  disabled={loading || !diffText.trim()}
                  className="w-full gap-2 btn-press"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {loading ? 'Analyzing...' : 'Analyze Diff'}
                </Button>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Results */}
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="flex flex-col h-full bg-card">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 shrink-0">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Analysis Results</span>
              </div>
              <div className="flex-1 overflow-auto">
                <ResultsPanel result={result} loading={loading} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
