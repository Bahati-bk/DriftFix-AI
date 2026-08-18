'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

type ActivityType = 'FINDING' | 'EVIDENCE' | 'ANALYSIS' | 'PR';

interface ActivityEntry {
  id: string;
  type: ActivityType;
  action: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

const TYPE_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Findings', value: 'FINDING' },
  { label: 'Evidence', value: 'EVIDENCE' },
  { label: 'Analysis', value: 'ANALYSIS' },
  { label: 'PRs', value: 'PR' },
];

const typeDotColors: Record<ActivityType, string> = {
  FINDING: 'bg-red-500',
  EVIDENCE: 'bg-emerald-500',
  ANALYSIS: 'bg-purple-500',
  PR: 'bg-blue-500',
};

const typeBadgeColors: Record<ActivityType, string> = {
  FINDING: 'bg-red-500/20 text-red-400',
  EVIDENCE: 'bg-emerald-500/20 text-emerald-400',
  ANALYSIS: 'bg-purple-500/20 text-purple-400',
  PR: 'bg-blue-500/20 text-blue-400',
};

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export function AuditLogView() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');

  const buildTypeParam = () => {
    if (typeFilter === 'all') return '';
    return `&type=${typeFilter}`;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const typeParam = buildTypeParam();
        const res = await fetch(`/api/audit-log?page=${page}&limit=20${typeParam}`);
        if (cancelled) return;
        const data = await res.json();
        setActivities(data.activities || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch {
        // empty
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [page, typeFilter]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Audit Activity Log
        </h1>
        <p className="text-secondary-bright text-sm mt-1">
          Complete audit trail of all compliance activities
        </p>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_FILTERS.map((filter) => {
          const isActive = typeFilter === filter.value;
          return (
            <button
              key={filter.value}
              onClick={() => {
                setTypeFilter(filter.value);
                setPage(1);
              }}
              className={`tag-pill text-xs px-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground border-border/60 hover:bg-accent hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
                <div className="w-px flex-1 bg-border/30" />
              </div>
              <div className="flex-1 h-20 bg-muted rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No activity yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Activity entries will appear here once analyses are run or actions are taken
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border/40" />
          <div className="space-y-3">
            {activities.map((entry, i) => {
              const isLast = i === activities.length - 1;
              return (
                <div key={entry.id} className="relative flex gap-4">
                  <div className="relative z-10 flex flex-col items-center shrink-0 pt-4">
                    <div
                      className={`h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center shadow-sm status-dot-glow ${typeDotColors[entry.type]}`}
                    >
                      <div className="h-3.5 w-3.5 rounded-full bg-background" />
                    </div>
                  </div>
                  <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-3'}`}>
                    <Card className="border-border/50 rounded-xl hover:border-border/70 hover:bg-accent/50 transition-all duration-200">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-[10px] font-medium border-0 ${typeBadgeColors[entry.type]}`}
                          >
                            {entry.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(entry.timestamp)}
                          </span>
                        </div>
                        <div className="mt-2 font-medium text-sm">{entry.action}</div>
                        <div className="text-secondary-bright text-sm mt-1">{entry.description}</div>
                        <div className="text-xs text-muted-foreground mt-2">{entry.actor}</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = idx + 1;
              } else if (page <= 3) {
                pageNum = idx + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + idx;
              } else {
                pageNum = page - 2 + idx;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="icon"
                  className={`h-8 w-8 text-xs ${page === pageNum ? '' : 'text-muted-foreground'}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground ml-2">Page {page} of {totalPages}</span>
        </div>
      )}
    </div>
  );
}
