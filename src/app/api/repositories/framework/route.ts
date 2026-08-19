import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_FRAMEWORKS = ['soc2', 'gdpr', 'hipaa'] as const;

type ValidFramework = (typeof VALID_FRAMEWORKS)[number];

function isValidFramework(f: string): f is ValidFramework {
  return VALID_FRAMEWORKS.includes(f as ValidFramework);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('repositoryId');

    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Missing "repositoryId" query parameter' },
        { status: 400 }
      );
    }

    const repo = await db.repository.findUnique({
      where: { id: repositoryId },
      select: { id: true, framework: true },
    });

    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      repositoryId: repo.id,
      framework: repo.framework,
    });
  } catch (error) {
    console.error('repositories/framework GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, framework } = body as {
      repositoryId?: string;
      framework?: string;
    };

    if (!repositoryId || typeof repositoryId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "repositoryId"' },
        { status: 400 }
      );
    }

    if (!framework || typeof framework !== 'string' || !isValidFramework(framework)) {
      return NextResponse.json(
        { error: `Invalid "framework". Must be one of: ${VALID_FRAMEWORKS.join(', ')}` },
        { status: 400 }
      );
    }

    const repo = await db.repository.update({
      where: { id: repositoryId },
      data: { framework },
      select: { id: true, framework: true },
    });

    return NextResponse.json({
      repositoryId: repo.id,
      framework: repo.framework,
    });
  } catch (error) {
    console.error('repositories/framework PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
