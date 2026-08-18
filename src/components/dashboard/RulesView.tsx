'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, RotateCcw, Search } from 'lucide-react';

function toTitleCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const sevConfig: Record<string, { icon: typeof ShieldAlert; color: string; bg: string; badge: string }> = {
  CRITICAL: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/15', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  HIGH: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/15', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  MEDIUM: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/15', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  LOW: { icon: Info, color: 'text-slate-400', bg: 'bg-slate-400/15', badge: 'bg-slate-400/15 text-slate-400 border-slate-400/30' },
};

const frameworkMap: Record<string, string[]> = {
  PII_LOGGING: ['SOC2', 'GDPR'],
  HARDCODED_SECRETS: ['SOC2', 'GDPR'],
  SENSITIVE_DATA_EXPOSURE: ['SOC2', 'GDPR'],
  INSECURE_CORS: ['SOC2'],
  SQL_INJECTION: ['SOC2', 'GDPR'],
  XSS_VULNERABILITY: ['SOC2'],
  INSECURE_DESERIALIZATION: ['SOC2'],
  MISSING_AUTHORIZATION: ['SOC2', 'GDPR'],
};

export function RulesView() {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/rules')
      .then((r) => r.json())
      .then((data) => {
        setRules(data.rules || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleRule = async (rule: Record<string, unknown>) => {
    const newValue = !rule.enabled;
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: newValue } : r)),
        );
        toast.success(`Rule ${newValue ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to update rule');
      }
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleReset = async () => {
    try {
      await Promise.all(
        rules.map((rule) =>
          fetch(`/api/rules/${rule.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true }),
          }),
        ),
      );
      setRules((prev) => prev.map((r) => ({ ...r, enabled: true })));
      toast.success('All rules reset to defaults');
    } catch {
      toast.error('Failed to reset rules');
    }
  };

  const enabledCount = rules.filter((r) => Boolean(r.enabled)).length;

  const grouped = useMemo(() => {
    const filtered = rules.filter((r) => {
      const name = String(r.name).replace(/_/g, ' ').toLowerCase();
      return !search || name.includes(search.toLowerCase());
    });
    const groups: Record<string, Record<string, unknown>[]> = {};
    for (const rule of filtered) {
      const cat = String(rule.category || 'Other');
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(rule);
    }
    return groups;
  }, [rules, search]);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const categoryOrder = Object.keys(grouped).sort();

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="section-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compliance Rules</h1>
          <p className="text-secondary-bright text-sm mt-1">
            {enabledCount} of {rules.length} rules enabled
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rules by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 input-glow placeholder:text-muted-foreground/70"
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="border-border/50 rounded-xl">
          <CardContent className="p-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No rules found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? 'Try a different search term.' : 'No compliance rules configured.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {categoryOrder.map((category) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-foreground">
                  {toTitleCase(category)}
                </h2>
                <div className="flex-1 divider-strong" />
                <Badge variant="outline" className="text-[10px]">
                  {grouped[category].length} {grouped[category].length === 1 ? 'rule' : 'rules'}
                </Badge>
              </div>

              <div className="grid gap-3">
                {grouped[category].map((rule) => {
                  const sev = String(rule.severity || 'MEDIUM').toUpperCase();
                  const cfg = sevConfig[sev] || sevConfig.MEDIUM;
                  const SevIcon = cfg.icon;
                  const ruleName = String(rule.name);
                  const frameworks = frameworkMap[ruleName] || ['SOC2'];

                  return (
                    <Card
                      key={String(rule.id)}
                      className={`border-border/50 hover:border-primary/30 transition-all duration-200 rounded-xl ${!rule.enabled ? 'opacity-60' : ''}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`mt-0.5 h-9 w-9 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                            <SevIcon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold">
                                {ruleName.replace(/_/g, ' ')}
                              </span>
                              <Badge
                                className={`text-[10px] font-semibold border px-1.5 py-0 ${cfg.badge}`}
                              >
                                {sev}
                              </Badge>
                            </div>
                            <p className="text-sm text-secondary-bright mb-1.5">
                              {String(rule.description)}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {String(rule.category || '').replace(/_/g, ' ')}
                              </Badge>
                              {frameworks.map((fw) => (
                                <span key={fw} className="tag-pill">
                                  {fw}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 ml-auto">
                            <Switch
                              checked={Boolean(rule.enabled)}
                              onCheckedChange={() => toggleRule(rule)}
                              className="toggle-glow"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-secondary-bright text-center pb-4">
        Rules run as the first layer of analysis. AI contextual review validates and enriches rule engine results.
      </p>
    </div>
  );
}
