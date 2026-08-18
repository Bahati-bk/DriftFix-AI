'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app';
import { GitPullRequest, GitBranch, ArrowRight } from 'lucide-react';

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  open: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  closed: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  merged: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
};

const statusBorderAccent: Record<string, string> = {
  open: 'border-l-2 border-l-emerald-500/60',
  merged: 'border-l-2 border-l-blue-500/60',
  closed: 'border-l-2 border-l-slate-500/40',
};

export function PullRequestsView() {
  const selectPR = useAppStore((s) => s.selectPR);
  const [prs, setPrs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/pull-requests')
      .then((r) => r.json())
      .then((data) => {
        setPrs(data.pullRequests || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-72" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? prs : prs.filter((p) => String(p.status) === filter);
  const openCount = prs.filter((p) => String(p.status) === 'open').length;
  const closedCount = prs.filter((p) => String(p.status) === 'closed').length;
  const mergedCount = prs.filter((p) => String(p.status) === 'merged').length;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pull Requests</h1>
        <p className="section-subtitle mt-1">
          {prs.length} total {"\u2022 "} {openCount} open {"\u2022 "} {mergedCount} merged {"\u2022 "} {closedCount} closed
        </p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            All
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{prs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-1.5">
            Open
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{openCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-1.5">
            Closed
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{closedCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="merged" className="gap-1.5">
            Merged
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{mergedCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.map((pr) => {
          const status = String(pr.status || 'open').toLowerCase();
          const authorName = String(pr.author || 'U');
          const cfg = statusConfig[status] || statusConfig.open;
          const repoName = String(pr.repositoryId || '');

          return (
            <Card
              key={String(pr.id)}
              className={`border-border/50 card-hover rounded-xl cursor-pointer group ${statusBorderAccent[status] || ''}`}
              onClick={() => selectPR(String(pr.id))}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-primary text-sm font-bold">
                  {authorName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      #{pr.number}
                    </Badge>
                    <span className="font-semibold text-sm truncate">{String(pr.title)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5 font-mono text-xs bg-secondary/50 px-1.5 py-0.5 rounded text-foreground/70">
                      <GitBranch className="h-3 w-3" />
                      {String(pr.sourceBranch)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                    <span className="flex items-center gap-1.5 font-mono text-xs bg-secondary/50 px-1.5 py-0.5 rounded text-foreground/70">
                      {String(pr.targetBranch)}
                    </span>
                    {repoName && (
                      <span className="text-muted-foreground/60">{"\u2022"}</span>
                    )}
                    {repoName && (
                      <span className="text-[11px]">{repoName}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-center">
                  <span
                    className={`h-2 w-2 rounded-full status-dot-glow ${cfg.text.replace('text-', 'bg-')}`}
                  />
                  <Badge
                    className={`text-[10px] font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card className="border-border/50 rounded-xl">
            <CardContent className="p-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <GitPullRequest className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {filter === 'all' ? 'No pull requests yet' : `No ${filter} pull requests`}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Pull requests will appear here once repositories are connected and analyzed.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
