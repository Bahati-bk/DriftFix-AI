import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const deliveryId = request.headers.get('x-github-delivery');
    const eventType = request.headers.get('x-github-event');

    // Verify signature if secret is configured (skip in demo mode)
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
      if (signature !== expectedSig) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Find repository by GitHub repo ID
    const repoData = body.repository as Record<string, unknown> | undefined;
    const githubRepoId = repoData?.id;
    const repoFullName = repoData?.full_name as string | undefined;

    let repositoryId: string | undefined;
    if (githubRepoId) {
      const repo = await db.repository.findFirst({
        where: { githubRepoId: Number(githubRepoId) },
      });
      repositoryId = repo?.id;
    }

    // Create webhook event record
    const event = await db.webhookEvent.create({
      data: {
        repositoryId: repositoryId || null,
        eventType: eventType || 'unknown',
        deliveryId: deliveryId || null,
        payload,
        processed: false,
      },
    });

    // Handle pull request events
    if (eventType === 'pull_request' && repositoryId) {
      const prAction = body.action as string;
      const pr = body.pull_request as Record<string, unknown>;

      if (pr) {
        // Upsert the PR
        const prNumber = pr.number as number;
        const existingPr = await db.pullRequest.findFirst({
          where: {
            repositoryId,
            githubPrId: prNumber,
          },
        });

        if (!existingPr && (prAction === 'opened' || prAction === 'synchronize')) {
          const user = pr.user as Record<string, unknown>;
          const head = pr.head as Record<string, unknown>;
          const base = pr.base as Record<string, unknown>;

          await db.pullRequest.create({
            data: {
              repositoryId,
              githubPrId: prNumber,
              number: prNumber,
              title: (pr.title as string) || '',
              author: (user?.login as string) || 'unknown',
              sourceBranch: (head?.ref as string) || '',
              targetBranch: (base?.ref as string) || 'main',
              body: (pr.body as string) || null,
              status: (pr.state as string) || 'open',
            },
          });

          await createEvidenceRecord({
            repositoryId,
            eventType: 'WEBHOOK_PR_RECEIVED',
            actor: 'github-webhook',
            payload: {
              prNumber,
              action: prAction,
              repo: repoFullName,
            },
          });
        }

        // Mark as processed
        await db.webhookEvent.update({
          where: { id: event.id },
          data: { processed: true },
        });
      }
    }

    return NextResponse.json({ received: true, eventId: event.id });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
