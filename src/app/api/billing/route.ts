import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const PLAN_TIERS = {
  FREE: {
    label: 'Free',
    prsIncluded: 50,
    reposIncluded: 1,
    priceCents: 0,
  },
  PRO: {
    label: 'Pro',
    prsIncluded: -1, // unlimited
    reposIncluded: -1, // unlimited
    priceCents: 2900,
  },
  ENTERPRISE: {
    label: 'Enterprise',
    prsIncluded: -1,
    reposIncluded: -1,
    priceCents: 0, // custom pricing
  },
} as const;

type PlanKey = keyof typeof PLAN_TIERS;

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function GET() {
  try {
    const org = await db.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { subscription: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const month = getCurrentMonth();
    let usage = await db.usageRecord.findUnique({
      where: { organizationId_month: { organizationId: org.id, month } },
    });

    if (!usage) {
      usage = await db.usageRecord.create({
        data: {
          organizationId: org.id,
          month,
          prsIncluded: 50,
        },
      });
    }

    const subscription = org.subscription;
    const status = subscription?.status ?? 'free';
    const planKey = (status.toUpperCase() === 'PRO'
      ? 'PRO'
      : status.toUpperCase() === 'ENTERPRISE'
        ? 'ENTERPRISE'
        : 'FREE') as PlanKey;
    const plan = PLAN_TIERS[planKey];

    return NextResponse.json({
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      usage: {
        month: usage.month,
        prsAnalyzed: usage.prsAnalyzed,
        prsIncluded: usage.prsIncluded,
        overagePrs: usage.overagePrs,
        overageCostCents: usage.overageCostCents,
      },
      plan: {
        key: planKey,
        label: plan.label,
        prsIncluded: plan.prsIncluded,
        reposIncluded: plan.reposIncluded,
        priceCents: plan.priceCents,
      },
    });
  } catch (error) {
    console.error('billing GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (!action || !['upgrade', 'downgrade', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "upgrade", "downgrade", or "cancel".' },
        { status: 400 }
      );
    }

    const org = await db.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { subscription: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const currentStatus = org.subscription?.status ?? 'free';

    let newStatus: string;
    if (action === 'upgrade') {
      newStatus = currentStatus === 'free' ? 'pro' : 'enterprise';
    } else if (action === 'downgrade') {
      newStatus = currentStatus === 'enterprise' ? 'pro' : 'free';
    } else {
      // cancel
      newStatus = currentStatus;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (org.subscription) {
      const updateData: Record<string, unknown> = {
        status: action === 'cancel' ? 'canceled' : newStatus,
        updatedAt: now,
      };

      if (action === 'cancel') {
        updateData.cancelAtPeriodEnd = true;
      } else {
        updateData.currentPeriodStart = now;
        updateData.currentPeriodEnd = periodEnd;
        updateData.cancelAtPeriodEnd = false;
      }

      await db.subscription.update({
        where: { id: org.subscription.id },
        data: updateData,
      });
    } else {
      await db.subscription.create({
        data: {
          organizationId: org.id,
          status: newStatus,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    // Update prsIncluded on the current month's usage record
    if (action !== 'cancel') {
      const month = getCurrentMonth();
      const prsIncluded = newStatus === 'pro' ? -1 : newStatus === 'enterprise' ? -1 : 50;
      await db.usageRecord.upsert({
        where: { organizationId_month: { organizationId: org.id, month } },
        create: {
          organizationId: org.id,
          month,
          prsIncluded,
        },
        update: { prsIncluded },
      });
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (error) {
    console.error('billing PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
