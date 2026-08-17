import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { createEvidenceRecord } from '@/lib/compliance/evidence';
import { calculateComplianceScore, getScoreLabel } from '@/lib/compliance/scoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, framework = 'SOC2', generatedBy = 'system' } = body;

    // Gather all data for the report
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

    // Build compliance control coverage
    const controlCoverage: Record<string, { framework: string; control: string; controlName: string; findings: number }[]> = {};
    for (const finding of findings) {
      for (const mapping of finding.complianceMappings) {
        const key = `${mapping.framework}:${mapping.control}`;
        if (!controlCoverage[key]) {
          controlCoverage[key] = [];
        }
        controlCoverage[key].push({
          framework: mapping.framework,
          control: mapping.control,
          controlName: mapping.controlName || '',
          findings: 1,
        });
      }
    }

    const reportData = {
      generatedAt: new Date().toISOString(),
      framework,
      generatedBy,
      summary: {
        totalFindings: findings.length,
        openFindings: findings.filter(f => f.status === 'OPEN').length,
        resolvedFindings: findings.filter(f => f.status === 'RESOLVED').length,
        dismissedFindings: findings.filter(f => f.status === 'DISMISSED').length,
        acceptedRiskFindings: findings.filter(f => f.status === 'ACCEPTED_RISK').length,
        complianceScore: currentScore,
        scoreLabel: scoreInfo.label,
        repositories: repositories.length,
        recentAnalyses: recentAnalyses.length,
        evidenceRecords: evidenceRecords.length,
      },
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

    // Create integrity hash
    const reportStr = JSON.stringify(reportData);
    const integrityHash = crypto.createHash('sha256').update(reportStr).digest('hex');

    const report = await db.auditReport.create({
      data: {
        organizationId: organizationId || null,
        framework,
        generatedBy,
        reportData: reportStr,
        integrityHash,
      },
    });

    // Create evidence of report generation
    await createEvidenceRecord({
      organizationId: organizationId || undefined,
      eventType: 'AUDIT_REPORT_GENERATED',
      actor: generatedBy,
      payload: {
        reportId: report.id,
        framework,
        score: currentScore,
        totalFindings: findings.length,
      },
    });

    return NextResponse.json({ report, reportData }, { status: 201 });
  } catch (error) {
    console.error('Generate report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
