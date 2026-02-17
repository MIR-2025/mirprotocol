# Test Vectors

This directory contains known-good and known-bad MIR claims with real Ed25519 signatures for validating implementations across languages and platforms.

## Files

| File | Expected Result | Tests |
|------|----------------|-------|
| `keys.json` | — | Public keys for all test vectors |
| `valid-claim.json` | **ACCEPT** | Valid signature, valid fields |
| `tampered-claim.json` | **REJECT** | `type` field modified after signing |
| `wrong-key-claim.json` | **REJECT** | Verified against wrong public key (fingerprint mismatch) |
| `expired-key-claim.json` | **ACCEPT** (signature) | Valid signature, but key has `expires` in the past |

## How to Use

1. Load `keys.json` to get the public keys.
2. For each test vector file:
   - Read the `verifyWith` field to identify which key to use.
   - Load the corresponding public key from `keys.json`.
   - Run your verification algorithm against `claim` using that public key.
   - Assert the result matches `expectedResult`.

## Canonical Form

The `valid-claim.json` file includes a `canonicalForm` field — the exact JSON string that was signed. Use this to validate your canonical serialization implementation byte-for-byte.

Your implementation should:

1. Remove `sig` from the claim.
2. Serialize with sorted keys and no whitespace.
3. Compare the resulting string to `canonicalForm`.

If the strings match, your serializer is conformant.

## Key Format

Public keys in `keys.json` are the raw 32-byte Ed25519 public key, Base64-encoded. To use them:

1. Base64-decode the `pub` field to get 32 bytes.
2. Construct an Ed25519 public key from those bytes using your platform's crypto library.
3. Verify: `SHA256(raw_32_bytes)` should equal the `fingerprint` field.

## Generating New Vectors

The test vectors were generated using the reference SDK:

```bash
cd sdk && node --input-type=module -e "
import { generateKeyPair, createClaim, subjectHash, canonicalString } from './src/index.js';
// ... generate and sign claims
"
```
