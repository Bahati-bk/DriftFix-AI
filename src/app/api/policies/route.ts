import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;

    const policies = await db.policy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ policies });
  } catch (error) {
    console.error('List policies error:', error);
    return NextResponse.json({ error: 'Failed to list policies' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, blockOnCritical, blockOnHigh, blockOnMedium, minimumScore } = body;

    if (!id) {
      return NextResponse.json({ error: 'Policy id is required' }, { status: 400 });
    }

    const existing = await db.policy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (blockOnCritical !== undefined) updateData.blockOnCritical = blockOnCritical;
    if (blockOnHigh !== undefined) updateData.blockOnHigh = blockOnHigh;
    if (blockOnMedium !== undefined) updateData.blockOnMedium = blockOnMedium;
    if (minimumScore !== undefined) updateData.minimumScore = minimumScore;

    const policy = await db.policy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('Update policy error:', error);
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
  }
}
