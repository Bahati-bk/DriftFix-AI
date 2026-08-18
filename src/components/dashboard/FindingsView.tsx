'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';
import { Search, ShieldOff, ChevronLeft, ChevronRight, Zap, Download, CheckCircle2, XCircle, Ban, Loader2, AlertTriangle, CircleDot, LayoutGrid, Eye } from 'lucide-react';

export function FindingsView() {
  const selectFinding = useAppStore((s) => s.selectFinding);
  const setView = useAppStore((s) => s.setView);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const [findings, setFindings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState(searchQuery);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const filterPresets = [
    { label: 'Critical', filter: { severity: 'CRITICAL', status: 'OPEN' }, icon: AlertTriangle },
    { label: 'High Risk', filter: { severity: 'HIGH', status: 'OPEN' }, icon: AlertTriangle },
    { label: 'Open', filter: { status: 'OPEN' }, icon: CircleDot },
    { label: 'Resolved', filter: { status: 'RESOLVED' }, icon: CheckCircle2 },
    { label: 'All', filter: {}, icon: LayoutGrid },
  ];

  const applyPreset = (preset: typeof filterPresets[number]) => {
    setSeverity((preset.filter as Record<string, string>).severity || 'ALL');
    setStatus((preset.filter as Record<string, string>).status || 'ALL');
    setCategory('ALL');
    setActivePreset(preset.label);
    setPage(1);
  };

  const fetchFindings = useCallback(async (p: number, s: string, st: string, c: string, q: string) => {
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (s !== 'ALL') params.set('severity', s);
    if (st !== 'ALL') params.set('status', st);
    if (c !== 'ALL') params.set('category', c);
    if (q) params.set('search', q);
    const data = await (await fetch(`/api/findings?${params}`)).json();
    setFindings(data.findings || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotalCount(data.pagination?.total || 0);
    return data;
  }, []);

  const runAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const res = await fetch('/api/demo/analyze', { method: 'POST' });
      if (res.ok) {
        await fetchFindings(1, severity, status, category, search);
        setPage(1);
      }
    } catch {
      // empty
    }
    setRunningAnalysis(false);
  };

  const exportCSV = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '1000', format: 'csv' });
      if (severity !== 'ALL') params.set('severity', severity);
      if (status !== 'ALL') params.set('status', status);
      if (category !== 'ALL') params.set('category', category);
      if (search) params.set('search', search);
      const res = await fetch(`/api/findings?${params}`);
      const data = await res.json();
      const items = data.findings || [];
      if (items.length === 0) {
        toast.info('No findings to export');
        return;
      }
      const headers = ['Severity', 'Status', 'Category', 'Title', 'File', 'Line', 'Confidence', 'Description'];
      const rows = items.map((f: Record<string, unknown>) => [
        String(f.severity),
        String(f.status),
        String(f.category).replace(/_/g, ' '),
        String(f.title).replace(/"/g, '""'),
        String(f.filePath || ''),
        String(f.lineStart || ''),
        `${Math.round(Number(f.confidence || 0) * 100)}%`,
        String(f.description || '').replace(/"/g, '""').replace(/\n/g, ' '),
      ]);
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `driftfix-findings-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${items.length} findings to CSV`);
    } catch {
      toast.error('Export failed');
    }
  }, [severity, status, category, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === findings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(findings.map((f) => String(f.id))));
    }
  };

  const bulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(action);
    try {
      const endpoint = action === 'resolve' ? 'resolve' : action === 'dismiss' ? 'dismiss' : 'accept-risk';
      const actionLabel = action === 'resolve' ? 'Resolved' : action === 'dismiss' ? 'Dismissed' : 'Accepted risk for';

      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/findings/${id}/${endpoint}`, { method: 'POST' }).then((res) => {
            if (!res.ok) throw new Error(`Failed for ${id}`);
            return id;
          })
        )
      );

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.filter((r) => r.status === 'rejected').length;

      if (failCount > 0) {
        toast.warning(`${actionLabel} ${successCount} finding${successCount !== 1 ? 's' : ''} (${failCount} failed)`);
      } else {
        toast.success(`${actionLabel} ${successCount} finding${successCount !== 1 ? 's' : ''}`);
      }

      setSelectedIds(new Set());
      await fetchFindings(page, severity, status, category, search);
    } catch {
      toast.error('Bulk action failed');
    }
    setBulkLoading(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await fetchFindings(page, severity, status, category, search);
      } catch {
        /* empty */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [severity, status, category, search, page, fetchFindings]);

  const allSelected = findings.length > 0 && selectedIds.size === findings.length;

  const currentFindings = findings;

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, currentFindings.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && currentFindings[focusedIndex]) {
      selectFinding(String(currentFindings[focusedIndex].id));
      setView('finding-detail');
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Findings</h1>
          <p className="text-secondary-bright text-sm mt-1">
            Compliance and security findings across all repositories
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={runAnalysis} disabled={runningAnalysis} className="gap-1.5 text-xs">
            {runningAnalysis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {runningAnalysis ? 'Analyzing...' : 'New Scan'}
          </Button>
        </div>
      </div>

      {/* Quick Filter Presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        {filterPresets.map((preset) => {
          const Icon = preset.icon;
          const isActive = activePreset === preset.label;
          return (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-secondary/50 text-muted-foreground border-border/60 hover:border-primary/20 hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="h-px bg-border/60 my-3" />

      {/* Filters */}
      <Card className="border-border/50 rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter findings..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchQuery(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-sm focus-ring-animate"
              />
            </div>
            <Select value={severity} onValueChange={(v) => { setSeverity(v); setActivePreset(null); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[120px] h-8 text-sm"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severity</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setActivePreset(null); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[120px] h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
                <SelectItem value="ACCEPTED_RISK">Accepted Risk</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => { setCategory(v); setActivePreset(null); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] h-8 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="PII_LOGGING">PII Logging</SelectItem>
                <SelectItem value="HARDCODED_SECRETS">Hardcoded Secrets</SelectItem>
                <SelectItem value="INSECURE_CORS">Insecure CORS</SelectItem>
                <SelectItem value="MISSING_AUTH">Missing Auth</SelectItem>
                <SelectItem value="MISSING_RATE_LIMIT">Missing Rate Limit</SelectItem>
                <SelectItem value="SENSITIVE_DATA_EXPOSURE">Data Exposure</SelectItem>
                <SelectItem value="WEAK_ENCRYPTION">Weak Encryption</SelectItem>
                <SelectItem value="DANGEROUS_DEPENDENCY">Dangerous Dep</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Count & Select All */}
      {!loading && findings.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4"
            />
            <span className="text-xs text-secondary-bright">
              Showing {findings.length} of {totalCount} findings
            </span>
          </div>
          <span className="text-xs text-secondary-bright">
            Page {page} of {totalPages}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="space-y-2" tabIndex={0} onKeyDown={handleListKeyDown}>
        <span className="sr-only">Use arrow keys to navigate, Enter to open</span>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 skeleton" />)
          : findings.map((f, index) => {
              const isSelected = selectedIds.has(String(f.id));
              const confVal = Math.round(Number(f.confidence) * 100);
              const confColor = confVal >= 80 ? 'text-emerald-400' : confVal >= 50 ? 'text-yellow-400' : 'text-red-400';
              const confBarColor = confVal >= 80 ? 'bg-emerald-500' : confVal >= 50 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <Card
                  key={String(f.id)}
                  className={`group border-border/50 card-hover cursor-pointer transition-all duration-200 rounded-xl hover:bg-accent/50 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 animate-stagger ${isSelected ? 'ring-1 ring-primary/50 bg-primary/5' : ''} ${focusedIndex === index ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                  onClick={() => selectFinding(String(f.id))}
                  style={{ animationDelay: `${Math.min(index, 15) * 40}ms` }}
                >
                  <CardContent className="p-3 sm:p-5 flex items-center gap-3">
                    <div onClick={(e) => { e.stopPropagation(); toggleSelect(String(f.id)); }} className="shrink-0">
                      <Checkbox checked={isSelected} className="h-4 w-4" />
                    </div>
                    <Badge className={`severity-${String(f.severity).toLowerCase()} text-[10px] px-1.5 py-0 font-bold shrink-0 border-l-2`}>
                      {String(f.severity)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{String(f.title)}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {String(f.filePath)}{f.lineStart ? `:${f.lineStart}` : ''}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 hidden md:inline-flex">
                          {String(f.category).replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    {/* Confidence Pill */}
                    <div className="flex items-center gap-1.5 shrink-0 hidden sm:flex">
                      <div className="w-10 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${confBarColor}`} style={{ width: `${confVal}%`, transition: 'width 0.5s ease-out' }} />
                      </div>
                      <span className={`text-xs font-medium tabular-nums w-8 text-right ${confColor}`}>{confVal}%</span>
                      <span className={`text-xs font-medium hidden lg:inline ${confColor} opacity-80`}>conf</span>
                    </div>
                    <Badge
                      variant={f.status === 'OPEN' ? 'destructive' : f.status === 'RESOLVED' ? 'default' : 'secondary'}
                      className="text-[10px] shrink-0"
                    >
                      {String(f.status).replace(/_/g, ' ')}
                    </Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); selectFinding(String(f.id)); setView('finding-detail'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary"
                      aria-label="View finding details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              );
            })
        }
        {findings.length === 0 && !loading && (
          <Card className="border-border/50 rounded-xl">
            <CardContent className="p-12 text-center">
              <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No findings match your filters</h3>
              <p className="text-sm text-secondary-bright mb-4">Run an analysis to discover compliance issues</p>
              <Button onClick={runAnalysis} disabled={runningAnalysis} className="gap-2">
                <Zap className="h-4 w-4" />
                {runningAnalysis ? 'Running...' : 'Run Analysis'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <Button
                key={pageNum}
                variant={page === pageNum ? 'default' : 'outline'}
                size="sm"
                className="w-8 h-8 p-0 text-xs"
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl bg-card/95 backdrop-blur-sm border border-border shadow-xl animate-slide-in overflow-x-auto">
          <span className="text-sm font-medium whitespace-nowrap">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs h-8"
            disabled={bulkLoading === 'resolve'}
            onClick={() => bulkAction('resolve')}
          >
            {bulkLoading === 'resolve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            Resolve Selected
          </Button>
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs h-8"
            disabled={bulkLoading === 'dismiss'}
            onClick={() => bulkAction('dismiss')}
          >
            {bulkLoading === 'dismiss' ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 text-slate-400" />}
            Dismiss
          </Button>
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs h-8"
            disabled={bulkLoading === 'accept-risk'}
            onClick={() => bulkAction('accept-risk')}
          >
            {bulkLoading === 'accept-risk' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3 text-yellow-500" />}
            Accept Risk
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="ghost" size="sm" className="text-xs h-8 whitespace-nowrap"
            onClick={() => setSelectedIds(new Set())}
          >
            Deselect All
          </Button>
        </div>
      )}
    </div>
  );
}
