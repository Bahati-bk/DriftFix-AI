import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;

    const [repositories, total] = await Promise.all([
      db.repository.findMany({
        where,
        include: {
          _count: { select: { pullRequests: true } },
        },
        orderBy: { connectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.repository.count({ where }),
    ]);

    return NextResponse.json({
      repositories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List repositories error:', error);
    return NextResponse.json({ error: 'Failed to list repositories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, owner, name, fullName, defaultBranch, language, visibility, githubRepoId } = body;

    if (!organizationId || !owner || !name) {
      return NextResponse.json(
        { error: 'organizationId, owner, and name are required' },
        { status: 400 }
      );
    }

    const repository = await db.repository.create({
      data: {
        organizationId,
        owner,
        name,
        fullName: fullName || `${owner}/${name}`,
        defaultBranch: defaultBranch || 'main',
        language: language || null,
        visibility: visibility || 'private',
        githubRepoId: githubRepoId || null,
      },
    });

    return NextResponse.json({ repository }, { status: 201 });
  } catch (error) {
    console.error('Create repository error:', error);
    return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
  }
}
