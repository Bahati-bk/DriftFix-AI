import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rules = await db.rule.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('List rules error:', error);
    return NextResponse.json({ error: 'Failed to list rules' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled, severity, name, description, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    const existing = await db.rule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (severity) updateData.severity = severity;
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (category) updateData.category = category;

    const rule = await db.rule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Update rule error:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}
