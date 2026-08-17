'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileCode, Lightbulb, Scale } from 'lucide-react';

export function FindingDetailView() {
  const findingId = useAppStore((s) => s.selectFinding);
  const selectFinding = useAppStore((s) => s.selectFinding);
  const [finding, setFinding] = useState<Record<string, unknown> | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [riskOpen, setRiskOpen] = useState(false);
  const [riskJust, setRiskJust] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fId = useAppStore.getState().selectedFindingId;

  useEffect(() => {
    if (!fId) return;
    setLoading(true);
    fetch(`/api/findings/${fId}`).then(r => r.json()).then(data => {
      setFinding(data.finding || null);
      setMappings(data.finding?.complianceMappings || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [fId]);

  const handleAction = async (action: string, body?: Record<string, string>) => {
    if (!fId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/findings/${fId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      if (res.ok) {
        toast.success(`Finding ${action === 'resolve' ? 'resolved' : action === 'dismiss' ? 'dismissed' : 'accepted as risk'}`);
        setDismissOpen(false);
        setRiskOpen(false);
        const updated = await (await fetch(`/api/findings/${fId}`)).json();
        setFinding(updated.finding || null);
      }
    } catch { toast.error('Action failed'); }
    setActionLoading(false);
  };

  if (loading || !finding) return <div className="p-6 space-y-4"><div className="h-8 w-48 bg-muted rounded animate-pulse" /><div className="h-40 bg-muted rounded-lg animate-pulse" /></div>;

  const confidence = Number(finding.confidence) || 0;
  const confLabel = confidence >= 0.9 ? 'High confidence' : confidence >= 0.7 ? 'Moderate confidence' : 'Needs review';

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <button onClick={() => selectFinding(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Back to Findings
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Badge className={`severity-${String(finding.severity).toLowerCase()} text-xs px-2.5 py-1 font-bold`}>{String(finding.severity)}</Badge>
        <h1 className="text-xl font-bold">{String(finding.title)}</h1>
        <div className="sm:ml-auto">
          <Badge variant={finding.status === 'RESOLVED' ? 'default' : finding.status === 'DISMISSED' ? 'secondary' : 'destructive'}>
            {String(finding.status).replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Evidence */}
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><FileCode className="h-4 w-4 text-primary" />Evidence</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span>{String(finding.filePath)}{finding.lineStart ? `:${finding.lineStart}` : ''}</span>
              </div>
              <pre className="bg-secondary rounded-lg p-4 text-sm font-mono overflow-x-auto border border-border/50">{String(finding.evidence || finding.description)}</pre>
            </CardContent>
          </Card>

          {/* AI Explanation */}
          {finding.aiExplanation && (
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />AI Explanation</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{String(finding.aiExplanation)}</p></CardContent>
            </Card>
          )}

          {/* Impact */}
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" />Impact</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{String(finding.impact || 'No impact description available.')}</p></CardContent>
          </Card>

          {/* Recommendation */}
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Recommended Remediation</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{String(finding.recommendation || 'No recommendation available.')}</p></CardContent>
          </Card>

          {/* Compliance Mappings */}
          {mappings.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Scale className="h-4 w-4 text-primary" />Compliance Mappings</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {mappings.map((m, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{String(m.framework)}</Badge>
                      <span className="text-sm font-medium">{String(m.control)}</span>
                      {m.controlName && <span className="text-xs text-muted-foreground">— {String(m.controlName)}</span>}
                    </div>
                    {m.rationale && <p className="text-xs text-muted-foreground mt-1">{String(m.rationale)}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                <div className="text-2xl font-bold">{Math.round(confidence * 100)}%</div>
                <div className="text-xs text-muted-foreground">{confLabel}</div>
              </div>
              <Separator className="bg-border/50" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Category</div><div className="font-medium text-xs mt-0.5">{String(finding.category).replace(/_/g, ' ')}</div></div>
                <div><div className="text-xs text-muted-foreground">File</div><div className="font-medium text-xs mt-0.5 truncate">{String(finding.filePath || 'N/A')}</div></div>
                <div><div className="text-xs text-muted-foreground">Line</div><div className="font-medium text-xs mt-0.5">{finding.lineStart || 'N/A'}</div></div>
                <div><div className="text-xs text-muted-foreground">Created</div><div className="font-medium text-xs mt-0.5">{finding.createdAt ? new Date(String(finding.createdAt)).toLocaleDateString() : 'N/A'}</div></div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="text-xs text-muted-foreground mb-2 font-medium">Actions</div>
              {finding.status !== 'RESOLVED' && (
                <Button className="w-full" size="sm" onClick={() => handleAction('resolve')} disabled={actionLoading}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />Mark Resolved
                </Button>
              )}
              {finding.status !== 'DISMISSED' && finding.status !== 'RESOLVED' && (
                <Button variant="outline" className="w-full" size="sm" onClick={() => setDismissOpen(true)}>
                  <XCircle className="h-4 w-4 mr-1.5" />Dismiss
                </Button>
              )}
              {finding.status !== 'ACCEPTED_RISK' && finding.status !== 'RESOLVED' && (
                <Button variant="outline" className="w-full" size="sm" onClick={() => setRiskOpen(true)}>
                  <AlertTriangle className="h-4 w-4 mr-1.5" />Accept Risk
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground text-center mt-2">All actions are recorded in the evidence ledger.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dismiss Dialog */}
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent><DialogHeader><DialogTitle>Dismiss Finding</DialogTitle><DialogDescription>This action will be recorded in the evidence ledger.</DialogDescription></DialogHeader>
          <Textarea placeholder="Reason for dismissal (e.g., False positive, Not applicable, Compensating control)" value={dismissReason} onChange={e => setDismissReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!dismissReason.trim()) { toast.error('Reason required'); return; } handleAction('dismiss', { reason: dismissReason }); }} disabled={actionLoading}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Risk Dialog */}
      <Dialog open={riskOpen} onOpenChange={setRiskOpen}>
        <DialogContent><DialogHeader><DialogTitle>Accept Risk</DialogTitle><DialogDescription>Document your justification for accepting this risk.</DialogDescription></DialogHeader>
          <Textarea placeholder="Justification for accepting this risk..." value={riskJust} onChange={e => setRiskJust(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!riskJust.trim()) { toast.error('Justification required'); return; } handleAction('accept-risk', { justification: riskJust }); }} disabled={actionLoading}>Accept Risk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}