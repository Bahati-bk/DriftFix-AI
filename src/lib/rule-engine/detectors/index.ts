import type { Detector } from '../types';
import { secretRegexDetector } from './secret-regex-detector';
import { piiFieldDetector } from './pii-field-detector';
import { outboundHttpDetector } from './outbound-http-detector';
import { secretEntropyDetector } from './secret-entropy-detector';
import { dependencyCveDetector } from './dependency-cve-detector';
import { auditAnnotationDetector } from './audit-annotation-detector';

/**
 * Registry mapping detector name → detector instance.
 * Add new detectors here.
 */
export const detectors: Record<string, Detector> = {
  secret_regex: secretRegexDetector,
  secret_entropy: secretEntropyDetector,
  pii_field: piiFieldDetector,
  outbound_http: outboundHttpDetector,
  dependency_cve: dependencyCveDetector,
  audit_annotation: auditAnnotationDetector,
};

/**
 * Look up a detector by name.
 */
export function getDetector(name: string): Detector | undefined {
  return detectors[name];
}
