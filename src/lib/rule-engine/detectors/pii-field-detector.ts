import type { Detector, DiffFile, RuleConfig, RuleFinding, FrameworkControl } from '../types';

const DEFAULT_PII_FIELDS = [
  'email', 'ssn', 'phone', 'address', 'date_of_birth',
  'social_security_number', 'credit_card', 'passport',
];

const ENCRYPTION_ANNOTATIONS = /\b(encrypted|@Encrypted|encrypt:|cipher|aes|field_level_encryption)\b/i;

/**
 * Extract the field name from a line like:
 *   email: string;
 *   ssn: string;
 *   email = '';
 */
function extractFieldName(line: string): string | null {
  const trimmed = line.trim();
  // Match patterns like "fieldName: type" or "fieldName = " or "fieldName string" (Prisma)
  const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=\s]/);
  return match ? match[1].toLowerCase() : null;
}

export const piiFieldDetector: Detector = {
  name: 'pii_field',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];

    const piiFields = rule.pii_fields ?? DEFAULT_PII_FIELDS;

    // Collect all add lines with their index for nearby-line checking
    const addLines: { content: string; lineNum: number; hunkIndex: number; lineIndex: number }[] = [];

    for (let hi = 0; hi < file.hunks.length; hi++) {
      const hunk = file.hunks[hi];
      for (let li = 0; li < hunk.lines.length; li++) {
        const line = hunk.lines[li];
        if (line.type === 'add') {
          addLines.push({
            content: line.content,
            lineNum: line.newLineNumber ?? 0,
            hunkIndex: hi,
            lineIndex: li,
          });
        }
      }
    }

    for (const addLine of addLines) {
      const fieldName = extractFieldName(addLine.content);
      if (!fieldName) continue;

      // Check if the field name matches a PII field
      const matchedPii = piiFields.find((pii) => fieldName.includes(pii) || pii.includes(fieldName));
      if (!matchedPii) continue;

      // Check if this line or nearby lines (within ±2) have encryption annotations
      const hunk = file.hunks[addLine.hunkIndex];
      const startIdx = Math.max(0, addLine.lineIndex - 2);
      const endIdx = Math.min(hunk.lines.length - 1, addLine.lineIndex + 2);

      let hasEncryption = false;
      for (let i = startIdx; i <= endIdx; i++) {
        if (ENCRYPTION_ANNOTATIONS.test(hunk.lines[i].content)) {
          hasEncryption = true;
          break;
        }
      }

      if (!hasEncryption) {
        const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);
        findings.push({
          rule_id: rule.id,
          rule_name: rule.name,
          tier: rule.tier,
          file: file.newPath,
          line: addLine.lineNum,
          explanation: `PII field "${fieldName}" detected without encryption annotation`,
          suggested_fix: rule.suggested_fix,
          framework_citations: frameworkCitations,
          match_content: addLine.content.trim(),
          confidence: 0.85,
        });
      }
    }

    return findings;
  },
};
