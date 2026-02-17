/**
 * MIR claim creation and signing.
 *
 * Uses Node.js crypto (Ed25519) — no external dependencies.
 */

import { createHash, sign, generateKeyPairSync } from 'node:crypto';
import { canonicalize } from './serialize.js';

/**
 * Valid MIR claim types.
 */
export const CLAIM_TYPES = [
  'transaction.initiated',
  'transaction.completed',
  'transaction.fulfilled',
  'transaction.cancelled',
  'transaction.refunded',
  'transaction.disputed',
  'transaction.chargeback',
  'account.created',
  'account.updated',
  'account.verified',
  'account.suspended',
  'account.closed',
  'review.submitted',
  'review.received',
  'rating.received',
  'message.sent',
  'message.received',
  'response.provided',
  'policy.warning',
  'policy.violation',
  'terms.violation',
  'signal.positive',
  'signal.negative',
];

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
 * Compute a MIR subject hash.
 *
 * @param {string} domain - The issuing domain.
 * @param {string} externalUserId - The platform-specific user ID.
 * @returns {string} SHA-256 hex hash.
 */
export function subjectHash(domain, externalUserId) {
  return createHash('sha256').update(`${domain}:${externalUserId}`).digest('hex');
}

/**
 * Create and sign a MIR claim.
 *
 * @param {object} params
 * @param {string} params.type - Claim type (e.g., "transaction.completed").
 * @param {string} params.domain - Issuing domain.
 * @param {string} params.subject - SHA-256 subject hash.
 * @param {string} params.timestamp - ISO 8601 timestamp.
 * @param {object} [params.metadata] - Optional metadata.
 * @param {import('node:crypto').KeyObject} params.privateKey - Ed25519 private key.
 * @param {string} params.keyFingerprint - Fingerprint of the corresponding public key.
 * @returns {object} The signed MIR claim.
 */
export function createClaim({ type, domain, subject, timestamp, metadata, privateKey, keyFingerprint: kf }) {
  if (!CLAIM_TYPES.includes(type)) {
    throw new Error(`Unknown claim type: "${type}"`);
  }

  if (!/^[a-f0-9]{64}$/.test(subject)) {
    throw new Error('Subject must be a 64-character lowercase hex string (SHA-256 hash).');
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

  claim.sig = signature.toString('base64');

  return claim;
}
