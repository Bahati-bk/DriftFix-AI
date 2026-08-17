import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyEvidenceChain } from '@/lib/compliance/evidence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const repositoryId = searchParams.get('repositoryId');
    const findingId = searchParams.get('findingId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;
    if (repositoryId) where.repositoryId = repositoryId;
    if (findingId) where.findingId = findingId;

    const [records, total] = await Promise.all([
      db.evidenceRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.evidenceRecord.count({ where }),
    ]);

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List evidence error:', error);
    return NextResponse.json({ error: 'Failed to list evidence records' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const result = await verifyEvidenceChain();
    return NextResponse.json({
      valid: result.valid,
      recordsVerified: result.recordsVerified,
      brokenAt: result.brokenAt || null,
    });
  } catch (error) {
    console.error('Verify evidence chain error:', error);
    return NextResponse.json({ error: 'Failed to verify evidence chain' }, { status: 500 });
  }
}
