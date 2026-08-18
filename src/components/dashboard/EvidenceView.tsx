'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ShieldCheck, CheckCircle2, XCircle, User, Clock, ChevronDown,
  ChevronRight, ChevronLeft, Copy, Check, ScrollText, FileSearch,
} from 'lucide-react';

const evtColors: Record<string, string> = {
  FINDING_DETECTED: 'bg-red-500/20 text-red-400',
  FINDING_RESOLVED: 'bg-emerald-500/20 text-emerald-400',
  FINDING_DISMISSED: 'bg-slate-500/20 text-slate-300',
  FINDING_ACKNOWLEDGED: 'bg-yellow-500/20 text-yellow-400',
  PR_ANALYZED: 'bg-primary/20 text-primary',
  REPOSITORY_CONNECTED: 'bg-cyan-500/20 text-cyan-400',
  SCORE_UPDATED: 'bg-purple-500/20 text-purple-400',
  POLICY_CHANGED: 'bg-orange-500/20 text-orange-400',
  AUDIT_REPORT_GENERATED: 'bg-emerald-500/20 text-emerald-400',
  INTEGRATION_CONNECTED: 'bg-teal-500/20 text-teal-400',
  COMPLIANCE_POSTURE_CHANGED: 'bg-emerald-500/20 text-emerald-400',
  FINDING_ACCEPTED_RISK: 'bg-orange-500/20 text-orange-400',
  DEMO_ANALYSIS_COMPLETED: 'bg-primary/20 text-primary',
  FINDING_STATUS_CHANGED: 'bg-yellow-500/20 text-yellow-400',
};

const dotColors: Record<string, string> = {
  FINDING_DETECTED: 'bg-red-500',
  FINDING_RESOLVED: 'bg-emerald-500',
  FINDING_DISMISSED: 'bg-slate-500',
  FINDING_ACKNOWLEDGED: 'bg-yellow-500',
  PR_ANALYZED: 'bg-primary',
  REPOSITORY_CONNECTED: 'bg-cyan-500',
  SCORE_UPDATED: 'bg-purple-500',
  POLICY_CHANGED: 'bg-orange-500',
  AUDIT_REPORT_GENERATED: 'bg-emerald-500',
  INTEGRATION_CONNECTED: 'bg-teal-500',
  COMPLIANCE_POSTURE_CHANGED: 'bg-emerald-500',
  FINDING_ACCEPTED_RISK: 'bg-orange-500',
  DEMO_ANALYSIS_COMPLETED: 'bg-primary',
  FINDING_STATUS_CHANGED: 'bg-yellow-500',
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

function CopyHashButton({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success('Hash copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
      title="Copy full hash"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function PayloadSection({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([, v]) => v !== null && v !== undefined && v !== '' && String(v) !== '{}'
  );
  if (entries.length === 0) return null;

  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-accent">
        <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
        <span>View details</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md bg-secondary/50 border border-border/50 p-3 space-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 text-xs">
              <span className="font-medium text-muted-foreground shrink-0">{k}:</span>
              <span className="text-foreground/80 break-all">
                {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EvidenceView() {
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [integrity, setIntegrity] = useState<{
    valid: boolean;
    recordsVerified: number;
    verifiedAt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/evidence?page=${page}&limit=15`);
        if (cancelled) return;
        const data = await res.json();
        setRecords(data.records || []);
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
  }, [page]);

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      const data = await res.json();
      setIntegrity({
        ...data,
        verifiedAt: new Date().toISOString(),
      });
      toast.success(data.valid ? 'Evidence chain verified' : 'Evidence chain broken!');
    } catch {
      toast.error('Verification failed');
    }
    setVerifying(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
            Evidence Ledger
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tamper-evident audit trail of all compliance events
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={verifyChain}
          disabled={verifying}
          className="gap-2"
        >
          <ShieldCheck className="h-4 w-4" />
          {verifying ? 'Verifying...' : 'Verify Chain Integrity'}
        </Button>
      </div>

      {/* Chain Verification Banner */}
      {integrity && (
        <div
          className={`rounded-lg border p-4 flex items-center gap-4 ${
            integrity.valid
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-red-500/50 bg-red-500/5'
          }`}
        >
          {integrity.valid ? (
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
          )}
          <div className="flex-1">
            <div className={`font-bold text-sm ${integrity.valid ? 'text-emerald-400' : 'text-red-400'}`}>
              Evidence Integrity: {integrity.valid ? 'VERIFIED' : 'BROKEN'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {integrity.recordsVerified} records verified using SHA-256 hash chain
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">Verified at</div>
            <div className="text-xs font-mono">
              {integrity.verifiedAt
                ? new Date(integrity.verifiedAt).toLocaleTimeString()
                : '—'}
            </div>
          </div>
        </div>
      )}

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
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <FileSearch className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No evidence records yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Evidence records are created automatically when analyses run or actions are taken
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border/40" />

          <div className="space-y-3">
            {records.map((rec, i) => {
              let payload: Record<string, unknown> = {};
              try {
                payload = rec.payload ? JSON.parse(rec.payload as string) : {};
              } catch {
                // empty
              }
              const evtType = String(rec.eventType || '');
              const fullHash = String(rec.hash || '');
              const isLast = i === records.length - 1;
              const seqNum = records.length - i + (page - 1) * 15;

              return (
                <div key={i} className="relative flex gap-4 group">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex flex-col items-center shrink-0 pt-4">
                    <div
                      className={`h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center shadow-sm ${
                        dotColors[evtType] || 'bg-muted-foreground'
                      }`}
                    >
                      <div className="h-[10px] w-[10px] rounded-full bg-background" />
                    </div>
                  </div>

                  {/* Content card */}
                  <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-3'}`}>
                    <Card className="border-border/50 hover:border-border transition-colors">
                      <CardContent className="p-4">
                        {/* Top row: badge, actor, time */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge
                            className={`text-[10px] font-medium border-0 ${
                              evtColors[evtType] || 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {evtType.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                            <User className="h-3 w-3" />
                            {String(rec.actor || 'system')}
                          </span>
                          <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(String(rec.createdAt))}
                          </span>
                        </div>

                        {/* Payload collapsible */}
                        <PayloadSection payload={payload} />

                        {/* Bottom row: hash */}
                        {fullHash && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
                            <span className="text-[10px] text-muted-foreground shrink-0">Hash</span>
                            <code className="text-[11px] font-mono text-muted-foreground/80 truncate flex-1">
                              {fullHash.length > 24
                                ? `${fullHash.substring(0, 16)}...${fullHash.substring(fullHash.length - 8)}`
                                : fullHash}
                            </code>
                            <CopyHashButton hash={fullHash} />
                          </div>
                        )}
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
