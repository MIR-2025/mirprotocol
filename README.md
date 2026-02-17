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

## Specification

| # | Document | Description |
|---|----------|-------------|
| 01 | [Overview](protocol/01-overview.md) | Architecture, properties, scope |
| 02 | [Terminology](protocol/02-terminology.md) | Defined terms |
| 03 | [Claim Format](protocol/03-claim-format.md) | Claim structure, fields, types |
| 04 | [Signature Model](protocol/04-signature-model.md) | Canonical serialization, Ed25519 |
| 05 | [Domain Key Discovery](protocol/05-domain-key-discovery.md) | DNS TXT, `.well-known/mir.json` |
| 06 | [Verification Process](protocol/06-verification-process.md) | Deterministic verification algorithm |
| 07 | [Registry Role](protocol/07-registry-role.md) | What registries do and do not provide |
| 08 | [Security Considerations](protocol/08-security-considerations.md) | Cryptographic and operational security |
| 09 | [Threat Model](protocol/09-threat-model.md) | Attack surface and mitigations |
| 10 | [Non-Goals](protocol/10-non-goals.md) | Explicit exclusions |

## Conformance

This specification uses RFC 2119 keywords (MUST, SHOULD, MAY) throughout the protocol documents.

A conformant **signer** MUST:
- Produce claims matching [mir-claim.schema.json](protocol/schemas/mir-claim.schema.json).
- Serialize the signing input using the [canonical serialization rules](protocol/04-signature-model.md#canonical-serialization).
- Sign with Ed25519 per [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032).
- Publish at least one public key via [DNS TXT or `.well-known/mir.json`](protocol/05-domain-key-discovery.md).

A conformant **verifier** MUST:
- Implement the [deterministic verification algorithm](protocol/06-verification-process.md#algorithm).
- Reject claims with missing required fields, invalid formats, or failed signatures.
- Discover keys via `.well-known` with DNS fallback.

A conformant **registry** MUST:
- Validate signatures on ingestion.
- Never modify claims after ingestion.
- Never require authentication for read/verify operations.

See [test-vectors/](test-vectors/) for known-good and known-bad claims to validate your implementation.

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
│   └── mir.test.js     # Test suite
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
│   ├── 10-non-goals.md
│   └── schemas/
│       └── mir-claim.schema.json
├── test-vectors/            # Interop test vectors
│   ├── README.md
│   ├── valid-claim.json
│   ├── tampered-claim.json
│   ├── wrong-key-claim.json
│   ├── expired-key-claim.json
│   └── keys.json
└── sdk/                     # Reference implementation (JavaScript)
    ├── src/
    ├── test/
    └── package.json
```

## License

[MIT](LICENSE)
