import type { Detector } from '../types';
import { secretRegexDetector } from './secret-regex-detector';
import { piiFieldDetector } from './pii-field-detector';
import { outboundHttpDetector } from './outbound-http-detector';

/**
 * Registry mapping detector name → detector instance.
 * Add new detectors here.
 */
export const detectors: Record<string, Detector> = {
  secret_regex: secretRegexDetector,
  pii_field: piiFieldDetector,
  outbound_http: outboundHttpDetector,
};

/**
 * Look up a detector by name.
 */
export function getDetector(name: string): Detector | undefined {
  return detectors[name];
}
