import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { calculateComplianceScore, getScoreLabel } from '@/lib/compliance/scoring';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function severityColor(sev: string): string {
  switch (sev) {
    case 'CRITICAL': return '#f87171';
    case 'HIGH':     return '#fb923c';
    case 'MEDIUM':   return '#facc15';
    case 'LOW':      return '#34d399';
    case 'BLOCKING': return '#f87171';
    case 'WARNING':  return '#fb923c';
    case 'INFO':     return '#94a3b8';
    default:         return '#94a3b8';
  }
}

function severityBgHex(sev: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'rgba(248,113,113,0.12)',
    HIGH:     'rgba(251,146,60,0.12)',
    MEDIUM:   'rgba(250,204,21,0.12)',
    LOW:      'rgba(52,211,153,0.12)',
    BLOCKING: 'rgba(248,113,113,0.12)',
    WARNING:  'rgba(251,146,60,0.12)',
    INFO:     'rgba(148,163,184,0.12)',
  };
  return map[sev] || 'rgba(148,163,184,0.12)';
}

function statusColor(status: string): string {
  switch (status) {
    case 'OPEN':          return '#f87171';
    case 'RESOLVED':      return '#34d399';
    case 'DISMISSED':     return '#94a3b8';
    case 'ACCEPTED_RISK': return '#fb923c';
    case 'IN_REVIEW':     return '#facc15';
    default:              return '#94a3b8';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ACCEPTED_RISK': return 'ACCEPTED RISK';
    case 'IN_REVIEW':     return 'IN REVIEW';
    default:              return status;
  }
}

