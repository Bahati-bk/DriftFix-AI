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

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser, token: `demo-${user.id}` });
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

  await db.organization.create({
    data: {
      name: `${user.name}'s Organization`,
      slug: `${user.name?.toLowerCase().replace(/\s+/g, '-') || 'org'}-${user.id.slice(0, 6)}`,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
      policies: {
        create: {
          name: 'default',
          blockOnCritical: true,
          blockOnHigh: true,
          blockOnMedium: false,
          minimumScore: 80,
        },
      },
    },
  });

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser, token: `demo-${user.id}` }, { status: 201 });
}

async function handleDemoLogin() {
  let demoUser = await db.user.findUnique({ where: { email: 'demo@driftfix.dev' } });

  if (!demoUser) {
    demoUser = await db.user.create({
      data: {
        email: 'demo@driftfix.dev',
        name: 'Demo User',
        passwordHash: simpleHash('demo-password'),
        role: 'ADMIN',
      },
    });

    await db.organization.create({
      data: {
        name: 'DriftFix Demo Org',
        slug: 'driftfix-demo',
        members: {
          create: {
            userId: demoUser.id,
            role: 'OWNER',
          },
        },
        policies: {
          create: {
            name: 'default',
            blockOnCritical: true,
            blockOnHigh: true,
            blockOnMedium: false,
            minimumScore: 80,
          },
        },
      },
    });
  }

  const { passwordHash: _, ...safeUser } = demoUser;
  return NextResponse.json({ user: safeUser, token: `demo-${demoUser.id}` });
}
