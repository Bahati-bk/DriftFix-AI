import type { AnalysisResult, ComplianceRulesConfig, DiffFile, RuleFinding } from './types';
import { loadRulesConfig } from './config-loader';
import { parseDiff } from './diff-parser';
import { getDetector } from './detectors';

/**
 * Analyze a unified diff text against compliance rules.
 * Returns findings and a summary.
 */
export async function analyzeDiff(
  diffText: string,
  config?: ComplianceRulesConfig
): Promise<AnalysisResult> {
  const rulesConfig = config ?? loadRulesConfig();
  const files: DiffFile[] = parseDiff(diffText);
  const allFindings: RuleFinding[] = [];

  for (const file of files) {
    for (const rule of rulesConfig.rules) {
      const detector = getDetector(rule.detector);
      if (!detector) continue;

      const findings = detector.detect(file, rule, {
        allowlist: rulesConfig.network_allowlist,
      });
      allFindings.push(...findings);
    }
  }

  const blocking = allFindings.filter((f) => f.tier === 'BLOCKING').length;
  const warning = allFindings.filter((f) => f.tier === 'WARNING').length;
  const info = allFindings.filter((f) => f.tier === 'INFO').length;

  return {
    findings: allFindings,
    summary: {
      total: allFindings.length,
      blocking,
      warning,
      info,
      files_scanned: files.length,
    },
    check_conclusion: blocking > 0 ? 'failure' : 'success',
  };
}
