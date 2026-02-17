# 07 — Registry Role

A MIR registry is optional infrastructure. It provides discovery, timestamp anchoring, and availability indexing. It is not a trust anchor. It cannot forge claim signatures and is not required for verification.

## What a Registry Provides

### Discovery

Registries index claims and make them queryable by subject hash, domain, type, and time range. Without a registry, a verifier must obtain claims directly from the domain or from the subject.

### Timestamp Anchoring

When a registry ingests a claim, it records an independent ingestion timestamp. This creates a second time reference: the domain-reported `timestamp` and the registry-observed `ingestedAt`. Discrepancies between the two are visible to verifiers.

### Availability

Registries serve as an availability layer. Claims submitted to a registry remain accessible even if the issuing domain goes offline.

### Aggregation

Registries may index claims across multiple domains, enabling cross-domain subject history queries.

## What a Registry Does Not Provide

### Trust

A registry cannot make a claim more or less valid. Validity is determined by the cryptographic signature, not by registry presence.

### Verification

"The registry has this claim" is not verification. Verification is: "the Ed25519 signature on this claim is valid against the domain's published public key." A registry can perform this check, but so can anyone.

### Authority

A registry does not approve or reject claims based on content. It may reject malformed claims or claims with invalid signatures, but it does not evaluate truthfulness.

### Exclusivity

No single registry is canonical. Claims may be submitted to multiple registries. Registries may index claims they discover from other registries or from domains directly.

## Registry Operations

A registry SHOULD:

- Validate claim signatures on ingestion (reject invalid signatures).
- Record an independent ingestion timestamp.
- Serve claims over a queryable API.
- Support lookup by claim ID, subject hash, domain, and type.
- Implement rate limiting.

A registry MAY:

- Cache domain public keys for efficient verification.
- Provide webhook notifications for new claims.
- Offer batch ingestion endpoints.
- Index claims from multiple sources.

A registry MUST NOT:

- Modify claims after ingestion.
- Claim to be the sole source of truth.
- Require API keys for verification (read) operations.
- Strip or alter signatures.

## Storage and Indexing

### What a Registry Stores

A registry ingests and stores the **complete signed claim** — all fields including `sig`. Claims are stored verbatim. No fields are stripped, transformed, or re-encoded.

In addition to the claim itself, a registry records:

| Field | Description |
|-------|-------------|
| `claimId` | Registry-assigned opaque identifier (e.g., `claim_abc123`) |
| `ingestedAt` | ISO 8601 timestamp of when the registry received the claim |
| `sigHash` | SHA-256 hash of the `sig` field — used for deduplication |

### Indexing

A registry MUST support lookup by:

- `claimId` — direct single-claim retrieval.
- `subject` — all claims for a given subject hash.
- `domain` — all claims from a given domain.

A registry SHOULD support filtering by:

- `type` — claim type.
- `timestamp` range — `after` and `before` parameters.
- Combined queries — e.g., subject + domain + type.

A registry MUST NOT support unfiltered listing of all claims.

### Deduplication

The same claim (identical `sig`) submitted multiple times MUST be stored only once. The `sigHash` field is the deduplication key. Duplicate submissions return the existing claim, not an error.

### Conflict Resolution

There are no conflicts to resolve. Claims are append-only. Two claims from the same domain about the same subject at the same time are both valid — they are two separate signed assertions. The registry stores both.

If a domain issues a correction (e.g., `transaction.refunded` after `transaction.completed`), both claims exist in the registry. Verifiers interpret the sequence; the registry does not.

## Relationship to Domains

Domains submit claims to registries for distribution and discoverability. This is a convenience, not a requirement. A domain can also publish claims on its own infrastructure, and verifiers can check them directly.

## Federated Model

Multiple registries can coexist. A claim submitted to Registry A can be independently discovered and indexed by Registry B. Because claims are self-contained and cryptographically signed, any registry can validate any claim regardless of where it was originally submitted.
