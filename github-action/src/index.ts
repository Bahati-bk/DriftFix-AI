/**
 * DriftFix GitHub Action — Compliance Check
 *
 * This action analyzes a PR diff against YAML-driven compliance rules
 * (SOC2, GDPR, HIPAA) and:
 *   1. Creates a GitHub Check with success/failure conclusion
 *   2. Posts inline PR comments for WARNING and INFO findings
 *   3. Sets action outputs for downstream workflows
 *
 * Self-contained: all detectors and the diff parser are embedded.
 * Does NOT import from the Next.js app.
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
  pii_fields?: string[];
  suggested_fix: string;
}

interface ComplianceRulesConfig {
  version: string;
  tiers?: Record<string, { label: string; description: string; check_conclusion: string }>;
  network_allowlist?: string[];
  rules: RuleConfig[];
}

interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
  lines: DiffLine[];
}

interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
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

interface AnalysisResult {
  findings: RuleFinding[];
  summary: {
    total: number;
    blocking: number;
    warning: number;
    info: number;
    files_scanned: number;
  };
  check_conclusion: 'failure' | 'success';
}

interface Detector {
  name: string;
  detect(file: DiffFile, rule: RuleConfig, context?: { allowlist?: string[] }): RuleFinding[];
}

// ── Diff Parser ─────────────────────────────────────────────────────────

function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diffText.split('\n');

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineCounter = 0;
  let newLineCounter = 0;

  const hunkHeaderRe = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;
  const diffGitRe = /^diff --git\s+a\/(.*)\s+b\/(.*)$/;
  const oldFileRe = /^---\s+(?:a\/)?(.*)$/;
  const newFileRe = /^\+\+\+\s+(?:b\/)?(.*)$/;
  const binaryRe = /^Binary files/;

  function pushHunk() {
    if (currentHunk && currentFile) {
      currentFile.hunks.push(currentHunk);
    }
    currentHunk = null;
  }

  function pushFile() {
    pushHunk();
    if (currentFile) {
      files.push(currentFile);
    }
    currentFile = null;
  }

  for (const rawLine of lines) {
    const gitMatch = rawLine.match(diffGitRe);
    if (gitMatch) {
      pushFile();
      currentFile = {
        oldPath: gitMatch[1],
        newPath: gitMatch[2],
        hunks: [],
      };
      continue;
    }

    if (rawLine.startsWith('index ') || rawLine.startsWith('similarity index ')) {
      continue;
    }

    if (binaryRe.test(rawLine)) {
      if (currentFile) {
        currentFile.hunks = [];
      }
      continue;
    }

    const oldMatch = rawLine.match(oldFileRe);
    if (oldMatch && currentFile) {
      currentFile.oldPath = oldMatch[1];
      continue;
    }

    const newMatch = rawLine.match(newFileRe);
    if (newMatch && currentFile) {
      currentFile.newPath = newMatch[1];
      continue;
    }

    const hunkMatch = rawLine.match(hunkHeaderRe);
    if (hunkMatch && currentFile) {
      pushHunk();
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;

      currentHunk = {
        oldStart,
        oldLines: oldCount,
        newStart,
        newLines: newCount,
        content: rawLine,
        lines: [],
      };
      oldLineCounter = oldStart;
      newLineCounter = newStart;
      continue;
    }

    if (currentHunk && currentFile) {
      let diffLine: DiffLine | null = null;

      if (rawLine.startsWith('+')) {
        diffLine = {
          type: 'add',
          content: rawLine.slice(1),
          newLineNumber: newLineCounter,
        };
        newLineCounter++;
      } else if (rawLine.startsWith('-')) {
        diffLine = {
          type: 'remove',
          content: rawLine.slice(1),
          oldLineNumber: oldLineCounter,
        };
        oldLineCounter++;
      } else if (rawLine.startsWith(' ')) {
        diffLine = {
          type: 'context',
          content: rawLine.slice(1),
          oldLineNumber: oldLineCounter,
          newLineNumber: newLineCounter,
        };
        oldLineCounter++;
        newLineCounter++;
      }

      if (diffLine) {
        currentHunk.lines.push(diffLine);
      }
    }
  }

  pushFile();
  return files;
}

// ── Detectors ────────────────────────────────────────────────────────────

// --- Helper: comment/test detection ---
const COMMENT_PREFIXES = ['//', '#', '<!--', '*'];
const TEST_MOCK_PATTERNS = [/(test|mock|spec|fixture|stub|fake)\b/i, /\.test\./, /\.spec\./, /__tests__/, /__mocks__/];

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return COMMENT_PREFIXES.some((p) => trimmed.startsWith(p));
}

function isTestOrMockFile(filePath: string): boolean {
  return TEST_MOCK_PATTERNS.some((re) => re.test(filePath));
}

// --- 1. secret_regex detector ---
function stripInlineFlags(pattern: string): string {
  return pattern.replace(/^\(\?[imsx]+\)/, '');
}

const secretRegexDetector: Detector = {
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

// --- 2. secret_entropy detector ---
const SECRET_ASSIGNMENT_RE = /(?:api[_\-]?key|apikey|secret[_\-]?key|password|token|auth[_\-]?token|private[_\-]?key|access[_\-]?key)\s*[:=]\s*/i;
const VALUE_RE = /[:=]\s*([\'\"\`])([^\'\"\`\s]{6,})\1/;
const STRING_LITERAL_RE = /['"`]([a-zA-Z0-9_+\-/.=]{6,})['"`]/g;

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

const secretEntropyDetector: Detector = {
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
            const threshold = value.length >= 8 ? 3.0 : 3.5;
            if (entropy >= threshold) {
              const maskedValue = value.length > 8
                ? value.slice(0, 4) + '\u2022'.repeat(8) + value.slice(-4)
                : value.slice(0, 2) + '\u2022'.repeat(value.length - 2);

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
              continue;
            }
          }
        }

        // Mode 2: Scan for standalone high-entropy string literals
        STRING_LITERAL_RE.lastIndex = 0;
        let strMatch;
        while ((strMatch = STRING_LITERAL_RE.exec(content)) !== null) {
          const value = strMatch[1];
          if (/^(http|https|mailto|file|data):\/\//i.test(value)) continue;
          if (/^\d+\.\d+\.\d+/.test(value)) continue;
          if (/^[a-z]+(\s+[a-z]+)*$/i.test(value)) continue;
          if (value.length < 8) continue;

          const entropy = shannonEntropy(value);
          if (entropy >= 4.0) {
            if (findings.some((f) => f.line === (line.newLineNumber ?? 0) && f.file === file.newPath)) continue;

            const maskedValue = value.slice(0, 4) + '\u2022'.repeat(8) + value.slice(-4);
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

// --- 3. pii_field detector ---
const DEFAULT_PII_FIELDS = [
  'email', 'ssn', 'phone', 'address', 'date_of_birth',
  'social_security_number', 'credit_card', 'passport',
];

const ENCRYPTION_ANNOTATIONS = /\b(encrypted|@Encrypted|encrypt:|cipher|aes|field_level_encryption)\b/i;

function extractFieldName(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=\s]/);
  return match ? match[1].toLowerCase() : null;
}

const piiFieldDetector: Detector = {
  name: 'pii_field',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];

    const piiFields = rule.pii_fields ?? DEFAULT_PII_FIELDS;

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

      const matchedPii = piiFields.find((pii) => fieldName.includes(pii) || pii.includes(fieldName));
      if (!matchedPii) continue;

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

// --- 4. outbound_http detector ---
const HTTP_CALL_RE =
  /(?:fetch|axios|http\.(?:get|post|put|delete|patch|request)|urllib\.request)\s*\(\s*(['"`])([^'"`]+)\1/g;

function extractDomain(url: string): string | null {
  try {
    const cleaned = url.replace(/^`|`$/g, '').replace(/^'|'$/g, '').replace(/^"|"$/g, '');
    const maybeUrl = cleaned.trim();
    if (!maybeUrl.startsWith('http')) return null;
    const parsed = new URL(maybeUrl);
    return parsed.hostname;
  } catch {
    return null;
  }
}

function isAllowed(domain: string, allowlist: string[]): boolean {
  for (const entry of allowlist) {
    if (entry.includes('*')) {
      const regexStr = '^' + entry.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      if (new RegExp(regexStr).test(domain)) return true;
    } else if (domain === entry) {
      return true;
    }
  }
  return false;
}

const outboundHttpDetector: Detector = {
  name: 'outbound_http',

  detect(file: DiffFile, rule: RuleConfig, context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const allowlist = context?.allowlist ?? [];
    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;

        const content = line.content;

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

// --- 5. dependency_cve detector ---
const LOCKFILE_PATTERNS = [/package-lock\.json$/, /yarn\.lock$/, /pnpm-lock\.yaml$/, /Cargo\.lock$/, /go\.sum$/, /requirements\.txt$/, /Pipfile\.lock$/, /Gemfile\.lock$/, /composer\.lock$/];
const NPM_VERSION_RE = /"([^"]+)":\s*"([^"]+)"/;
const NPM_VERSION_ONLY_RE = /"version":\s*"([^"]+)"/;
const YARN_VERSION_RE = /([\w@./-]+)\s+"([^"]+)"/;
const GENERIC_DEP_RE = /([\w.-]+)\s*[=~><]+\s*([\d][\w.*-]*)/;

interface ExtractedDep {
  name: string;
  version: string;
}

function isLockfile(filePath: string): boolean {
  return LOCKFILE_PATTERNS.some((re) => re.test(filePath));
}

function extractDepsFromLines(lines: string[]): ExtractedDep[] {
  const results: ExtractedDep[] = [];
  let currentPkg: string | null = null;

  for (const line of lines) {
    const nameVerMatch = line.match(NPM_VERSION_RE);
    if (nameVerMatch && nameVerMatch[1] !== 'version' && nameVerMatch[1].length > 1) {
      results.push({ name: nameVerMatch[1], version: nameVerMatch[2] });
      currentPkg = nameVerMatch[1];
      continue;
    }

    const nameOnlyMatch = line.match(/"([^"]+)":\s*\{/);
    if (nameOnlyMatch && nameOnlyMatch[1] !== 'version' && nameOnlyMatch[1].length > 1) {
      currentPkg = nameOnlyMatch[1];
      continue;
    }

    if (currentPkg) {
      const verMatch = line.match(NPM_VERSION_ONLY_RE);
      if (verMatch) {
        results.push({ name: currentPkg, version: verMatch[1] });
        currentPkg = null;
        continue;
      }
    }

    const yarnMatch = line.match(YARN_VERSION_RE);
    if (yarnMatch && yarnMatch[1].length > 1) {
      results.push({ name: yarnMatch[1], version: yarnMatch[2] });
      continue;
    }

    const genMatch = line.match(GENERIC_DEP_RE);
    if (genMatch && genMatch[1].length > 1) {
      results.push({ name: genMatch[1], version: genMatch[2] });
    }
  }

  return results;
}

const KNOWN_VULN_PACKAGES: Record<string, { cve: string; severity: string; fixedIn: string }> = {
  'lodash': { cve: 'CVE-2024-XXXX', severity: 'high', fixedIn: '4.17.21' },
  'express': { cve: 'CVE-2024-XXXX', severity: 'critical', fixedIn: '4.19.2' },
  'jsonwebtoken': { cve: 'CVE-2022-23529', severity: 'critical', fixedIn: '9.0.0' },
  'node-forge': { cve: 'CVE-2022-24771', severity: 'high', fixedIn: '1.3.0' },
  'minimist': { cve: 'CVE-2021-44906', severity: 'critical', fixedIn: '1.2.6' },
  'axios': { cve: 'CVE-2023-45857', severity: 'medium', fixedIn: '1.6.0' },
  'path-to-regexp': { cve: 'CVE-2024-21529', severity: 'high', fixedIn: '6.2.2' },
  'semver': { cve: 'CVE-2022-25883', severity: 'high', fixedIn: '7.5.2' },
};

function checkLocalVulnDB(packageName: string, version: string): {
  cve: string;
  severity: string;
  fixedIn: string;
} | null {
  const entry = KNOWN_VULN_PACKAGES[packageName.toLowerCase()];
  if (!entry) return null;
  return entry;
}

const dependencyCveDetector: Detector = {
  name: 'dependency_cve',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];

    if (!isLockfile(file.newPath)) return findings;

    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);
    const seen = new Set<string>();

    for (const hunk of file.hunks) {
      const allLines = hunk.lines.map((l) => l.content);
      const deps = extractDepsFromLines(allLines);

      for (const dep of deps) {
        const key = `${dep.name}@${dep.version}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const vuln = checkLocalVulnDB(dep.name, dep.version);
        if (vuln) {
          const addLine = hunk.lines.find((l) =>
            l.type === 'add' && l.content.includes(dep.name) && l.content.includes(dep.version)
          );

          findings.push({
            rule_id: rule.id,
            rule_name: rule.name,
            tier: rule.tier,
            file: file.newPath,
            line: addLine?.newLineNumber ?? 0,
            explanation: `Dependency ${dep.name}@${dep.version} has a known vulnerability (${vuln.cve}, severity: ${vuln.severity}). ` +
              `Update to at least version ${vuln.fixedIn} to resolve.`,
            suggested_fix: rule.suggested_fix,
            framework_citations: frameworkCitations,
            match_content: `${dep.name}@${dep.version}`,
            confidence: 0.92,
          });
        }
      }
    }

    return findings;
  },
};

// --- 6. audit_annotation detector ---
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
  if (!FUNCTION_DEF_RE.test(trimmed)) return false;
  return SENSITIVE_KEYWORDS.some((re) => re.test(trimmed));
}

function hasAuditCall(lines: string[]): boolean {
  const checkLines = lines.slice(0, 20);
  return checkLines.some((line) => AUDIT_INDICATORS.some((re) => re.test(line)));
}

const auditAnnotationDetector: Detector = {
  name: 'audit_annotation',

  detect(file: DiffFile, rule: RuleConfig, _context?: { allowlist?: string[] }): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const frameworkCitations: FrameworkControl[] = Object.values(rule.frameworks);

    if (/\.(test|spec)\.[jt]sx?$/.test(file.newPath)) return findings;
    if (/(?:jest|vitest|__tests__)/i.test(file.newPath)) return findings;

    for (const hunk of file.hunks) {
      const addLines = hunk.lines.filter((l) => l.type === 'add');
      const allAddContent = addLines.map((l) => l.content);

      for (let i = 0; i < addLines.length; i++) {
        const line = addLines[i];
        if (isCommentLine(line.content)) continue;

        if (isSensitiveFunction(line.content)) {
          const subsequentLines = allAddContent.slice(i + 1);
          const hasAudit = hasAuditCall(subsequentLines);

          if (!hasAudit) {
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

// ── Detector Registry ─────────────────────────────────────────────────────

const detectors: Record<string, Detector> = {
  secret_regex: secretRegexDetector,
  secret_entropy: secretEntropyDetector,
  pii_field: piiFieldDetector,
  outbound_http: outboundHttpDetector,
  dependency_cve: dependencyCveDetector,
  audit_annotation: auditAnnotationDetector,
};

function getDetector(name: string): Detector | undefined {
  return detectors[name];
}

// ── Analyzer ──────────────────────────────────────────────────────────────

function analyzeDiff(diffText: string, rulesConfig: ComplianceRulesConfig): AnalysisResult {
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

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a markdown-formatted check annotation for a single finding.
 */
function formatAnnotation(f: RuleFinding): string {
  const tierEmoji = f.tier === 'BLOCKING' ? '\u274c' : f.tier === 'WARNING' ? '\u26a0\ufe0f' : '\u2139\ufe0f';
  const citations = f.framework_citations.map((c) => `${c.control}: ${c.name}`).join(', ');
  return [
    `${tierEmoji} **${f.rule_id}** \u2014 ${f.rule_name} (${f.tier})`,
    `   File: \`${f.file}:${f.line}\``,
    `   Matched: \`${f.match_content.replace(/[\`\\]/g, '\\$&')}\``,
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
    `| \u274c BLOCKING | ${blocking.length} |`,
    `| \u26a0\ufe0f WARNING | ${warning.length} |`,
    `| \u2139\ufe0f INFO | ${info.length} |`,
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
    // Fully self-contained — no imports from the Next.js app.
    const result = analyzeDiff(diff, rulesConfig);

    core.info(`Analysis complete: ${result.summary.total} findings (${result.summary.blocking} blocking)`);

    // ── Step 4: Set action outputs ───────────────────────────────────────
    core.setOutput('blocking_count', String(result.summary.blocking));
    core.setOutput('warning_count', String(result.summary.warning));
    core.setOutput('info_count', String(result.summary.info));
    core.setOutput('check_conclusion', result.check_conclusion);

    // ── Step 5: Create a GitHub Check with the analysis results ─────────
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

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
            title: `${f.rule_id} \u2014 ${f.rule_name} [${f.tier}]`,
          })),
      },
    });

    core.info(`Created check run: ${check.data.html_url}`);

    // ── Step 6: Post inline PR comments for WARNING and INFO findings ───
    const nonBlockingFindings = result.findings.filter(
      (f) => f.tier === 'WARNING' || f.tier === 'INFO',
    );

    if (context.payload.pull_request?.number && nonBlockingFindings.length > 0) {
      const prNumber = context.payload.pull_request.number;

      const commentsByFile = new Map<string, RuleFinding[]>();
      for (const f of nonBlockingFindings) {
        const existing = commentsByFile.get(f.file) || [];
        existing.push(f);
        commentsByFile.set(f.file, existing);
      }

      for (const [filePath, findings] of commentsByFile) {
        for (const f of findings) {
          try {
            await octokit.rest.pulls.createReviewComment({
              ...context.repo,
              pull_number: prNumber,
              path: filePath,
              line: f.line,
              body: [
                `**${f.tier === 'WARNING' ? '\u26a0\ufe0f' : '\u2139\ufe0f'} ${f.rule_id}: ${f.rule_name}**`,
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
    core.setFailed(`Action failed: ${error}`);
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

run();
