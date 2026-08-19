/**
 * DriftFix GitHub Action — Compliance Check
 *
 * This action analyzes a PR diff against YAML-driven compliance rules
 * (SOC2, GDPR, HIPAA) and:
 *   1. Creates a GitHub Check with success/failure conclusion
 *   2. Posts inline PR comments for WARNING and INFO findings
 *   3. Sets action outputs for downstream workflows
 *
 * Usage:
 *   - uses: ./github-action
 *     with:
 *       diff: ${{ steps.diff.outputs.diff }}
 *       github_token: ${{ secrets.GITHUB_TOKEN }}
 *       framework: soc2
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

// ── Types (mirrored from rule-engine/types.ts) ──────────────────────────

type ActionTier = 'BLOCKING' | 'WARNING' | 'INFO';

interface FrameworkControl {
  control: string;
  name: string;
}

interface RuleConfig {
  id: string;
  name: string;
  category: string;
  tier: ActionTier;
  description: string;
  detector: string;
  frameworks: Record<string, FrameworkControl>;
  pattern?: string;
  suggested_fix: string;
}

interface ComplianceRulesConfig {
  version: string;
  rules: RuleConfig[];
}

interface RuleFinding {
  rule_id: string;
  rule_name: string;
  tier: ActionTier;
  file: string;
  line: number;
  explanation: string;
  suggested_fix: string;
  framework_citations: FrameworkControl[];
  match_content: string;
  confidence: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a markdown-formatted check annotation for a single finding.
 * Used in the GitHub Check output summary.
 */
function formatAnnotation(f: RuleFinding): string {
  const tierEmoji = f.tier === 'BLOCKING' ? ':no_entry:' : f.tier === 'WARNING' ? ':warning:' : ':information_source:';
  const citations = f.framework_citations.map((c) => `${c.control}: ${c.name}`).join(', ');
  return [
    `${tierEmoji} **${f.rule_id}** — ${f.rule_name} (${f.tier})`,
    `   File: \`${f.file}:${f.line}\``,
    `   Matched: \`${f.match_content.replace(/[`\\]/g, '\\$&')}\``,
    `   ${f.explanation}`,
    `   Fix: ${f.suggested_fix}`,
    citations ? `   Frameworks: ${citations}` : '',
    '',
  ].join('\n');
}

/**
 * Build the full markdown summary for the GitHub Check.
 */
function buildCheckSummary(findings: RuleFinding[]): string {
  const blocking = findings.filter((f) => f.tier === 'BLOCKING');
  const warning = findings.filter((f) => f.tier === 'WARNING');
  const info = findings.filter((f) => f.tier === 'INFO');

  const lines: string[] = [
    '# DriftFix Compliance Check',
    '',
    `| Tier | Count |`,
    `|------|-------|`,
    `| :no_entry: BLOCKING | ${blocking.length} |`,
    `| :warning: WARNING | ${warning.length} |`,
    `| :information_source: INFO | ${info.length} |`,
    `| **Total** | **${findings.length}** |`,
    '',
  ];

  if (blocking.length > 0) {
    lines.push('## BLOCKING Findings', '');
    blocking.forEach((f) => lines.push(formatAnnotation(f)));
  }

  return lines.join('\n');
}

// ── Main Action Entry Point ──────────────────────────────────────────────

