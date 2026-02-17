/**
 * Generate all test vectors with real Ed25519 signatures.
 * Run: node test-vectors/generate.mjs
 *
 * This regenerates keys.json and all 6 vector directories.
 * Private keys are printed to stdout for reproducibility but NOT stored.
 */

import { generateKeyPairSync, createHash, sign, createPublicKey } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Helpers ---

function sortDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortDeep(value[key]);
  return sorted;
}

function canonicalString(claim) {
  const { sig, ...payload } = claim;
  return JSON.stringify(sortDeep(payload));
}

function canonicalBytes(claim) {
  return new TextEncoder().encode(canonicalString(claim));
}

function fingerprint(publicKey) {
  const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return createHash('sha256').update(rawPub).digest('hex');
}

function rawPubBase64url(publicKey) {
  return publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64url');
}

function signClaim(claim, privateKey) {
  const bytes = canonicalBytes(claim);
  const signature = sign(null, bytes, privateKey);
  return signature.toString('base64url');
}

function writeVector(dir, claim, canonical, expected) {
  mkdirSync(join(__dirname, dir), { recursive: true });
  writeFileSync(join(__dirname, dir, 'claim.json'), JSON.stringify(claim, null, 2) + '\n');
  writeFileSync(join(__dirname, dir, 'canonical.txt'), canonical);
  writeFileSync(join(__dirname, dir, 'signature.txt'), claim.sig);
  writeFileSync(join(__dirname, dir, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
}

// --- Generate key pairs ---

const keyPairA = generateKeyPairSync('ed25519');
const keyPairB = generateKeyPairSync('ed25519');

const fpA = fingerprint(keyPairA.publicKey);
const fpB = fingerprint(keyPairB.publicKey);
const pubA = rawPubBase64url(keyPairA.publicKey);
const pubB = rawPubBase64url(keyPairB.publicKey);

console.log('keyA fingerprint:', fpA);
console.log('keyA pub:', pubA);
console.log('keyB fingerprint:', fpB);
console.log('keyB pub:', pubB);

// Write keys.json
const keysJson = {
  keyA: {
    pub: pubA,
    fingerprint: fpA,
    alg: 'Ed25519',
    created: '2026-01-01T00:00:00Z',
    expires: null,
  },
  keyB: {
    pub: pubB,
    fingerprint: fpB,
    alg: 'Ed25519',
    created: '2026-02-01T00:00:00Z',
    expires: null,
  },
  keyA_expired: {
    pub: pubA,
    fingerprint: fpA,
    alg: 'Ed25519',
    created: '2025-01-01T00:00:00Z',
    expires: '2025-12-31T23:59:59Z',
  },
};

writeFileSync(join(__dirname, 'keys.json'), JSON.stringify(keysJson, null, 2) + '\n');
console.log('\nkeys.json written');

// --- Subject hashes ---
const subjectMarketplace = createHash('sha256').update('marketplace.example.com:user_42').digest('hex');
const subjectExample = createHash('sha256').update('example.com:user_99').digest('hex');
const subjectReviews = createHash('sha256').update('reviews.example.com:reviewer_7').digest('hex');
const subjectPlatform = createHash('sha256').update('platform.example.com:user_200').digest('hex');
const subjectTrap = createHash('sha256').update('trap.example.com:user_trap').digest('hex');

// --- Vector 01: Valid claim ---
{
  const claim = {
    mir: 1,
    type: 'mir.transaction.completed',
    domain: 'marketplace.example.com',
    subject: subjectMarketplace,
    timestamp: '2026-02-16T15:30:00Z',
    keyFingerprint: fpA,
    metadata: { currency: 'USD', count: 1 },
  };
  claim.sig = signClaim(claim, keyPairA.privateKey);
  const canonical = canonicalString(claim);

  writeVector('01-valid-claim', claim, canonical, {
    result: 'ACCEPT',
    verifyWith: 'keyA',
  });
  console.log('01-valid-claim written');
}

// --- Vector 02: Tampered payload (.com → .con) ---
{
  const claim = {
    mir: 1,
    type: 'mir.transaction.completed',
    domain: 'marketplace.example.com',
    subject: subjectMarketplace,
    timestamp: '2026-02-16T15:30:00Z',
    keyFingerprint: fpA,
    metadata: { currency: 'USD', count: 1 },
  };
  claim.sig = signClaim(claim, keyPairA.privateKey);

  // Tamper: change domain after signing
  const tampered = { ...claim, domain: 'marketplace.example.con' };
  const canonical = canonicalString(tampered);

  writeVector('02-tampered-payload', tampered, canonical, {
    result: 'REJECT',
    code: 'INVALID_SIGNATURE',
    verifyWith: 'keyA',
    note: 'domain changed from .com to .con after signing',
  });
  console.log('02-tampered-payload written');
}

// --- Vector 03: Wrong key (signed by keyB, verify with keyA) ---
{
  const claim = {
    mir: 1,
    type: 'mir.account.created',
    domain: 'example.com',
    subject: subjectExample,
    timestamp: '2026-01-15T10:00:00Z',
    keyFingerprint: fpB,
  };
  claim.sig = signClaim(claim, keyPairB.privateKey);
  const canonical = canonicalString(claim);

  writeVector('03-wrong-key', claim, canonical, {
    result: 'REJECT',
    code: 'KEY_NOT_FOUND',
    verifyWith: 'keyA',
    note: 'Claim signed by keyB, verified against keyA. Fingerprint mismatch.',
  });
  console.log('03-wrong-key written');
}

// --- Vector 04: Expired key (valid signature, key expired) ---
{
  const claim = {
    mir: 1,
    type: 'mir.account.verified',
    domain: 'reviews.example.com',
    subject: subjectReviews,
    timestamp: '2025-06-01T12:00:00Z',
    keyFingerprint: fpA,
    metadata: { verified_purchase: true },
  };
  claim.sig = signClaim(claim, keyPairA.privateKey);
  const canonical = canonicalString(claim);

  writeVector('04-expired-key', claim, canonical, {
    result: 'ACCEPT',
    code: null,
    verifyWith: 'keyA_expired',
    note: 'Signature is valid. Key expires 2025-12-31. Claim timestamp (2025-06-01) predates expiry, so SHOULD be accepted. Verifier policy may reject via KEY_EXPIRED.',
  });
  console.log('04-expired-key written');
}

// --- Vector 05: Key rotation (signed by keyB) ---
{
  const claim = {
    mir: 1,
    type: 'mir.account.updated',
    domain: 'platform.example.com',
    subject: subjectPlatform,
    timestamp: '2026-02-10T08:00:00Z',
    keyFingerprint: fpB,
  };
  claim.sig = signClaim(claim, keyPairB.privateKey);
  const canonical = canonicalString(claim);

  writeVector('05-key-rotation', claim, canonical, {
    verifyWith_keyB: { result: 'ACCEPT', code: null },
    verifyWith_keyA: { result: 'REJECT', code: 'KEY_NOT_FOUND' },
    note: 'Signed by keyB (new key). Valid under keyB. Fails against keyA (old key) because fingerprint does not match.',
  });
  console.log('05-key-rotation written');
}

// --- Vector 06: Canonicalization trap (unsorted keys + nested metadata) ---
{
  // Build claim with sorted keys for signing
  const claimForSigning = {
    mir: 1,
    type: 'mir.account.verified',
    domain: 'trap.example.com',
    subject: subjectTrap,
    timestamp: '2026-03-01T00:00:00Z',
    keyFingerprint: fpA,
    metadata: { zebra: 1, alpha: 2 },
  };
  const sig = signClaim(claimForSigning, keyPairA.privateKey);

  // Write claim.json with deliberately unsorted keys
  const claimUnsorted = {
    timestamp: '2026-03-01T00:00:00Z',
    domain: 'trap.example.com',
    mir: 1,
    subject: subjectTrap,
    metadata: { zebra: 1, alpha: 2 },
    type: 'mir.account.verified',
    keyFingerprint: fpA,
    sig,
  };

  const canonical = canonicalString(claimForSigning);

  const dir = '06-canonicalization-trap';
  mkdirSync(join(__dirname, dir), { recursive: true });
  writeFileSync(join(__dirname, dir, 'claim.json'), JSON.stringify(claimUnsorted, null, 2) + '\n');
  writeFileSync(join(__dirname, dir, 'canonical.txt'), canonical);
  writeFileSync(join(__dirname, dir, 'signature.txt'), sig);
  writeFileSync(join(__dirname, dir, 'expected.json'), JSON.stringify({
    result: 'ACCEPT',
    code: null,
    verifyWith: 'keyA',
    note: 'JSON keys are deliberately unsorted. Canonical serialization must sort before verifying. metadata.zebra appears before metadata.alpha in the claim JSON but must sort to alpha < zebra in canonical form.',
  }, null, 2) + '\n');

  console.log('06-canonicalization-trap written');
}

console.log('\nAll vectors generated. Run: node test-vectors/validate.mjs');
