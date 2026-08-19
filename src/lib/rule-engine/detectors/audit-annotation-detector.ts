import type { Detector, DiffFile, RuleConfig, RuleFinding, FrameworkControl } from '../types';

/**
 * Detects sensitive operation handlers (delete, payment, auth, admin, export)
 * that are missing audit logging calls.
 *
 * Looks for:
 * - Function definitions with sensitive keywords (delete, remove, payment, charge, login, auth, admin, export)
 * - Checks if the function body (within the diff) contains audit/log/tracking calls
 * - If no audit call found, flags as INFO
 */

const SENSITIVE_KEYWORDS = [
  /delete/i, /remove/i, /destroy/i, /drop/i,
  /payment/i, /charge/i, /refund/i, /billing/i,
  /login/i, /auth/i, /logout/i, /password/i,
  /admin/i, /sudo/i, /elevate/i, /impersonate/i,
  /export/i, /download/i, /bulk/i, /mass/i,
];

const AUDIT_INDICATORS = [
  /audit/i, /log\(/i, /logger/i, /telemetry/i, /track/i, /event\(/i,
  /record\(/i, /audit_log/i, /AuditLog/i, /activityLog/i, /AuditTrail/i,
];

const FUNCTION_DEF_RE = /(?:async\s+)?(?:function\s+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?)\(?/;

function isSensitiveFunction(line: string): boolean {
  const trimmed = line.trim();
  // Must be a function definition line
  if (!FUNCTION_DEF_RE.test(trimmed)) return false;
  return SENSITIVE_KEYWORDS.some((re) => re.test(trimmed));
}

function hasAuditCall(lines: string[]): boolean {
  // Check up to 20 lines after the function def for audit indicators
  const checkLines = lines.slice(0, 20);
  return checkLines.some((line) => AUDIT_INDICATORS.some((re) => re.test(line)));
}

const COMMENT_PREFIXES = ['//', '#', '<!--', '*'];
function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return COMMENT_PREFIXES.some((p) => trimmed.startsWith(p));
}

export const auditAnnotationDetector: Detector = {
  name: 'audit_annotation',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);

    // Skip test files and config files
    if (/\.(test|spec)\.[jt]sx?$/.test(file.newPath)) return findings;
    if (/(?:jest|vitest|__tests__)/i.test(file.newPath)) return findings;

    for (const hunk of file.hunks) {
      const addLines = hunk.lines.filter((l) => l.type === 'add');
      const allAddContent = addLines.map((l) => l.content);

      for (let i = 0; i < addLines.length; i++) {
        const line = addLines[i];
        if (isCommentLine(line.content)) continue;

        if (isSensitiveFunction(line.content)) {
          // Get lines after this function def to check for audit calls
          const subsequentLines = allAddContent.slice(i + 1);
          const hasAudit = hasAuditCall(subsequentLines);

          if (!hasAudit) {
            // Extract function name
            const nameMatch = line.content.match(/(?:function\s+|(?:const|let|var)\s+)(\w+)/);
            const funcName = nameMatch ? nameMatch[1] : 'unnamed';

            findings.push({
              rule_id: rule.id,
              rule_name: rule.name,
              tier: rule.tier,
              file: file.newPath,
              line: line.newLineNumber ?? 0,
              explanation: `Sensitive function "${funcName}" detected without audit logging. ` +
                `Add an audit log call within this handler for compliance traceability.`,
              suggested_fix: rule.suggested_fix,
              framework_citations: frameworkCitations,
              match_content: line.content.trim(),
              confidence: 0.75,
            });
          }
        }
      }
    }

    return findings;
  },
};
