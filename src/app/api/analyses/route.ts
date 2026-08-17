import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateRules, type DiffContext } from '@/lib/compliance/rules';
import { analyzeWithAI } from '@/lib/ai/provider';
import { calculateComplianceScore } from '@/lib/compliance/scoring';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pullRequestId, diff, files } = body;

    if (!pullRequestId) {
      return NextResponse.json({ error: 'pullRequestId is required' }, { status: 400 });
    }

    const pullRequest = await db.pullRequest.findUnique({
      where: { id: pullRequestId },
      include: { repository: true },
    });

    if (!pullRequest) {
      return NextResponse.json({ error: 'Pull request not found' }, { status: 404 });
    }

    const startTime = Date.now();

    // Create the analysis run in pending state
    const analysisRun = await db.analysisRun.create({
      data: {
        pullRequestId,
        status: 'running',
      },
    });

    // Build diff contexts for the rules engine
    const diffContexts: DiffContext[] = [];
    if (files && Array.isArray(files)) {
      for (const file of files) {
        diffContexts.push({
          diff: file.diff || '',
          filePath: file.path,
        });
      }
    } else if (diff) {
      // Parse unified diff into per-file contexts
      const fileDiffs = diff.split(/^(?=diff --git )/m).filter(Boolean);
      for (const fileDiff of fileDiffs) {
        const pathMatch = fileDiff.match(/^diff --git\s+a\/.+?\s+b\/(.+)$/m);
        const filePath = pathMatch ? pathMatch[1] : 'unknown';
        diffContexts.push({ diff: fileDiff, filePath });
      }
    }

    // Get enabled rules from DB, fall back to all rules
    const dbRules = await db.rule.findMany({ where: { enabled: true } });
    const enabledRuleNames = dbRules.length > 0 ? dbRules.map(r => r.name) : undefined;

    // Step 1: Run the rules engine
    const ruleResult = evaluateRules(diffContexts, enabledRuleNames);

    // Step 2: Run AI analysis with rule engine results
    const prTitle = pullRequest.title;
    const prBody = pullRequest.body || undefined;
    const fullDiff = diff || (files || []).map(f => f.diff || '').join('\n');
    const filePaths = diffContexts.map(ctx => ctx.filePath);

    const aiResult = await analyzeWithAI({
      prTitle,
      prBody,
      diff: fullDiff,
      filePaths,
      candidateFindings: ruleResult.findings,
      frameworks: ['SOC2', 'GDPR'],
    });

    // Step 3: Persist findings and compliance mappings
    const createdFindings = [];

    for (const aiFinding of aiResult.findings) {
      const finding = await db.finding.create({
        data: {
          analysisRunId: analysisRun.id,
          category: aiFinding.category,
          title: aiFinding.title,
          description: aiFinding.description,
          severity: aiFinding.severity,
          confidence: aiFinding.confidence,
          status: 'OPEN',
          filePath: aiFinding.file || null,
          lineStart: aiFinding.line_start || null,
          lineEnd: aiFinding.line_end || null,
          evidence: aiFinding.evidence || null,
          impact: aiFinding.impact || null,
          recommendation: aiFinding.recommendation || null,
          aiExplanation: `AI confidence: ${Math.round(aiFinding.confidence * 100)}%`,
          suggestedFix: aiFinding.suggested_fix || null,
          complianceMappings: {
            create: (aiFinding.compliance_mappings || []).map((m: Record<string, unknown>) => ({
              framework: String(m.framework || 'SOC2'),
              control: String(m.control || 'N/A'),
              controlName: m.control_name ? String(m.control_name) : null,
              rationale: m.reason ? String(m.reason) : null,
            })),
          },
        },
        include: { complianceMappings: true },
      });
      createdFindings.push(finding);
    }

    // Step 4: Calculate compliance score
    const allFindingsForScore = createdFindings.map(f => ({
      severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      confidence: f.confidence,
      status: f.status,
    }));
    const score = calculateComplianceScore(allFindingsForScore);

    const durationMs = Date.now() - startTime;

    // Step 5: Update analysis run with results
    const updatedRun = await db.analysisRun.update({
      where: { id: analysisRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        durationMs,
        score,
        filesAnalyzed: diffContexts.length,
        findingsCount: createdFindings.length,
        summary: aiResult.summary,
      },
      include: {
        findings: { include: { complianceMappings: true } },
        pullRequest: { include: { repository: true } },
      },
    });

    // Step 6: Create evidence record
    await createEvidenceRecord({
      organizationId: pullRequest.repository?.organizationId,
      repositoryId: pullRequest.repositoryId,
      eventType: 'ANALYSIS_COMPLETED',
      actor: 'system',
      payload: {
        analysisRunId: analysisRun.id,
        pullRequestId,
        score,
        findingsCount: createdFindings.length,
        durationMs,
      },
    });

    // Step 7: Record compliance score history
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekLabel = weekStart.toISOString().split('T')[0];

    await db.complianceScoreHistory.create({
      data: {
        organizationId: pullRequest.repository?.organizationId,
        repositoryId: pullRequest.repositoryId,
        score,
        weekLabel,
      },
    });

    return NextResponse.json({ analysisRun: updatedRun }, { status: 201 });
  } catch (error) {
    console.error('Create analysis error:', error);
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }
}
