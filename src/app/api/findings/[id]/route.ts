import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const finding = await db.finding.findUnique({
      where: { id },
      include: {
        complianceMappings: true,
        analysisRun: {
          include: {
            pullRequest: {
              include: {
                repository: { select: { id: true, fullName: true, owner: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Get finding error:', error);
    return NextResponse.json({ error: 'Failed to get finding' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, title, recommendation, suggestedFix } = body;

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

    const updateData: Record<string, unknown> = {};
    if (title) updateData.title = title;
    if (recommendation) updateData.recommendation = recommendation;
    if (suggestedFix !== undefined) updateData.suggestedFix = suggestedFix;

    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED') {
        updateData.resolvedAt = new Date();
      }
    }

    const finding = await db.finding.update({
      where: { id },
      data: updateData,
      include: { complianceMappings: true },
    });

    // Create evidence for status change
    if (status && status !== existing.status) {
      await createEvidenceRecord({
        organizationId: existing.analysisRun?.pullRequest?.repository?.organizationId,
        repositoryId: existing.analysisRun?.pullRequest?.repositoryId,
        findingId: id,
        eventType: 'FINDING_STATUS_CHANGED',
        actor: 'user',
        payload: {
          findingId: id,
          from: existing.status,
          to: status,
        },
      });
    }

    return NextResponse.json({ finding });
  } catch (error) {
    console.error('Update finding error:', error);
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 });
  }
}
