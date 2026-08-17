'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ShieldCheck, Link2, AlertTriangle, CheckCircle2, User, Clock } from 'lucide-react';

const evtColors: Record<string, string> = {
  FINDING_DETECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  FINDING_RESOLVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  FINDING_DISMISSED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  FINDING_ACKNOWLEDGED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PR_ANALYZED: 'bg-primary/20 text-primary border-primary/30',
  REPOSITORY_CONNECTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SCORE_UPDATED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  POLICY_CHANGED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  AUDIT_REPORT_GENERATED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  INTEGRATION_CONNECTED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  COMPLIANCE_POSTURE_CHANGED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  FINDING_ACCEPTED_RISK: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export function EvidenceView() {
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [integrity, setIntegrity] = useState<{ valid: boolean; recordsVerified: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async () => {
 setLoading(true);
  try {
    const res = await fetch(`/api/evidence?page=${page}&limit=15`);
    const data = await res.json();
    setRecords(data.records || []);
    setTotalPages(data.totalPages || 1);
  } catch { /* empty */ }
  setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page]);

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify' }) });
      const data = await res.json();
      setIntegrity(data);
      toast.success(data.valid ? 'Evidence chain verified ✓' : 'Evidence chain broken!');
    } catch { toast.error('Verification failed'); }
    setVerifying(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evidence Ledger</h1>
          <p className="text-muted-foreground text-sm mt-1">Tamper-evident audit trail of all compliance events</p>
        </div>
        <Button variant="outline" size="sm" onClick={verifyChain} disabled={verifying}>
          <ShieldCheck className="h-4 w-4 mr-1.5" />{verifying ? 'Verifying...' : 'Verify Chain Integrity'}
        </Button>
      </div>

      {integrity && (
        <Card className={`border ${integrity.valid ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {integrity.valid ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
            <div>
              <div className="font-semibold text-sm">Evidence Integrity: {integrity.valid ? '✓ VERIFIED' : '✗ BROKEN'}</div>
              <div className="text-xs text-muted-foreground">{integrity.recordsVerified} records verified using SHA-256 hash chain</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />) :
          records.map((rec, i) => {
            let payload: Record<string, unknown> = {};
            try { payload = rec.payload ? JSON.parse(rec.payload) : {}; } catch { /* empty */ }
            return (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">#{records.length - i + (page - 1) * 15}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`text-[10px] border ${evtColors[rec.eventType || ''] || 'bg-secondary text-muted-foreground border-border'}`}>{rec.eventType?.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{rec.actor}</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {Object.entries(payload).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' • ')}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(rec.createdAt).toLocaleString()}</span>
                        <span className="flex items-center gap-1 font-mono"><Link2 className="h-3 w-3" />{rec.hash?.substring(0, 16)}...</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        }
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}