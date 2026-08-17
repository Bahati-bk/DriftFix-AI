'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, GitFork, Globe, Lock } from 'lucide-react';

export function RepositoriesView() {
  const [repos, setRepos] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/repositories').then(r => r.json()).then(data => { setRepos(data.repositories || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}</div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Repositories</h1>
        <p className="text-muted-foreground text-sm mt-1">Connected repositories being monitored for compliance drift</p>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {repos.map((repo) => (
          <Card key={repo.id} className="border-border/50 hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold text-sm">{repo.name}</div>
                    <div className="text-xs text-muted-foreground">{repo.fullName}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {repo.visibility === 'public' ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {repo.language && <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{repo.language}</span>}
                <span>Branch: {repo.defaultBranch}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {repos.length === 0 && (
          <Card className="border-border/50 sm:col-span-2 xl:col-span-3">
            <CardContent className="p-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No repositories connected</h3>
              <p className="text-sm text-muted-foreground">Connect a GitHub repository to start monitoring for compliance drift.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}