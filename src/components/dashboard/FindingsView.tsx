'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/stores/app';
import { Search, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

export function FindingsView() {
  const selectFinding = useAppStore((s) => s.selectFinding);
  const [findings, setFindings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { let cancelled = false; (async () => { setLoading(true); try { const params = new URLSearchParams({ page: String(page), limit: '20' }); if (severity !== 'ALL') params.set('severity', severity); if (status !== 'ALL') params.set('status', status); if (category !== 'ALL') params.set('category', category); if (search) params.set('search', search); const res = await fetch(`/api/findings?${params}`); if (cancelled) return; const data = await res.json(); setFindings(data.findings || []); setTotalPages(data.pagination?.totalPages || 1); } catch { /* empty */ } if (!cancelled) setLoading(false); })(); return () => { cancelled = true; }; }, [severity, status, category, search, page]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Findings</h1>
        <p className="text-muted-foreground text-sm mt-1">Compliance and security findings across all repositories</p>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search findings..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9" />
            </div>
            <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1); }}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severity</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
                <SelectItem value="ACCEPTED_RISK">Accepted Risk</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
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

      {/* Table */}
      <div className="space-y-2">
        {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />) :
          findings.map((f) => (
            <Card key={String(f.id)} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => selectFinding(String(f.id))}>
              <CardContent className="p-4 flex items-center gap-4">
                <Badge className={`severity-${String(f.severity).toLowerCase()} text-[10px] px-1.5 py-0 font-bold shrink-0`}>{String(f.severity)}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{String(f.title)}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{String(f.filePath)}{f.lineStart ? `:${f.lineStart}` : ''}</div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:flex">{String(f.category).replace(/_/g, ' ')}</Badge>
                <div className="text-xs text-muted-foreground w-12 text-right shrink-0">{Math.round(Number(f.confidence) * 100)}%</div>
                <Badge variant={f.status === 'OPEN' ? 'destructive' : f.status === 'RESOLVED' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                  {String(f.status).replace(/_/g, ' ')}
                </Badge>
              </CardContent>
            </Card>
          ))
        }
        {findings.length === 0 && !loading && (
          <Card className="border-border/50"><CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No findings match your filters</h3>
            <p className="text-sm text-muted-foreground">Try adjusting the filter criteria above.</p>
          </CardContent></Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}