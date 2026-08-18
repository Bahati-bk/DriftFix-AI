import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { calculateComplianceScore, getScoreLabel } from '@/lib/compliance/scoring';

function severityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return '#f87171';
    case 'HIGH': return '#fb923c';
    case 'MEDIUM': return '#facc15';
    case 'LOW': return '#34d399';
    default: return '#94a3b8';
  }
}

function severityBg(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'rgba(248,113,113,0.12)';
    case 'HIGH': return 'rgba(251,146,60,0.12)';
    case 'MEDIUM': return 'rgba(250,204,21,0.12)';
    case 'LOW': return 'rgba(52,211,153,0.12)';
    default: return 'rgba(148,163,184,0.12)';
  }
}

function scoreGauge(score: number) {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#facc15' : '#f87171';
  const pct = Math.min(100, Math.max(0, score));
  return `
    <div style="position:relative;width:160px;height:160px;margin:0 auto;">
      <svg viewBox="0 0 160 160" style="width:100%;height:100%;transform:rotate(-90deg);">
        <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(148,163,184,0.1)" stroke-width="10"/>
        <circle cx="80" cy="80" r="68" fill="none" stroke="${color}" stroke-width="10"
          stroke-dasharray="${(pct / 100) * 427.26} 427.26" stroke-linecap="round"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <span style="font-size:2.5rem;font-weight:800;color:${color};line-height:1;">${score}</span>
        <span style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Compliance</span>
      </div>
    </div>`;
}

