'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  ShieldAlert, AlertTriangle, AlertCircle, Info, RotateCcw, Search,
  ChevronDown, ChevronRight, Ban, Eye, ShieldCheck, FileCode2,
} from 'lucide-react';
import type { ComplianceRulesConfig, RuleConfig, ActionTier, FrameworkControl } from '@/lib/rule-engine/types';

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Tier styling for Severity Configuration tab ───────────────────────────

type TierConfig = {
  label: string;
  icon: typeof Ban;
  badge: string;
  border: string;
  description: string;
  glow: string;
};

const tierConfig: Record<ActionTier, TierConfig> = {
  BLOCKING: {
    label: 'BLOCKING',
    icon: Ban,
    badge: 'bg-red-500/15 text-red-400 border-red-500/30 font-bold',
    border: 'border-l-red-500',
    description: 'Prevents PR merge. Must be resolved before merging.',
    glow: 'shadow-red-500/10',
  },
  WARNING: {
    label: 'WARNING',
    icon: AlertTriangle,
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold',
    border: 'border-l-amber-500',
    description: 'Posted as PR comment. Does not prevent merge.',
    glow: 'shadow-amber-500/10',
  },
  INFO: {
    label: 'INFO',
    icon: Info,
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    border: 'border-l-blue-500',
    description: 'Informational note posted as PR comment.',
    glow: 'shadow-blue-500/10',
  },
};

// ── Active Rules Tab (original behavior) ──────────────────────────────────

