import type { Detector, DiffFile, RuleConfig, RuleFinding, FrameworkControl } from '../types';

const COMMENT_PREFIXES = ['//', '#', '<!--', '*'];
const TEST_MOCK_PATTERNS = [/\b(test|mock|spec|fixture|stub|fake)\b/i, /\.test\./, /\.spec\./, /__tests__/, /__mocks__/];

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return COMMENT_PREFIXES.some((p) => trimmed.startsWith(p));
}

function isTestOrMockFile(filePath: string): boolean {
  return TEST_MOCK_PATTERNS.some((re) => re.test(filePath));
}

/**
 * Strip inline regex flags like (?i) from pattern since JavaScript RegExp
 * doesn't support them. The 'i' flag is already passed to the RegExp constructor.
 */
function stripInlineFlags(pattern: string): string {
  return pattern.replace(/^\(\?[imsx]+\)/, '');
}

export const secretRegexDetector: Detector = {
  name: 'secret_regex',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];

    if (!rule.pattern) return findings;
    if (isTestOrMockFile(file.newPath)) return findings;

    const cleanedPattern = stripInlineFlags(rule.pattern);
    let regex: RegExp;
    try {
      regex = new RegExp(cleanedPattern, 'gi');
    } catch {
      // Invalid pattern (e.g. unmatched parens) — skip this rule silently
      return findings;
    }

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;
        if (isCommentLine(line.content)) continue;

        regex.lastIndex = 0;
        const match = regex.exec(line.content);
        if (match) {
          const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);
          findings.push({
            rule_id: rule.id,
            rule_name: rule.name,
            tier: rule.tier,
            file: file.newPath,
            line: line.newLineNumber ?? 0,
            explanation: rule.description,
            suggested_fix: rule.suggested_fix,
            framework_citations: frameworkCitations,
            match_content: line.content.trim(),
            confidence: 0.9,
          });
        }
      }
    }

    return findings;
  },
};
