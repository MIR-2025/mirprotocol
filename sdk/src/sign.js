/**
 * MIR claim creation and signing.
 *
 * Uses Node.js crypto (Ed25519) — no external dependencies.
 */

import { createHash, createHmac, sign, generateKeyPairSync } from 'node:crypto';
import { canonicalize } from './serialize.js';

/**
 * Core MIR claim types (protocol-defined).
 * All core types use the `mir.` namespace prefix.
 * Types without a colon are reserved for the MIR protocol.
 */
export const CORE_CLAIM_TYPES = [
  'mir.transaction.initiated',
  'mir.transaction.completed',
  'mir.transaction.fulfilled',
  'mir.transaction.cancelled',
  'mir.transaction.refunded',
  'mir.transaction.disputed',
  'mir.transaction.chargeback',
  'mir.account.created',
  'mir.account.updated',
  'mir.account.verified',
  'mir.account.suspended',
  'mir.account.closed',
  'mir.review.submitted',
  'mir.review.received',
  'mir.message.sent',
  'mir.message.received',
  'mir.response.provided',
  'mir.policy.warning',
  'mir.policy.violation',
  'mir.terms.violation',
];

/**
 * Validate a claim type string.
 * Core types: mir.{category}.{action} (namespaced, no colon)
 * Extension types: {domain}:{category}.{action}
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isValidClaimType(type) {
  // Core type: mir.{category}.{action}
  if (/^mir\.[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/.test(type)) {
    return true;
  }
  // Extension type: {domain}:{category}.{action}
  if (/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}:[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/.test(type)) {
    return true;
  }
  return false;
}

/**
 * Generate an Ed25519 key pair for signing MIR claims.
 *
 * @returns {{ privateKey: import('node:crypto').KeyObject, publicKey: import('node:crypto').KeyObject, fingerprint: string }}
 */
export function generateKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const fingerprint = createHash('sha256').update(rawPub).digest('hex');
  return { privateKey, publicKey, fingerprint };
}

/**
 * Compute the key fingerprint (SHA-256 of raw 32-byte public key).
 *
 * @param {import('node:crypto').KeyObject} publicKey
 * @returns {string} Hex-encoded fingerprint.
 */
export function keyFingerprint(publicKey) {
  const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return createHash('sha256').update(rawPub).digest('hex');
}

/**
 * Compute a MIR subject hash (basic mode — SHA-256).
 * For stronger privacy, use subjectHashHmac instead.
 *
 * @param {string} domain - The issuing domain.
 * @param {string} externalUserId - The platform-specific user ID (MUST NOT be email/phone).
 * @returns {string} SHA-256 hex hash.
 */
export function subjectHash(domain, externalUserId) {
  return createHash('sha256').update(`${domain}:${externalUserId}`).digest('hex');
}

/**
 * Compute a MIR subject hash (HMAC mode — recommended).
 * Resistant to brute-force even if externalUserId format is known.
 *
 * @param {string} domain - The issuing domain.
 * @param {string} externalUserId - The platform-specific user ID.
 * @param {string | Buffer} domainSecret - Stable domain-specific secret (never published).
 * @returns {string} HMAC-SHA256 hex hash.
 */
export function subjectHashHmac(domain, externalUserId, domainSecret) {
  return createHmac('sha256', domainSecret).update(`${domain}:${externalUserId}`).digest('hex');
}

/**
 * Create and sign a MIR claim.
 *
 * @param {object} params
 * @param {string} params.type - Claim type (core or extension).
 * @param {string} params.domain - Issuing domain.
 * @param {string} params.subject - Subject hash (64-char lowercase hex).
 * @param {string} params.timestamp - ISO 8601 timestamp.
 * @param {object} [params.metadata] - Optional metadata.
 * @param {import('node:crypto').KeyObject} params.privateKey - Ed25519 private key.
 * @param {string} params.keyFingerprint - Fingerprint of the corresponding public key.
 * @returns {object} The signed MIR claim.
 */
export function createClaim({ type, domain, subject, timestamp, metadata, privateKey, keyFingerprint: kf }) {
  if (!isValidClaimType(type)) {
    throw new Error(`Invalid claim type: "${type}". Must be mir.{category}.{action} or {domain}:{category}.{action}`);
  }

  if (!/^[a-f0-9]{64}$/.test(subject)) {
    throw new Error('Subject must be a 64-character lowercase hex string (SHA-256 or HMAC-SHA256 hash).');
  }

  if (!/^[a-f0-9]{64}$/.test(kf)) {
    throw new Error('keyFingerprint must be a 64-character lowercase hex string.');
  }

  const claim = {
    mir: 1,
    type,
    domain,
    subject,
    timestamp,
    keyFingerprint: kf,
  };

  if (metadata !== undefined) {
    claim.metadata = metadata;
  }

  const bytes = canonicalize(claim);
  const signature = sign(null, bytes, privateKey);

  claim.sig = signature.toString('base64url');

  return claim;
}