function ActiveRulesTab() {
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
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const categoryOrder = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-secondary-bright text-sm">
          {enabledCount} of {rules.length} rules enabled
        </p>
        <Button variant="outline" className="gap-2 btn-press" onClick={handleReset}>
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
                <h2 className="text-lg font-bold text-foreground">{toTitleCase(category)}</h2>
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
                              <span className="text-sm font-semibold">{ruleName.replace(/_/g, ' ')}</span>
                              <Badge className={`text-[10px] font-semibold border px-1.5 py-0 ${cfg.badge}`}>
                                {sev}
                              </Badge>
                            </div>
                            <p className="text-sm text-secondary-bright mb-1.5">{String(rule.description)}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {String(rule.category || '').replace(/_/g, ' ')}
                              </Badge>
                              {frameworks.map((fw) => (
                                <span key={fw} className="tag-pill">{fw}</span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 ml-auto">
                            <Switch checked={Boolean(rule.enabled)} onCheckedChange={() => toggleRule(rule)} className="toggle-glow" />
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

// ── Severity Configuration Tab ─────────────────────────────────────────────

function RuleCard({ rule }: { rule: RuleConfig }) {
  const [open, setOpen] = useState(false);
  const tc = tierConfig[rule.tier];
  const TierIcon = tc.icon;

  return (
    <Card className={`border-border/50 border-l-4 ${tc.border} card-hover rounded-xl animate-stagger`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Badge className={`text-[10px] font-mono font-bold px-1.5 py-0 shrink-0 ${tc.badge}`}>
            {rule.id}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold">{rule.name}</span>
              <Badge className={`text-[10px] border px-1.5 py-0 ${tc.badge}`}>
                <TierIcon className="h-3 w-3 mr-1" />
                {tc.label}
              </Badge>
            </div>
            <p className="text-sm text-secondary-bright mb-2">{rule.description}</p>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <Badge variant="outline" className="text-[10px]">{toTitleCase(rule.category)}</Badge>
              {Object.entries(rule.frameworks).map(([fw, ctrl]) => (
                <span key={fw} className="tag-pill text-[10px]">
                  {fw.toUpperCase()} {ctrl.control} — {ctrl.name}
                </span>
              ))}
            </div>
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Suggested Fix
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm text-secondary-bright">
                  {rule.suggested_fix}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TierGroup({ tier, rules }: { tier: ActionTier; rules: RuleConfig[] }) {
  const tc = tierConfig[tier];
  const TierIcon = tc.icon;

  if (rules.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`h-7 w-7 rounded-md ${tc.badge.split(' ')[0]} flex items-center justify-center`}>
          <TierIcon className={`h-4 w-4 ${tc.badge.split(' ')[1]}`} />
        </div>
        <h3 className="text-base font-bold">{tc.label}</h3>
        <Badge variant="outline" className="text-[10px]">{rules.length} {rules.length === 1 ? 'rule' : 'rules'}</Badge>
        <div className="flex-1 divider-strong" />
      </div>
      <div className="grid gap-3">
        {rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  );
}

function SeverityConfigTab() {
  const [config, setConfig] = useState<ComplianceRulesConfig | null>(null);
  const [yamlSource, setYamlSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [showYaml, setShowYaml] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/rules-config');
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          const yamlRes = await fetch('/api/rules-config?raw=yaml');
          if (yamlRes.ok) {
            setYamlSource(await yamlRes.text());
          }
        }
      } catch {
        toast.error('Failed to load rules configuration');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <Card className="border-border/50 rounded-xl">
        <CardContent className="p-16 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No YAML configuration found</h3>
          <p className="text-sm text-secondary-bright">Add a compliance-rules.yaml to configure severity tiers.</p>
        </CardContent>
      </Card>
    );
  }

  const blockingCount = config.rules.filter((r) => r.tier === 'BLOCKING').length;
  const warningCount = config.rules.filter((r) => r.tier === 'WARNING').length;
  const infoCount = config.rules.filter((r) => r.tier === 'INFO').length;

  const blockingRules = config.rules.filter((r) => r.tier === 'BLOCKING');
  const warningRules = config.rules.filter((r) => r.tier === 'WARNING');
  const infoRules = config.rules.filter((r) => r.tier === 'INFO');

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <Card className="border-border/50 rounded-xl">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Rule Summary:</span>
          <Badge className={`text-xs px-2 py-0.5 border ${tierConfig.BLOCKING.badge}`}>
            <Ban className="h-3 w-3 mr-1" />{blockingCount} BLOCKING
          </Badge>
          <Badge className={`text-xs px-2 py-0.5 border ${tierConfig.WARNING.badge}`}>
            <AlertTriangle className="h-3 w-3 mr-1" />{warningCount} WARNING
          </Badge>
          <Badge className={`text-xs px-2 py-0.5 border ${tierConfig.INFO.badge}`}>
            <Info className="h-3 w-3 mr-1" />{infoCount} INFO
          </Badge>
          <span className="text-xs text-secondary-bright ml-auto">v{config.version}</span>
        </CardContent>
      </Card>

      {/* Tier Legend */}
      <Card className="border-border/50 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Tier Legend</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['BLOCKING', 'WARNING', 'INFO'] as ActionTier[]).map((tier) => {
              const tc = tierConfig[tier];
              const TierIcon = tc.icon;
              return (
                <div key={tier} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30">
                  <TierIcon className={`h-4 w-4 mt-0.5 shrink-0 ${tc.badge.split(' ')[1]}`} />
                  <div>
                    <div className="text-xs font-bold">{tc.label}</div>
                    <div className="text-[11px] text-secondary-bright">{tc.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rule Groups by Tier */}
      <div className="space-y-8">
        <TierGroup tier="BLOCKING" rules={blockingRules} />
        <TierGroup tier="WARNING" rules={warningRules} />
        <TierGroup tier="INFO" rules={infoRules} />
      </div>

      {/* YAML Source */}
      {yamlSource && (
        <Collapsible open={showYaml} onOpenChange={setShowYaml}>
          <Card className="border-border/50 rounded-xl">
            <CollapsibleTrigger className="w-full p-4 flex items-center gap-2 hover:bg-accent/50 rounded-xl transition-colors">
              <FileCode2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">YAML Source</span>
              <span className="text-[10px] text-secondary-bright">(compliance-rules.yaml)</span>
              <div className="flex-1" />
              {showYaml ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-xs text-secondary-bright font-mono overflow-auto max-h-[500px] whitespace-pre-wrap break-all">
                  {yamlSource}
                </pre>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

// ── Main RulesView with Tabs ───────────────────────────────────────────────

export function RulesView() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="section-header">
        <h1 className="text-2xl font-bold">Compliance Rules</h1>
        <p className="text-secondary-bright text-sm mt-1">
          Manage active rules and configure YAML-driven severity tiers
        </p>
      </div>

      <Tabs defaultValue="active-rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active-rules" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Active Rules
          </TabsTrigger>
          <TabsTrigger value="severity-config" className="gap-1.5">
            <FileCode2 className="h-3.5 w-3.5" />
            Severity Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active-rules">
          <ActiveRulesTab />
        </TabsContent>

        <TabsContent value="severity-config">
          <SeverityConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
