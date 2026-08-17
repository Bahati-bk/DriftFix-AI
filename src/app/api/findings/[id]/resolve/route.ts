import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.finding.findUnique({
      where: { id },
      include: {
        analysisRun: {
          include: {
            pullRequest: {
              include: { repository: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    const finding = await db.finding.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
      include: { complianceMappings: true },
    });

    await createEvidenceRecord({
      organizationId: existing.analysisRun?.pullRequest?.repository?.organizationId,
      repositoryId: existing.analysisRun?.pullRequest?.repositoryId,
      findingId: id,
      eventType: 'FINDING_RESOLVED',
      actor: 'user',
      payload: {
        findingId: id,
        title: existing.title,
        severity: existing.severity,
      },
    });

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Resolve finding error:', error);
    return NextResponse.json({ error: 'Failed to resolve finding' }, { status: 500 });
  }
}
