'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { GitBranch, Globe, Lock, Plus, GitPullRequest } from 'lucide-react';

const languageColors: Record<string, string> = {
  TypeScript: '#3b82f6',
  Python: '#22c55e',
  Go: '#06b6d4',
  Ruby: '#ef4444',
  JavaScript: '#eab308',
  Rust: '#f97316',
  Java: '#ef4444',
  C: '#64748b',
  'C++': '#64748b',
};

function relativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD}d ago`;
    const diffMo = Math.floor(diffD / 30);
    return `${diffMo}mo ago`;
  } catch {
    return '';
  }
}

export function RepositoriesView() {
  const [repos, setRepos] = useState<Record<string, string>[]>([]);
  const [prCounts, setPrCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/repositories').then(r => r.json()),
      fetch('/api/pull-requests').then(r => r.json()),
    ])
      .then(([repoData, prData]) => {
        const repoList = repoData.repositories || [];
        setRepos(repoList);
        const counts: Record<string, number> = {};
        (prData.pullRequests || []).forEach((pr: Record<string, unknown>) => {
          const repoId = String(pr.repositoryId || '');
          if (repoId) counts[repoId] = (counts[repoId] || 0) + 1;
        });
        setPrCounts(counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Repositories</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {repos.length} connected {repos.length === 1 ? 'repository' : 'repositories'} being monitored
          </p>
        </div>
        <Button
          onClick={() => toast.info('GitHub integration required. Connect your GitHub account to add repositories.')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Connect Repository
        </Button>
      </div>

      {repos.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <GitBranch className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No repositories connected</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Connect a GitHub repository to start monitoring for compliance drift and automated analysis.
            </p>
            <Button
              className="mt-6 gap-2"
              onClick={() => toast.info('GitHub integration required. Connect your GitHub account to add repositories.')}
            >
              <Plus className="h-4 w-4" />
              Connect Your First Repository
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {repos.map((repo) => {
            const lang = repo.language || '';
            const langColor = languageColors[lang] || '#64748b';
            const prCount = prCounts[repo.id] || 0;
            return (
              <Card
                key={repo.id}
                className="border-border/50 card-hover group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                <CardContent className="p-5 relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background"
                        style={{ backgroundColor: langColor }}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{repo.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{repo.fullName}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {repo.visibility === 'public' ? (
                        <><Globe className="h-3 w-3 mr-1" />Public</>
                      ) : (
                        <><Lock className="h-3 w-3 mr-1" />Private</>
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    {lang && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: langColor }}
                        />
                        {lang}
                      </span>
                    )}
                    <code className="text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">
                      {repo.defaultBranch || 'main'}
                    </code>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GitPullRequest className="h-3 w-3" />
                      <span>{prCount} {prCount === 1 ? 'PR' : 'PRs'}</span>
                    </div>
                    {repo.createdAt && (
                      <span className="text-[11px] text-muted-foreground">
                        Connected {relativeTime(String(repo.createdAt))}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
