import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ActivityEntry {
  id: string;
  type: 'FINDING' | 'EVIDENCE' | 'ANALYSIS' | 'PR';
  action: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const typeFilter = searchParams.get('type') || '';

    const types = typeFilter
      ? typeFilter.split(',').map((t) => t.trim().toUpperCase())
      : [];

    const wantFinding = types.length === 0 || types.includes('FINDING');
    const wantEvidence = types.length === 0 || types.includes('EVIDENCE');
    const wantAnalysis = types.length === 0 || types.includes('ANALYSIS');
    const wantPR = types.length === 0 || types.includes('PR');

    const [findings, evidenceRecords, analysisRuns, pullRequests] = await Promise.all([
      wantFinding
        ? db.finding.findMany({ orderBy: { createdAt: 'desc' } })
        : [],
      wantEvidence
        ? db.evidenceRecord.findMany({ orderBy: { createdAt: 'desc' } })
        : [],
      wantAnalysis
        ? db.analysisRun.findMany({ orderBy: { createdAt: 'desc' } })
        : [],
      wantPR
        ? db.pullRequest.findMany({ orderBy: { createdAt: 'desc' } })
        : [],
    ]);

    const activities: ActivityEntry[] = [
      ...findings.map((f) => ({
        id: f.id,
        type: 'FINDING' as const,
        action: 'Finding discovered',
        description: f.title,
        actor: 'DriftFix AI',
        timestamp: f.createdAt.toISOString(),
        metadata: {
          severity: f.severity,
          status: f.status,
          category: f.category,
          confidence: f.confidence,
          filePath: f.filePath,
        },
      })),
      ...evidenceRecords.map((e) => {
        let summary = '';
        try {
          const payload = e.payload ? JSON.parse(e.payload) : {};
          summary =
            payload.summary ||
            payload.title ||
            payload.message ||
            payload.description ||
            JSON.stringify(payload).slice(0, 120);
        } catch {
          summary = e.payload?.slice(0, 120) || '';
        }
        return {
          id: e.id,
          type: 'EVIDENCE' as const,
          action: e.eventType,
          description: summary,
          actor: e.actor || 'system',
          timestamp: e.createdAt.toISOString(),
          metadata: {
            eventType: e.eventType,
            repositoryId: e.repositoryId,
            findingId: e.findingId,
          },
        };
      }),
      ...analysisRuns.map((a) => ({
        id: a.id,
        type: 'ANALYSIS' as const,
        action: 'Analysis completed',
        description: `Score: ${a.score}, ${a.findingsCount} findings`,
        actor: 'DriftFix',
        timestamp: a.createdAt.toISOString(),
        metadata: {
          score: a.score,
          findingsCount: a.findingsCount,
          filesAnalyzed: a.filesAnalyzed,
          status: a.status,
          durationMs: a.durationMs,
        },
      })),
      ...pullRequests.map((pr) => ({
        id: pr.id,
        type: 'PR' as const,
        action: 'PR analyzed',
        description: pr.title,
        actor: pr.author,
        timestamp: pr.createdAt.toISOString(),
        metadata: {
          number: pr.number,
          status: pr.status,
          sourceBranch: pr.sourceBranch,
          targetBranch: pr.targetBranch,
        },
      })),
    ];

    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const total = activities.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginatedActivities = activities.slice(offset, offset + limit);

    return NextResponse.json({
      activities: paginatedActivities,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 },
    );
  }
}
