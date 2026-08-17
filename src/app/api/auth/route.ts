import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

function simpleHash(password: string): string {
  return crypto.createHash('sha256').update(password + 'driftfix-salt').digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'login') {
      return handleLogin(body);
    } else if (action === 'register') {
      return handleRegister(body);
    } else if (action === 'demo-login') {
      return handleDemoLogin();
    }

    return NextResponse.json({ error: 'Invalid action. Use: login, register, or demo-login' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleLogin(body: { email?: string; password?: string }) {
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.passwordHash !== simpleHash(password)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const member = await db.organizationMember.findFirst({ where: { userId: user.id } });
  const orgId = member?.organizationId || null;

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser, orgId });
}

async function handleRegister(body: { email?: string; password?: string; name?: string }) {
  const { email, password, name } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      passwordHash: simpleHash(password),
      role: 'MEMBER',
    },
  });

  const org = await db.organization.create({
    data: {
      name: `${user.name}'s Organization`,
      slug: `${user.name?.toLowerCase().replace(/\s+/g, '-') || 'org'}-${user.id.slice(0, 6)}`,
      members: { create: { userId: user.id, role: 'OWNER' } },
      policies: { create: { name: 'default', blockOnCritical: true, blockOnHigh: true, blockOnMedium: false, minimumScore: 80 } },
    },
  });

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser, orgId: org.id }, { status: 201 });
}

async function handleDemoLogin() {
  // Find or create demo user matching the seed data
  let demoUser = await db.user.findUnique({ where: { email: 'demo@driftfix.ai' } });

  if (!demoUser) {
    demoUser = await db.user.create({
      data: { email: 'demo@driftfix.ai', name: 'Alex Chen', passwordHash: simpleHash('demo123'), role: 'OWNER' },
    });
    // Create org if it doesn't exist
    const existingOrg = await db.organization.findFirst({ where: { name: 'Acme Corp' } });
    if (!existingOrg) {
      await db.organization.create({
        data: {
          name: 'Acme Corp', slug: 'acme-corp',
          members: { create: { userId: demoUser.id, role: 'OWNER' } },
          policies: { create: { name: 'default', blockOnCritical: true, blockOnHigh: true, blockOnMedium: false, minimumScore: 80 } },
        },
      });
    } else {
      await db.organizationMember.create({ data: { organizationId: existingOrg.id, userId: demoUser.id, role: 'OWNER' } }).catch(() => {});
    }
  }

  const member = await db.organizationMember.findFirst({ where: { userId: demoUser.id } });
  const { passwordHash: _, ...safeUser } = demoUser;
  return NextResponse.json({ user: safeUser, orgId: member?.organizationId || null });
}