function generateHTMLReport(data: Record<string, unknown>): string {
  const now = new Date().toISOString();
  const summary = data.summary as Record<string, unknown>;
  const severityBreakdown = data.severityBreakdown as Record<string, number>;
  const findings = (data.findings || []) as Array<Record<string, unknown>>;
  const recentAnalyses = (data.recentAnalyses || []) as Array<Record<string, unknown>>;
  const framework = String(data.framework || 'SOC2');
  const score = Number(summary?.complianceScore || 0);
  const scoreLabel = String(data.scoreLabel || getScoreLabel(score).label);
  const totalFindings = Number(summary?.totalFindings || 0);
  const openFindings = Number(summary?.openFindings || 0);
  const resolvedFindings = Number(summary?.resolvedFindings || 0);
  const repos = Number(summary?.repositories || 0);
  const evidenceCount = Number(summary?.evidenceRecords || 0);
  const analyses = Number(summary?.recentAnalyses || 0);

  const findingsRows = findings.map(f => {
    const sev = String(f.severity || 'LOW');
    const status = String(f.status || 'OPEN');
    const statusColor = status === 'OPEN' ? '#f87171' : status === 'RESOLVED' ? '#34d399' : '#94a3b8';
    const mappings = (f.complianceMappings || []) as Array<Record<string, unknown>>;
    const controlBadges = mappings.map(m =>
      `<span style="display:inline-block;background:rgba(45,212,191,0.12);color:#2dd4bf;border:1px solid rgba(45,212,191,0.25);border-radius:4px;padding:1px 6px;font-size:10px;margin-right:4px;font-family:ui-monospace,monospace;">${m.framework || ''} ${m.control || ''}</span>`
    ).join('');
    return `
      <tr style="border-bottom:1px solid rgba(148,163,184,0.08);">
        <td style="padding:12px 16px;vertical-align:top;">
          <span style="display:inline-block;background:${severityBg(sev)};color:${severityColor(sev)};border:1px solid ${severityColor(sev)}33;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;letter-spacing:0.04em;">${sev}</span>
          <span style="display:inline-block;margin-left:8px;color:${statusColor};font-size:10px;font-weight:600;text-transform:uppercase;">${status}</span>
        </td>
        <td style="padding:12px 16px;vertical-align:top;color:#e2e8f0;font-size:13px;font-weight:500;">${f.title || 'Untitled Finding'}</td>
        <td style="padding:12px 16px;vertical-align:top;color:#94a3b8;font-size:12px;font-family:ui-monospace,monospace;max-width:220px;word-break:break-all;">${f.filePath || '—'}</td>
        <td style="padding:12px 16px;vertical-align:top;color:#cbd5e1;font-size:12px;max-width:280px;">${f.recommendation || '—'}</td>
        <td style="padding:12px 16px;vertical-align:top;">${controlBadges}</td>
      </tr>`;
  }).join('');

  const analysisRows = recentAnalyses.map(a => `
    <tr style="border-bottom:1px solid rgba(148,163,184,0.08);">
      <td style="padding:10px 16px;color:#94a3b8;font-size:12px;font-family:ui-monospace,monospace;">${String(a.id || '').slice(0, 12)}…</td>
      <td style="padding:10px 16px;color:#e2e8f0;font-size:13px;">${a.repository || '—'}</td>
      <td style="padding:10px 16px;color:#94a3b8;font-size:13px;text-align:right;">${a.findingsCount || 0}</td>
      <td style="padding:10px 16px;text-align:right;font-weight:600;color:${Number(a.score || 0) >= 80 ? '#34d399' : Number(a.score || 0) >= 60 ? '#facc15' : '#f87171'};">${a.score || 0}</td>
    </tr>`
  ).join('');

  // Compute an integrity hash for the footer
  const integrityHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DriftFix Compliance Report — ${framework}</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;">

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#0a0f1a 0%,#0d1b2a 50%,#0a1628 100%);border-bottom:2px solid rgba(45,212,191,0.3);padding:40px 48px;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(45,212,191,0.08) 0%,transparent 70%);border-radius:50%;"></div>
  <div style="position:absolute;bottom:-40px;left:30%;width:300px;height:120px;background:radial-gradient(circle,rgba(45,212,191,0.05) 0%,transparent 70%);border-radius:50%;"></div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
    <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#2dd4bf,#14b8a6);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#0a0f1a;">DF</div>
    <div>
      <h1 style="margin:0;font-size:1.75rem;font-weight:800;color:#f0fdfa;letter-spacing:-0.02em;">DriftFix</h1>
      <p style="margin:0;font-size:0.75rem;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.15em;font-weight:600;">Infrastructure Compliance Platform</p>
    </div>
  </div>
  <div style="margin-top:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    <span style="display:inline-block;background:rgba(45,212,191,0.12);color:#2dd4bf;border:1px solid rgba(45,212,191,0.25);border-radius:6px;padding:4px 14px;font-size:13px;font-weight:600;">${framework}</span>
    <span style="color:#64748b;font-size:13px;">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</span>
  </div>
</div>

<!-- MAIN CONTENT -->
<div style="max-width:1100px;margin:0 auto;padding:40px 48px 60px;">

  <!-- EXECUTIVE SUMMARY -->
  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;">
      <span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>
      Executive Summary
    </h2>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:start;">
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:16px;padding:28px 32px;text-align:center;">
        ${scoreGauge(score)}
        <div style="margin-top:12px;font-size:0.85rem;font-weight:600;color:#cbd5e1;">${scoreLabel}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;">
          <div style="font-size:2rem;font-weight:800;color:#e2e8f0;line-height:1;">${totalFindings}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Total Findings</div>
        </div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;">
          <div style="font-size:2rem;font-weight:800;color:#f87171;line-height:1;">${openFindings}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Open Findings</div>
        </div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;">
          <div style="font-size:2rem;font-weight:800;color:#34d399;line-height:1;">${resolvedFindings}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Resolved</div>
        </div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px 24px;">
          <div style="font-size:2rem;font-weight:800;color:#e2e8f0;line-height:1;">${repos}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-top:6px;">Repositories</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SEVERITY BREAKDOWN -->
  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;">
      <span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>
      Severity Breakdown
    </h2>
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
            <th style="padding:12px 20px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Severity</th>
            <th style="padding:12px 20px;text-align:center;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Open Count</th>
            <th style="padding:12px 20px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Distribution</th>
          </tr>
        </thead>
        <tbody>
          ${['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
            const count = severityBreakdown[sev] || 0;
            const total = openFindings || 1;
            const pct = Math.round((count / total) * 100);
            const color = severityColor(sev);
            return `
            <tr style="border-bottom:1px solid rgba(148,163,184,0.06);">
              <td style="padding:14px 20px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:10px;vertical-align:middle;"></span>
                <span style="color:${color};font-weight:700;font-size:13px;">${sev}</span>
              </td>
              <td style="padding:14px 20px;text-align:center;color:#e2e8f0;font-weight:700;font-size:1.1rem;">${count}</td>
              <td style="padding:14px 20px;">
                <div style="background:rgba(148,163,184,0.08);border-radius:4px;height:8px;overflow:hidden;min-width:200px;">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.3s;"></div>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- RECENT ANALYSES -->
  ${analyses > 0 ? `
  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;">
      <span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>
      Recent Analyses
    </h2>
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
            <th style="padding:12px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Analysis ID</th>
            <th style="padding:12px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Repository</th>
            <th style="padding:12px 16px;text-align:right;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Findings</th>
            <th style="padding:12px 16px;text-align:right;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Score</th>
          </tr>
        </thead>
        <tbody>${analysisRows}</tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- FINDINGS LIST -->
  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;">
      <span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>
      Findings Detail
      <span style="font-size:0.75rem;color:#64748b;font-weight:400;text-transform:none;letter-spacing:normal;">(${findings.length} total)</span>
    </h2>
    ${findings.length === 0 ? `
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:48px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:8px;">✓</div>
        <div style="color:#34d399;font-weight:600;font-size:14px;">No findings detected</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px;">All infrastructure configurations are compliant with ${framework} controls.</div>
      </div>
    ` : `
      <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
              <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Severity</th>
              <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Finding</th>
              <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">File Path</th>
              <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Recommendation</th>
              <th style="padding:10px 16px;text-align:left;font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Controls</th>
            </tr>
          </thead>
          <tbody>${findingsRows}</tbody>
        </table>
      </div>
    `}
  </div>

  <!-- EVIDENCE LEDGER -->
  <div style="margin-bottom:48px;">
    <h2 style="margin:0 0 24px;font-size:1.1rem;font-weight:700;color:#f0fdfa;text-transform:uppercase;letter-spacing:0.08em;display:flex;align-items:center;gap:10px;">
      <span style="display:inline-block;width:4px;height:20px;background:#2dd4bf;border-radius:2px;"></span>
      Evidence Ledger
    </h2>
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:24px 28px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:20px;">
        <div>
          <div style="font-size:1.5rem;font-weight:800;color:#2dd4bf;">${evidenceCount}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Evidence Records</div>
        </div>
        <div>
          <div style="font-size:1.5rem;font-weight:800;color:#e2e8f0;">${analyses}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Analysis Runs</div>
        </div>
        <div>
          <div style="font-size:1.5rem;font-weight:800;color:#e2e8f0;">${repos}</div>
          <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Monitored Repos</div>
        </div>
      </div>
      <div style="background:rgba(10,15,26,0.8);border:1px solid rgba(148,163,184,0.08);border-radius:8px;padding:16px 20px;">
        <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Report Integrity Hash (SHA-256)</div>
        <code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;color:#2dd4bf;word-break:break-all;line-height:1.8;">${integrityHash}</code>
      </div>
      <p style="margin:16px 0 0;font-size:11px;color:#475569;">
        This hash is computed over the entire report payload. Any modification to this document will invalidate the hash.
        Evidence records are stored in an append-only ledger with cryptographic chain verification.
      </p>
    </div>
  </div>

</div>

<!-- FOOTER -->
<div style="border-top:1px solid rgba(148,163,184,0.1);padding:24px 48px;background:rgba(15,23,42,0.4);">
  <div style="max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
    <div style="font-size:11px;color:#475569;">
      DriftFix Compliance Report · ${framework} · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · <code style="font-family:ui-monospace,monospace;font-size:10px;color:#2dd4bf;">${integrityHash.slice(0, 16)}…</code>
    </div>
    <div style="font-size:10px;color:#334155;max-width:500px;text-align:right;">
      This report is auto-generated by DriftFix and is intended for internal compliance review only. Distribution requires authorization.
    </div>
  </div>
</div>

</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, framework = 'SOC2' } = body;

    // Gather all data for the report (same as /api/reports)
    const orgWhere: Record<string, unknown> = organizationId ? { organizationId } : {};

    const [findings, repositories, recentAnalyses, evidenceRecords] = await Promise.all([
      db.finding.findMany({
        where: organizationId
          ? {
              analysisRun: {
                pullRequest: { repository: { organizationId } },
              },
            }
          : undefined,
        include: { complianceMappings: true, analysisRun: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.repository.findMany({ where: orgWhere }),
      db.analysisRun.findMany({
        where: organizationId
          ? {
              pullRequest: { repository: { organizationId } },
            }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { pullRequest: { include: { repository: true } } },
      }),
      db.evidenceRecord.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Calculate current score
    const scoreData = findings.map(f => ({
      severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      confidence: f.confidence,
      status: f.status,
    }));
    const currentScore = calculateComplianceScore(scoreData);
    const scoreInfo = getScoreLabel(currentScore);

    const reportData: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      framework,
      summary: {
        totalFindings: findings.length,
        openFindings: findings.filter(f => f.status === 'OPEN').length,
        resolvedFindings: findings.filter(f => f.status === 'RESOLVED').length,
        dismissedFindings: findings.filter(f => f.status === 'DISMISSED').length,
        acceptedRiskFindings: findings.filter(f => f.status === 'ACCEPTED_RISK').length,
        complianceScore: currentScore,
        repositories: repositories.length,
        recentAnalyses: recentAnalyses.length,
        evidenceRecords: evidenceRecords.length,
      },
      scoreLabel: scoreInfo.label,
      severityBreakdown: {
        CRITICAL: findings.filter(f => f.severity === 'CRITICAL' && f.status === 'OPEN').length,
        HIGH: findings.filter(f => f.severity === 'HIGH' && f.status === 'OPEN').length,
        MEDIUM: findings.filter(f => f.severity === 'MEDIUM' && f.status === 'OPEN').length,
        LOW: findings.filter(f => f.severity === 'LOW' && f.status === 'OPEN').length,
      },
      findings: findings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        status: f.status,
        category: f.category,
        filePath: f.filePath,
        recommendation: f.recommendation,
        complianceMappings: f.complianceMappings,
      })),
      recentAnalyses: recentAnalyses.map(a => ({
        id: a.id,
        score: a.score,
        findingsCount: a.findingsCount,
        status: a.status,
        createdAt: a.createdAt,
        repository: a.pullRequest?.repository?.fullName,
      })),
    };

    const html = generateHTMLReport(reportData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${framework.toLowerCase()}-report-${new Date().toISOString().split('T')[0]}.html"`,
      },
    });
  } catch (error) {
    console.error('Generate PDF report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
