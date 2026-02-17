# 11 — Conformance

This document specifies conformance requirements for MIR protocol implementations. Keywords follow [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119): MUST, MUST NOT, SHOULD, SHOULD NOT, MAY.

## Signer Conformance

A conformant signer (claim creator) MUST:

- [ ] Set `mir` to `1`.
- [ ] Set `type` to a valid claim type: core (`mir.{category}.{action}`) or extension (`{domain}:{category}.{action}`).
- [ ] Set `domain` to a valid DNS hostname controlled by the signer.
- [ ] Set `subject` to a 64-character lowercase hex string (SHA-256 or HMAC-SHA256).
- [ ] Set `timestamp` to a valid ISO 8601 datetime with timezone.
- [ ] Set `keyFingerprint` to `hex(SHA256(raw_32_byte_public_key))`.
- [ ] Compute the canonical form of the claim (all fields except `sig`, keys sorted lexicographically, no whitespace, UTF-8).
- [ ] Sign the canonical bytes with Ed25519 per [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032).
- [ ] Set `sig` to the base64url-encoded signature (no padding, 86 characters).
- [ ] Publish at least one public key via DNS TXT (`_mir-key.{domain}`) or `https://{domain}/.well-known/mir.json`.
- [ ] Produce claims that validate against [mir-claim.schema.json](schemas/mir-claim.schema.json).

A conformant signer MUST NOT:

- [ ] Include plaintext PII in `subject` or `metadata`.
- [ ] Use email, phone number, or other directly identifiable values as `externalUserId` without HMAC derivation.
- [ ] Create `mir.`-prefixed claim types outside of protocol versions (reserved namespace).

A conformant signer SHOULD:

- [ ] Use HMAC-SHA256 for subject derivation instead of plain SHA-256.
- [ ] Use integers and strings (not floats) in `metadata`.
- [ ] Rotate signing keys every 90 days.
- [ ] Set timestamps in UTC.

## Verifier Conformance

A conformant verifier MUST:

- [ ] Parse claims as JSON and validate all required fields exist.
- [ ] Validate field formats per the schema.
- [ ] Reject claims with `mir` != 1 (`INVALID_SCHEMA`).
- [ ] Validate `type` matches the core or extension pattern (`INVALID_SCHEMA`).
- [ ] Validate `subject` and `keyFingerprint` are 64-character lowercase hex (`INVALID_SCHEMA`).
- [ ] Validate `sig` is base64url, decoding to exactly 64 bytes (`INVALID_SCHEMA`).
- [ ] Compute canonical form identically to the signing process.
- [ ] Discover the domain's public key via `.well-known/mir.json` with DNS TXT fallback.
- [ ] Match the public key whose `SHA256(raw_32_byte_public_key)` equals `keyFingerprint` (`KEY_NOT_FOUND`).
- [ ] Verify the Ed25519 signature against the canonical bytes and discovered public key (`INVALID_SIGNATURE`).
- [ ] Return a machine-readable error code on rejection.
- [ ] Produce identical canonical bytes for the [test vectors](../test-vectors/) as the reference SDK.

A conformant verifier SHOULD:

- [ ] Cache discovered public keys (respect DNS TTL / HTTP Cache-Control).
- [ ] Re-fetch keys on fingerprint cache miss before returning `KEY_NOT_FOUND`.
- [ ] Log verification failures with error codes for debugging.

A conformant verifier MAY:

- [ ] Reject claims with expired keys (`KEY_EXPIRED`). SHOULD evaluate key validity at the claim's `timestamp`, not at verification time, and allow 5 minutes of clock skew.
- [ ] Reject claims exceeding a freshness window (`CLAIM_EXPIRED`).
- [ ] Reject claims from unexpected domains (`DOMAIN_MISMATCH`).
- [ ] Accept claims with unrecognized extension types (signature validity is independent of type recognition).

## Registry Conformance

A conformant registry MUST:

- [ ] Validate claim signatures on ingestion (reject `INVALID_SIGNATURE`).
- [ ] Validate claim schema on ingestion (reject `INVALID_SCHEMA`).
- [ ] Store claims verbatim — never modify fields or re-encode signatures.
- [ ] Record an independent `ingestedAt` timestamp.
- [ ] Deduplicate by signature hash (`SHA256(sig)`).
- [ ] Support lookup by claim ID, subject hash, and domain.
- [ ] NOT require authentication for read/verification operations.

A conformant registry MUST NOT:

- [ ] Modify claims after ingestion.
- [ ] Strip or alter signatures.
- [ ] Claim to be the sole source of truth.
- [ ] Require API keys for read access.

A conformant registry SHOULD:

- [ ] Support filtering by type and timestamp range.
- [ ] Implement rate limiting.
- [ ] Cache domain public keys for efficient ingestion validation.

## Error Codes

All implementations MUST use these error codes for rejection reasons:

| Code | Category | Meaning |
|------|----------|---------|
| `INVALID_SCHEMA` | Protocol | Malformed JSON, missing field, or format violation |
| `INVALID_SIGNATURE` | Protocol | Ed25519 signature does not verify |
| `KEY_NOT_FOUND` | Protocol | No published key matches `keyFingerprint` |
| `CANONICALIZATION_ERROR` | Protocol | Canonical serialization failed |
| `KEY_EXPIRED` | Verifier policy | Key exists but has expired |
| `CLAIM_EXPIRED` | Verifier policy | Claim timestamp exceeds freshness window |
| `DOMAIN_MISMATCH` | Verifier policy | Domain does not match expected value |

**Protocol** codes are mandatory rejection reasons. **Verifier policy** codes are optional — verifiers decide whether to enforce them.

## Test Vector Conformance

Implementations MUST produce identical results for all [test vectors](../test-vectors/):

- Canonical serialization MUST produce byte-identical output to `canonical.txt`.
- Signature verification MUST produce the expected result in `expected.json`.
- Error codes MUST match the expected error code.

An implementation that fails any test vector is non-conformant.
