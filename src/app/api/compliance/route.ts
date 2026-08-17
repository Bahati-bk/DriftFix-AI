import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateComplianceScore } from '@/lib/compliance/scoring';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'trends') {
      return getTrends();
    }
    return getCurrentScore();
  } catch (error) {
    console.error('Compliance error:', error);
    return NextResponse.json({ error: 'Failed to get compliance data' }, { status: 500 });
  }
}

async function getCurrentScore() {
  const allFindings = await db.finding.findMany({
    select: { severity: true, confidence: true, status: true },
  });

  const openFindings = allFindings.filter(f => f.status === 'OPEN' || f.status === 'IN_REVIEW');
  const score = calculateComplianceScore(
    allFindings.map(f => ({
      severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      confidence: f.confidence,
      status: f.status,
    }))
  );

  const severityBreakdown: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of openFindings) {
    const s = f.severity as string;
    if (s in severityBreakdown) severityBreakdown[s]++;
  }

  const prsAnalyzed = await db.analysisRun.count();
  const resolvedCount = allFindings.filter(f => f.status === 'RESOLVED').length;
  const evidenceCount = await db.evidenceRecord.count();
  const criticalCount = openFindings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = openFindings.filter(f => f.severity === 'HIGH').length;
  const mediumCount = openFindings.filter(f => f.severity === 'MEDIUM').length;

  return NextResponse.json({
    score,
    severityBreakdown,
    prsAnalyzed,
    resolvedCount,
    evidenceCount,
    criticalCount,
    highCount,
    mediumCount,
    openFindings: openFindings.length,
  });
}

async function getTrends() {
  const history = await db.complianceScoreHistory.findMany({
    orderBy: { weekLabel: 'asc' },
    take: 52,
  });

  if (history.length === 0) {
    const sampleData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      sampleData.push({
        id: `sample-${i}`,
        weekLabel: `Week ${12 - i}`,
        score: 80 + Math.floor(Math.random() * 15),
        createdAt: d.toISOString(),
      });
    }
    return NextResponse.json({ history: sampleData });
  }

  return NextResponse.json({ history });
}
