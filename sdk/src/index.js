/**
 * MIR Protocol SDK — public API.
 *
 * Claim creation, signing, and verification.
 * No database. No hosting. No API keys. No SaaS logic.
 */

export { canonicalize, canonicalString } from './serialize.js';
export { createClaim, generateKeyPair, keyFingerprint, subjectHash, CLAIM_TYPES } from './sign.js';
export { verifyClaim } from './verify.js';
