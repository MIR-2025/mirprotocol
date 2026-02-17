/**
 * MIR claim verification.
 *
 * Deterministic, offline-capable Ed25519 signature verification.
 */

import { verify, createHash } from 'node:crypto';
import { canonicalize } from './serialize.js';
import { isValidClaimType } from './sign.js';

/**
 * Standard error codes for verification failures.
 */
export const ErrorCode = {
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  KEY_EXPIRED: 'KEY_EXPIRED',
  CLAIM_EXPIRED: 'CLAIM_EXPIRED',
  CANONICALIZATION_ERROR: 'CANONICALIZATION_ERROR',
  DOMAIN_MISMATCH: 'DOMAIN_MISMATCH',
};

/**
 * @typedef {object} VerifyResult
 * @property {boolean} valid - Whether the claim is valid.
 * @property {string} [error] - Human-readable reason for rejection.
 * @property {string} [code] - Machine-readable error code.
 */

/**
 * Verify a MIR claim against a public key.
 *
 * This is the reference implementation of the deterministic verification
 * algorithm specified in 06-verification-process.md.
 *
 * @param {object} claim - The signed MIR claim.
 * @param {import('node:crypto').KeyObject} publicKey - Ed25519 public key.
 * @returns {VerifyResult}
 */
export function verifyClaim(claim, publicKey) {
  // Step 2: Validate required fields
  const required = ['mir', 'type', 'domain', 'subject', 'timestamp', 'keyFingerprint', 'sig'];
  for (const field of required) {
    if (claim[field] === undefined || claim[field] === null) {
      return { valid: false, error: `Missing required field: ${field}`, code: ErrorCode.INVALID_SCHEMA };
    }
  }

  // Step 3: Validate field formats
  if (claim.mir !== 1) {
    return { valid: false, error: `Unsupported protocol version: ${claim.mir}`, code: ErrorCode.INVALID_SCHEMA };
  }

  if (!isValidClaimType(claim.type)) {
    return { valid: false, error: `Invalid claim type: ${claim.type}`, code: ErrorCode.INVALID_SCHEMA };
  }

  if (!/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(claim.domain)) {
    return { valid: false, error: `Invalid domain: ${claim.domain}`, code: ErrorCode.INVALID_SCHEMA };
  }

  if (!/^[a-f0-9]{64}$/.test(claim.subject)) {
    return { valid: false, error: 'Invalid subject hash', code: ErrorCode.INVALID_SCHEMA };
  }

  if (!/^[a-f0-9]{64}$/.test(claim.keyFingerprint)) {
    return { valid: false, error: 'Invalid key fingerprint', code: ErrorCode.INVALID_SCHEMA };
  }

  // Validate sig is base64url and decodes to 64 bytes
  let sigBytes;
  try {
    sigBytes = Buffer.from(claim.sig, 'base64url');
    if (sigBytes.length !== 64) {
      return { valid: false, error: `Signature must be 64 bytes, got ${sigBytes.length}`, code: ErrorCode.INVALID_SCHEMA };
    }
  } catch {
    return { valid: false, error: 'Invalid base64url signature', code: ErrorCode.INVALID_SCHEMA };
  }

  // Verify key fingerprint matches the provided public key
  const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const expectedFingerprint = createHash('sha256').update(rawPub).digest('hex');
  if (claim.keyFingerprint !== expectedFingerprint) {
    return { valid: false, error: 'Key fingerprint does not match provided public key', code: ErrorCode.KEY_NOT_FOUND };
  }

  // Steps 4-5: Extract sig, compute canonical form
  const bytes = canonicalize(claim);

  // Step 8: Ed25519 verify
  const isValid = verify(null, bytes, publicKey, sigBytes);

  if (!isValid) {
    return { valid: false, error: 'Signature verification failed', code: ErrorCode.INVALID_SIGNATURE };
  }

  return { valid: true };
}
