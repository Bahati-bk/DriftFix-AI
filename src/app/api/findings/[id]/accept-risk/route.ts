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
    const { justification } = body;

    if (!justification) {
      return NextResponse.json({ error: 'Risk acceptance justification is required' }, { status: 400 });
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
        status: 'ACCEPTED_RISK',
        dismissReason: justification,
        resolvedAt: new Date(),
      },
      include: { complianceMappings: true },
    });

    await createEvidenceRecord({
      organizationId: existing.analysisRun?.pullRequest?.repository?.organizationId,
      repositoryId: existing.analysisRun?.pullRequest?.repositoryId,
      findingId: id,
      eventType: 'FINDING_RISK_ACCEPTED',
      actor: 'user',
      payload: {
        findingId: id,
        title: existing.title,
        severity: existing.severity,
        justification,
      },
    });

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Accept risk finding error:', error);
    return NextResponse.json({ error: 'Failed to accept risk' }, { status: 500 });
  }
}
