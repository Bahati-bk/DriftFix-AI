import { NextRequest, NextResponse } from 'next/server';
import { analyzeDiff } from '@/lib/rule-engine/engine';
import { loadRulesConfig, loadFrameworkConfig } from '@/lib/rule-engine/config-loader';
import { db } from '@/lib/db';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

const OVERAGE_RATE_CENTS_PER_PR = 50; // $0.50 per overage PR

const TIER_TO_SEVERITY: Record<string, string> = {
  BLOCKING: 'HIGH',
  WARNING: 'MEDIUM',
  INFO: 'LOW',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { diff, framework } = body as { diff?: string; framework?: string };

    if (!diff || typeof diff !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "diff" field' }, { status: 400 });
    }

    // Usage limit check (demo-friendly middleware)
    const firstOrgForCheck = await db.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { subscription: true },
    });
    if (firstOrgForCheck) {
      const subStatus = firstOrgForCheck.subscription?.status ?? 'free';
      if (subStatus === 'free') {
        const month = getCurrentMonth();
        const usage = await db.usageRecord.findUnique({
          where: { organizationId_month: { organizationId: firstOrgForCheck.id, month } },
        });
        if (usage && usage.prsAnalyzed >= 50) {
          return NextResponse.json(
            {
              error: 'Usage limit exceeded',
              message: `You have reached the 50 PR analysis limit for this month on the Free plan. Please upgrade to Pro for unlimited analyses.`,
              prsAnalyzed: usage.prsAnalyzed,
              limit: 50,
            },
            { status: 429 }
          );
        }
      }
    }

    const rulesConfig = framework ? loadFrameworkConfig(framework) : loadRulesConfig();
    const result = await analyzeDiff(diff, rulesConfig);

    // Persist to database: create an AnalysisRun linked to the first repo
    const firstRepo = await db.repository.findFirst({ orderBy: { createdAt: 'asc' } });
    if (firstRepo) {
      // Find or create a placeholder PR for the analysis
      let pr = await db.pullRequest.findFirst({
        where: { repositoryId: firstRepo.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!pr) {
        pr = await db.pullRequest.create({
          data: {
            repositoryId: firstRepo.id,
            number: 0,
            title: 'Direct diff analysis',
            author: 'system',
            sourceBranch: 'analysis',
            targetBranch: 'main',
            status: 'closed',
          },
        });
      }

      const analysisRun = await db.analysisRun.create({
        data: {
          pullRequestId: pr.id,
          status: result.check_conclusion === 'failure' ? 'failed' : 'completed',
          completedAt: new Date(),
          durationMs: 0,
          score: Math.max(0, 100 - result.summary.blocking * 20 - result.summary.warning * 5),
          filesAnalyzed: result.summary.files_scanned,
          findingsCount: result.summary.total,
          summary: JSON.stringify(result.summary),
        },
      });

      // Create Finding records
      for (const finding of result.findings) {
        const ruleConfig = rulesConfig.rules.find((r) => r.id === finding.rule_id);
        const frameworkEntries = ruleConfig?.frameworks ?? {};

        const createdFinding = await db.finding.create({
          data: {
            analysisRunId: analysisRun.id,
            category: finding.rule_id.split('-')[0],
            title: finding.rule_name,
            description: finding.explanation,
            severity: TIER_TO_SEVERITY[finding.tier] ?? 'LOW',
            confidence: finding.confidence,
            filePath: finding.file,
            lineStart: finding.line,
            evidence: finding.match_content,
            suggestedFix: finding.suggested_fix,
            actionLevel: finding.tier,
          },
        });

        // Create ComplianceMapping records for each framework citation
        for (const citation of finding.framework_citations) {
          const frameworkKey = Object.keys(frameworkEntries).find((key) => {
            const fc = frameworkEntries[key];
            return fc?.control === citation.control && fc?.name === citation.name;
          }) ?? 'unknown';

          await db.complianceMapping.create({
            data: {
              findingId: createdFinding.id,
              framework: frameworkKey,
              control: citation.control,
              controlName: citation.name,
            },
          });
        }
      }

      // Create an EvidenceRecord for the analysis
      await createEvidenceRecord({
        repositoryId: firstRepo.id,
        eventType: 'DIFF_ANALYSIS',
        actor: 'system',
        payload: {
          analysisRunId: analysisRun.id,
          framework: framework ?? 'all',
          check_conclusion: result.check_conclusion,
          summary: result.summary,
        },
      });

      // Increment usage counter
      const org = await db.organization.findFirst({
        where: { id: firstRepo.organizationId },
        include: { subscription: true },
      });
      if (org) {
        const month = getCurrentMonth();
        const subStatus = org.subscription?.status ?? 'free';
        const prsIncluded = subStatus === 'pro' || subStatus === 'enterprise' ? -1 : 50;

        const existing = await db.usageRecord.findUnique({
          where: { organizationId_month: { organizationId: org.id, month } },
        });

        const newPrsAnalyzed = (existing?.prsAnalyzed ?? 0) + 1;
        const overagePrs = prsIncluded > 0 && newPrsAnalyzed > prsIncluded ? newPrsAnalyzed - prsIncluded : 0;
        const overageCostCents = overagePrs * OVERAGE_RATE_CENTS_PER_PR;

        await db.usageRecord.upsert({
          where: { organizationId_month: { organizationId: org.id, month } },
          create: {
            organizationId: org.id,
            month,
            prsAnalyzed: 1,
            prsIncluded,
            overagePrs,
            overageCostCents,
          },
          update: {
            prsAnalyzed: newPrsAnalyzed,
            overagePrs,
            overageCostCents,
          },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('analyze-diff error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
