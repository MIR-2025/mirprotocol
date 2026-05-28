# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MIR Protocol (Memory Infrastructure Registry) is an open specification (v0.2.0, draft) for recording and verifying participation claims across distributed systems. Claims are Ed25519-signed JSON objects that can be independently verified without any central authority. The protocol is non-scoring and non-evaluative — it records that something happened, not whether it was good.

## Repository Structure

- `protocol/` — 11-document specification (claim format, signature model, key discovery, verification, conformance, etc.)
- `protocol/schemas/mir-claim.schema.json` — JSON Schema (draft-07) for claim validation
- `sdk/` — Reference JavaScript implementation (Node.js 20+, zero external dependencies)
- `test-vectors/` — 6 normative interop test vectors with real Ed25519 signatures

## Commands

```bash
# SDK tests (30 tests)
cd sdk && npm install && npm test

# Test vector generation/validation
node test-vectors/generate.mjs
node test-vectors/validate.mjs
```

## SDK Architecture

The SDK (`sdk/src/`) has three modules exporting a minimal public API:

- **`serialize.js`** — Canonical JSON serialization (remove `sig`, sort keys recursively, compact JSON, UTF-8)
- **`sign.js`** — `generateKeyPair()`, `keyFingerprint()`, `subjectHash()`, `subjectHashHmac()`, `createClaim()`, `isValidClaimType()`, `CORE_CLAIM_TYPES`
- **`verify.js`** — `verifyClaim(claim, publicKey)` returns `{valid, error?, code?}`, plus `ErrorCode` constants

All crypto uses Node.js built-in `crypto` module (Ed25519/RFC 8032). Signatures are base64url without padding.

## Key Protocol Concepts

- **Claim**: Signed JSON with fields: `mir`, `type`, `domain`, `subject`, `timestamp`, `keyFingerprint`, `sig`, optional `metadata`
- **Subject identifier**: `hex(SHA256("domain:userId"))` or `hex(HMAC-SHA256(secret, "domain:userId"))` — never plaintext PII
- **Key discovery**: `.well-known/mir.json` (preferred) or DNS TXT at `_mir-key.{domain}`
- **Canonical form**: Remove `sig`, sort keys lexicographically (recursive), compact JSON, UTF-8 — this is what gets signed/verified
- **Core claim types**: Namespaced as `mir.{category}.{action}` (e.g., `mir.transaction.completed`). Extensions use `{domain}:{category}.{action}`
- **Error codes**: `INVALID_SCHEMA`, `INVALID_SIGNATURE`, `KEY_NOT_FOUND`, `KEY_EXPIRED`, `CLAIM_EXPIRED`, `DOMAIN_MISMATCH`, `CANONICALIZATION_ERROR`

## Test Vectors

Each vector in `test-vectors/` contains `claim.json`, `canonical.txt`, `signature.txt`, and `expected.json`. The six scenarios: valid claim, tampered payload, wrong key, expired key, key rotation, and canonicalization trap (unsorted keys). These are normative — implementations must pass all of them.

## Editing Guidelines

- Specification documents use RFC 2119 keywords (MUST/SHOULD/MAY) — use them precisely per `protocol/11-conformance.md`
- When modifying claim format or verification logic, update all three: spec docs, JSON Schema, and test vectors
- The SDK must remain zero-dependency (Node.js built-in `crypto` only)
- Signatures are base64url **without padding** (RFC 4648 section 5)
