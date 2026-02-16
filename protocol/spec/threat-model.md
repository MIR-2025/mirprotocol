# Threat Model

**Status:** Draft

This document describes the MIR protocol's trust model, what it protects against, what it does not, and explicit non-goals.

## Trust Model

MIR uses a **registry-anchored** trust model. The MIR registry is the trusted recorder of claims.

```
┌────────────┐    API key     ┌──────────────┐    query     ┌──────────┐
│  Partner   │───────────────▶│ MIR Registry │◀────────────│ Verifier │
│ (verified  │   submit claim │  (trust      │  verify claim│          │
│  domain)   │                │   anchor)    │              │          │
└────────────┘                └──────────────┘              └──────────┘
```

Trust flows from three mechanisms:

1. **Domain verification.** Partners prove control of their domain via DNS TXT records (see [domain-authority.md](domain-authority.md)). This establishes organizational identity.

2. **Authenticated submission.** Partners authenticate claim submissions with API keys. Keys are stored as SHA-256 hashes — the registry never holds plaintext keys.

3. **Immutable recording.** Once accepted, claims are append-only. The registry does not modify or delete claims.

A claim in the registry means: "Domain X, which was verified at time T, submitted this claim via an authenticated API call."

## What MIR Protects Against

### Unverified claims

The registry rejects claims from domains that have not completed DNS TXT verification. An attacker cannot submit claims as `bank.com` without proving control of that domain.

### Claim tampering

Claims are immutable after ingestion. Neither the submitting partner nor the registry modifies recorded claims. Corrections are expressed as new claims.

### PII exposure

Subject identifiers are SHA-256 hashes. The registry never stores or transmits plaintext user identifiers. The hashing is domain-scoped (`SHA256("domain:userId")`), so the same user has different hashes across platforms — preventing cross-domain correlation without user consent.

### Replay attacks

The idempotency mechanism prevents duplicate claim submission. The same `Idempotency-Key` within 24 hours returns the original claim without creating a new record.

### Clock manipulation

Claims with timestamps more than 5 minutes in the future are rejected. The registry records both the partner-reported timestamp and its own ingestion timestamp, making discrepancies visible.

## What MIR Does Not Protect Against

### False claims from verified partners

A verified domain can submit false claims. If `example.com` submits a `transaction.completed` claim for a transaction that never happened, the registry will record it. MIR records claims; it does not judge their truthfulness.

**Mitigation:** Verifiers should consider the reputation and context of the submitting domain. The protocol supports this by making the source domain visible on every claim.

### Compromised API keys

If a partner's API key is compromised, an attacker can submit claims under that partner's domain. This is an operational security concern for the partner.

**Mitigation:** Partners should rotate keys regularly. The registry supports key revocation and re-issuance.

### Registry compromise

If the registry itself is compromised, all trust guarantees are void. This is an operational security concern for registry operators.

**Mitigation:** Outside the scope of this protocol specification. Registry operators are responsible for infrastructure security.

### Collusion

Multiple partners could coordinate to submit misleading claims about the same subject. The protocol does not detect or prevent coordinated false reporting.

**Mitigation:** Verifiers who consume claims from multiple domains should apply their own analysis.

### Domain takeover

If a domain changes ownership (e.g., via expired registration), the new owner could pass re-verification and submit claims under the same domain. Historical claims from the previous owner remain in the registry.

**Mitigation:** Re-verification cadence (recommended: 90 days) limits the window. The registry records verification timestamps, so verifiers can assess whether claims were submitted during a specific domain ownership period.

## Non-Goals

The following are explicitly outside the scope of the MIR protocol:

| Non-goal | Explanation |
|----------|-------------|
| **Scoring or ranking** | MIR does not calculate trust scores, reputation rankings, or behavioral ratings. |
| **Evaluating truthfulness** | MIR does not assess whether a claim is accurate or honest. |
| **Identity verification** | MIR verifies domain control, not real-world identity of individuals. |
| **Behavioral analytics** | MIR does not model, predict, or profile user behavior. |
| **Content evaluation** | MIR does not assess the quality or nature of referenced content. |
| **Surveillance** | MIR is designed to resist correlation. Subject hashes are domain-scoped. |
| **Access control** | MIR does not grant or deny access to systems. It provides claims for others to evaluate. |

## Security Properties Summary

| Property | Guaranteed | Mechanism |
|----------|-----------|-----------|
| Source authenticity | Yes | Domain verification + API key auth |
| Claim integrity | Yes | Append-only registry |
| Subject pseudonymity | Yes | Domain-scoped SHA-256 hashing |
| Temporal ordering | Partial | Partner-reported + ingestion timestamps |
| Claim truthfulness | No | Out of scope — MIR records, does not judge |
| Key confidentiality | Yes | SHA-256 hashed storage, never plaintext |
