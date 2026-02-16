# Verification

**Status:** Draft

Verification is the process by which a third party confirms that a claim exists in the MIR registry and was submitted by a verified domain. The registry is the trust anchor — verification means "the registry confirms this claim was recorded."

## Trust Model

MIR uses a registry-anchored trust model:

- Partners authenticate via API key and submit claims.
- The registry records claims from verified domains.
- Third parties verify claims by querying the registry.

There are no per-claim cryptographic signatures. The registry itself is the authority. If the registry says a claim exists and was submitted by `example.com`, that is the verification.

## Verification Flow

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│ Verifier │────────▶│ MIR Registry │◀────────│ Partner  │
│          │  query  │              │  submit  │          │
│          │◀────────│              │          │          │
│          │  result │              │          │          │
└──────────┘         └──────────────┘         └──────────┘
```

### Steps

1. **Obtain claim reference.** The verifier receives a claim ID or subject hash from the party being verified (e.g., a user presenting their participation history).

2. **Query the registry.** The verifier sends a request to the registry:
   ```
   GET /v1/claims/{claimId}
   ```
   Or queries by subject:
   ```
   GET /v1/claims?subject={subjectHash}&domain={domain}
   ```

3. **Registry responds.** The response includes:
   - The full claim record (type, domain, subject, timestamp, metadata)
   - The domain's current verification status
   - The claim's ingestion timestamp (when the registry received it)

4. **Verifier evaluates.** The verifier checks:
   - Does the claim exist in the registry?
   - Was it submitted by the expected domain?
   - Is the domain currently verified?
   - Is the timestamp consistent with expectations?
   - Has the claim been superseded by a later claim (e.g., a refund after a transaction)?

## What Verification Proves

Verification confirms:

- **Existence:** The claim was recorded in the registry.
- **Source:** The claim was submitted by a specific verified domain.
- **Time:** The claim was submitted at a specific time (both claimed and ingested timestamps).
- **Integrity:** The claim has not been modified since ingestion (claims are immutable).

## What Verification Does Not Prove

Verification does NOT confirm:

- **Truthfulness:** A verified domain can submit false claims. MIR records; it does not judge.
- **Current status:** A `transaction.completed` claim does not guarantee the transaction was not later refunded. Check for subsequent claims.
- **Identity:** The subject hash maps to a pseudonymous identifier, not a verified real-world identity.

## Batch Verification

Multiple claims can be verified in a single request:

```
POST /v1/claims/verify
Content-Type: application/json

{
  "claimIds": ["claim_abc123", "claim_def456"]
}
```

The response includes the verification status for each claim.

## Liveness Check

A verifier may optionally confirm that the submitting domain is still verified at the time of verification:

```
GET /v1/domains/{domain}/status
```

This returns the domain's current verification status, last verification date, and next scheduled re-verification.

## Verification Response

```json
{
  "claim": {
    "id": "claim_abc123",
    "version": 1,
    "type": "transaction.completed",
    "domain": "example.com",
    "subject": "a1b2c3d4...",
    "timestamp": "2026-02-14T12:00:00Z",
    "metadata": {},
    "ingestedAt": "2026-02-14T12:00:01Z"
  },
  "domain": {
    "name": "example.com",
    "verified": true,
    "verifiedAt": "2026-01-10T09:00:00Z"
  }
}
```
