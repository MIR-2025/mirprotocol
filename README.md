# MIR Protocol

**Memory Infrastructure Registry**

Version 0.2.0 — Draft Specification

---

MIR is a neutral, non-scoring continuity layer for digital participation.

It defines a structured format for recording participation claims — cryptographically signed by the issuing domain, independently verifiable by anyone, and portable across systems without reliance on any central authority.

## Why IAM Teams Care

Identity stacks decide. MIR supplies the durable context they decide *with*.

- **Portable participation history.** Claims move with the subject across systems. No vendor lock-in, no proprietary APIs to integrate.
- **Offline-verifiable.** Ed25519 signatures verify without calling home. Fits Zero Trust architectures where every assertion is checked, nothing is implicitly trusted.
- **No opinion layer.** MIR doesn't score, rank, or recommend. Your policy engine consumes raw claims and applies your rules. MIR stays out of the decision path.
- **Survives domain rotation.** Signed claims remain verifiable even after key rotation or domain changes. Historical context doesn't evaporate.

MIR is the participation layer your identity stack reads from. It doesn't replace your IdP, your SIEM, or your policy engine. It gives them something durable to read.

## Principles

- **Claims are self-contained.** Every claim carries an Ed25519 signature. Verification requires only the claim and the domain's public key.
- **No central authority.** Registries provide discovery and availability. They are not trust anchors. They cannot forge signatures.
- **Non-scoring.** MIR records participation. It does not calculate trust, reputation, or behavioral rankings.
- **Non-evaluative.** MIR proves who signed a claim. It does not judge whether the claim is true.
- **Privacy-preserving.** Subject identifiers are domain-scoped SHA-256 hashes. No PII enters the protocol.

## Registry Is Optional

A MIR registry stores and indexes claims for convenience. It is **not** a trust anchor. It cannot forge, modify, or invalidate claims — signatures are verified against the domain's public key, not the registry's word.

You can verify any MIR claim with nothing more than the claim JSON and the signer's public key (fetched from the domain's DNS TXT record or `.well-known/mir.json`). No registry call required. No API key. No account.

Registries add value by aggregating claims for lookup and providing availability, but they are architecturally replaceable. See [07-Registry Role](protocol/07-registry-role.md).

## How to Implement

| Step | What to do | Reference |
|------|-----------|-----------|
| 1 | Understand the claim structure | [03-Claim Format](protocol/03-claim-format.md) |
| 2 | Generate Ed25519 keys and publish via DNS or `.well-known` | [05-Domain Key Discovery](protocol/05-domain-key-discovery.md) |
| 3 | Implement canonical serialization (sort keys, exclude `sig`, compact JSON, UTF-8) | [04-Signature Model](protocol/04-signature-model.md) |
| 4 | Sign claims and produce base64url signatures | [04-Signature Model](protocol/04-signature-model.md) |
| 5 | Implement the verification algorithm | [06-Verification Process](protocol/06-verification-process.md) |
| 6 | Validate against the authoritative test vectors | [test-vectors/](test-vectors/) |
| 7 | Check conformance requirements | [11-Conformance](protocol/11-conformance.md) |

The [reference SDK](sdk/) (JavaScript, zero dependencies) demonstrates all steps. Run `cd sdk && npm install && npm test` to see 30 tests pass.

## Specification

| # | Document | Description |
|---|----------|-------------|
| 01 | [Overview](protocol/01-overview.md) | Architecture, properties, scope |
| 02 | [Terminology](protocol/02-terminology.md) | Defined terms |
| 03 | [Claim Format](protocol/03-claim-format.md) | Claim structure, fields, types, encoding |
| 04 | [Signature Model](protocol/04-signature-model.md) | Canonical serialization, Ed25519, number handling |
| 05 | [Domain Key Discovery](protocol/05-domain-key-discovery.md) | DNS TXT, `.well-known/mir.json`, key lifecycle |
| 06 | [Verification Process](protocol/06-verification-process.md) | Deterministic verification algorithm, error codes |
| 07 | [Registry Role](protocol/07-registry-role.md) | What registries do and do not provide |
| 08 | [Security Considerations](protocol/08-security-considerations.md) | Cryptographic and operational security |
| 09 | [Threat Model](protocol/09-threat-model.md) | Attack surface and mitigations |
| 10 | [Non-Goals](protocol/10-non-goals.md) | Explicit exclusions |
| 11 | [Conformance](protocol/11-conformance.md) | MUST/SHOULD checklist and error codes |

