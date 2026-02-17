# 01 — Overview

**MIR Protocol** (Memory Infrastructure Registry) is an open specification for recording and verifying participation claims across distributed systems.

A MIR claim is a cryptographically signed record that asserts: *a specific event involving a pseudonymous subject occurred at a specific time, as attested by a specific domain.*

## Core Properties

- **Cryptographically verifiable.** Every claim carries an Ed25519 signature from the issuing domain. Verification requires no trusted third party.
- **Registry-agnostic.** Claims can be verified offline, peer-to-peer, or against any registry. No single registry is authoritative.
- **Non-scoring.** MIR records participation. It does not calculate trust, reputation, or behavioral rankings.
- **Non-evaluative.** MIR does not judge whether a claim is true. It proves who made the claim, when, and that it has not been altered.
- **Privacy-preserving.** Subject identifiers are domain-scoped SHA-256 hashes. No PII enters the protocol.

## What a Claim Proves

Given a valid MIR claim, any verifier can independently confirm:

1. **Authorship.** The claim was signed by a key controlled by the stated domain.
2. **Integrity.** The claim has not been modified since signing.
3. **Time.** The claim asserts a specific timestamp (and registries may provide an independent ingestion timestamp).

## What a Claim Does Not Prove

- **Truthfulness.** A domain can sign a false claim. MIR proves authorship, not accuracy.
- **Identity.** The subject hash is pseudonymous. MIR does not identify real-world individuals.
- **Current status.** A `mir.transaction.completed` claim does not mean the transaction was not later refunded.

## Architecture

```
┌────────────┐          ┌────────────┐          ┌──────────┐
│   Domain   │  sign    │   Claim    │  verify  │ Verifier │
│ (key pair) │─────────▶│ (portable) │◀─────────│ (anyone) │
└────────────┘          └────────────┘          └──────────┘
                              │
                              │ optional
                              ▼
                        ┌──────────┐
                        │ Registry │
                        │(discover,│
                        │timestamp,│
                        │  index)  │
                        └──────────┘
```

- **Domains** generate Ed25519 key pairs and publish public keys via DNS or `.well-known`.
- **Claims** are self-contained, signed JSON documents. They are portable and verifiable anywhere.
- **Verifiers** discover the domain's public key and verify the signature. No registry required.
- **Registries** are optional infrastructure: discovery, timestamp anchoring, availability indexing. They are not trust anchors.

## Protocol Documents

| Document | Contents |
|----------|----------|
| [02 — Terminology](02-terminology.md) | Defined terms |
| [03 — Claim Format](03-claim-format.md) | Claim structure, fields, constraints |
| [04 — Signature Model](04-signature-model.md) | Canonical serialization and Ed25519 signing |
| [05 — Domain Key Discovery](05-domain-key-discovery.md) | DNS TXT and `.well-known` key publication |
| [06 — Verification Process](06-verification-process.md) | Deterministic verification algorithm |
| [07 — Registry Role](07-registry-role.md) | What registries do and do not provide |
| [08 — Security Considerations](08-security-considerations.md) | Cryptographic and operational security |
| [09 — Threat Model](09-threat-model.md) | Attack surface and mitigations |
| [10 — Non-Goals](10-non-goals.md) | Explicit exclusions |
