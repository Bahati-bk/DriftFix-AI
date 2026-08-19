import type { Detector, DiffFile, RuleConfig, RuleFinding, FrameworkControl, SuggestedFix } from '../types';

const COMMENT_PREFIXES = ['//', '#', '<!--', '*'];
const TEST_MOCK_PATTERNS = [/\b(test|mock|spec|fixture|stub|fake)\b/i, /\.test\./, /\.spec\./, /__tests__/, /__mocks__/];

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return COMMENT_PREFIXES.some((p) => trimmed.startsWith(p));
}

function isTestOrMockFile(filePath: string): boolean {
  return TEST_MOCK_PATTERNS.some((re) => re.test(filePath));
}

function stripInlineFlags(pattern: string): string {
  return pattern.replace(/^\(\?[imsx]+\)/, '');
}

/**
 * Generate a GitHub suggested-change diff for replacing a hardcoded secret.
 */
function generateSecretSuggestion(line: string, rule: RuleConfig): SuggestedFix {
  // Try to extract the variable name and build env var suggestion
  const varMatch = line.match(/(\w+)\s*[:=]\s*/);
  const varName = varMatch ? varMatch[1] : 'value';
  const envName = varName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toUpperCase();

  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  const commentPrefix = line.trimStart().startsWith('//') ? '//' :
    line.trimStart().startsWith('#') ? '#' : '';
  
  if (commentPrefix) {
    return {
      description: rule.suggested_fix,
      github_diff_lines: [
        line.trimStart(),
        `${indent}${commentPrefix} TODO: Use environment variable instead of hardcoded secret`,
        `${indent}${varName}: process.env.${envName},`,
      ],
    };
  }

  return {
    description: rule.suggested_fix,
    github_diff_lines: [
      line.trimStart(),
      `${indent}${varName}: process.env.${envName},`,
    ],
  };
}

/**
 * Generate a GitHub suggested-change diff for CORS wildcard.
 */
function generateCorsSuggestion(line: string, rule: RuleConfig): SuggestedFix {
  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  return {
    description: rule.suggested_fix,
    github_diff_lines: [
      line.trimStart(),
      `${indent}Access-Control-Allow-Origin: 'https://your-allowed-domain.com',`,
    ],
  };
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
      return findings;
    }

    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;
        if (isCommentLine(line.content)) continue;

        regex.lastIndex = 0;
        const match = regex.exec(line.content);
        if (match) {
          // Generate suggested fix object based on rule type
          let suggestedFixObj: SuggestedFix | undefined;
          if (rule.id === 'AUD-002') {
            suggestedFixObj = generateCorsSuggestion(line.content, rule);
          } else {
            suggestedFixObj = generateSecretSuggestion(line.content, rule);
          }

          findings.push({
            rule_id: rule.id,
            rule_name: rule.name,
            tier: rule.tier,
            file: file.newPath,
            line: line.newLineNumber ?? 0,
            explanation: rule.description,
            suggested_fix: rule.suggested_fix,
            suggested_fix_obj: suggestedFixObj,
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
