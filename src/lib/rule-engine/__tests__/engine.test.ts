import { parseDiff } from '../diff-parser';
import { analyzeDiff } from '../engine';
import { loadRulesConfig } from '../config-loader';
import { secretRegexDetector } from '../detectors/secret-regex-detector';
import { piiFieldDetector } from '../detectors/pii-field-detector';
import { outboundHttpDetector } from '../detectors/outbound-http-detector';
import { secretEntropyDetector } from '../detectors/secret-entropy-detector';
import { dependencyCveDetector } from '../detectors/dependency-cve-detector';
import { auditAnnotationDetector } from '../detectors/audit-annotation-detector';
import type { DiffFile } from '../types';
import {
  SECRET_DIFF, PII_DIFF, OUTBOUND_HTTP_DIFF, CLEAN_DIFF,
  ENTROPY_SECRET_DIFF, DEPENDENCY_CVE_DIFF, AUDIT_MISSING_DIFF,
  AUDIT_PRESENT_DIFF, LOW_ENTROPY_DIFF, SUGGESTION_DIFF,
} from './fixtures/sample-diff';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${(err as Error).message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

// ── Load config once ──
const config = loadRulesConfig();
const secretRule = config.rules.find((r) => r.id === 'SEC-001')!;
const piiRule = config.rules.find((r) => r.id === 'PII-001')!;
const httpRule = config.rules.find((r) => r.id === 'NET-001')!;
const entropyRule = config.rules.find((r) => r.id === 'SEC-003')!;
const cveRule = config.rules.find((r) => r.id === 'DEP-001')!;
const auditRule = config.rules.find((r) => r.id === 'AUD-001')!;

async function main() {
console.log('=== Rule Engine Tests (Features 1-3) ===');
console.log(`Loaded ${config.rules.length} rules, ${Object.keys(config.tiers).length} tiers`);
console.log('');

// ── Feature 1 Tests ──

console.log('--- Feature 1: parseDiff tests ---');
test('parseDiff parses SECRET_DIFF into DiffFile with hunks and typed lines', () => {
  const files = parseDiff(SECRET_DIFF);
  assertEqual(files.length, 1, 'file count');
  const file = files[0] as DiffFile;
  assertEqual(file.oldPath, 'src/config.ts', 'oldPath');
  assertEqual(file.newPath, 'src/config.ts', 'newPath');
  assert(file.hunks.length >= 1, 'has at least 1 hunk');
  const hunk = file.hunks[0];
  assertEqual(hunk.oldStart, 1, 'oldStart');
  assertEqual(hunk.newStart, 1, 'newStart');
  const addLines = hunk.lines.filter((l) => l.type === 'add');
  const removeLines = hunk.lines.filter((l) => l.type === 'remove');
  assertEqual(addLines.length, 1, 'add line count');
  assertEqual(removeLines.length, 1, 'remove line count');
  assert(addLines[0].content.includes('sk-live'), 'add line contains sk-live');
  assert(removeLines[0].content.includes('process.env.API_KEY'), 'remove line contains process.env.API_KEY');
});

console.log('--- Feature 1: Secret regex detector tests ---');
test('Secret regex detector finds hardcoded API key as BLOCKING', () => {
  const files = parseDiff(SECRET_DIFF);
  const file = files[0];
  const findings = secretRegexDetector.detect(file, secretRule);
  assert(findings.length >= 1, 'should find at least 1 secret finding');
  const secFinding = findings.find((f) => f.rule_id === 'SEC-001');
  assert(secFinding !== undefined, 'SEC-001 finding exists');
  assertEqual(secFinding!.tier, 'BLOCKING', 'tier is BLOCKING');
  assert(secFinding!.match_content.includes('sk-live'), 'match_content contains the secret');
  assert(secFinding!.file === 'src/config.ts', 'file path is correct');
  assert(secFinding!.confidence > 0, 'confidence > 0');
});

console.log('--- Feature 1: PII field detector tests ---');
test('PII detector flags unencrypted email/ssn/phone/address as WARNING', () => {
  const files = parseDiff(PII_DIFF);
  const file = files[0];
  const findings = piiFieldDetector.detect(file, piiRule);
  assert(findings.length >= 4, `should find at least 4 PII fields (got ${findings.length})`);
  const fieldNames = findings.map((f) => f.match_content);
  assert(fieldNames.some((c) => c.includes('email')), 'flags email field');
  assert(fieldNames.some((c) => c.includes('ssn')), 'flags ssn field');
  assert(fieldNames.some((c) => c.includes('phone')), 'flags phone field');
  assert(fieldNames.some((c) => c.includes('address')), 'flags address field');
  for (const f of findings) {
    assertEqual(f.tier, 'WARNING', `PII finding tier should be WARNING (got ${f.tier})`);
  }
});

console.log('--- Feature 1: Outbound HTTP detector tests ---');
test('Outbound HTTP detector flags evil-api but NOT api.github.com', () => {
  const files = parseDiff(OUTBOUND_HTTP_DIFF);
  const file = files[0];
  const findings = outboundHttpDetector.detect(file, httpRule, { allowlist: config.network_allowlist });
  const evilFindings = findings.filter((f) => f.match_content.includes('evil-api'));
  assert(evilFindings.length >= 1, 'should flag evil-api.example.com');
  const githubFindings = findings.filter((f) => f.match_content.includes('api.github.com'));
  assertEqual(githubFindings.length, 0, 'should NOT flag api.github.com');
  for (const f of evilFindings) {
    assertEqual(f.tier, 'WARNING', 'outbound HTTP finding tier should be WARNING');
    assert(f.explanation.includes('evil-api'), 'explanation mentions the domain');
  }
});

console.log('--- Feature 1: Clean diff tests ---');
{
  const result = await analyzeDiff(CLEAN_DIFF, config);
  test('Clean diff produces zero findings', () => {
    assertEqual(result.findings.length, 0, 'total findings');
    assertEqual(result.summary.total, 0, 'summary total');
    assertEqual(result.check_conclusion, 'success', 'check_conclusion');
  });
}

console.log('--- Feature 1: Full engine tests ---');
{
  const combined = SECRET_DIFF + '\n' + PII_DIFF;
  const result = await analyzeDiff(combined, config);
  test('Full engine analysis returns correct summary counts', () => {
    assert(result.summary.total > 0, 'has findings');
    assertEqual(result.summary.files_scanned, 2, 'files scanned');
    assert(result.summary.blocking >= 1, `blocking >= 1 (got ${result.summary.blocking})`);
    assert(result.summary.warning >= 1, `warning >= 1 (got ${result.summary.warning})`);
  });
}

{
  const result = await analyzeDiff(SECRET_DIFF, config);
  test('Analysis with BLOCKING finding has check_conclusion: failure', () => {
    assert(result.findings.some((f) => f.tier === 'BLOCKING'), 'has at least one BLOCKING finding');
    assertEqual(result.check_conclusion, 'failure', 'check_conclusion is failure');
  });
}

{
  const combined = PII_DIFF + '\n' + OUTBOUND_HTTP_DIFF;
  const result = await analyzeDiff(combined, config);
  test('Analysis with only WARNING/INFO has check_conclusion: success', () => {
    const hasBlocking = result.findings.some((f) => f.tier === 'BLOCKING');
    assert(!hasBlocking, 'has no BLOCKING findings');
    assertEqual(result.check_conclusion, 'success', 'check_conclusion is success');
  });
}

// ── Feature 2 Tests ──

console.log('--- Feature 2: Entropy detector tests ---');
test('Entropy detector flags high-entropy token as BLOCKING', () => {
  const files = parseDiff(ENTROPY_SECRET_DIFF);
  const file = files[0];
  const findings = secretEntropyDetector.detect(file, entropyRule);
  assert(findings.length >= 1, `should find at least 1 high-entropy secret (got ${findings.length})`);
  const entFinding = findings[0];
  assertEqual(entFinding.tier, 'BLOCKING', 'tier is BLOCKING');
  assert(entFinding.explanation.includes('entropy'), 'explanation mentions entropy');
  assert(entFinding.confidence >= 0.7, `confidence >= 0.7 (got ${entFinding.confidence})`);
});

console.log('--- Feature 2: Low entropy test ---');
test('Low-entropy string does NOT trigger entropy detector', () => {
  const files = parseDiff(LOW_ENTROPY_DIFF);
  const file = files[0];
  const findings = secretEntropyDetector.detect(file, entropyRule);
  assertEqual(findings.length, 0, 'should find 0 findings for low-entropy string');
});

console.log('--- Feature 2: CVE detector tests ---');
test('CVE detector flags jsonwebtoken@8.5.1 as WARNING', () => {
  const files = parseDiff(DEPENDENCY_CVE_DIFF);
  const file = files[0];
  const findings = dependencyCveDetector.detect(file, cveRule);
  assert(findings.length >= 1, `should flag jsonwebtoken (got ${findings.length})`);
  const cveFinding = findings.find((f) => f.match_content.includes('jsonwebtoken'));
  assert(cveFinding !== undefined, 'jsonwebtoken finding exists');
  assertEqual(cveFinding!.tier, 'WARNING', 'tier is WARNING');
  assert(cveFinding!.explanation.includes('CVE'), 'explanation mentions CVE');
  assert(cveFinding!.explanation.includes('9.0.0'), 'mentions fix version');
});

console.log('--- Feature 2: Audit annotation tests ---');
test('Audit detector flags deleteAllUsers without audit logging', () => {
  const files = parseDiff(AUDIT_MISSING_DIFF);
  const file = files[0];
  const findings = auditAnnotationDetector.detect(file, auditRule);
  assert(findings.length >= 1, `should flag function without audit (got ${findings.length})`);
  const auditFinding = findings[0];
  assert(auditFinding.explanation.includes('deleteAllUsers'), 'mentions function name');
  assertEqual(auditFinding.tier, 'INFO', 'tier is INFO');
});

test('Audit detector does NOT flag function with audit logging present', () => {
  const files = parseDiff(AUDIT_PRESENT_DIFF);
  const file = files[0];
  const findings = auditAnnotationDetector.detect(file, auditRule);
  assertEqual(findings.length, 0, 'should find 0 findings when audit log is present');
});

console.log('--- Feature 2: Full engine integration ---');
{
  const combined = ENTROPY_SECRET_DIFF + '\n' + DEPENDENCY_CVE_DIFF + '\n' + AUDIT_MISSING_DIFF;
  const result = await analyzeDiff(combined, config);
  test('Full engine with all detectors returns correct summary', () => {
    assert(result.summary.total >= 3, `should have at least 3 findings (got ${result.summary.total})`);
    assert(result.summary.blocking >= 1, `blocking >= 1 (got ${result.summary.blocking})`);
    assert(result.summary.warning >= 1, `warning >= 1 (got ${result.summary.warning})`);
    assert(result.summary.info >= 1, `info >= 1 (got ${result.summary.info})`);
    assertEqual(result.check_conclusion, 'failure', 'check_conclusion is failure (has BLOCKING)');
  });
}

// ── Feature 3: Suggested Fix Tests ──

console.log('--- Feature 3: Suggested fix tests ---');
test('Secret finding includes GitHub suggested-change format', () => {
  const files = parseDiff(SUGGESTION_DIFF);
  const file = files[0];
  const findings = secretRegexDetector.detect(file, secretRule);
  assert(findings.length >= 1, 'should find secret');
  const fix = findings[0].suggested_fix_obj;
  assert(fix !== undefined, 'suggested_fix_obj is defined');
  assert(fix!.github_diff_lines.length >= 2, `github_diff_lines has at least 2 entries (got ${fix!.github_diff_lines.length})`);
  assert(fix!.description.length > 0, 'description is non-empty');
  assert(!fix!.github_diff_lines[0].startsWith('+') && !fix!.github_diff_lines[0].startsWith('-'),
    'first line is the original (no +/- prefix)');
  assert(fix!.github_diff_lines[1].includes('process.env'), 'replacement uses env var');
});

test('PII finding includes GitHub suggested-change format', () => {
  const files = parseDiff(PII_DIFF);
  const file = files[0];
  const findings = piiFieldDetector.detect(file, piiRule);
  assert(findings.length >= 1, 'should find PII fields');
  const fix = findings[0].suggested_fix_obj;
  assert(fix !== undefined, 'suggested_fix_obj is defined');
  assert(fix!.github_diff_lines.some((l) => l.includes('@Encrypted') || l.includes('encrypted')),
    'suggested fix includes encryption annotation');
});

test('Outbound HTTP finding includes GitHub suggested-change format', () => {
  const files = parseDiff(OUTBOUND_HTTP_DIFF);
  const file = files[0];
  const findings = outboundHttpDetector.detect(file, httpRule, { allowlist: config.network_allowlist });
  const evilFindings = findings.filter((f) => f.match_content.includes('evil-api'));
  assert(evilFindings.length >= 1, 'should flag evil-api');
  const fix = evilFindings[0].suggested_fix_obj;
  assert(fix !== undefined, 'suggested_fix_obj is defined');
  assert(fix!.github_diff_lines.some((l) => l.includes('network_allowlist') || l.includes('TODO')),
    'suggested fix mentions allowlist or TODO');
});

// ── Summary ──
console.log('');
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
} // end main()

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
