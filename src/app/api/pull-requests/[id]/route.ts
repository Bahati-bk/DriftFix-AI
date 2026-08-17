import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pr = await db.pullRequest.findUnique({
      where: { id },
      include: {
        analysisRuns: {
          include: {
            findings: {
              include: { complianceMappings: true },
              orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        repository: { select: { id: true, fullName: true, owner: true, name: true } },
      },
    });

    if (!pr) {
      return NextResponse.json({ error: 'Pull request not found' }, { status: 404 });
    }

    const analysisRun = pr.analysisRuns[0] || null;
    return NextResponse.json({ pullRequest: pr, analysisRun });
  } catch (error) {
    console.error('Get PR error:', error);
    return NextResponse.json({ error: 'Failed to get pull request' }, { status: 500 });
  }
}
