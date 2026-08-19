import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import type { ActionTier, ComplianceRulesConfig, RuleConfig } from './types';

/**
 * Fix double-escaped regex metacharacters in patterns.
 * YAML double-quoted strings require \\ to produce a single \,
 * but patterns written for YAML sometimes end up with \\\\ producing \\,
 * which in RegExp means a literal backslash instead of a metacharacter.
 * This normalizes \\X to \X for known regex metacharacter X.
 */
function normalizePattern(pattern: string): string {
  return pattern.replace(/\\\\(?=[wWsSdDbnrt0])/g, '\\');
}

/**
 * Pre-process raw YAML text to fix non-standard escape sequences
 * that the strict `yaml` parser rejects (e.g. \` in double-quoted strings).
 */
function sanitizeYaml(raw: string): string {
  // Replace \` (invalid YAML DQ escape) with just backtick
  return raw.replace(/\\`/g, '`');
}

/**
 * Post-process parsed config to normalize regex patterns.
 */
function normalizeConfig(config: ComplianceRulesConfig): ComplianceRulesConfig {
  return {
    ...config,
    rules: config.rules.map((rule) => ({
      ...rule,
      pattern: rule.pattern ? normalizePattern(rule.pattern) : undefined,
    })),
  };
}

/**
 * Load and parse compliance-rules.yaml from the project root.
 * Re-reads on each call (no stale cache).
 */
export function loadRulesConfig(): ComplianceRulesConfig {
  const configPath = resolve(process.cwd(), 'compliance-rules.yaml');
  const raw = readFileSync(configPath, 'utf-8');
  const sanitized = sanitizeYaml(raw);
  const parsed = parseYaml(sanitized) as ComplianceRulesConfig;
  const normalized = normalizeConfig(parsed);

  // Basic structural validation
  if (!normalized.version || typeof normalized.version !== 'string') {
    throw new Error('Invalid config: missing or invalid "version" field');
  }
  if (!normalized.tiers || typeof normalized.tiers !== 'object') {
    throw new Error('Invalid config: missing or invalid "tiers" field');
  }
  if (!Array.isArray(normalized.rules)) {
    throw new Error('Invalid config: missing or invalid "rules" array');
  }

  return normalized;
}

/**
 * Get all rules matching a given action tier.
 */
export function getRulesByTier(tier: ActionTier): RuleConfig[] {
  const config = loadRulesConfig();
  return config.rules.filter((r) => r.tier === tier);
}

/**
 * Look up a single rule by its id.
 */
export function getRuleById(id: string): RuleConfig | undefined {
  const config = loadRulesConfig();
  return config.rules.find((r) => r.id === id);
}
