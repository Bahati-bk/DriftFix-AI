import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get the first organization
    const org = await db.organization.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Get all repositories for this org
    const repos = await db.repository.findMany({
      where: { organizationId: org.id },
    });

    const repoIds = repos.map((r) => r.id);
    const totalRepos = repos.length;

    // For each repo, get its latest analysis run and open findings count
    const repoBreakdown: {
      repositoryId: string;
      repoName: string;
      repoOwner: string;
      language: string | null;
      framework: string;
      latestScore: number | null;
      totalFindings: number;
      openFindings: number;
      lastAnalysisAt: string | null;
      health: 'healthy' | 'warning' | 'critical';
    }[] = [];

    const allScores: number[] = [];

    for (const repo of repos) {
      // Get latest completed analysis run
      const latestRun = await db.analysisRun.findFirst({
        where: {
          pullRequest: { repositoryId: repo.id },
          status: 'completed',
        },
        orderBy: { completedAt: 'desc' },
        include: { pullRequest: true },
      });

      // Count total and open findings for this repo
      const runIds = await db.analysisRun
        .findMany({
          where: { pullRequest: { repositoryId: repo.id } },
          select: { id: true },
        })
        .then((runs) => runs.map((r) => r.id));

      const totalFindings = runIds.length > 0
        ? await db.finding.count({ where: { analysisRunId: { in: runIds } } })
        : 0;

      const openFindings = runIds.length > 0
        ? await db.finding.count({ where: { analysisRunId: { in: runIds }, status: 'OPEN' } })
        : 0;

      const latestScore = latestRun?.score ?? null;
      if (latestScore !== null) {
        allScores.push(latestScore);
      }

      // Determine health based on latest score and open findings
      let health: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (latestScore !== null) {
        if (latestScore < 60 || openFindings > 5) {
          health = 'critical';
        } else if (latestScore < 80 || openFindings > 2) {
          health = 'warning';
        }
      } else if (openFindings > 0) {
        health = 'warning';
      }

      repoBreakdown.push({
        repositoryId: repo.id,
        repoName: repo.name,
        repoOwner: repo.owner,
        language: repo.language,
        framework: repo.framework,
        latestScore,
        totalFindings,
        openFindings,
        lastAnalysisAt: latestRun?.completedAt?.toISOString() ?? null,
        health,
      });
    }

    // Calculate overall score (average of latest scores per repo)
    const overallScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;

    // Tier breakdown: count open findings by actionLevel across all repos
    const allRunIds = await db.analysisRun
      .findMany({
        where: { pullRequest: { repositoryId: { in: repoIds } } },
        select: { id: true },
      })
      .then((runs) => runs.map((r) => r.id));

    const openFindingsAll = allRunIds.length > 0
      ? await db.finding.findMany({
          where: { analysisRunId: { in: allRunIds }, status: 'OPEN' },
          select: { actionLevel: true },
        })
      : [];

    const tierBreakdown = {
      blocking: openFindingsAll.filter((f) => f.actionLevel === 'BLOCKING').length,
      warning: openFindingsAll.filter((f) => f.actionLevel === 'WARNING').length,
      info: openFindingsAll.filter((f) => f.actionLevel === 'INFO').length,
    };

    // Recent analyses: last 10 completed analysis runs across all repos
    const recentAnalyses = await db.analysisRun.findMany({
      where: {
        pullRequest: { repositoryId: { in: repoIds } },
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        pullRequest: {
          include: { repository: true },
        },
      },
    });

    const recentAnalysesFormatted = recentAnalyses.map((run) => ({
      id: run.id,
      repoName: run.pullRequest.repository.fullName,
      score: run.score,
      findingsCount: run.findingsCount,
      status: run.status,
      completedAt: run.completedAt?.toISOString() ?? null,
    }));

    // Compliance trend: last 12 ComplianceScoreHistory entries
    const complianceTrend = await db.complianceScoreHistory.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: {
        id: true,
        score: true,
        weekLabel: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      orgName: org.name,
      totalRepos,
      overallScore,
      repoBreakdown,
      tierBreakdown,
      recentAnalyses: recentAnalysesFormatted,
      complianceTrend,
    });
  } catch (error) {
    console.error('Org dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load org dashboard' }, { status: 500 });
  }
}
