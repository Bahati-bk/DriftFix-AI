export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type FindingStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED' | 'ACCEPTED_RISK';
export type FindingCategory =
  | 'PII_LOGGING'
  | 'HARDCODED_SECRETS'
  | 'INSECURE_CORS'
  | 'MISSING_AUTH'
  | 'MISSING_RATE_LIMIT'
  | 'SENSITIVE_DATA_EXPOSURE'
  | 'WEAK_ENCRYPTION'
  | 'DANGEROUS_DEPENDENCY';

export interface CandidateFinding {
  title: string;
  description: string;
  severity: Severity;
  confidence: number;
  category: FindingCategory;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  evidence: string;
  impact: string;
  recommendation: string;
  suggestedFix?: string;
  complianceMappings: {
    framework: string;
    control: string;
    controlName: string;
    rationale: string;
  }[];
  autofixAvailable: boolean;
}

export interface RuleResult {
  findings: CandidateFinding[];
}

export interface DiffContext {
  diff: string;
  filePath: string;
  fileContent?: string;
}

const PII_PATTERNS = [
  /(?:logger|console|log|print|write|writelog)\s*\(\s*[^)]*(?:email|phone|ssn|social.?security|national.?id|passport|address|zipcode|zip|credit.?card|dob|date.?of.?birth)/i,
  /(?:email|phone|ssn|social.?security|national.?id|passport|address|zipcode|zip|credit.?card|dob|date.?of.?birth)\s*(?::|=|,)\s*[^\n]*(?:logger|console|log|print|write)/i,
  /log(?:ger|Info|Debug|Warn|Error)?\s*\([^)]*(?:user\.(?:email|phone|ssn|address|name|id))[^)]*\)/i,
  /console\.(?:log|info|debug|warn|error)\s*\([^)]*(?:user\.(?:email|phone|ssn|address|name))[^)]*\)/i,
];

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']([a-zA-Z0-9_]{20,})["']/i,
  /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/i,
  /(?:secret|token|access[_-]?token|auth[_-]?token)\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{20,}["']/i,
  /(?:private[_-]?key|ssh[_-]?key)\s*[:=]\s*["']-----BEGIN[\s\S]*?-----END[\s\S]*?["']/i,
  /sk_live_[a-zA-Z0-9]{24,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /xox[bposa]-[a-zA-Z0-9\-]{10,}/,
  /AKIA[A-Z0-9]{16}/,
];

const CORS_PATTERNS = [
  /origin\s*[:=]\s*["']\*["']/i,
  /Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*["']/i,
  /cors\(\s*\{[^}]*origin\s*:\s*["']\*["']/i,
  /app\.use\(\s*cors\s*\(\s*\)\s*\)/i,
];

const AUTH_PATTERNS = [
  /@app\.(?:get|post|put|delete|patch)\s*\(["'](?:\/api\/)?(?:admin|user|settings|config|secret|internal)/i,
  /router\.(?:get|post|put|delete|patch)\s*\(["'](?:\/api\/)?(?:admin|user|settings|config|secret|internal)/i,
];

const RATE_LIMIT_PATTERNS = [
  /@app\.(?:get|post|put|delete|patch)\s*\(["'](?:\/api\/)?(?:login|auth|register|signup|password)/i,
  /router\.(?:get|post|put|delete|patch)\s*\(["'](?:\/api\/)?(?:login|auth|register|signup|password)/i,
];

const SENSITIVE_DATA_PATTERNS = [
  /(?:password|secret|token|key|credential)\s*(?::|\.)?toJSON|to_dict|serialize|json\(/i,
  /(?:return|response|res\.json|json\()\s*\(\s*\{[^}]*(?:password|secret|token|api_key)[^}]*\}/i,
  /(?:raise|throw)\s+\w+Error\s*\([^)]*(?:password|secret|token|api_key|credential)[^)]*\)/i,
];

const ENCRYPTION_PATTERNS = [
  /http:\/\//i,
  /md5\s*\(/i,
  /sha1\s*\(/i,
  /verify\s*=\s*false/i,
  /rejectUnauthorized\s*:\s*false/i,
  /tls\s*:\s*\{[^}]*rejectUnauthorized\s*:\s*false/i,
  /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0/i,
  /DES|RC4|ECB|Blowfish/i,
];

const DEPENDENCY_PATTERNS = [
  /^\+\s*(?:"|')?lodash\s*@[<>=~^]?0\./,
  /^\+\s*(?:"|')?moment\s*@[<>=~^]?2\./,
  /^\+\s*(?:"|')?express\s*@[<>=~^]?3\./,
];

function findLineMatches(content: string, patterns: RegExp[]): { line: number; match: string }[] {
  const lines = content.split('\n');
  const results: { line: number; match: string }[] = [];
  lines.forEach((line, idx) => {
    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (m) {
        results.push({ line: idx + 1, match: m[0].substring(0, 200) });
      }
    }
  });
  return results;
}

export const rules = [
  {
    name: 'PII_LOGGING' as const,
    title: 'Potential PII exposure in application logs',
    description: 'Sensitive personal information appears to be written to application logs.',
    severity: 'HIGH' as Severity,
    patterns: PII_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.1', controlName: 'Logical & Physical Access Controls', rationale: 'Sensitive information should be appropriately protected from unauthorized access through logging.' },
      { framework: 'SOC2', control: 'P1.2', controlName: 'Privacy Notice', rationale: "Personal data processing must comply with the organization's privacy notice." },
      { framework: 'GDPR', control: 'Art.5(1)(c)', controlName: 'Data Minimisation', rationale: 'Personal data should be limited to what is necessary for the processing purpose.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Appropriate technical measures must protect personal data.' },
    ],
    impact: 'User personal data may become accessible through application logs, potentially violating privacy regulations and exposing sensitive information to unauthorized parties.',
    recommendation: 'Remove the sensitive value from the log statement. Log a non-sensitive user identifier instead (e.g., user ID, hashed identifier).',
    autofixAvailable: true,
  },
  {
    name: 'HARDCODED_SECRETS' as const,
    title: 'Hardcoded secret or credential detected',
    description: 'A secret, API key, or credential appears to be embedded directly in source code.',
    severity: 'CRITICAL' as Severity,
    patterns: SECRET_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.1', controlName: 'Logical & Physical Access Controls', rationale: 'Credentials must be properly managed and not exposed in source code.' },
      { framework: 'SOC2', control: 'CC6.6', controlName: 'Data Encryption', rationale: 'Secrets in source code undermine encryption and key management controls.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Hardcoded secrets compromise the security of personal data processing.' },
    ],
    impact: 'Credentials committed to source control may be exposed to unauthorized users, enabling unauthorized access to the associated service.',
    recommendation: 'Move the credential into an environment variable, secret manager, or secure configuration system.',
    autofixAvailable: true,
  },
  {
    name: 'INSECURE_CORS' as const,
    title: 'Insecure CORS configuration detected',
    description: 'CORS is configured to allow all origins, potentially with credentials enabled.',
    severity: 'HIGH' as Severity,
    patterns: CORS_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.1', controlName: 'Logical & Physical Access Controls', rationale: 'Overly permissive CORS undermines access control boundaries.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Insecure CORS can lead to unauthorized data access.' },
    ],
    impact: 'Allowing any origin to access the API enables cross-site request forgery and data exfiltration from unauthorized domains.',
    recommendation: 'Restrict the allowed origins to specific trusted domains. If credentials are involved, never use the wildcard origin.',
    autofixAvailable: true,
  },
  {
    name: 'MISSING_AUTH' as const,
    title: 'Sensitive endpoint may lack authentication',
    description: 'A sensitive API endpoint appears to be defined without visible authentication middleware.',
    severity: 'HIGH' as Severity,
    patterns: AUTH_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.1', controlName: 'Logical & Physical Access Controls', rationale: 'Sensitive operations must require authentication.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Access to personal data must be controlled.' },
    ],
    impact: 'Unauthenticated access to sensitive endpoints could allow unauthorized data access or modification.',
    recommendation: 'Add authentication middleware or decorators to the endpoint. Verify the user is authorized before processing the request.',
    autofixAvailable: false,
  },
  {
    name: 'MISSING_RATE_LIMIT' as const,
    title: 'Authentication endpoint may lack rate limiting',
    description: 'An authentication-related endpoint appears without visible rate limiting protection.',
    severity: 'MEDIUM' as Severity,
    patterns: RATE_LIMIT_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.1', controlName: 'Logical & Physical Access Controls', rationale: 'Rate limiting protects against brute-force attacks on authentication.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Protecting authentication endpoints safeguards personal data.' },
    ],
    impact: 'Without rate limiting, authentication endpoints are vulnerable to brute-force and credential stuffing attacks.',
    recommendation: 'Implement rate limiting on authentication endpoints using a middleware or library. Consider account lockout after repeated failures.',
    autofixAvailable: false,
  },
  {
    name: 'SENSITIVE_DATA_EXPOSURE' as const,
    title: 'Sensitive data may be exposed in responses or errors',
    description: 'Sensitive fields like passwords, tokens, or secrets appear to be included in API responses or error messages.',
    severity: 'CRITICAL' as Severity,
    patterns: SENSITIVE_DATA_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.6', controlName: 'Data Encryption', rationale: 'Sensitive data must not be exposed through API responses.' },
      { framework: 'SOC2', control: 'P1.2', controlName: 'Privacy Notice', rationale: 'Exposing personal data in responses may violate privacy commitments.' },
      { framework: 'GDPR', control: 'Art.5(1)(c)', controlName: 'Data Minimisation', rationale: 'Only necessary data should be returned in responses.' },
    ],
    impact: 'Sensitive data exposure in API responses or errors can lead to unauthorized access to credentials and personal information.',
    recommendation: 'Exclude sensitive fields from serialization. Use DTOs or view models that only include safe fields. Sanitize error messages.',
    autofixAvailable: false,
  },
  {
    name: 'WEAK_ENCRYPTION' as const,
    title: 'Weak encryption or insecure transport detected',
    description: 'The code uses weak cryptographic algorithms or insecure transport protocols.',
    severity: 'HIGH' as Severity,
    patterns: ENCRYPTION_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC6.6', controlName: 'Data Encryption', rationale: 'Strong encryption must be used for data protection.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Appropriate encryption is required for personal data protection.' },
    ],
    impact: 'Weak encryption algorithms or insecure transport can allow interception, tampering, or unauthorized access to sensitive data.',
    recommendation: 'Use HTTPS exclusively. Replace weak algorithms (MD5, SHA1) with strong alternatives (SHA-256, bcrypt). Never disable TLS verification.',
    autofixAvailable: true,
  },
  {
    name: 'DANGEROUS_DEPENDENCY' as const,
    title: 'Potentially dangerous or outdated dependency detected',
    description: 'A dependency with known security issues or deprecated status is being added.',
    severity: 'MEDIUM' as Severity,
    patterns: DEPENDENCY_PATTERNS,
    complianceMappings: [
      { framework: 'SOC2', control: 'CC7.1', controlName: 'System Monitoring', rationale: 'Dependencies must be monitored for security vulnerabilities.' },
      { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Vulnerable dependencies can compromise the security of processing.' },
    ],
    impact: 'Outdated or vulnerable dependencies can introduce known security vulnerabilities into the application.',
    recommendation: 'Update the dependency to the latest stable version. If an upgrade is not possible, document the risk and consider alternative packages.',
    autofixAvailable: false,
  },
];

export function evaluateRules(contexts: DiffContext[], enabledRules?: string[]): RuleResult {
  const findings: CandidateFinding[] = [];
  const enabledRuleNames = enabledRules || rules.map(r => r.name);

  for (const ctx of contexts) {
    const content = ctx.diff || ctx.fileContent || '';
    if (!content.trim()) continue;

    for (const rule of rules) {
      if (!enabledRuleNames.includes(rule.name)) continue;
      const matches = findLineMatches(content, rule.patterns);
      for (const match of matches) {
        findings.push({
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          confidence: 0.85,
          category: rule.name,
          filePath: ctx.filePath,
          lineStart: match.line,
          lineEnd: match.line,
          evidence: match.match,
          impact: rule.impact,
          recommendation: rule.recommendation,
          complianceMappings: rule.complianceMappings,
          autofixAvailable: rule.autofixAvailable,
        });
      }
    }
  }

  return { findings };
}
