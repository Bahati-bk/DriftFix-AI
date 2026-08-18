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
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileCode, Lightbulb, Scale, Wrench, Clock, Tag, Copy, MessageSquare, Send } from 'lucide-react';

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
  const currentUser = useAppStore((s) => s.currentUser);
  const [notes, setNotes] = useState<string[]>(finding?.notes ? JSON.parse(finding.notes) : []);
  const [newNote, setNewNote] = useState('');

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
  const confColor = confidence >= 0.9 ? '#22c55e' : confidence >= 0.7 ? '#eab308' : '#ef4444';
  const confBarColor = confidence >= 0.9 ? 'bg-emerald-500' : confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500';

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

          {/* Code Diff Viewer */}
          {(finding.evidence || finding.suggestedFix) ? (
            <Card className="border-border/50 rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-emerald-500" />Code Diff
                  <button
                    onClick={() => {
                      if (finding.suggestedFix) {
                        navigator.clipboard.writeText(String(finding.suggestedFix));
                        toast.success('Copied to clipboard');
                      }
                    }}
                    className="ml-auto p-1 rounded hover:bg-secondary transition-colors"
                    title="Copy suggested fix"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0d1117] rounded-lg border border-border/50 overflow-hidden">
                  <div className="max-h-64 overflow-y-auto overflow-x-auto">
                    {finding.evidence && (
                      <>
                        <div className="px-4 pt-3 pb-1 text-xs font-medium text-red-400">- Before</div>
                        {String(finding.evidence).split('\n').map((line: string, i: number) => (
                          <div key={`before-${i}`} className="flex bg-red-500/10 border-l-2 border-red-500">
                            <span className="text-muted-foreground/50 text-xs font-mono w-8 shrink-0 text-right pr-3 py-0.5 select-none">{i + 1}</span>
                            <pre className="font-mono text-sm text-foreground/90 py-0.5 pr-4 whitespace-pre">{line}</pre>
                          </div>
                        ))}
                      </>
                    )}
                    {finding.suggestedFix && (
                      <>
                        <div className="px-4 pt-3 pb-1 text-xs font-medium text-emerald-400">+ After</div>
                        {String(finding.suggestedFix).split('\n').map((line: string, i: number) => (
                          <div key={`after-${i}`} className="flex bg-emerald-500/10 border-l-2 border-emerald-500">
                            <span className="text-muted-foreground/50 text-xs font-mono w-8 shrink-0 text-right pr-3 py-0.5 select-none">{i + 1}</span>
                            <pre className="font-mono text-sm text-foreground/90 py-0.5 pr-4 whitespace-pre">{line}</pre>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 rounded-xl">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Wrench className="h-4 w-4 text-emerald-500" />Code Diff</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">No code diff available</p></CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card className="border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notes ({notes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet. Add your analysis or context.</p>}
              {notes.map((note, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{currentUser?.name?.charAt(0) || 'U'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{note}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Just now</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newNote.trim()) {
                      setNotes(prev => [...prev, newNote.trim()]);
                      setNewNote('');
                    }
                  }}
                  placeholder="Add a note..."
                  className="flex-1 h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground input-glow focus:outline-none"
                />
                <Button size="sm" onClick={() => {
                  if (newNote.trim()) {
                    setNotes(prev => [...prev, newNote.trim()]);
                    setNewNote('');
                  }
                }} disabled={!newNote.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
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
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs text-muted-foreground">Confidence Score</div>
                  <div className="text-lg font-bold tabular-nums" style={{ color: confColor }}>{Math.round(confidence * 100)}%</div>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full ${confBarColor}`} style={{ width: `${confidence * 100}%`, transition: 'width 0.8s ease-out' }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{confLabel}</div>
              </div>
              <Separator className="bg-border/50" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-1.5"><Tag className="h-3 w-3 mt-1 text-muted-foreground shrink-0" /><div><div className="text-[10px] text-muted-foreground">Category</div><div className="font-medium text-xs mt-0.5">{String(finding.category).replace(/_/g, ' ')}</div></div></div>
                <div className="flex items-start gap-1.5"><FileCode className="h-3 w-3 mt-1 text-muted-foreground shrink-0" /><div><div className="text-[10px] text-muted-foreground">File</div><div className="font-medium text-xs mt-0.5 truncate">{String(finding.filePath || 'N/A')}</div></div></div>
                <div className="flex items-start gap-1.5"><ShieldCheck className="h-3 w-3 mt-1 text-muted-foreground shrink-0" /><div><div className="text-[10px] text-muted-foreground">Line</div><div className="font-medium text-xs mt-0.5">{finding.lineStart || 'N/A'}{finding.lineEnd && finding.lineEnd !== finding.lineStart ? `-${finding.lineEnd}` : ''}</div></div></div>
                <div className="flex items-start gap-1.5"><Clock className="h-3 w-3 mt-1 text-muted-foreground shrink-0" /><div><div className="text-[10px] text-muted-foreground">Created</div><div className="font-medium text-xs mt-0.5">{finding.createdAt ? new Date(String(finding.createdAt)).toLocaleDateString() : 'N/A'}</div></div></div>
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