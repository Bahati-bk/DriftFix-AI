import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Dismissal reason is required' }, { status: 400 });
    }

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
        status: 'DISMISSED',
        dismissReason: reason,
        resolvedAt: new Date(),
      },
      include: { complianceMappings: true },
    });

    await createEvidenceRecord({
      organizationId: existing.analysisRun?.pullRequest?.repository?.organizationId,
      repositoryId: existing.analysisRun?.pullRequest?.repositoryId,
      findingId: id,
      eventType: 'FINDING_DISMISSED',
      actor: 'user',
      payload: {
        findingId: id,
        title: existing.title,
        severity: existing.severity,
        reason,
      },
    });

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Dismiss finding error:', error);
    return NextResponse.json({ error: 'Failed to dismiss finding' }, { status: 500 });
  }
}
