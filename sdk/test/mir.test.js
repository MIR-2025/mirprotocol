import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKeyPair,
  createClaim,
  verifyClaim,
  subjectHash,
  keyFingerprint,
  canonicalize,
  canonicalString,
  CLAIM_TYPES,
} from '../src/index.js';

describe('MIR Protocol SDK', () => {

  describe('Key generation', () => {
    it('generates an Ed25519 key pair with fingerprint', () => {
      const keys = generateKeyPair();
      assert.ok(keys.privateKey);
      assert.ok(keys.publicKey);
      assert.match(keys.fingerprint, /^[a-f0-9]{64}$/);
    });

    it('fingerprint matches keyFingerprint utility', () => {
      const keys = generateKeyPair();
      assert.equal(keys.fingerprint, keyFingerprint(keys.publicKey));
    });
  });

  describe('Subject hashing', () => {
    it('produces a 64-char hex SHA-256 hash', () => {
      const hash = subjectHash('example.com', 'user_12345');
      assert.match(hash, /^[a-f0-9]{64}$/);
    });

    it('is deterministic', () => {
      const a = subjectHash('example.com', 'user_12345');
      const b = subjectHash('example.com', 'user_12345');
      assert.equal(a, b);
    });

    it('differs across domains for the same user', () => {
      const a = subjectHash('example.com', 'user_12345');
      const b = subjectHash('other.com', 'user_12345');
      assert.notEqual(a, b);
    });
  });

  describe('Canonical serialization', () => {
    it('sorts keys lexicographically', () => {
      const claim = { mir: 1, type: 'account.created', domain: 'a.com', subject: 'a'.repeat(64), timestamp: '2026-01-01T00:00:00Z', keyFingerprint: 'b'.repeat(64) };
      const str = canonicalString(claim);
      const keys = [...str.matchAll(/"([^"]+)":/g)].map(m => m[1]);
      const sorted = [...keys].sort();
      assert.deepEqual(keys, sorted);
    });

    it('excludes sig field', () => {
      const claim = { mir: 1, sig: 'should-be-excluded', type: 'account.created' };
      const str = canonicalString(claim);
      assert.ok(!str.includes('sig'));
    });

    it('sorts nested objects', () => {
      const claim = { mir: 1, metadata: { zebra: 1, alpha: 2 } };
      const str = canonicalString(claim);
      assert.ok(str.indexOf('alpha') < str.indexOf('zebra'));
    });

    it('returns UTF-8 bytes', () => {
      const claim = { mir: 1 };
      const bytes = canonicalize(claim);
      assert.ok(bytes instanceof Uint8Array);
    });
  });

  describe('Claim creation and signing', () => {
    it('creates a valid signed claim', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'transaction.completed',
        domain: 'marketplace.example.com',
        subject: subjectHash('marketplace.example.com', 'user_42'),
        timestamp: '2026-02-16T15:30:00Z',
        metadata: { amount: 149.99, currency: 'USD' },
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      assert.equal(claim.mir, 1);
      assert.equal(claim.type, 'transaction.completed');
      assert.equal(claim.domain, 'marketplace.example.com');
      assert.equal(claim.keyFingerprint, keys.fingerprint);
      assert.ok(claim.sig);
    });

    it('rejects unknown claim types', () => {
      const keys = generateKeyPair();
      assert.throws(() => {
        createClaim({
          type: 'invalid.type',
          domain: 'example.com',
          subject: 'a'.repeat(64),
          timestamp: '2026-01-01T00:00:00Z',
          privateKey: keys.privateKey,
          keyFingerprint: keys.fingerprint,
        });
      }, /Unknown claim type/);
    });

    it('rejects invalid subject hash', () => {
      const keys = generateKeyPair();
      assert.throws(() => {
        createClaim({
          type: 'account.created',
          domain: 'example.com',
          subject: 'not-a-hash',
          timestamp: '2026-01-01T00:00:00Z',
          privateKey: keys.privateKey,
          keyFingerprint: keys.fingerprint,
        });
      }, /Subject must be/);
    });

    it('creates claims without metadata', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      assert.equal(claim.metadata, undefined);
      assert.ok(claim.sig);
    });
  });

  describe('Verification', () => {
    it('accepts a valid claim', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'transaction.completed',
        domain: 'marketplace.example.com',
        subject: subjectHash('marketplace.example.com', 'user_42'),
        timestamp: '2026-02-16T15:30:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    it('rejects a tampered claim', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'transaction.completed',
        domain: 'marketplace.example.com',
        subject: subjectHash('marketplace.example.com', 'user_42'),
        timestamp: '2026-02-16T15:30:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      claim.type = 'transaction.refunded';
      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, false);
      assert.equal(result.error, 'Signature verification failed');
    });

    it('rejects a claim signed by a different key', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();
      const claim = createClaim({
        type: 'account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys1.privateKey,
        keyFingerprint: keys1.fingerprint,
      });

      const result = verifyClaim(claim, keys2.publicKey);
      assert.equal(result.valid, false);
    });

    it('rejects a claim with missing fields', () => {
      const keys = generateKeyPair();
      const result = verifyClaim({ mir: 1, type: 'account.created' }, keys.publicKey);
      assert.equal(result.valid, false);
      assert.match(result.error, /Missing required field/);
    });

    it('rejects unsupported protocol version', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      claim.mir = 99;
      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, false);
      assert.match(result.error, /Unsupported protocol version/);
    });

    it('rejects mismatched key fingerprint', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();

      const claim = createClaim({
        type: 'account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys1.privateKey,
        keyFingerprint: keys1.fingerprint,
      });

      // Verify with keys2 — fingerprint in claim won't match keys2's public key
      const result = verifyClaim(claim, keys2.publicKey);
      assert.equal(result.valid, false);
      assert.match(result.error, /fingerprint does not match/);
    });
  });

  describe('All claim types', () => {
    it('can create and verify every registered claim type', () => {
      const keys = generateKeyPair();
      for (const type of CLAIM_TYPES) {
        const claim = createClaim({
          type,
          domain: 'example.com',
          subject: 'a'.repeat(64),
          timestamp: '2026-01-01T00:00:00Z',
          privateKey: keys.privateKey,
          keyFingerprint: keys.fingerprint,
        });
        const result = verifyClaim(claim, keys.publicKey);
        assert.equal(result.valid, true, `Failed for type: ${type}`);
      }
    });
  });
});
