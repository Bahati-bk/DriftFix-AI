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
  content: string;
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

export interface SuggestedFix {
  /** Human-readable explanation */
  description: string;
  /** 
   * For GitHub's suggested-change API format.
   * Each entry is a line to replace, prefixed with `` (remove) or `+` (add).
   * The first line must be the original line to remove (no prefix).
   */
  github_diff_lines: string[];
}

export interface RuleFinding {
  rule_id: string;
  rule_name: string;
  tier: ActionTier;
  file: string;
  line: number;
  explanation: string;
  suggested_fix: string;
  /** Structured suggested fix for GitHub's suggested-change API (Feature 3) */
  suggested_fix_obj?: SuggestedFix;
  framework_citations: FrameworkControl[];
  match_content: string;
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
  detect(file: DiffFile, rule: RuleConfig, context?: { allowlist?: string[] }): RuleFinding[];
}
