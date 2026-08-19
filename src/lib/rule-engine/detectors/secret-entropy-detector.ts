import type { Detector, DiffFile, RuleConfig, RuleFinding, FrameworkControl } from '../types';

const COMMENT_PREFIXES = ['//', '#', '<!--', '*'];
const TEST_MOCK_PATTERNS = [/(test|mock|spec|fixture|stub|fake)\b/i, /\.test\./, /\.spec\./, /__tests__/, /__mocks__/];
const SECRET_ASSIGNMENT_RE = /(?:api[_\-]?key|apikey|secret[_\-]?key|password|token|auth[_\-]?token|private[_\-]?key|access[_\-]?key)\s*[:=]\s*/i;
const VALUE_RE = /[:=]\s*([\'\"\`])([^\'\"\`\s]{6,})\1/;
const STRING_LITERAL_RE = /['"`]([a-zA-Z0-9_+\-/.=]{6,})['"`]/g;

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return COMMENT_PREFIXES.some((p) => trimmed.startsWith(p));
}

function isTestOrMockFile(filePath: string): boolean {
  return TEST_MOCK_PATTERNS.some((re) => re.test(filePath));
}

/**
 * Calculate Shannon entropy of a string.
 * Higher entropy → more random/likely a secret.
 * Threshold: ~3.5+ for 8+ char strings is suspicious.
 */
function shannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Detector that combines regex pattern matching with Shannon entropy analysis
 * to identify hardcoded secrets that might not match standard patterns.
 *
 * Two detection modes:
 * 1. Pattern + Entropy: Lines matching secret assignment patterns where the value has high entropy
 * 2. High-Entropy Standalone: String literals with very high entropy (4.0+) that look like secrets
 */
export const secretEntropyDetector: Detector = {
  name: 'secret_entropy',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];

    if (isTestOrMockFile(file.newPath)) return findings;

    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;
        if (isCommentLine(line.content)) continue;

        const content = line.content;

        // Mode 1: Check for secret assignment pattern + high entropy value
        const assignmentMatch = content.match(SECRET_ASSIGNMENT_RE);
        if (assignmentMatch) {
          const valueMatch = content.match(VALUE_RE);
          if (valueMatch) {
            const value = valueMatch[2];
            const entropy = shannonEntropy(value);
            // Threshold: 3.0+ entropy for values 8+ chars, or 3.5+ for shorter
            const threshold = value.length >= 8 ? 3.0 : 3.5;
            if (entropy >= threshold) {
              const maskedValue = value.length > 8
                ? value.slice(0, 4) + '•'.repeat(8) + value.slice(-4)
                : value.slice(0, 2) + '•'.repeat(value.length - 2);

              findings.push({
                rule_id: rule.id,
                rule_name: rule.name,
                tier: rule.tier,
                file: file.newPath,
                line: line.newLineNumber ?? 0,
                explanation: `High-entropy secret detected (entropy: ${entropy.toFixed(2)}). ` +
                  `Value "${maskedValue}" appears to be a hardcoded secret assigned to a sensitive key.`,
                suggested_fix: rule.suggested_fix,
                framework_citations: frameworkCitations,
                match_content: content.trim(),
                confidence: Math.min(0.95, 0.6 + entropy * 0.08),
              });
              continue; // Don't double-flag this line
            }
          }
        }

        // Mode 2: Scan for standalone high-entropy string literals
        // that aren't part of a known assignment pattern
        STRING_LITERAL_RE.lastIndex = 0;
        let strMatch;
        while ((strMatch = STRING_LITERAL_RE.exec(content)) !== null) {
          const value = strMatch[1];
          // Skip common non-secret patterns
          if (/^(http|https|mailto|file|data):\/\//i.test(value)) continue;
          if (/^\d+\.\d+\.\d+/.test(value)) continue; // versions
          if (/^[a-z]+(\s+[a-z]+)*$/i.test(value)) continue; // plain words
          if (value.length < 8) continue; // too short for entropy check

          const entropy = shannonEntropy(value);
          if (entropy >= 4.0) {
            // Avoid double-flagging if we already found this line
            if (findings.some((f) => f.line === (line.newLineNumber ?? 0) && f.file === file.newPath)) continue;

            const maskedValue = value.slice(0, 4) + '•'.repeat(8) + value.slice(-4);
            findings.push({
              rule_id: rule.id,
              rule_name: rule.name,
              tier: rule.tier,
              file: file.newPath,
              line: line.newLineNumber ?? 0,
              explanation: `High-entropy string literal detected (entropy: ${entropy.toFixed(2)}). ` +
                `Value "${maskedValue}" may be a hardcoded secret or credential.`,
              suggested_fix: rule.suggested_fix,
              framework_citations: frameworkCitations,
              match_content: content.trim(),
              confidence: Math.min(0.85, 0.4 + entropy * 0.1),
            });
          }
        }
      }
    }

    return findings;
  },
};
