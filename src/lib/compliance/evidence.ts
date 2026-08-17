import crypto from 'crypto';
import { db } from '@/lib/db';

export async function createEvidenceRecord(params: {
  organizationId?: string;
  repositoryId?: string;
  findingId?: string;
  eventType: string;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  const lastRecord = await db.evidenceRecord.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const previousHash = lastRecord?.hash || 'GENESIS';
  const payloadStr = JSON.stringify(params.payload || {});
  const dataToHash = `${params.eventType}|${params.actor}|${payloadStr}|${previousHash}|${new Date().toISOString()}`;
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

  return db.evidenceRecord.create({
    data: {
      organizationId: params.organizationId,
      repositoryId: params.repositoryId,
      findingId: params.findingId,
      eventType: params.eventType,
      actor: params.actor,
      payload: payloadStr,
      hash,
      previousHash,
    },
  });
}

export async function verifyEvidenceChain(): Promise<{ valid: boolean; brokenAt?: string; recordsVerified: number }> {
  const records = await db.evidenceRecord.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (records.length === 0) return { valid: true, recordsVerified: 0 };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const expectedPrevious = i === 0 ? 'GENESIS' : records[i - 1].hash;

    if (record.previousHash !== expectedPrevious) {
      return { valid: false, brokenAt: record.id, recordsVerified: i };
    }

    const payloadStr = record.payload || '';
    const dataToHash = `${record.eventType}|${record.actor}|${payloadStr}|${record.previousHash}|${record.createdAt.toISOString()}`;
    const expectedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    if (record.hash !== expectedHash) {
      return { valid: false, brokenAt: record.id, recordsVerified: i };
    }
  }

  return { valid: true, recordsVerified: records.length };
}

export function redactSecrets(diff: string): string {
  return diff
    .replace(/sk_live_[a-zA-Z0-9]{24,}/g, '[REDACTED_SECRET]')
    .replace(/sk_test_[a-zA-Z0-9]{24,}/g, '[REDACTED_SECRET]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_SECRET]')
    .replace(/gho_[a-zA-Z0-9]{36}/g, '[REDACTED_SECRET]')
    .replace(/xox[bposa]-[a-zA-Z0-9\-]{10,}/g, '[REDACTED_SECRET]')
    .replace(/AKIA[A-Z0-9]{16}/g, '[REDACTED_SECRET]')
    .replace(/(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/gi, (match) => {
      const [key, ...rest] = match.split(/["']/);
      return `${key}"${'*'.repeat(8)}"`;
    })
    .replace(/(?:api[_-]?key|apikey|api[_-]?secret|secret|token|access[_-]?token|auth[_-]?token)\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{20,}["']/gi, (match) => {
      const keyMatch = match.match(/^[^:=]+/);
      return `${keyMatch ? keyMatch[0].trim() : 'secret'}="[REDACTED_SECRET]"`;
    });
}
