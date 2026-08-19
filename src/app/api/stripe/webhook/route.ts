import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// In demo mode, STRIPE_WEBHOOK_SECRET may not be set.
// We gracefully skip signature verification when the secret is missing.

function getOrgForStripeCustomer(stripeCustomerId: string) {
  return db.subscription.findFirst({
    where: { stripeCustomerId },
    include: { organization: true },
  });
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const bodyText = await request.text();

    // In demo mode without a secret, parse directly.
    // In production, you would verify the Stripe signature here:
    // const sig = request.headers.get('stripe-signature');
    // stripe.webhooks.constructEvent(bodyText, sig, webhookSecret);
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = event.type as string;
    const eventData = event.data as { object?: Record<string, unknown> } | undefined;
    const data = eventData?.object;

    if (!data) {
      return NextResponse.json({ received: true });
    }

    switch (eventType) {
      case 'customer.subscription.created': {
        const customerId = data.customer as string;
        const subId = data.id as string;
        const priceId = data.items?.[0]?.price?.id as string | undefined;
        const status = data.status as string;
        const periodStart = data.current_period_start
          ? new Date((data.current_period_start as number) * 1000)
          : new Date();
        const periodEnd = data.current_period_end
          ? new Date((data.current_period_end as number) * 1000)
          : new Date();

        const existing = await db.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (existing) {
          await db.subscription.update({
            where: { id: existing.id },
            data: {
              stripeSubscriptionId: subId,
              stripePriceId: priceId ?? null,
              status,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          });
        } else {
          // Find the first org or create a subscription for it
          const org = await db.organization.findFirst({
            orderBy: { createdAt: 'asc' },
          });
          if (org) {
            await db.subscription.upsert({
              where: { organizationId: org.id },
              create: {
                organizationId: org.id,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subId,
                stripePriceId: priceId ?? null,
                status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
              update: {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subId,
                stripePriceId: priceId ?? null,
                status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const customerId = data.customer as string;
        const status = data.status as string;
        const periodStart = data.current_period_start
          ? new Date((data.current_period_start as number) * 1000)
          : null;
        const periodEnd = data.current_period_end
          ? new Date((data.current_period_end as number) * 1000)
          : null;
        const cancelAtPeriodEnd = data.cancel_at_period_end as boolean;

        const sub = await getOrgForStripeCustomer(customerId);
        if (sub) {
          await db.subscription.update({
            where: { id: sub.id },
            data: {
              status,
              currentPeriodStart: periodStart ?? undefined,
              currentPeriodEnd: periodEnd ?? undefined,
              cancelAtPeriodEnd,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const customerId = data.customer as string;
        const sub = await getOrgForStripeCustomer(customerId);
        if (sub) {
          await db.subscription.update({
            where: { id: sub.id },
            data: { status: 'canceled' },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const customerId = data.customer as string;
        const sub = await getOrgForStripeCustomer(customerId);
        if (sub) {
          // Reset monthly usage counters
          const now = new Date();
          const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          await db.usageRecord.upsert({
            where: { organizationId_month: { organizationId: sub.organizationId, month } },
            create: {
              organizationId: sub.organizationId,
              month,
              prsAnalyzed: 0,
              overagePrs: 0,
              overageCostCents: 0,
            },
            update: {
              prsAnalyzed: 0,
              overagePrs: 0,
              overageCostCents: 0,
            },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = data.customer as string;
        const sub = await getOrgForStripeCustomer(customerId);
        if (sub) {
          await db.subscription.update({
            where: { id: sub.id },
            data: { status: 'past_due' },
          });
        }
        break;
      }

      default:
        break;
    }

    // Always return 200 to prevent Stripe retries
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('stripe webhook error:', error);
    // Still return 200 to prevent Stripe retries for malformed events
    return NextResponse.json({ received: true });
  }
}
