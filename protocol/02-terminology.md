# 02 — Terminology

## Claim

A signed JSON document asserting that an event occurred. A claim contains a type, domain, subject, timestamp, optional metadata, and an Ed25519 signature. Claims are self-contained and independently verifiable.

## Domain

The DNS domain of the organization issuing a claim (e.g., `marketplace.example.com`). The domain is the identity anchor — it controls the signing key and is responsible for the claims it signs.

## Subject

A pseudonymous identifier for the participant referenced in a claim. Derived as SHA-256 or HMAC-SHA256 of `{domain}:{externalUserId}`. The same real-world person has different subject hashes on different domains by design.

## Claim Type

A namespaced string identifying the kind of event. Core types use the `mir.` prefix (e.g., `mir.transaction.completed`, `mir.account.verified`). Extension types use a domain prefix with colon (e.g., `shopify.com:loyalty.earned`). Types are validated by format, not by a central registry.

## Signing Key

An Ed25519 private key held by the domain. Used to produce the signature on each claim. Never published.

## Public Key

The Ed25519 public key corresponding to a domain's signing key. Published via DNS TXT record or `.well-known/mir.json` endpoint. Used by verifiers to check claim signatures.

## Key Fingerprint

The SHA-256 hash of the raw 32-byte Ed25519 public key, hex-encoded. Used to identify which key signed a claim when a domain has multiple active keys.

## Canonical Form

The deterministic JSON serialization of a claim's payload (excluding the `sig` field). Keys sorted lexicographically, no whitespace, UTF-8 encoded. This is the exact byte string that is signed and verified.

## Signature

An Ed25519 signature over the canonical form of the claim payload. Base64url-encoded (no padding) in the claim document. 64 bytes when decoded (86 characters encoded).

## Registry

An optional service that indexes claims for discovery, provides independent timestamps, and serves as an availability layer. A registry is not a trust anchor — it cannot forge signatures and is not required for verification.

## Verifier

Any party that checks a claim's signature against the domain's published public key. Verification is deterministic and can be performed offline once the public key is known.

## Trust Boundary Classification

A categorization of claim types by scope:

- **intra_system** — Actions within a single platform's boundary.
- **cross_system** — Actions where value crosses trust boundaries.
- **privileged** — Enforcement or verification actions requiring elevated authority.
