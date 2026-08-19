import type { Detector, DiffFile, RuleConfig, RuleFinding, FrameworkControl } from '../types';

// Matches fetch(), axios(), http.get/post/request(), urllib.request calls
const HTTP_CALL_RE =
  /(?:fetch|axios|http\.(?:get|post|put|delete|patch|request)|urllib\.request)\s*\(\s*(['"`])([^'"`]+)\1/g;

// Also match template literal URLs (basic)
const TEMPLATE_URL_RE =
  /(?:fetch|axios|http\.(?:get|post|put|delete|patch|request)|urllib\.request)\s*\(\s*[`']([^'`]+)[`']/g;

/**
 * Extract domain from a URL string
 */
function extractDomain(url: string): string | null {
  try {
    // Remove backticks if template literal
    const cleaned = url.replace(/^`|`$/g, '').replace(/^'|'$/g, '').replace(/^"|"$/g, '');
    // Handle cases where URL might start with a variable like `https://...`
    const maybeUrl = cleaned.trim();
    if (!maybeUrl.startsWith('http')) return null;
    const parsed = new URL(maybeUrl);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if a domain matches any allowlist entry (supports wildcards)
 */
function isAllowed(domain: string, allowlist: string[]): boolean {
  for (const entry of allowlist) {
    if (entry.includes('*')) {
      // Convert glob-style wildcard to regex
      const regexStr = '^' + entry.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      if (new RegExp(regexStr).test(domain)) return true;
    } else if (domain === entry) {
      return true;
    }
  }
  return false;
}

export const outboundHttpDetector: Detector = {
  name: 'outbound_http',

  detect(file: DiffFile, rule: RuleConfig, context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const allowlist = context?.allowlist ?? [];
    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;

        const content = line.content;

        // Reset regex state
        HTTP_CALL_RE.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = HTTP_CALL_RE.exec(content)) !== null) {
          const url = match[2];
          const domain = extractDomain(url);
          if (!domain) continue;

          if (!isAllowed(domain, allowlist)) {
            findings.push({
              rule_id: rule.id,
              rule_name: rule.name,
              tier: rule.tier,
              file: file.newPath,
              line: line.newLineNumber ?? 0,
              explanation: `Outbound HTTP call to unauthorized domain: ${domain}`,
              suggested_fix: rule.suggested_fix,
              framework_citations: frameworkCitations,
              match_content: content.trim(),
              confidence: 0.8,
            });
          }
        }
      }
    }

    return findings;
  },
};
