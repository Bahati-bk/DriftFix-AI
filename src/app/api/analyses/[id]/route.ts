import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const analysisRun = await db.analysisRun.findUnique({
      where: { id },
      include: {
        findings: {
          include: { complianceMappings: true },
          orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
        },
        pullRequest: {
          include: {
            repository: { select: { id: true, fullName: true, owner: true, name: true } },
          },
        },
      },
    });

    if (!analysisRun) {
      return NextResponse.json({ error: 'Analysis run not found' }, { status: 404 });
    }

    return NextResponse.json({ analysisRun });
  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json({ error: 'Failed to get analysis' }, { status: 500 });
  }
}
