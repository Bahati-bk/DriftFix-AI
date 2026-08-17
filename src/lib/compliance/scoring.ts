import type { Severity } from './rules';

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
};

export function calculateComplianceScore(findings: { severity: Severity; confidence: number; status: string }[]): number {
  let totalPenalty = 0;

  for (const finding of findings) {
    if (finding.status === 'RESOLVED' || finding.status === 'DISMISSED') continue;

    const baseWeight = SEVERITY_WEIGHTS[finding.severity] || 5;
    const confidenceMultiplier = 0.5 + finding.confidence * 0.5;
    totalPenalty += baseWeight * confidenceMultiplier;
  }

  return Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'emerald' };
  if (score >= 80) return { label: 'Good', color: 'green' };
  if (score >= 70) return { label: 'Fair', color: 'yellow' };
  if (score >= 60) return { label: 'Needs Attention', color: 'orange' };
  return { label: 'Critical', color: 'red' };
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'red';
    case 'HIGH': return 'orange';
    case 'MEDIUM': return 'yellow';
    case 'LOW': return 'slate';
    default: return 'slate';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'OPEN': return 'red';
    case 'IN_REVIEW': return 'yellow';
    case 'RESOLVED': return 'green';
    case 'DISMISSED': return 'slate';
    case 'ACCEPTED_RISK': return 'orange';
    default: return 'slate';
  }
}