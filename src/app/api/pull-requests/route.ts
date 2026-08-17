import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('repositoryId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (repositoryId) where.repositoryId = repositoryId;
    if (status) where.status = status;

    const [pullRequests, total] = await Promise.all([
      db.pullRequest.findMany({
        where,
        include: {
          repository: { select: { id: true, fullName: true, owner: true, name: true } },
          _count: { select: { analysisRuns: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.pullRequest.count({ where }),
    ]);

    return NextResponse.json({
      pullRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List pull requests error:', error);
    return NextResponse.json({ error: 'Failed to list pull requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, number, title, author, sourceBranch, targetBranch, body: prBody, githubPrId } = body;

    if (!repositoryId || !number || !title || !author) {
      return NextResponse.json(
        { error: 'repositoryId, number, title, and author are required' },
        { status: 400 }
      );
    }

    const pullRequest = await db.pullRequest.create({
      data: {
        repositoryId,
        number,
        title,
        author,
        sourceBranch: sourceBranch || 'feature/branch',
        targetBranch: targetBranch || 'main',
        body: prBody || null,
        githubPrId: githubPrId || null,
      },
    });

    return NextResponse.json({ pullRequest }, { status: 201 });
  } catch (error) {
    console.error('Create pull request error:', error);
    return NextResponse.json({ error: 'Failed to create pull request' }, { status: 500 });
  }
}
