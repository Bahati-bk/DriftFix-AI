'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Download, Shield, Loader2, Hash } from 'lucide-react';

interface Report {
  id: string;
  framework: string;
  status: string;
  score: number;
  integrityHash: string;
  createdAt: string;
}

export function ReportsView() {
  const [framework, setFramework] = useState('SOC2');
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestHash, setLatestHash] = useState('');

  useEffect(() => {
    // We load reports from evidence records filtered by REPORT_GENERATED
    fetch('/api/evidence?limit=50')
      .then((r) => r.json())
      .then((data) => {
        const recs = data.records || data.evidenceRecords || [];
        const reportRecs = recs.filter(
          (r: Record<string, unknown>) => r.eventType === 'REPORT_GENERATED'
        );
        setReports(
          reportRecs.map((r: Record<string, unknown>, i: number) => ({
            id: String(r.id),
            framework: String((r.payload as Record<string, unknown>)?.framework || 'SOC2'),
            status: 'completed',
            score: Number((r.payload as Record<string, unknown>)?.score ?? 0),
            integrityHash: String(r.currentHash || ''),
            createdAt: String(r.createdAt),
          }))
        );
        if (reportRecs.length > 0) {
          setLatestHash(String(reportRecs[0].currentHash || ''));
        }
      })
      .catch(() => {
        toast.error('Failed to load reports');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');
      toast.success(`${framework} report generated!`);
      if (data.integrityHash) setLatestHash(data.integrityHash);
      // Refresh reports list
      fetch('/api/evidence?limit=50')
        .then((r) => r.json())
        .then((data) => {
          const recs = data.records || data.evidenceRecords || [];
          const reportRecs = recs.filter(
            (r: Record<string, unknown>) => r.eventType === 'REPORT_GENERATED'
          );
          setReports(
            reportRecs.map((r: Record<string, unknown>) => ({
              id: String(r.id),
              framework: String((r.payload as Record<string, unknown>)?.framework || 'SOC2'),
              status: 'completed',
              score: Number((r.payload as Record<string, unknown>)?.score ?? 0),
              integrityHash: String(r.currentHash || ''),
              createdAt: String(r.createdAt),
            }))
          );
        });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate and manage compliance audit reports</p>
        </div>
      </div>

      {/* Generate Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Framework</label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOC2">SOC 2 Type II</SelectItem>
                  <SelectItem value="GDPR">GDPR</SelectItem>
                  <SelectItem value="HIPAA">HIPAA</SelectItem>
                  <SelectItem value="ISO27001">ISO 27001</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>

          {/* Latest Hash */}
          {latestHash && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="size-3.5" />
                <span className="font-medium">Latest Integrity Hash:</span>
                <code className="text-foreground/80 font-mono break-all">{latestHash}</code>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-14 w-full" />))}</div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No reports generated yet. Click &quot;Generate Report&quot; to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                >
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.framework} Compliance Report</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${r.score >= 80 ? 'text-emerald-400' : r.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {r.score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">score</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    <Shield className="size-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
