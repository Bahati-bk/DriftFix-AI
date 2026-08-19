'use client';

import { useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/stores/app';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  status: string;
  filePath: string | null;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) !== 1 ? 's' : ''} ago`;
}

const severityColors: Record<Severity, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-gray-400',
};

const severityBadgeVariant: Record<Severity, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  CRITICAL: 'destructive',
  HIGH: 'default',
  MEDIUM: 'secondary',
  LOW: 'outline',
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const selectFinding = useAppStore((s) => s.selectFinding);
  const setView = useAppStore((s) => s.setView);

  const fetchFindings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/findings?limit=8&status=OPEN');
      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
        setTotalCount(data.pagination?.total ?? 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFindings();
    }
  }, [open, fetchFindings]);

  const handleNotificationClick = (id: string) => {
    selectFinding(id);
    setView('finding-detail');
    setOpen(false);
  };

  const handleViewAll = () => {
    selectFinding(null);
    setView('findings');
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    // Visual feedback - clear the list display
    setFindings([]);
    setTotalCount(0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden rounded-xl border shadow-lg"
      >
        <Card className="border-0 shadow-none py-0 gap-0 rounded-xl animate-fade-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-bold">
                  {totalCount}
                </Badge>
              )}
            </div>
            {findings.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications list */}
          <CardContent className="p-0">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : findings.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-sm">No new notifications</span>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto notification-scroll">
                {findings.map((finding) => (
                  <button
                    key={finding.id}
                    onClick={() => handleNotificationClick(finding.id)}
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-b-0"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${severityColors[finding.severity]}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">
                            {finding.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={severityBadgeVariant[finding.severity]}
                            className="text-[10px] px-1.5 py-0 h-4 font-medium"
                          >
                            {finding.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(finding.createdAt)}
                          </span>
                        </div>
                        {finding.filePath && (
                          <span className="block text-[11px] font-mono text-muted-foreground/70 mt-1 truncate">
                            {finding.filePath}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>

          {/* Footer */}
          {findings.length > 0 && (
            <div className="border-t border-border/50 px-4 py-2.5">
              <button
                onClick={handleViewAll}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                View all findings
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
}
