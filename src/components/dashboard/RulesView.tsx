'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

export function RulesView() {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then(data => { setRules(data.rules || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const toggleRule = async (rule: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
        toast.success(`Rule ${!rule.enabled ? 'enabled' : 'disabled'}`);
      }
    } catch { toast.error('Failed to update rule'); }
  };

  const sevIcon = (sev: string) => {
    if (sev === 'CRITICAL') return <ShieldAlert className="h-5 w-5 text-red-500" />;
    if (sev === 'HIGH') return <ShieldAlert className="h-5 w-5 text-orange-500" />;
    if (sev === 'MEDIUM') return <Shield className="h-5 w-5 text-yellow-500" />;
    return <Shield className="h-5 w-5 text-slate-400" />;
  };

  const frameworkList = (name: string) => {
    if (['PII_LOGGING', 'HARDCODED_SECRETS', 'SENSITIVE_DATA_EXPOSURE'].includes(name)) return ['SOC 2', 'GDPR'];
    return ['SOC 2'];
  };

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance Rules</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure which security and compliance rules are active</p>
      </div>
      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={String(rule.id)} className={`border-border/50 ${!rule.enabled ? 'opacity-60' : ''}`}>
            <CardContent className="p-4 flex items-start gap-4">
              <div className="mt-0.5">{sevIcon(String(rule.severity))}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{String(rule.name).replace(/_/g, ' ')}</span>
                  <Badge className={`severity-${String(rule.severity).toLowerCase()} text-[10px] px-1.5 py-0 font-bold`}>{String(rule.severity)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{String(rule.description)}</p>
                <div className="flex gap-1.5 mt-2">{frameworkList(String(rule.name)).map(fw => <Badge key={fw} variant="outline" className="text-[10px]">{fw}</Badge>)}</div>
              </div>
              <Switch checked={Boolean(rule.enabled)} onCheckedChange={() => toggleRule(rule)} />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground text-center pb-4">
        Rules run as the first layer of analysis. AI contextual review validates and enriches rule engine results.
      </p>
    </div>
  );
}