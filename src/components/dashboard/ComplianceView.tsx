'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedScore } from '@/components/ui/animated-score';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip as RTooltip,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowRight, Target, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useAppStore } from '@/stores/app';

const sevColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#64748b',
};

const sevLabels: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const TARGET_SCORE = 80;

const statusDotColor = (status: string) => {
  switch (status) {
    case 'Compliant': return 'bg-emerald-500';
    case 'Partial': return 'bg-yellow-500';
    case 'Gap': return 'bg-red-500';
    default: return 'bg-muted-foreground/40';
  }
};

const statusBadgeStyle = (status: string) => {
  switch (status) {
    case 'Compliant': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Partial': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case 'Gap': return 'bg-red-500/15 text-red-400 border-red-500/30';
    default: return 'bg-secondary text-muted-foreground border-border/50';
  }
};

const soc2Controls = [
  { id: 'CC6.1', name: 'Logical & Physical Access Controls', category: 'CC6 - Logical and Physical Access', description: 'The entity implements logical and physical access controls over information assets to manage the risk of unauthorized access.', requirements: ['Multi-factor authentication for privileged access', 'Role-based access control (RBAC) implementation', 'Network segmentation between environments', 'Session timeout and idle lockout policies'] },
  { id: 'CC6.6', name: 'Data Encryption', category: 'CC6 - Logical and Physical Access', description: 'The entity implements encryption and decryption to protect data at rest and in transit.', requirements: ['TLS 1.2+ for all data in transit', 'AES-256 encryption for data at rest', 'Key rotation policies every 90 days', 'Certificate management automation'] },
  { id: 'CC7.1', name: 'System Monitoring', category: 'CC7 - System Operations', description: 'The entity monitors the system to detect anomalies indicating security threats.', requirements: ['Real-time security event logging', 'Anomaly detection on access patterns', 'Alert thresholds for suspicious activity', '24/7 monitoring coverage'] },
  { id: 'CC7.2', name: 'Incident Response', category: 'CC7 - System Operations', description: 'The entity responds to identified incidents to mitigate impact.', requirements: ['Documented incident response plan', 'Automated incident detection and triage', 'Communication protocols for breach notification', 'Post-incident review process'] },
  { id: 'P1.2', name: 'Privacy Notice', category: 'P1 - Privacy', description: 'The entity provides notice to data subjects about its privacy practices.', requirements: ['Published privacy policy', 'Clear data collection purposes stated', 'Data retention periods specified', 'User rights and contact information included'] },
  { id: 'A1.2', name: 'System Availability', category: 'A1 - Availability', description: 'The entity maintains system availability to support business operations.', requirements: ['99.9% uptime SLA', 'Disaster recovery plan tested quarterly', 'Geo-redundant backups', 'Load balancing and auto-scaling'] },
];

const gdprControls = [
  { id: 'Art.5(1)(c)', name: 'Data Minimisation', category: 'Principles', description: 'Personal data shall be adequate, relevant and limited to what is necessary for the purposes.', requirements: ['Data collection limited to stated purposes', 'Regular data inventory reviews', 'Automated PII detection in code', 'Data retention limits enforced'] },
  { id: 'Art.25', name: 'Data Protection by Design', category: 'Technical Measures', description: 'The controller shall implement appropriate technical and organisational measures for data protection.', requirements: ['Privacy impact assessments for new features', 'Default privacy settings', 'Data protection in architecture reviews', 'Developer privacy training program'] },
  { id: 'Art.32', name: 'Security of Processing', category: 'Technical Measures', description: 'The controller shall implement appropriate technical measures to ensure security of processing.', requirements: ['Encryption of personal data', 'Pseudonymisation where feasible', 'Regular security testing', 'Access control to personal data'] },
  { id: 'Art.33', name: 'Breach Notification', category: 'Obligations', description: 'The controller shall notify the supervisory authority of a breach within 72 hours.', requirements: ['Breach detection procedures', '72-hour notification workflow', 'Template notifications prepared', 'Regulatory contact information maintained'] },
  { id: 'Art.35', name: 'Impact Assessment', category: 'Obligations', description: 'A data protection impact assessment shall be made for processing likely to result in high risk.', requirements: ['DPIA checklist for high-risk processing', 'Regular review of existing DPIAs', 'Documentation of assessment outcomes', 'Consultation with DPO when required'] },
];

