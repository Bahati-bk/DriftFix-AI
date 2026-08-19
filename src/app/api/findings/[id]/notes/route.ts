import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notes = await db.findingNote.findMany({
      where: { findingId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Get finding notes error:', error);
    return NextResponse.json({ error: 'Failed to get notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, author } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!author || !author.trim()) {
      return NextResponse.json({ error: 'Author is required' }, { status: 400 });
    }

    const note = await db.findingNote.create({
      data: {
        findingId: id,
        content: content.trim(),
        author: author.trim(),
      },
    });

    const notes = await db.findingNote.findMany({
      where: { findingId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Create finding note error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
