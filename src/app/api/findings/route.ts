import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const repositoryId = searchParams.get('repositoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};

    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (category) where.category = category;

    if (repositoryId) {
      where.analysisRun = {
        pullRequest: {
          repositoryId,
        },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { filePath: { contains: search } },
      ];
    }

    const [findings, total] = await Promise.all([
      db.finding.findMany({
        where,
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
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.finding.count({ where }),
    ]);

    return NextResponse.json({
      findings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List findings error:', error);
    return NextResponse.json({ error: 'Failed to list findings' }, { status: 500 });
  }
}