const sampleControls = [
  { id: 'CC6.1', name: 'Logical Access Security', framework: 'SOC2', status: 'Compliant', findingCount: 0 },
  { id: 'CC6.2', name: 'User Authentication', framework: 'SOC2', status: 'Compliant', findingCount: 1 },
  { id: 'CC6.3', name: 'Role-Based Access', framework: 'SOC2', status: 'Partial', findingCount: 2 },
  { id: 'CC7.1', name: 'System Monitoring', framework: 'SOC2', status: 'Compliant', findingCount: 0 },
  { id: 'CC7.2', name: 'Incident Response', framework: 'SOC2', status: 'Gap', findingCount: 3 },
  { id: 'CC8.1', name: 'Change Management', framework: 'SOC2', status: 'Partial', findingCount: 1 },
  { id: 'Art.5', name: 'Principles of Processing', framework: 'GDPR', status: 'Compliant', findingCount: 0 },
  { id: 'Art.6', name: 'Lawful Basis', framework: 'GDPR', status: 'Partial', findingCount: 1 },
  { id: 'Art.17', name: 'Right to Erasure', framework: 'GDPR', status: 'Gap', findingCount: 2 },
  { id: 'Art.25', name: 'Data Protection by Design', framework: 'GDPR', status: 'Partial', findingCount: 1 },
  { id: 'Art.32', name: 'Security of Processing', framework: 'GDPR', status: 'Compliant', findingCount: 0 },
  { id: 'Art.33', name: 'Breach Notification', framework: 'GDPR', status: 'Gap', findingCount: 2 },
];

