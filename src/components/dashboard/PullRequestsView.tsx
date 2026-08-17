'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/app';
import { GitPullRequest, GitBranch, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';

export function PullRequestsView() {
  const selectPR = useAppStore((s) => s.selectPR);
  const [prs, setPrs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pull-requests').then(r => r.json()).then(data => { setPrs(data.pullRequests || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const scoreColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';

  if (loading) return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>;

  const openPRs = prs.filter(p => p.status === 'open');

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pull Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">{openPRs.length} open • {prs.length} total</p>
        </div>
      </div>
      <div className="space-y-3">
        {prs.map((pr) => (
          <Card key={String(pr.id)} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => selectPR(String(pr.id))}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <GitPullRequest className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">#{pr.number}</span>
                  <span className="text-sm truncate">{pr.title as string}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{pr.author as string}</span>
                  <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{pr.sourceBranch as string} → {pr.targetBranch as string}</span>
                </div>
              </div>
              <Badge variant={pr.status === 'open' ? 'default' : 'secondary'} className="shrink-0">
                {pr.status as string}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {prs.length === 0 && (
          <Card className="border-border/50"><CardContent className="p-12 text-center">
            <GitPullRequest className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No pull requests yet</h3>
            <p className="text-sm text-muted-foreground">Pull requests will appear here once repositories are connected.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}