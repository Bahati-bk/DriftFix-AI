import type { CandidateFinding } from '@/lib/compliance/rules';
import { redactSecrets } from '@/lib/compliance/evidence';

interface AIAnalysisRequest {
  prTitle: string;
  prBody?: string;
  diff: string;
  filePaths: string[];
  candidateFindings: CandidateFinding[];
  frameworks: string[];
}

interface AIFinding {
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  category: string;
  file: string;
  line_start: number;
  line_end: number;
  evidence: string;
  impact: string;
  recommendation: string;
  suggested_fix?: string;
  compliance_mappings: {
    framework: string;
    control: string;
    control_name?: string;
    reason?: string;
  }[];
  autofix_available: boolean;
}

interface AIAnalysisResponse {
  findings: AIFinding[];
  summary: string;
  false_positives?: string[];
}

function buildPrompt(request: AIAnalysisRequest): string {
  const redactedDiff = redactSecrets(request.diff);
  const findingsDesc = request.candidateFindings.map((f, i) =>
    `[${i}] Category: ${f.category}, Severity: ${f.severity}, File: ${f.filePath}, Line: ${f.lineStart}, Evidence: ${f.evidence.substring(0, 150)}`
  ).join('\n');

  return `You are DriftFix AI, a compliance engineering assistant. Analyze this pull request for security and compliance issues.

PR Title: ${request.prTitle}
${request.prBody ? `PR Body: ${request.prBody}` : ''}

Changed files: ${request.filePaths.join(', ')}

Diff (secrets automatically redacted before analysis):
${redactedDiff.substring(0, 8000)}

Static rule engine found these candidate findings:
${findingsDesc || 'None'}

Compliance frameworks in scope: ${request.frameworks.join(', ')}

TASK:
1. Review the diff for security and compliance issues.
2. Validate or reject each candidate finding from the rule engine.
3. Identify any additional issues the rules may have missed.
4. For each confirmed finding, provide a confidence score (0.0-1.0).
5. Map each finding to relevant compliance controls.
6. Suggest concrete remediation.

IMPORTANT: Sensitive values are automatically redacted before this analysis.

Respond with ONLY valid JSON matching this schema exactly:
{
  "findings": [
    {
      "title": "string",
      "description": "string",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidence": 0.0-1.0,
      "category": "PII_LOGGING|HARDCODED_SECRETS|INSECURE_CORS|MISSING_AUTH|MISSING_RATE_LIMIT|SENSITIVE_DATA_EXPOSURE|WEAK_ENCRYPTION|DANGEROUS_DEPENDENCY",
      "file": "path/to/file",
      "line_start": 1,
      "line_end": 1,
      "evidence": "relevant code snippet",
      "impact": "why this matters",
      "recommendation": "how to fix",
      "suggested_fix": "optional code fix",
      "compliance_mappings": [{"framework": "SOC2", "control": "CC6.1", "control_name": "name", "reason": "why"}],
      "autofix_available": true
    }
  ],
  "summary": "Brief analysis summary",
  "false_positives": ["index of rejected candidates"]
}`;
}

function parseAIResponse(raw: string): AIAnalysisResponse | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.findings || !Array.isArray(parsed.findings)) return null;

    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const validCategories = ['PII_LOGGING', 'HARDCODED_SECRETS', 'INSECURE_CORS', 'MISSING_AUTH', 'MISSING_RATE_LIMIT', 'SENSITIVE_DATA_EXPOSURE', 'WEAK_ENCRYPTION', 'DANGEROUS_DEPENDENCY'];

    const validatedFindings = parsed.findings
      .filter((f: Record<string, unknown>) =>
        f.title && f.description && f.severity && validSeverities.includes(f.severity as string) && f.confidence >= 0 && f.confidence <= 1
      )
      .map((f: Record<string, unknown>) => ({
        title: String(f.title),
        description: String(f.description),
        severity: validSeverities.includes(f.severity as string) ? f.severity : 'MEDIUM',
        confidence: Math.max(0, Math.min(1, Number(f.confidence))),
        category: validCategories.includes(f.category as string) ? f.category : 'SENSITIVE_DATA_EXPOSURE',
        file: String(f.file || ''),
        line_start: Number(f.line_start) || 1,
        line_end: Number(f.line_end) || 1,
        evidence: String(f.evidence || ''),
        impact: String(f.impact || ''),
        recommendation: String(f.recommendation || ''),
        suggested_fix: f.suggested_fix ? String(f.suggested_fix) : undefined,
        compliance_mappings: Array.isArray(f.compliance_mappings) ? f.compliance_mappings : [],
        autofix_available: Boolean(f.autofix_available),
      }));

    return {
      findings: validatedFindings,
      summary: String(parsed.summary || 'Analysis complete.'),
      false_positives: parsed.false_positives || [],
    };
  } catch {
    return null;
  }
}

export async function analyzeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  // Try using z-ai-web-dev-sdk LLM first
  try {
    const { createLLM } = await import('z-ai-web-dev-sdk');
    const llm = createLLM({ provider: 'openai' });
    const prompt = buildPrompt(request);
    const response = await llm.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = typeof response === 'string' ? response : response?.content || response?.text || JSON.stringify(response);
    const parsed = parseAIResponse(content);

    if (parsed) return parsed;
  } catch (e) {
    console.error('AI provider failed, using rule-engine fallback:', e);
  }

  // Fallback: enhance rule engine findings with AI-like analysis
  return {
    findings: request.candidateFindings.map(f => ({
      title: f.title,
      description: f.description,
      severity: f.severity,
      confidence: f.confidence,
      category: f.category,
      file: f.filePath || '',
      line_start: f.lineStart || 1,
      line_end: f.lineEnd || 1,
      evidence: f.evidence,
      impact: f.impact,
      recommendation: f.recommendation,
      suggested_fix: f.suggestedFix,
      compliance_mappings: f.complianceMappings.map(m => ({
        framework: m.framework,
        control: m.control,
        control_name: m.controlName,
        reason: m.rationale,
      })),
      autofix_available: f.autofixAvailable,
    })),
    summary: `Static analysis identified ${request.candidateFindings.length} potential compliance findings. AI contextual analysis used rule-engine fallback. Sensitive values were automatically redacted before analysis.`,
    false_positives: [],
  };
}

export { buildPrompt, parseAIResponse };
export type { AIAnalysisResponse, AIFinding };