## Conformance

This specification uses RFC 2119 keywords (MUST, SHOULD, MAY) throughout the protocol documents. Full conformance requirements are in [11-Conformance](protocol/11-conformance.md).

A conformant **signer** MUST:
- Produce claims matching [mir-claim.schema.json](protocol/schemas/mir-claim.schema.json).
- Serialize the signing input using the [canonical serialization rules](protocol/04-signature-model.md#canonical-serialization).
- Sign with Ed25519 per [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032).
- Encode signatures and public keys as base64url without padding ([RFC 4648 §5](https://datatracker.ietf.org/doc/html/rfc4648#section-5)).
- Publish at least one public key via [DNS TXT or `.well-known/mir.json`](protocol/05-domain-key-discovery.md).

A conformant **verifier** MUST:
- Implement the [deterministic verification algorithm](protocol/06-verification-process.md#algorithm).
- Return standard [error codes](protocol/11-conformance.md#error-codes) on rejection.
- Reject claims with missing required fields, invalid formats, or failed signatures.
- Discover keys via `.well-known` with DNS fallback.

A conformant **registry** MUST:
- Validate signatures on ingestion.
- Never modify claims after ingestion.
- Never require authentication for read/verify operations.

## Test Vectors

Six [authoritative test vectors](test-vectors/) with real Ed25519 signatures:

| # | Scenario | Expected |
|---|----------|----------|
| 01 | Valid claim | ACCEPT |
| 02 | Tampered payload (`.com` → `.con`) | REJECT — `INVALID_SIGNATURE` |
| 03 | Wrong key (fingerprint mismatch) | REJECT — `KEY_NOT_FOUND` |
| 04 | Expired key (valid signature) | ACCEPT (policy may reject) |
| 05 | Key rotation | ACCEPT under new key, REJECT under old |
| 06 | Canonicalization trap (unsorted keys) | ACCEPT |

See [test-vectors/README.md](test-vectors/README.md) for file format and usage.

## Schema

- [mir-claim.schema.json](protocol/schemas/mir-claim.schema.json) — JSON Schema (draft-07) for MIR claims

## Reference SDK

A minimal JavaScript SDK for claim creation, signing, and verification:

```
sdk/
├── src/
│   ├── serialize.js    # Canonical JSON serialization
│   ├── sign.js         # Claim creation and signing
│   ├── verify.js       # Signature verification
│   └── index.js        # Public API
├── test/
│   └── mir.test.js     # Test suite (30 tests)
└── package.json
```

No database. No hosting. No API keys. No SaaS logic.

```bash
cd sdk && npm install && npm test
```

## Repository Structure

```
mirprotocol.net/
├── README.md               # This file
├── LICENSE                  # MIT
├── protocol/                # Specification documents
│   ├── 01-overview.md
│   ├── ...
│   ├── 11-conformance.md
│   └── schemas/
│       └── mir-claim.schema.json
├── test-vectors/            # Authoritative interop test vectors
│   ├── README.md
│   ├── keys.json
│   ├── 01-valid-claim/
│   ├── 02-tampered-payload/
│   ├── 03-wrong-key/
│   ├── 04-expired-key/
│   ├── 05-key-rotation/
│   └── 06-canonicalization-trap/
└── sdk/                     # Reference implementation (JavaScript)
    ├── src/
    ├── test/
    └── package.json
```

## License

[MIT](LICENSE)