async function run(): Promise<void> {
  try {
    // ── Step 1: Read inputs ─────────────────────────────────────────────
    const diff: string = core.getInput('diff', { required: true });
    const githubToken: string = core.getInput('github_token', { required: true });
    const framework: string = core.getInput('framework') || 'soc2';

    core.info(`Received diff (${diff.length} bytes), framework: ${framework}`);

    // ── Step 2: Load the compliance rules YAML config ───────────────────
    // In production, this reads from the repo root or a configurable path.
    // The action looks for `compliance-rules.yaml` in the repository workspace.
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const configPath = resolve(workspace, 'compliance-rules.yaml');

    let rulesConfig: ComplianceRulesConfig;
    try {
      const raw = readFileSync(configPath, 'utf-8');
      rulesConfig = parseYaml(raw) as ComplianceRulesConfig;
      core.info(`Loaded ${rulesConfig.rules.length} rules from compliance-rules.yaml (v${rulesConfig.version})`);
    } catch (err) {
      core.setFailed(`Failed to load compliance-rules.yaml: ${err}`);
      return;
    }

    // ── Step 3: Run the rule engine analysis ─────────────────────────────
    // Import the rule engine. In the bundled action, this resolves to the
    // compiled output that includes the engine, detectors, and config loader.
    //
    // The engine parses the unified diff, runs each enabled detector against
    // every file's added lines, and returns structured findings.
    const { analyzeDiff } = await import('../../src/lib/rule-engine/engine');
    const result = await analyzeDiff(diff, rulesConfig);

    core.info(`Analysis complete: ${result.summary.total} findings (${result.summary.blocking} blocking)`);

    // ── Step 4: Set action outputs ───────────────────────────────────────
    core.setOutput('blocking_count', String(result.summary.blocking));
    core.setOutput('warning_count', String(result.summary.warning));
    core.setOutput('info_count', String(result.summary.info));
    core.setOutput('check_conclusion', result.check_conclusion);

    // ── Step 5: Create a GitHub Check with the analysis results ─────────
    // The check conclusion is 'failure' if any BLOCKING findings exist,
    // otherwise 'success'. This controls whether the PR merge is blocked.
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    // Create the check run
    const check = await octokit.rest.checks.create({
      ...context.repo,
      name: 'DriftFix Compliance',
      head_sha: context.payload.pull_request?.head?.sha || context.sha,
      status: 'completed',
      conclusion: result.check_conclusion === 'failure' ? 'failure' : 'success',
      output: {
        title: result.check_conclusion === 'failure'
          ? `${result.summary.blocking} blocking finding(s) detected`
          : 'All compliance checks passed',
        summary: buildCheckSummary(result.findings),
        annotations: result.findings
          .filter((f) => f.tier === 'BLOCKING')
          .map((f) => ({
            path: f.file,
            start_line: f.line,
            end_line: f.line,
            annotation_level: 'failure' as const,
            message: `[${f.rule_id}] ${f.rule_name}: ${f.explanation}`,
            title: `${f.rule_id} — ${f.rule_name} [${f.tier}]`,
          })),
      },
    });

    core.info(`Created check run: ${check.data.html_url}`);

    // ── Step 6: Post inline PR comments for WARNING and INFO findings ───
    // BLOCKING findings are shown as check annotations (above). Non-blocking
    // findings are posted as PR review comments so they're visible inline.
    const nonBlockingFindings = result.findings.filter(
      (f) => f.tier === 'WARNING' || f.tier === 'INFO',
    );

    if (context.payload.pull_request?.number && nonBlockingFindings.length > 0) {
      const prNumber = context.payload.pull_request.number;

      // Group findings by file for efficient comment posting
      const commentsByFile = new Map<string, RuleFinding[]>();
      for (const f of nonBlockingFindings) {
        const existing = commentsByFile.get(f.file) || [];
        existing.push(f);
        commentsByFile.set(f.file, existing);
      }

      for (const [filePath, findings] of commentsByFile) {
        // Post each finding as a separate inline comment on the PR diff
        for (const f of findings) {
          try {
            await octokit.rest.pulls.createReviewComment({
              ...context.repo,
              pull_number: prNumber,
              path: filePath,
              line: f.line,
              body: [
                `**${f.tier === 'WARNING' ? '⚠️' : 'ℹ️'} ${f.rule_id}: ${f.rule_name}**`,
                '',
                f.explanation,
                '',
                `**Suggested fix:** ${f.suggested_fix}`,
                f.framework_citations.length > 0
                  ? `**Frameworks:** ${f.framework_citations.map((c) => `${c.control}`).join(', ')}`
                  : '',
              ].join('\n'),
            });
          } catch (commentErr) {
            // Inline comments can fail if the line doesn't exist in the diff.
            // Log but don't fail the action.
            core.warning(`Failed to post comment on ${filePath}:${f.line}: ${commentErr}`);
          }
        }
      }

      core.info(`Posted ${nonBlockingFindings.length} inline review comments`);
    }

    // ── Step 7: Final status ─────────────────────────────────────────────
    if (result.check_conclusion === 'failure') {
      core.setFailed(
        `Compliance check failed: ${result.summary.blocking} blocking finding(s) found. Resolve them before merging.`,
      );
    } else {
      core.info('Compliance check passed. No blocking findings detected.');
    }
  } catch (error) {
    // Catch any unhandled errors and fail the action gracefully
    core.setFailed(`Action failed: ${error}`);
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

run();
