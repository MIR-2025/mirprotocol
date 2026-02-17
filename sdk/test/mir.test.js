import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKeyPair,
  createClaim,
  verifyClaim,
  subjectHash,
  subjectHashHmac,
  keyFingerprint,
  canonicalize,
  canonicalString,
  isValidClaimType,
  CORE_CLAIM_TYPES,
  ErrorCode,
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

    it('HMAC mode produces a 64-char hex hash', () => {
      const hash = subjectHashHmac('example.com', 'user_12345', 'domain-secret');
      assert.match(hash, /^[a-f0-9]{64}$/);
    });

    it('HMAC mode is deterministic', () => {
      const a = subjectHashHmac('example.com', 'user_12345', 'secret');
      const b = subjectHashHmac('example.com', 'user_12345', 'secret');
      assert.equal(a, b);
    });

    it('HMAC mode differs from plain SHA-256', () => {
      const plain = subjectHash('example.com', 'user_12345');
      const hmac = subjectHashHmac('example.com', 'user_12345', 'secret');
      assert.notEqual(plain, hmac);
    });

    it('HMAC mode differs with different secrets', () => {
      const a = subjectHashHmac('example.com', 'user_12345', 'secret-a');
      const b = subjectHashHmac('example.com', 'user_12345', 'secret-b');
      assert.notEqual(a, b);
    });
  });

  describe('Claim type validation', () => {
    it('accepts core types', () => {
      assert.ok(isValidClaimType('mir.transaction.completed'));
      assert.ok(isValidClaimType('mir.account.verified'));
      assert.ok(isValidClaimType('mir.signal.positive'));
    });

    it('accepts extension types with domain prefix', () => {
      assert.ok(isValidClaimType('shopify.com:loyalty.earned'));
      assert.ok(isValidClaimType('example.co.uk:custom.event'));
    });

    it('rejects invalid types', () => {
      assert.ok(!isValidClaimType(''));
      assert.ok(!isValidClaimType('nodot'));
      assert.ok(!isValidClaimType('UPPER.case'));
      assert.ok(!isValidClaimType('.leading.dot'));
      assert.ok(!isValidClaimType('trailing.'));
      // Bare category.action without mir. prefix is not valid
      assert.ok(!isValidClaimType('transaction.completed'));
      assert.ok(!isValidClaimType('account.verified'));
    });
  });

  describe('Canonical serialization', () => {
    it('sorts keys lexicographically', () => {
      const claim = { mir: 1, type: 'mir.account.created', domain: 'a.com', subject: 'a'.repeat(64), timestamp: '2026-01-01T00:00:00Z', keyFingerprint: 'b'.repeat(64) };
      const str = canonicalString(claim);
      const keys = [...str.matchAll(/"([^"]+)":/g)].map(m => m[1]);
      const sorted = [...keys].sort();
      assert.deepEqual(keys, sorted);
    });

    it('excludes sig field', () => {
      const claim = { mir: 1, sig: 'should-be-excluded', type: 'mir.account.created' };
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

    it('produces identical bytes for different key ordering', () => {
      const a = { mir: 1, type: 'mir.account.created', domain: 'a.com' };
      const b = { domain: 'a.com', mir: 1, type: 'mir.account.created' };
      assert.equal(canonicalString(a), canonicalString(b));
    });
  });

  describe('Claim creation and signing', () => {
    it('creates a valid signed claim with base64url encoding', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'mir.transaction.completed',
        domain: 'marketplace.example.com',
        subject: subjectHash('marketplace.example.com', 'user_42'),
        timestamp: '2026-02-16T15:30:00Z',
        metadata: { currency: 'USD', count: 1 },
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      assert.equal(claim.mir, 1);
      assert.equal(claim.type, 'mir.transaction.completed');
      assert.equal(claim.domain, 'marketplace.example.com');
      assert.equal(claim.keyFingerprint, keys.fingerprint);
      assert.ok(claim.sig);
      // base64url: no +, no /, no =
      assert.ok(!claim.sig.includes('+'), 'sig must not contain +');
      assert.ok(!claim.sig.includes('/'), 'sig must not contain /');
      assert.ok(!claim.sig.includes('='), 'sig must not contain =');
    });

    it('accepts extension claim types', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'shopify.com:loyalty.earned',
        domain: 'shopify.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });
      assert.equal(claim.type, 'shopify.com:loyalty.earned');
    });

    it('rejects invalid claim types', () => {
      const keys = generateKeyPair();
      assert.throws(() => {
        createClaim({
          type: 'INVALID',
          domain: 'example.com',
          subject: 'a'.repeat(64),
          timestamp: '2026-01-01T00:00:00Z',
          privateKey: keys.privateKey,
          keyFingerprint: keys.fingerprint,
        });
      }, /Invalid claim type/);
    });

    it('rejects invalid subject hash', () => {
      const keys = generateKeyPair();
      assert.throws(() => {
        createClaim({
          type: 'mir.account.created',
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
        type: 'mir.account.created',
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
        type: 'mir.transaction.completed',
        domain: 'marketplace.example.com',
        subject: subjectHash('marketplace.example.com', 'user_42'),
        timestamp: '2026-02-16T15:30:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
      assert.equal(result.code, undefined);
    });

    it('rejects a tampered claim with INVALID_SIGNATURE', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'mir.transaction.completed',
        domain: 'marketplace.example.com',
        subject: subjectHash('marketplace.example.com', 'user_42'),
        timestamp: '2026-02-16T15:30:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      claim.type = 'mir.transaction.refunded';
      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, false);
      assert.equal(result.code, ErrorCode.INVALID_SIGNATURE);
    });

    it('rejects wrong key with KEY_NOT_FOUND', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();
      const claim = createClaim({
        type: 'mir.account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys1.privateKey,
        keyFingerprint: keys1.fingerprint,
      });

      const result = verifyClaim(claim, keys2.publicKey);
      assert.equal(result.valid, false);
      assert.equal(result.code, ErrorCode.KEY_NOT_FOUND);
    });

    it('rejects missing fields with INVALID_SCHEMA', () => {
      const keys = generateKeyPair();
      const result = verifyClaim({ mir: 1, type: 'mir.account.created' }, keys.publicKey);
      assert.equal(result.valid, false);
      assert.equal(result.code, ErrorCode.INVALID_SCHEMA);
    });

    it('rejects unsupported protocol version', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'mir.account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });

      claim.mir = 99;
      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, false);
      assert.equal(result.code, ErrorCode.INVALID_SCHEMA);
    });

    it('rejects mismatched key fingerprint', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();

      const claim = createClaim({
        type: 'mir.account.created',
        domain: 'example.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys1.privateKey,
        keyFingerprint: keys1.fingerprint,
      });

      const result = verifyClaim(claim, keys2.publicKey);
      assert.equal(result.valid, false);
      assert.equal(result.code, ErrorCode.KEY_NOT_FOUND);
    });

    it('accepts extension claim types during verification', () => {
      const keys = generateKeyPair();
      const claim = createClaim({
        type: 'myplatform.com:custom.action',
        domain: 'myplatform.com',
        subject: 'a'.repeat(64),
        timestamp: '2026-01-01T00:00:00Z',
        privateKey: keys.privateKey,
        keyFingerprint: keys.fingerprint,
      });
      const result = verifyClaim(claim, keys.publicKey);
      assert.equal(result.valid, true);
    });
  });

  describe('All core claim types', () => {
    it('can create and verify every core claim type', () => {
      const keys = generateKeyPair();
      for (const type of CORE_CLAIM_TYPES) {
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
