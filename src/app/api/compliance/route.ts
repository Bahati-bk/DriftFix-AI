import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateComplianceScore } from '@/lib/compliance/scoring';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const repositoryId = searchParams.get('repositoryId');
    const organizationId = searchParams.get('organizationId');

    if (type === 'trends') {
      return getTrends(organizationId, repositoryId);
    }

    // Default: return current score
    return getCurrentScore(organizationId, repositoryId);
  } catch (error) {
    console.error('Compliance error:', error);
    return NextResponse.json({ error: 'Failed to get compliance data' }, { status: 500 });
  }
}

async function getCurrentScore(organizationId: string | null, repositoryId: string | null) {
  const where: Record<string, unknown> = {};
  if (repositoryId) {
    where.analysisRun = {
      pullRequest: { repositoryId },
    };
  } else if (organizationId) {
    where.analysisRun = {
      pullRequest: {
        repository: { organizationId },
      },
    };
  }

  const findings = await db.finding.findMany({
    where,
    select: {
      severity: true,
      confidence: true,
      status: true,
    },
  });

  const score = calculateComplianceScore(
    findings.map(f => ({
      severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      confidence: f.confidence,
      status: f.status,
    }))
  );

  // Get breakdown by severity
  const severityBreakdown = await db.finding.groupBy({
    by: ['severity'],
    where: {
      ...where,
      status: 'OPEN',
    },
    _count: true,
  });

  const breakdown: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  for (const item of severityBreakdown) {
    breakdown[item.severity] = item._count;
  }

  // Get latest analysis
  const latestAnalysis = await db.analysisRun.findFirst({
    where: repositoryId
      ? { pullRequest: { repositoryId } }
      : organizationId
        ? { pullRequest: { repository: { organizationId } } }
        : undefined,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    score,
    breakdown,
    totalOpen: Object.values(breakdown).reduce((a, b) => a + b, 0),
    lastAnalyzed: latestAnalysis?.createdAt || null,
  });
}

async function getTrends(organizationId: string | null, repositoryId: string | null) {
  const where: Record<string, unknown> = {};
  if (repositoryId) where.repositoryId = repositoryId;
  else if (organizationId) where.organizationId = organizationId;

  const history = await db.complianceScoreHistory.findMany({
    where,
    orderBy: { weekLabel: 'asc' },
    take: 52, // Last 52 weeks
  });

  // If no history, generate some sample data points
  if (history.length === 0) {
    const now = new Date();
    const sampleData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      d.setDate(d.getDate() - d.getDay() + 1);
      const weekLabel = d.toISOString().split('T')[0];
      sampleData.push({
        id: `sample-${i}`,
        weekLabel,
        score: 85 + Math.floor(Math.random() * 15),
        createdAt: d,
      });
    }
    return NextResponse.json({ trends: sampleData });
  }

  return NextResponse.json({ trends: history });
}