export function ComplianceView() {
  const setView = useAppStore((s) => s.setView);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const [compliance, setCompliance] = useState<Record<string, unknown> | null>(null);
  const [trends, setTrends] = useState<Record<string, unknown>[]>([]);
  const [sevBreakdown, setSevBreakdown] = useState<{ name: string; value: number; color: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deepDiveExpanded, setDeepDiveExpanded] = useState(false);
  const [controls, setControls] = useState<Array<{ id: string; name: string; framework: string; status: string; findingCount: number }>>([]);

  const navigateToFindings = useCallback((severity?: string) => {
    if (severity) {
      setSearchQuery('');
      useAppStore.getState().setView('findings');
    } else {
      setView('findings');
    }
  }, [setView, setSearchQuery]);

  useEffect(() => {
    (async () => {
      try {
        const [compRes, trendRes] = await Promise.all([
          fetch('/api/compliance'),
          fetch('/api/compliance?type=trends'),
        ]);
        const comp = await compRes.json();
        const trend = await trendRes.json();
        setCompliance(comp);
        setTrends(trend.history || []);
        const breakdown = (
          Object.entries(comp.severityBreakdown || {}).map(
            ([name, value]: [string, number]) => ({
              name,
              value: Number(value),
              color: sevColors[name] || '#64748b',
              label: sevLabels[name] || name,
            }),
          ) as { name: string; value: number; color: string; label: string }[]
        ).filter((d) => d.value > 0);
        setSevBreakdown(breakdown);
      } catch {
        /* empty */
      }
      // Fetch controls data for deep dive
      try {
        const ctrlRes = await fetch('/api/compliance?type=controls');
        const ctrlData = await ctrlRes.json();
        if (Array.isArray(ctrlData) && ctrlData.length > 0) {
          setControls(ctrlData);
        }
      } catch {
        // API may not exist, generate sample controls from compliance data
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-8 w-48 skeleton" />
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 rounded-xl skeleton" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2 skeleton" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl skeleton" />
          <Skeleton className="h-64 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  const score = Number(compliance?.score || 0);
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const radius = 70;
  const circ = 2 * Math.PI * radius;
  const off = circ - (score / 100) * circ;

  const totalFindings = sevBreakdown.reduce((sum, s) => sum + s.value, 0);

  const trendScores = trends.map((t) => Number(t.score || 0));
  const trendChange =
    trendScores.length >= 2
      ? trendScores[trendScores.length - 1] - trendScores[0]
      : 0;

  const TrendIcon = trendChange > 0 ? TrendingUp : trendChange < 0 ? TrendingDown : Minus;
  const trendColor = trendChange > 0 ? 'text-emerald-400' : trendChange < 0 ? 'text-red-400' : 'text-muted-foreground';

  const scoreLabel = score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Work';
  const scoreLabelColor = score >= 90 ? 'text-emerald-400' : score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  const gapToTarget = TARGET_SCORE - score;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compliance</h1>
          <p className="text-secondary-bright text-sm mt-1">
            Organization-wide compliance posture and trends
          </p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary hidden sm:flex gap-1.5">
          <Target className="h-3 w-3" />
          Target: {TARGET_SCORE}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score Gauge - More compact */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${radius * 2 + 20} ${radius * 2 + 20}`}>
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle
                  cx={radius + 10}
                  cy={radius + 10}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-secondary"
                />
                <circle
                  cx={radius + 10}
                  cy={radius + 10}
                  r={radius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={off}
                  filter="url(#glow)"
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
                {/* Target marker */}
                {TARGET_SCORE < 100 && (
                  <circle
                    cx={radius + 10}
                    cy={radius + 10}
                    r={radius}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    strokeDasharray={`${(circ * TARGET_SCORE) / 100} ${circ}`}
                    strokeDashoffset={0}
                    strokeOpacity={0.5}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-extrabold tracking-tight" style={{ color: scoreColor, fontWeight: 800 }}>
                  <AnimatedScore value={score} duration={1200} />
                </div>
                <div className={`text-[10px] mt-0.5 tracking-wider uppercase font-bold ${scoreLabelColor}`}>{scoreLabel}</div>
              </div>
            </div>

            {/* Trend + Gap */}
            <div className="flex items-center gap-4 mt-4">
              {trends.length >= 2 ? (
                <div className="flex items-center gap-1.5">
                  <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                  <span className={`text-sm font-semibold ${trendColor}`}>
                    {trendChange > 0 ? `+${trendChange}` : trendChange}
                  </span>
                  <span className="text-[10px] text-muted-foreground">trend</span>
                </div>
              ) : null}
              {gapToTarget > 0 && (
                <div className="text-[10px] text-muted-foreground animate-pulse">
                  <span className="font-medium text-foreground">{gapToTarget}pts</span> to target
                </div>
              )}
            </div>

            {/* Severity counts - clickable */}
            <div className="grid grid-cols-4 gap-4 w-full text-center mt-5 pt-4 border-t border-border/50">
              {[
                { label: 'Critical', count: Number(compliance?.criticalCount || 0), color: 'text-red-400', sev: 'CRITICAL' },
                { label: 'High', count: Number(compliance?.highCount || 0), color: 'text-orange-400', sev: 'HIGH' },
                { label: 'Medium', count: Number(compliance?.mediumCount || 0), color: 'text-yellow-400', sev: 'MEDIUM' },
                { label: 'Low', count: totalFindings - Number(compliance?.criticalCount || 0) - Number(compliance?.highCount || 0) - Number(compliance?.mediumCount || 0), color: 'text-slate-400', sev: 'LOW' },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => navigateToFindings(s.sev)}
                  className="group flex flex-col items-center gap-1 hover:opacity-80 transition-opacity rounded-lg hover:ring-2 hover:ring-primary/30"
                >
                  <div className={`text-lg font-bold ${s.color}`}>{Math.max(0, s.count)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors rounded-xl lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compliance Score Trend
              </CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-emerald-500 rounded" style={{ borderStyle: 'dashed' }} />
                  <span>Target ({TARGET_SCORE})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-violet-400 rounded" />\n                  <span>Actual</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56 pr-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends as { weekLabel: string; score: number }[]}>
                  <defs>
                    <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="weekLabel" tick={{ className: 'chart-axis-label' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={40} />
                  <YAxis domain={[0, 100]} tick={{ className: 'chart-axis-label' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <ReferenceLine
                    y={TARGET_SCORE}
                    stroke="#22c55e"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    label={{
                      value: 'Target',
                      position: 'right',
                      fill: '#22c55e',
                      fontSize: 10,
                    }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#a78bfa" fill="url(#tGrad)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score History Bar Chart */}
      <Card className="border-border/50 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends as { weekLabel: string; score: number }[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ className: 'chart-axis-label' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <YAxis domain={[0, 100]} tick={{ className: 'chart-axis-label' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine
                  y={TARGET_SCORE}
                  stroke="#22c55e"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                  label={{
                    value: 'Target',
                    position: 'right',
                    fill: '#22c55e',
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {(trends as { weekLabel: string; score: number }[]).map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.score >= 80 ? '#22c55e' : entry.score >= 60 ? '#eab308' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/50 hover:border-primary/30 transition-colors rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Findings by Severity
              </CardTitle>
              <Button
                variant="ghost" size="sm"
                className="text-xs gap-1 h-7 text-primary"
                onClick={() => navigateToFindings()}
              >
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3.5 pt-1">
              {sevBreakdown.map((s) => {
                const pct = totalFindings > 0 ? (s.value / totalFindings) * 100 : 0;
                return (
                  <button
                    key={s.name}
                    className="w-full text-left group"
                    onClick={() => navigateToFindings(s.name)}
                  >
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{s.value}</span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </button>
                );
              })}
              {sevBreakdown.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm text-muted-foreground">No open findings — looking good!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Framework Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 pt-2">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 border-emerald-500/30 text-emerald-400">SOC 2</Badge>
                    <span className="text-xs text-secondary-bright">Trust Service Criteria</span>
                  </div>
                  <span className="font-bold text-sm tabular-nums" style={{ color: scoreColor }}>{score}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${score}%`, backgroundColor: scoreColor }}
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy'].map((c) => (
                    <span key={c} className="tag-pill">{c}</span>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 border-blue-500/30 text-blue-400">GDPR</Badge>
                    <span className="text-xs text-secondary-bright">Data Protection</span>
                  </div>
                  <span className="font-bold text-sm tabular-nums" style={{ color: scoreColor }}>{Math.max(score - 5, 0)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(score - 5, 0)}%`, backgroundColor: scoreColor }}
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['Data Protection', 'Consent', 'Right to Erasure', 'Portability', 'DPO'].map((c) => (
                    <span key={c} className="tag-pill">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Framework Deep Dive Panel */}
      <Card className="border-border/50 rounded-xl">
        <button
          className="w-full flex items-center justify-between p-4 pb-0 text-left"
          onClick={() => setDeepDiveExpanded((v) => !v)}
        >
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Framework Deep Dive
          </CardTitle>
          {deepDiveExpanded ? (
            <ChevronUp className="size-4 text-muted-foreground transition-transform duration-200" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200" />
          )}
        </button>
        {deepDiveExpanded && (
          <CardContent className="pt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* SOC 2 Trust Services Criteria */}
              <Card className="border-border/50 card-hover p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 border-emerald-500/30 text-emerald-400">SOC 2</Badge>
                  <span className="text-sm font-medium text-foreground">Trust Services Criteria</span>
                </div>
                <Accordion type="multiple" className="w-full">
                  {soc2Controls.map((ctrl) => (
                    <AccordionItem key={ctrl.id} value={ctrl.id} className="border-border/40">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0 border-emerald-500/30 text-emerald-400 shrink-0">
                            {ctrl.id}
                          </Badge>
                          <span className="font-semibold text-xs">{ctrl.name}</span>
                          <span className="text-[10px] text-muted-foreground">{ctrl.category}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-secondary-bright text-xs mb-3">{ctrl.description}</p>
                        <ul className="space-y-1.5">
                          {ctrl.requirements.map((req) => (
                            <li key={req} className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{req}</span>
                            </li>
                          ))}
                        </ul>
                        <button className="text-xs text-primary hover:underline mt-3 block">
                          View mapped findings →
                        </button>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>

              {/* GDPR Articles */}
              <Card className="border-border/50 card-hover p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 border-blue-500/30 text-blue-400">GDPR</Badge>
                  <span className="text-sm font-medium text-foreground">Articles</span>
                </div>
                <Accordion type="multiple" className="w-full">
                  {gdprControls.map((ctrl) => (
                    <AccordionItem key={ctrl.id} value={ctrl.id} className="border-border/40">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0 border-blue-500/30 text-blue-400 shrink-0">
                            {ctrl.id}
                          </Badge>
                          <span className="font-semibold text-xs">{ctrl.name}</span>
                          <span className="text-[10px] text-muted-foreground">{ctrl.category}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-secondary-bright text-xs mb-3">{ctrl.description}</p>
                        <ul className="space-y-1.5">
                          {ctrl.requirements.map((req) => (
                            <li key={req} className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{req}</span>
                            </li>
                          ))}
                        </ul>
                        <button className="text-xs text-primary hover:underline mt-3 block">
                          View mapped findings →
                        </button>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>

      <p className="text-[11px] text-secondary-bright text-center pb-4">
        DriftFix provides engineering compliance guidance. This is not legal advice or a certification.
      </p>
    </div>
  );
}
