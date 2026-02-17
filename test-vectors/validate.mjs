/**
 * Validate all test vectors against the reference SDK.
 * Run: node test-vectors/validate.mjs
 */

import { createPublicKey, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyClaim, ErrorCode } from '../sdk/src/verify.js';
import { canonicalString } from '../sdk/src/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load keys
const keys = JSON.parse(readFileSync(join(__dirname, 'keys.json'), 'utf8'));

function loadKey(name) {
  const keyData = keys[name];
  const rawBytes = Buffer.from(keyData.pub, 'base64url');

  // Verify fingerprint
  const fp = createHash('sha256').update(rawBytes).digest('hex');
  if (fp !== keyData.fingerprint) {
    throw new Error(`Key ${name}: fingerprint mismatch. Expected ${keyData.fingerprint}, got ${fp}`);
  }

  // Construct Ed25519 public key from raw 32 bytes
  // DER format for Ed25519 public key: 12-byte prefix + 32 raw bytes
  const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const der = Buffer.concat([derPrefix, rawBytes]);
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// Vector 01: Valid claim
console.log('\n01-valid-claim');
{
  const claim = JSON.parse(readFileSync(join(__dirname, '01-valid-claim/claim.json'), 'utf8'));
  const canonical = readFileSync(join(__dirname, '01-valid-claim/canonical.txt'), 'utf8');
  const expected = JSON.parse(readFileSync(join(__dirname, '01-valid-claim/expected.json'), 'utf8'));
  const pubKey = loadKey(expected.verifyWith);

  test('canonical form matches', () => {
    const computed = canonicalString(claim);
    assert(computed === canonical, `\n  Expected: ${canonical}\n  Got:      ${computed}`);
  });

  test('signature verifies (ACCEPT)', () => {
    const result = verifyClaim(claim, pubKey);
    assert(result.valid === true, `Expected valid=true, got ${JSON.stringify(result)}`);
  });
}

// Vector 02: Tampered payload
console.log('\n02-tampered-payload');
{
  const claim = JSON.parse(readFileSync(join(__dirname, '02-tampered-payload/claim.json'), 'utf8'));
  const canonical = readFileSync(join(__dirname, '02-tampered-payload/canonical.txt'), 'utf8');
  const expected = JSON.parse(readFileSync(join(__dirname, '02-tampered-payload/expected.json'), 'utf8'));
  const pubKey = loadKey(expected.verifyWith);

  test('canonical form matches (tampered)', () => {
    const computed = canonicalString(claim);
    assert(computed === canonical, `\n  Expected: ${canonical}\n  Got:      ${computed}`);
  });

  test('signature fails (REJECT INVALID_SIGNATURE)', () => {
    const result = verifyClaim(claim, pubKey);
    assert(result.valid === false, `Expected valid=false, got valid=true`);
    assert(result.code === ErrorCode.INVALID_SIGNATURE, `Expected code INVALID_SIGNATURE, got ${result.code}`);
  });
}

// Vector 03: Wrong key
console.log('\n03-wrong-key');
{
  const claim = JSON.parse(readFileSync(join(__dirname, '03-wrong-key/claim.json'), 'utf8'));
  const expected = JSON.parse(readFileSync(join(__dirname, '03-wrong-key/expected.json'), 'utf8'));
  const pubKey = loadKey(expected.verifyWith);

  test('fingerprint mismatch (REJECT KEY_NOT_FOUND)', () => {
    const result = verifyClaim(claim, pubKey);
    assert(result.valid === false, `Expected valid=false, got valid=true`);
    assert(result.code === ErrorCode.KEY_NOT_FOUND, `Expected code KEY_NOT_FOUND, got ${result.code}`);
  });
}

// Vector 04: Expired key
console.log('\n04-expired-key');
{
  const claim = JSON.parse(readFileSync(join(__dirname, '04-expired-key/claim.json'), 'utf8'));
  const canonical = readFileSync(join(__dirname, '04-expired-key/canonical.txt'), 'utf8');
  const expected = JSON.parse(readFileSync(join(__dirname, '04-expired-key/expected.json'), 'utf8'));
  const pubKey = loadKey(expected.verifyWith);

  test('canonical form matches', () => {
    const computed = canonicalString(claim);
    assert(computed === canonical, `\n  Expected: ${canonical}\n  Got:      ${computed}`);
  });

  test('signature verifies despite expired key (ACCEPT)', () => {
    // keyA_expired has the same raw bytes as keyA, so signature is valid
    const result = verifyClaim(claim, pubKey);
    assert(result.valid === true, `Expected valid=true, got ${JSON.stringify(result)}`);
  });
}

// Vector 05: Key rotation
console.log('\n05-key-rotation');
{
  const claim = JSON.parse(readFileSync(join(__dirname, '05-key-rotation/claim.json'), 'utf8'));
  const canonical = readFileSync(join(__dirname, '05-key-rotation/canonical.txt'), 'utf8');
  const expected = JSON.parse(readFileSync(join(__dirname, '05-key-rotation/expected.json'), 'utf8'));
  const keyB = loadKey('keyB');
  const keyA = loadKey('keyA');

  test('canonical form matches', () => {
    const computed = canonicalString(claim);
    assert(computed === canonical, `\n  Expected: ${canonical}\n  Got:      ${computed}`);
  });

  test('verifies under keyB (ACCEPT)', () => {
    const result = verifyClaim(claim, keyB);
    assert(result.valid === true, `Expected valid=true under keyB, got ${JSON.stringify(result)}`);
  });

  test('fails under keyA (REJECT KEY_NOT_FOUND)', () => {
    const result = verifyClaim(claim, keyA);
    assert(result.valid === false, `Expected valid=false under keyA, got valid=true`);
    assert(result.code === ErrorCode.KEY_NOT_FOUND, `Expected KEY_NOT_FOUND, got ${result.code}`);
  });
}

// Vector 06: Canonicalization trap
console.log('\n06-canonicalization-trap');
{
  const claim = JSON.parse(readFileSync(join(__dirname, '06-canonicalization-trap/claim.json'), 'utf8'));
  const canonical = readFileSync(join(__dirname, '06-canonicalization-trap/canonical.txt'), 'utf8');
  const expected = JSON.parse(readFileSync(join(__dirname, '06-canonicalization-trap/expected.json'), 'utf8'));
  const pubKey = loadKey(expected.verifyWith);

  test('canonical form sorts keys correctly', () => {
    const computed = canonicalString(claim);
    assert(computed === canonical, `\n  Expected: ${canonical}\n  Got:      ${computed}`);
  });

  test('signature verifies with sorted keys (ACCEPT)', () => {
    const result = verifyClaim(claim, pubKey);
    assert(result.valid === true, `Expected valid=true, got ${JSON.stringify(result)}`);
  });
}

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
