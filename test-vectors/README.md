# Test Vectors

Authoritative test vectors for MIR protocol conformance testing. These contain real Ed25519 signatures and are **normative** — any implementation that produces different results is non-conformant.

## Keys

`keys.json` contains the public keys used across all vectors:

| Key | Description |
|-----|-------------|
| `keyA` | Primary signing key (active) |
| `keyB` | Second signing key (rotation scenario) |
| `keyA_expired` | Same key as `keyA` but with `expires: "2025-12-31T23:59:59Z"` |

## Vectors

| # | Directory | Expected | Error Code | Tests |
|---|-----------|----------|------------|-------|
| 1 | `01-valid-claim/` | **ACCEPT** | — | Happy path: valid signature, valid fields |
| 2 | `02-tampered-payload/` | **REJECT** | `INVALID_SIGNATURE` | Domain changed by one byte (`.com` → `.con`) after signing |
| 3 | `03-wrong-key/` | **REJECT** | `KEY_NOT_FOUND` | Signed by `keyB`, verified against `keyA` (fingerprint mismatch) |
| 4 | `04-expired-key/` | **ACCEPT** | — | Valid signature, but key has `expires` in the past. Verifier policy may reject with `KEY_EXPIRED`. |
| 5 | `05-key-rotation/` | **ACCEPT** under `keyB`, **REJECT** under `keyA` | `KEY_NOT_FOUND` | Signed by new key after rotation |
| 6 | `06-canonicalization-trap/` | **ACCEPT** | — | JSON keys deliberately unsorted + nested metadata keys in reverse order. Canonical serialization must sort before verification. |

## File Format

Each vector directory contains:

| File | Description |
|------|-------------|
| `claim.json` | The MIR claim as human-readable JSON |
| `canonical.txt` | The exact canonical byte string (UTF-8, no trailing newline) that is signed/verified |
| `signature.txt` | The base64url-encoded signature string (matches `sig` field in `claim.json`) |
| `expected.json` | Expected verification result, error code, and which key to use |

## How to Use

```
For each vector:
  1. Read keys.json → load the key specified in expected.json.verifyWith
  2. Read claim.json → the claim to verify
  3. Read canonical.txt → compare against your canonicalization output
  4. Verify the claim against the public key
  5. Assert the result matches expected.json
```

### Canonical Form Validation

Your canonicalization implementation MUST produce byte-identical output to `canonical.txt`. To test:

1. Remove `sig` from the claim.
2. Sort keys recursively, serialize as compact JSON, encode as UTF-8.
3. Compare byte-for-byte against `canonical.txt`.

### Key Loading

Public keys in `keys.json` are raw 32-byte Ed25519 keys, base64url-encoded (no padding, 43 characters). To load:

1. Base64url-decode `pub` to get 32 raw bytes.
2. Construct an Ed25519 public key from those bytes.
3. Verify: `hex(SHA256(raw_bytes))` MUST equal `fingerprint`.

### Encoding

All signatures and public keys use **base64url without padding** ([RFC 4648 §5](https://datatracker.ietf.org/doc/html/rfc4648#section-5)). Characters: `A-Z a-z 0-9 - _`. No `+`, `/`, or `=`.