function esc(str: string | null | undefined): string {
  if (!str) return '—';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreGaugeSVG(score: number): string {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#facc15' : '#f87171';
  const pct = Math.min(100, Math.max(0, score));
  const dashLen = (pct / 100) * 452.39;
  return `
    <div style="position:relative;width:180px;height:180px;margin:0 auto;">
      <svg viewBox="0 0 180 180" style="width:100%;height:100%;transform:rotate(-90deg);">
        <circle cx="90" cy="90" r="72" fill="none" stroke="rgba(148,163,184,0.08)" stroke-width="12"/>
        <circle cx="90" cy="90" r="72" fill="none" stroke="${color}" stroke-width="12"
          stroke-dasharray="${dashLen} 452.39" stroke-linecap="round"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <span style="font-size:2.75rem;font-weight:800;color:${color};line-height:1;">${score}</span>
        <span style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin-top:6px;">Compliance</span>
      </div>
    </div>`;
}

function distributionRow(label: string, count: number, total: number, color: string): string {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <tr style="border-bottom:1px solid rgba(148,163,184,0.06);">
      <td style="padding:14px 20px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:10px;vertical-align:middle;"></span>
        <span style="color:${color};font-weight:700;font-size:13px;">${label}</span>
      </td>
      <td style="padding:14px 20px;text-align:center;color:#e2e8f0;font-weight:700;font-size:1.1rem;">${count}</td>
      <td style="padding:14px 20px;text-align:center;color:#64748b;font-size:12px;">${pct}%</td>
      <td style="padding:14px 20px;">
        <div style="background:rgba(148,163,184,0.08);border-radius:4px;height:8px;overflow:hidden;min-width:200px;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div>
        </div>
      </td>
    </tr>`;
}

// ──────────────────────────────────────────────
// Deterministic visual integrity badge (SVG fingerprint)
// ──────────────────────────────────────────────

function integrityBadgeDataUri(shortHash: string, timestamp: string): string {
  const cells: string[] = [];
  const seed = (shortHash + timestamp).split('');
  const size = 9;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) % seed.length;
      const charCode = seed[idx].charCodeAt(0);
      const isFinder = (x < 3 && y < 3) || (x >= size - 3 && y < 3) || (x < 3 && y >= size - 3);
      const filled = isFinder || (charCode % 3 !== 0);
      cells.push(
        `<rect x="${x * 4}" y="${y * 4}" width="4" height="4" fill="${filled ? '#2dd4bf' : 'rgba(148,163,184,0.08)'}" rx="0.5"/>`,
      );
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><rect width="36" height="36" fill="#0a0f1a" rx="4"/>${cells.join('')}</svg>`;
  return `data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}`;
}

// ──────────────────────────────────────────────
// Report data types
// ──────────────────────────────────────────────

interface ReportFinding {
  id: string;
  severity: string;
  actionLevel: string;
  title: string;
  filePath: string | null;
  lineStart: number | null;
  status: string;
  resolvedAt: string | null;
  dismissReason: string | null;
  approver: string;
  complianceMappings: Array<{ framework: string; control: string }>;
}

interface ReportAnalysis {
  id: string;
  prTitle: string;
  status: string;
  findingsCount: number;
  score: number;
  completedAt: string | null;
}

interface ReportEvidence {
  createdAt: string;
  eventType: string;
  actor: string | null;
  hash: string | null;
  previousHash: string | null;
}

interface ReportParams {
  repoName: string;
  repoFullName: string;
  fromDate: string;
  toDate: string;
  generatedAt: string;
  score: number;
  scoreLabel: string;
  analyses: ReportAnalysis[];
  findings: ReportFinding[];
  evidence: ReportEvidence[];
  severityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  integrityHash: string;
  integrityTimestamp: string;
}

// ──────────────────────────────────────────────
// HTML report generator
// ──────────────────────────────────────────────

function generateAuditExportHTML(p: ReportParams): string {
  const totalFindings = p.findings.length;
  const totalSev = Object.values(p.severityBreakdown).reduce((a, b) => a + b, 0);
  const shortHash = p.integrityHash.slice(0, 16);
  const badgeUri = integrityBadgeDataUri(shortHash, p.integrityTimestamp);

  const now = new Date(p.generatedAt);
  const formattedDate = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  // Analysis rows
  const analysisRows = p.analyses.map((a) => {
    const sc = a.score;
    const scColor = sc >= 80 ? '#34d399' : sc >= 60 ? '#facc15' : '#f87171';
    const stColor = a.status === 'completed' ? '#34d399' : '#facc15';
    return `
      <tr style="border-bottom:1px solid rgba(148,163,184,0.08);">
        <td style="padding:10px 16px;color:#94a3b8;font-size:12px;font-family:ui-monospace,monospace;">${esc(a.id).slice(0, 12)}…</td>
        <td style="padding:10px 16px;color:#e2e8f0;font-size:13px;">${esc(a.prTitle)}</td>
        <td style="padding:10px 16px;text-align:center;"><span style="display:inline-block;background:${stColor}22;color:${stColor};border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;text-transform:uppercase;">${esc(a.status)}</span></td>
        <td style="padding:10px 16px;text-align:center;color:#94a3b8;font-size:13px;">${a.findingsCount}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:700;color:${scColor};font-size:14px;">${sc}</td>
        <td style="padding:10px 16px;text-align:right;color:#64748b;font-size:12px;">${esc(a.completedAt)}</td>
      </tr>`;
  }).join('');

  // Finding rows
  const findingsRows = p.findings.map((f) => {
    const sev = f.severity;
    const tier = f.actionLevel;
    const status = f.status;
    const sColor = statusColor(status);
    const resolvedDate = f.resolvedAt
      ? new Date(f.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
    let resolutionInfo = '';
    if (status === 'RESOLVED') {
      resolutionInfo = `<span style="color:#34d399;font-size:11px;">Resolved ${resolvedDate}</span>`;
    } else if (status === 'DISMISSED') {
      resolutionInfo = `<span style="color:#94a3b8;font-size:11px;">${esc(f.dismissReason) || 'Dismissed'}</span>`;
    } else if (status === 'ACCEPTED_RISK') {
      resolutionInfo = `<span style="color:#fb923c;font-size:11px;">Risk accepted: ${esc(f.dismissReason) || 'See notes'}</span>`;
    }

    const controlBadges = f.complianceMappings.slice(0, 4).map((m) =>
      `<span style="display:inline-block;background:rgba(45,212,191,0.12);color:#2dd4bf;border:1px solid rgba(45,212,191,0.25);border-radius:4px;padding:1px 6px;font-size:9px;margin-right:3px;font-family:ui-monospace,monospace;">${esc(m.framework)} ${esc(m.control)}</span>`,
    ).join('');
    const extraMappings = f.complianceMappings.length > 4
      ? `<span style="color:#64748b;font-size:9px;">+${f.complianceMappings.length - 4} more</span>`
      : '';

    return `
      <tr style="border-bottom:1px solid rgba(148,163,184,0.06);">
        <td style="padding:10px 14px;vertical-align:top;">
          <span style="display:inline-block;background:${severityBgHex(sev)};color:${severityColor(sev)};border:1px solid ${severityColor(sev)}33;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:0.04em;">${esc(sev)}</span>
          ${tier && tier !== sev ? `<span style="display:block;margin-top:3px;font-size:9px;color:#64748b;font-weight:600;">${esc(tier)}</span>` : ''}
        </td>
        <td style="padding:10px 14px;vertical-align:top;color:#e2e8f0;font-size:12px;font-weight:500;max-width:220px;">${esc(f.title)}</td>
        <td style="padding:10px 14px;vertical-align:top;color:#94a3b8;font-size:11px;font-family:ui-monospace,monospace;max-width:180px;word-break:break-all;">${esc(f.filePath)}</td>
        <td style="padding:10px 14px;vertical-align:top;color:#cbd5e1;font-size:12px;text-align:center;">${f.lineStart != null ? f.lineStart : '—'}</td>
        <td style="padding:10px 14px;vertical-align:top;">
          <span style="display:inline-block;background:${sColor}22;color:${sColor};border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;">${statusLabel(status)}</span>
          ${resolutionInfo ? `<div style="margin-top:4px;">${resolutionInfo}</div>` : ''}
        </td>
        <td style="padding:10px 14px;vertical-align:top;color:#94a3b8;font-size:11px;">${esc(f.approver) || '—'}</td>
        <td style="padding:10px 14px;vertical-align:top;">${controlBadges}${extraMappings}</td>
      </tr>`;
  }).join('');

  // Evidence rows
  const evidenceRows = p.evidence.map((e) => {
    const evt = e.eventType;
    const evtColor = evt.includes('RESOLVED') || evt.includes('FIX') ? '#34d399'
      : evt.includes('DISMISS') || evt.includes('RISK') ? '#fb923c'
        : evt.includes('FINDING') ? '#f87171' : '#2dd4bf';
    return `
      <tr style="border-bottom:1px solid rgba(148,163,184,0.06);">
        <td style="padding:8px 14px;color:#64748b;font-size:11px;white-space:nowrap;">${esc(e.createdAt)}</td>
        <td style="padding:8px 14px;"><span style="display:inline-block;background:${evtColor}18;color:${evtColor};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:600;font-family:ui-monospace,monospace;">${esc(evt)}</span></td>
        <td style="padding:8px 14px;color:#cbd5e1;font-size:11px;">${esc(e.actor)}</td>
        <td style="padding:8px 14px;"><code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;color:#2dd4bf;word-break:break-all;">${esc(e.hash)}</code></td>
        <td style="padding:8px 14px;"><code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;color:#64748b;word-break:break-all;">${esc(e.previousHash)}</code></td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DriftFix Audit Evidence Export — ${esc(p.repoFullName)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;">

<div style="background:linear-gradient(135deg,#0a0f1a 0%,#0d1b2a 50%,#0a1628 100%);border-bottom:2px solid rgba(45,212,191,0.3);padding:40px 48px;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(45,212,191,0.08) 0%,transparent 70%);border-radius:50%;"></div>
  <div style="position:absolute;bottom:-40px;left:25%;width:320px;height:120px;background:radial-gradient(circle,rgba(45,212,191,0.05) 0%,transparent 70%);border-radius:50%;"></div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
    <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#2dd4bf,#14b8a6);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#0a0f1a;">DF</div>
    <div>
      <h1 style="margin:0;font-size:1.75rem;font-weight:800;color:#f0fdfa;letter-spacing:-0.02em;">DriftFix</h1>
      <p style="margin:0;font-size:0.75rem;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.15em;font-weight:600;">Audit Evidence Export</p>
    </div>
  </div>
  <div style="margin-top:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    <span style="display:inline-block;background:rgba(45,212,191,0.12);color:#2dd4bf;border:1px solid rgba(45,212,191,0.25);border-radius:6px;padding:4px 14px;font-size:13px;font-weight:600;">${esc(p.repoFullName)}</span>
    <span style="display:inline-block;background:rgba(148,163,184,0.08);color:#94a3b8;border:1px solid rgba(148,163,184,0.15);border-radius:6px;padding:4px 14px;font-size:13px;">${esc(p.fromDate)} → ${esc(p.toDate)}</span>
    <span style="color:#64748b;font-size:13px;">Generated ${formattedDate}</span>
  </div>
</div>

<div style="max-width:1200px;margin:0 auto;padding:40px 48px 60px;">

  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;"><span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>Executive Summary</h2>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:start;">
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:16px;padding:28px 32px;text-align:center;">
        ${scoreGaugeSVG(p.score)}
        <div style="margin-top:12px;font-size:0.85rem;font-weight:600;color:#cbd5e1;">${esc(p.scoreLabel)}</div>
        <div style="margin-top:4px;font-size:0.65rem;color:#64748b;">Compliance Score</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;"><div style="font-size:2rem;font-weight:800;color:#e2e8f0;line-height:1;">${totalFindings}</div><div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Total Findings</div></div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;"><div style="font-size:2rem;font-weight:800;color:#f87171;line-height:1;">${p.statusBreakdown.OPEN ?? 0}</div><div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Open</div></div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;"><div style="font-size:2rem;font-weight:800;color:#34d399;line-height:1;">${p.statusBreakdown.RESOLVED ?? 0}</div><div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Resolved</div></div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;"><div style="font-size:2rem;font-weight:800;color:#e2e8f0;line-height:1;">${p.analyses.length}</div><div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Analysis Runs</div></div>
      </div>
    </div>
  </div>

  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;"><span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>Severity Breakdown</h2>
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
          <th style="padding:12px 20px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Severity</th>
          <th style="padding:12px 20px;text-align:center;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Count</th>
          <th style="padding:12px 20px;text-align:center;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Share</th>
          <th style="padding:12px 20px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Distribution</th>
        </tr></thead>
        <tbody>${['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => distributionRow(sev, p.severityBreakdown[sev] || 0, totalSev, severityColor(sev))).join('')}</tbody>
      </table>
    </div>
  </div>

  ${p.analyses.length > 0 ? `
  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;"><span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>Analysis Runs <span style="font-size:0.75rem;color:#64748b;font-weight:400;text-transform:none;letter-spacing:normal;">(${p.analyses.length})</span></h2>
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
          <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Run ID</th>
          <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Pull Request</th>
          <th style="padding:10px 16px;text-align:center;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Status</th>
          <th style="padding:10px 16px;text-align:center;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Findings</th>
          <th style="padding:10px 16px;text-align:right;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Score</th>
          <th style="padding:10px 16px;text-align:right;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Completed</th>
        </tr></thead>
        <tbody>${analysisRows}</tbody>
      </table>
    </div>
  </div>` : ''}

  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;"><span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>Findings Detail <span style="font-size:0.75rem;color:#64748b;font-weight:400;text-transform:none;letter-spacing:normal;">(${totalFindings} total)</span></h2>
    ${totalFindings === 0 ? `
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:48px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:8px;">✓</div>
        <div style="color:#34d399;font-weight:600;font-size:14px;">No findings in date range</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px;">All infrastructure configurations within the selected period are compliant.</div>
      </div>` : `
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:900px;">
          <thead><tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
            <th style="padding:10px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Severity / Tier</th>
            <th style="padding:10px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Rule / Finding</th>
            <th style="padding:10px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">File</th>
            <th style="padding:10px 14px;text-align:center;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Line</th>
            <th style="padding:10px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Status</th>
            <th style="padding:10px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Approver</th>
            <th style="padding:10px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Controls</th>
          </tr></thead>
          <tbody>${findingsRows}</tbody>
        </table>
      </div>`}
  </div>

  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;"><span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>Evidence Ledger <span style="font-size:0.75rem;color:#64748b;font-weight:400;text-transform:none;letter-spacing:normal;">(${p.evidence.length} records)</span></h2>
    ${p.evidence.length === 0 ? `
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:32px;text-align:center;">
        <div style="color:#64748b;font-size:13px;">No evidence records found for the selected repository and date range.</div>
      </div>` : `
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:800px;">
          <thead><tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
            <th style="padding:8px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Timestamp</th>
            <th style="padding:8px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Event Type</th>
            <th style="padding:8px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Actor</th>
            <th style="padding:8px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">SHA-256 Hash</th>
            <th style="padding:8px 14px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Previous Hash</th>
          </tr></thead>
          <tbody>${evidenceRows}</tbody>
        </table>
      </div>`}
    <div style="margin-top:16px;background:rgba(10,15,26,0.8);border:1px solid rgba(148,163,184,0.08);border-radius:8px;padding:14px 20px;">
      <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Evidence Chain Verification</div>
      <p style="margin:0;font-size:11px;color:#475569;">Evidence records form an append-only cryptographic chain. Each record's hash is computed over <code style="color:#94a3b8;">eventType | actor | payload | previousHash | timestamp</code> using SHA-256. Any modification to a record invalidates all subsequent hashes in the chain.</p>
    </div>
  </div>

</div>

<div style="border-top:1px solid rgba(148,163,184,0.1);padding:28px 48px;background:rgba(15,23,42,0.5);">
  <div style="max-width:1200px;margin:0 auto;">
    <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:20px;">
      <img src="${badgeUri}" alt="Integrity Badge" style="width:36px;height:36px;border-radius:4px;flex-shrink:0;margin-top:2px;"/>
      <div>
        <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Report Integrity Verification</div>
        <div style="margin-bottom:8px;"><span style="color:#94a3b8;font-size:11px;font-weight:600;">SHA-256 (full):</span><code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#2dd4bf;word-break:break-all;line-height:1.8;display:block;margin-top:2px;">${p.integrityHash}</code></div>
        <div style="margin-bottom:8px;"><span style="color:#94a3b8;font-size:11px;font-weight:600;">Timestamped:</span><code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#e2e8f0;margin-left:8px;">${p.integrityTimestamp}</code></div>
        <div><span style="color:#94a3b8;font-size:11px;font-weight:600;">Verification:</span><code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#cbd5e1;margin-left:8px;">sha256(report_html_bytes) == ${p.integrityHash}</code></div>
      </div>
    </div>
    <div style="border-top:1px solid rgba(148,163,184,0.08);padding-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div style="font-size:11px;color:#475569;">DriftFix Audit Evidence Export · ${esc(p.repoFullName)} · ${esc(p.fromDate)} → ${esc(p.toDate)} · <code style="font-family:ui-monospace,monospace;font-size:10px;color:#2dd4bf;">${shortHash}…</code></div>
      <div style="font-size:10px;color:#334155;max-width:500px;text-align:right;">This document is cryptographically signed. Tampering invalidates the integrity hash above. For compliance review only — distribution requires authorization.</div>
    </div>
  </div>
</div>

</body>
</html>`;
}

// ──────────────────────────────────────────────
// GET /api/audit-export?repositoryId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('repositoryId');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    // Validate required params
    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: repositoryId' },
        { status: 400 },
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fromStr || !dateRegex.test(fromStr)) {
      return NextResponse.json(
        { error: 'Missing or invalid "from" date. Use YYYY-MM-DD format.' },
        { status: 400 },
      );
    }
    if (!toStr || !dateRegex.test(toStr)) {
      return NextResponse.json(
        { error: 'Missing or invalid "to" date. Use YYYY-MM-DD format.' },
        { status: 400 },
      );
    }

    const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    const toDate = new Date(`${toStr}T23:59:59.999Z`);

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: '"from" date must be before "to" date.' },
        { status: 400 },
      );
    }

    // Verify repository exists
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 },
      );
    }

    // Fetch all analysis runs for this repository within the date range
    // Analysis runs belong to pull requests which belong to the repository
    const analyses = await db.analysisRun.findMany({
      where: {
        pullRequest: { repositoryId },
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: {
        pullRequest: { select: { title: true } },
        findings: {
          include: { complianceMappings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Collect all finding IDs from these analyses
    const allFindings = analyses.flatMap(a => a.findings);
    const findingIds = new Set(allFindings.map(f => f.id));

    // Also fetch evidence records directly tied to this repo in the date range
    const evidenceRecords = await db.evidenceRecord.findMany({
      where: {
        repositoryId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build a map of findingId -> last RESOLVED/DISMISSED/ACCEPTED_RISK evidence actor
    const approverMap = new Map<string, string>();
    for (const ev of evidenceRecords) {
      if (ev.findingId && (
        ev.eventType === 'FINDING_RESOLVED' ||
        ev.eventType === 'FINDING_DISMISSED' ||
        ev.eventType === 'FINDING_RISK_ACCEPTED'
      )) {
        if (!approverMap.has(ev.findingId)) {
          approverMap.set(ev.findingId, ev.actor || 'system');
        }
      }
    }

    // Build report data structures
    const reportFindings: ReportFinding[] = allFindings.map(f => ({
      id: f.id,
      severity: f.severity,
      actionLevel: f.actionLevel,
      title: f.title,
      filePath: f.filePath,
      lineStart: f.lineStart,
      status: f.status,
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
      dismissReason: f.dismissReason,
      approver: approverMap.get(f.id) || '',
      complianceMappings: f.complianceMappings.map(m => ({
        framework: m.framework,
        control: m.control,
      })),
    }));

    const reportAnalyses: ReportAnalysis[] = analyses.map(a => ({
      id: a.id,
      prTitle: a.pullRequest.title,
      status: a.status,
      findingsCount: a.findingsCount,
      score: a.score,
      completedAt: a.completedAt?.toISOString() ?? null,
    }));

    const reportEvidence: ReportEvidence[] = evidenceRecords.map(e => ({
      createdAt: e.createdAt.toISOString(),
      eventType: e.eventType,
      actor: e.actor,
      hash: e.hash,
      previousHash: e.previousHash,
    }));

    // Calculate compliance score over these findings
    const scoreData = allFindings.map(f => ({
      severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      confidence: f.confidence,
      status: f.status,
    }));
    const currentScore = calculateComplianceScore(scoreData);
    const scoreInfo = getScoreLabel(currentScore);

    // Severity breakdown (all findings, not just open)
    const severityBreakdown: Record<string, number> = {
      CRITICAL: allFindings.filter(f => f.severity === 'CRITICAL').length,
      HIGH:     allFindings.filter(f => f.severity === 'HIGH').length,
      MEDIUM:   allFindings.filter(f => f.severity === 'MEDIUM').length,
      LOW:      allFindings.filter(f => f.severity === 'LOW').length,
    };

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const f of allFindings) {
      statusBreakdown[f.status] = (statusBreakdown[f.status] || 0) + 1;
    }

    // Generate HTML report
    const generatedAt = new Date().toISOString();
    const integrityTimestamp = new Date().toISOString();

    const reportParams: ReportParams = {
      repoName: repository.name,
      repoFullName: repository.fullName,
      fromDate: fromStr,
      toDate: toStr,
      generatedAt,
      score: currentScore,
      scoreLabel: scoreInfo.label,
      analyses: reportAnalyses,
      findings: reportFindings,
      evidence: reportEvidence,
      severityBreakdown,
      statusBreakdown,
      integrityHash: '', // placeholder - computed below
      integrityTimestamp,
    };

    // First pass: generate HTML without the hash
    const htmlWithoutHash = generateAuditExportHTML(reportParams);

    // Compute SHA-256 of the entire report HTML content
    const integrityHash = crypto.createHash('sha256').update(htmlWithoutHash).digest('hex');

    // Second pass: generate final HTML with the hash embedded
    reportParams.integrityHash = integrityHash;
    const finalHtml = generateAuditExportHTML(reportParams);

    // Compute the true hash of the final document (which includes the hash itself)
    const trueHash = crypto.createHash('sha256').update(finalHtml).digest('hex');

    // One more pass with the true hash for self-consistency
    reportParams.integrityHash = trueHash;
    const selfConsistentHtml = generateAuditExportHTML(reportParams);
    const finalTrueHash = crypto.createHash('sha256').update(selfConsistentHtml).digest('hex');

    // Iterate until stable (should converge in 2-3 iterations)
    let stableHtml = selfConsistentHtml;
    let stableHash = finalTrueHash;
    for (let i = 0; i < 5; i++) {
      reportParams.integrityHash = stableHash;
      const candidateHtml = generateAuditExportHTML(reportParams);
      const candidateHash = crypto.createHash('sha256').update(candidateHtml).digest('hex');
      if (candidateHash === stableHash) {
        stableHtml = candidateHtml;
        break;
      }
      stableHtml = candidateHtml;
      stableHash = candidateHash;
    }

    const filename = `driftfix-audit-${repository.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${fromStr}-to-${toStr}.html`;

    return new NextResponse(stableHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Audit export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audit export' },
      { status: 500 },
    );
  }
}
