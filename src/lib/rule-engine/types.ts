// ── Rule Engine Types ─────────────────────────────────────────────

export type ActionTier = 'BLOCKING' | 'WARNING' | 'INFO';

export interface TierDefinition {
  label: string;
  description: string;
  check_conclusion: 'failure' | 'neutral';
}

export interface FrameworkControl {
  control: string;
  name: string;
}

export interface RuleConfig {
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

export interface ComplianceRulesConfig {
  version: string;
  tiers: Record<ActionTier, TierDefinition>;
  network_allowlist?: string[];
  rules: RuleConfig[];
}

// ── PR Diff Types ─────────────────────────────────────────────────

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string; // The @@ header line
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
}

// ── Finding Types ─────────────────────────────────────────────────

export interface RuleFinding {
  rule_id: string;
  rule_name: string;
  tier: ActionTier;
  file: string;
  line: number;
  explanation: string;
  suggested_fix: string;
  framework_citations: FrameworkControl[];
  match_content: string; // The line that triggered the finding
  confidence: number;
}

export interface AnalysisResult {
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

// ── Detector Interface ────────────────────────────────────────────

export interface Detector {
  name: string;
  /**
   * Run detection on a single file's diff.
   * Returns findings for this file only.
   */
  detect(file: DiffFile, rule: RuleConfig, context?: { allowlist?: string[] }): RuleFinding[];
}
