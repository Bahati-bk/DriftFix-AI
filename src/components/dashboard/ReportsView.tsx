'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { FileText, Download, Shield, Loader2, Hash, Copy, Check, AlertTriangle, FileBarChart } from 'lucide-react';

const frameworkDescriptions: Record<string, string> = {
  SOC2: 'SOC 2 Type II — Trust Services Criteria covering security, availability, and confidentiality.',
  GDPR: 'General Data Protection Regulation — EU data privacy and protection compliance.',
  HIPAA: 'Health Insurance Portability and Accountability Act — Healthcare data security.',
  ISO27001: 'ISO/IEC 27001 — Information security management systems standard.',
};

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
  const [complianceScore, setComplianceScore] = useState(0);
  const [openFindings, setOpenFindings] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    return fetch('/api/evidence?limit=50')
      .then((r) => r.json())
      .then((data) => {
        const recs = data.records || data.evidenceRecords || [];
        const reportRecs = recs.filter(
          (r: Record<string, unknown>) => r.eventType === 'REPORT_GENERATED',
        );
        setReports(
          reportRecs.map((r: Record<string, unknown>) => ({
            id: String(r.id),
            framework: String((r.payload as Record<string, unknown>)?.framework || 'SOC2'),
            status: 'completed',
            score: Number((r.payload as Record<string, unknown>)?.score ?? 0),
            integrityHash: String(r.currentHash || ''),
            createdAt: String(r.createdAt),
          })),
        );
      });
  }, []);

  useEffect(() => {
    Promise.all([
      loadReports(),
      fetch('/api/compliance').then((r) => r.json()),
      fetch('/api/findings?status=OPEN&limit=1').then((r) => r.json()),
    ])
      .then(([, comp, findings]) => {
        setComplianceScore(Number(comp?.score || 0));
        setOpenFindings(Number(findings?.total || 0));
      })
      .catch(() => {
        toast.error('Failed to load reports');
      })
      .finally(() => setLoading(false));
  }, [loadReports]);

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
      await loadReports();
      const compRes = await fetch('/api/compliance');
      const comp = await compRes.json();
      setComplianceScore(Number(comp?.score || 0));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework: report.framework }),
      });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.framework.toLowerCase()}-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to download report');
    }
  };

  const copyHash = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedId(id);
      toast.success('Hash copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  const scoreColor = (s: number) => (s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-red-400');

  const lastReportDate = reports.length > 0 ? formatDate(reports[0].createdAt) : 'Never';

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="section-subtitle">Generate and manage compliance audit reports</p>
        </div>
      </div>

      <Card className="border-border/50 rounded-xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 text-center">
            <div className="border-r-2 border-primary/20 pr-6">
              <div className={`text-3xl font-bold ${scoreColor(complianceScore)}`}>{complianceScore}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Current Score</div>
            </div>
            <div className="border-r-2 border-amber-400/20 px-6">
              <div className="text-2xl font-semibold text-muted-foreground">{openFindings}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Open Findings</div>
            </div>
            <div className="pl-6">
              <div className="text-lg font-semibold mt-1">{lastReportDate}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Last Report</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-sm text-muted-foreground">Framework</label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger className="w-full sm:w-56 [&>svg:last-child]:opacity-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOC2">
                    <div className="flex flex-col">
                      <span>SOC 2 Type II</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Trust services criteria compliance</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="GDPR">
                    <div className="flex flex-col">
                      <span>GDPR</span>
                      <span className="text-[10px] text-muted-foreground font-normal">EU data protection regulation</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="HIPAA">
                    <div className="flex flex-col">
                      <span>HIPAA</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Healthcare data security</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ISO27001">
                    <div className="flex flex-col">
                      <span>ISO 27001</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Information security management</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {frameworkDescriptions[framework] && (
                <p className="text-xs text-muted-foreground">{frameworkDescriptions[framework]}</p>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2 btn-press">
              {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <FileBarChart className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No reports generated yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Select a compliance framework and click "Generate Report" to create your first audit report.
              </p>
              <Button variant="outline" className="gap-2 btn-press" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                Generate Your First Report
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reports.map((r) => {
                const truncatedHash = r.integrityHash
                  ? `${r.integrityHash.slice(0, 16)}...${r.integrityHash.slice(-8)}`
                  : 'N/A';
                return (
                  <Card key={r.id} className="border-border hover:border-primary/30 transition-colors rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {r.framework}
                            </Badge>
                            <span className={`text-sm font-bold ${scoreColor(r.score)}`}>{r.score}</span>
                            <span className="text-[10px] text-muted-foreground">score</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{formatDate(r.createdAt)}</p>
                          {r.integrityHash && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <Hash className="size-3 text-muted-foreground shrink-0" />
                              <code className="text-muted-foreground font-mono truncate">{truncatedHash}</code>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyHash(r.id, r.integrityHash); }}
                                className="shrink-0 hover:text-foreground transition-colors text-muted-foreground"
                              >
                                {copiedId === r.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">
                            <Shield className="size-3 mr-1" />
                            Verified
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8"
                            onClick={() => handleDownload(r)}
                          >
                            <Download className="size-3" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
