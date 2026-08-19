import { parseDiff } from '../diff-parser';
import { analyzeDiff } from '../engine';
import { loadRulesConfig } from '../config-loader';
import { SECRET_DIFF, PII_DIFF, OUTBOUND_HTTP_DIFF, CLEAN_DIFF } from './fixtures/sample-diff';
import { secretRegexDetector } from '../detectors/secret-regex-detector';
import { piiFieldDetector } from '../detectors/pii-field-detector';
import { outboundHttpDetector } from '../detectors/outbound-http-detector';
import type { DiffFile } from '../types';

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

console.log('=== Rule Engine Tests ===');
console.log('');

// ── Test 1: parseDiff correctly parses SECRET_DIFF ──
console.log('--- parseDiff tests ---');
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

  assert(
    addLines[0].content.includes('sk-live'),
    'add line contains sk-live'
  );
  assert(
    removeLines[0].content.includes('process.env.API_KEY'),
    'remove line contains process.env.API_KEY'
  );
});

// ── Test 2: Secret regex detector finds hardcoded API key → BLOCKING ──
console.log('--- Secret regex detector tests ---');
test('Secret regex detector finds hardcoded API key as BLOCKING', () => {
  const files = parseDiff(SECRET_DIFF);
  const file = files[0];

  const findings = secretRegexDetector.detect(file, secretRule);

  assert(findings.length >= 1, 'should find at least 1 secret finding');

  const secFinding = findings.find((f) => f.rule_id === 'SEC-001');
  assert(secFinding !== undefined, 'SEC-001 finding exists');
  assertEqual(secFinding!.tier, 'BLOCKING', 'tier is BLOCKING');
  assert(
    secFinding!.match_content.includes('sk-live'),
    'match_content contains the secret'
  );
  assert(secFinding!.file === 'src/config.ts', 'file path is correct');
  assert(secFinding!.confidence > 0, 'confidence > 0');
});

// ── Test 3: PII detector flags unencrypted fields → WARNING ──
console.log('--- PII field detector tests ---');
test('PII detector flags unencrypted email/ssn/phone/address as WARNING', () => {
  const files = parseDiff(PII_DIFF);
  const file = files[0];

  const findings = piiFieldDetector.detect(file, piiRule);

  assert(findings.length >= 4, `should find at least 4 PII fields (got ${findings.length})`);

  const fieldNames = findings.map((f) => f.match_content);

  assert(
    fieldNames.some((c) => c.includes('email')),
    'flags email field'
  );
  assert(
    fieldNames.some((c) => c.includes('ssn')),
    'flags ssn field'
  );
  assert(
    fieldNames.some((c) => c.includes('phone')),
    'flags phone field'
  );
  assert(
    fieldNames.some((c) => c.includes('address')),
    'flags address field'
  );

  for (const f of findings) {
    assertEqual(f.tier, 'WARNING', `PII finding tier should be WARNING (got ${f.tier})`);
  }
});

// ── Test 4: Outbound HTTP detector flags evil-api but NOT api.github.com ──
console.log('--- Outbound HTTP detector tests ---');
test('Outbound HTTP detector flags evil-api but NOT api.github.com', () => {
  const files = parseDiff(OUTBOUND_HTTP_DIFF);
  const file = files[0];

  const findings = outboundHttpDetector.detect(file, httpRule, {
    allowlist: config.network_allowlist,
  });

  // Should flag evil-api.example.com
  const evilFindings = findings.filter((f) => f.match_content.includes('evil-api'));
  assert(evilFindings.length >= 1, 'should flag evil-api.example.com');

  // Should NOT flag api.github.com (it is in allowlist)
  const githubFindings = findings.filter((f) => f.match_content.includes('api.github.com'));
  assertEqual(githubFindings.length, 0, 'should NOT flag api.github.com');

  for (const f of evilFindings) {
    assertEqual(f.tier, 'WARNING', 'outbound HTTP finding tier should be WARNING');
    assert(
      f.explanation.includes('evil-api'),
      'explanation mentions the domain'
    );
  }
});

// ── Test 5: Clean diff produces zero findings ──
console.log('--- Clean diff tests ---');
test('Clean diff produces zero findings', async () => {
  const result = await analyzeDiff(CLEAN_DIFF, config);
  assertEqual(result.findings.length, 0, 'total findings');
  assertEqual(result.summary.total, 0, 'summary total');
  assertEqual(result.summary.blocking, 0, 'summary blocking');
  assertEqual(result.summary.warning, 0, 'summary warning');
  assertEqual(result.summary.info, 0, 'summary info');
  assertEqual(result.check_conclusion, 'success', 'check_conclusion');
});

// ── Test 6: Full engine analysis returns correct summary counts ──
console.log('--- Full engine tests ---');
test('Full engine analysis returns correct summary counts', async () => {
  // Combine SECRET_DIFF and PII_DIFF
  const combined = SECRET_DIFF + '\n' + PII_DIFF;
  const result = await analyzeDiff(combined, config);

  assert(result.summary.total > 0, 'has findings');
  assertEqual(result.summary.files_scanned, 2, 'files scanned');

  // Count should include at least the blocking secret and the PII warnings
  assert(result.summary.blocking >= 1, `blocking >= 1 (got ${result.summary.blocking})`);
  assert(result.summary.warning >= 1, `warning >= 1 (got ${result.summary.warning})`);
});

// ── Test 7: BLOCKING finding → check_conclusion: 'failure' ──
test('Analysis with BLOCKING finding has check_conclusion: failure', async () => {
  const result = await analyzeDiff(SECRET_DIFF, config);

  assert(
    result.findings.some((f) => f.tier === 'BLOCKING'),
    'has at least one BLOCKING finding'
  );
  assertEqual(result.check_conclusion, 'failure', 'check_conclusion is failure');
});

// ── Test 8: Only WARNING/INFO → check_conclusion: 'success' ──
test('Analysis with only WARNING/INFO has check_conclusion: success', async () => {
  // PII_DIFF triggers only WARNING (PII-001)
  // OUTBOUND_HTTP_DIFF triggers only WARNING (NET-001) for evil-api
  const combined = PII_DIFF + '\n' + OUTBOUND_HTTP_DIFF;
  const result = await analyzeDiff(combined, config);

  const hasBlocking = result.findings.some((f) => f.tier === 'BLOCKING');
  assert(!hasBlocking, 'has no BLOCKING findings');
  assertEqual(result.check_conclusion, 'success', 'check_conclusion is success');
});

// ── Summary ──
console.log('');
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
