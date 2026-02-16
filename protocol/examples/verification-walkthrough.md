# Verification Walkthrough

This walkthrough demonstrates how a third party verifies a MIR claim end-to-end.

## Scenario

A freelance platform, **HireMe**, wants to verify that a job applicant has a legitimate transaction history on a marketplace called **ShopDirect**. The applicant provides their MIR subject hash for the ShopDirect domain.

## Step 1: Applicant Provides Subject Hash

The applicant computes their subject hash:

```
SHA256("shopdirect.com:user_78432") = 50b400843015e89eafbffd286a3788a2d07c950b1b2d4a0dbeb0a0d2fa6dd4c8
```

They share this hash with HireMe. No plaintext user ID or PII is disclosed.

## Step 2: HireMe Queries the Registry

HireMe queries the MIR registry for all claims associated with this subject from `shopdirect.com`:

```http
GET /v1/claims?subject=50b400843015e89eafbffd286a3788a2d07c950b1b2d4a0dbeb0a0d2fa6dd4c8&domain=shopdirect.com
Host: registry.mirprotocol.net
```

## Step 3: Registry Responds

```json
{
  "data": [
    {
      "id": "claim_tx_92847",
      "version": 1,
      "type": "transaction.completed",
      "domain": "shopdirect.com",
      "subject": "50b400843015e89eafbffd286a3788a2d07c950b1b2d4a0dbeb0a0d2fa6dd4c8",
      "timestamp": "2026-02-14T15:30:00Z",
      "metadata": {
        "amount": 149.99,
        "currency": "USD",
        "category": "electronics"
      },
      "ingestedAt": "2026-02-14T15:30:02Z"
    },
    {
      "id": "claim_tx_91503",
      "version": 1,
      "type": "transaction.completed",
      "domain": "shopdirect.com",
      "subject": "50b400843015e89eafbffd286a3788a2d07c950b1b2d4a0dbeb0a0d2fa6dd4c8",
      "timestamp": "2026-01-28T10:15:00Z",
      "metadata": {
        "amount": 42.00,
        "currency": "USD",
        "category": "books"
      },
      "ingestedAt": "2026-01-28T10:15:01Z"
    },
    {
      "id": "claim_rv_88210",
      "version": 1,
      "type": "review.submitted",
      "domain": "shopdirect.com",
      "subject": "50b400843015e89eafbffd286a3788a2d07c950b1b2d4a0dbeb0a0d2fa6dd4c8",
      "timestamp": "2026-01-29T08:00:00Z",
      "metadata": {
        "verified_purchase": true
      },
      "ingestedAt": "2026-01-29T08:00:03Z"
    }
  ],
  "pagination": {
    "cursor": null,
    "hasMore": false,
    "total": 3
  }
}
```

## Step 4: HireMe Checks Domain Status

Optionally, HireMe confirms that `shopdirect.com` is still a verified domain:

```http
GET /v1/domains/shopdirect.com/status
Host: registry.mirprotocol.net
```

```json
{
  "domain": "shopdirect.com",
  "verified": true,
  "verifiedAt": "2026-01-10T09:00:00Z",
  "nextVerification": "2026-04-10T09:00:00Z"
}
```

## Step 5: HireMe Evaluates

HireMe now knows:

1. **The claims exist.** The registry has 3 claims for this subject from `shopdirect.com`.
2. **The source is verified.** `shopdirect.com` is a verified domain, last verified on January 10, 2026.
3. **The history is consistent.** Two completed transactions and a review linked to a verified purchase. No disputes, chargebacks, or policy violations.
4. **Timestamps are plausible.** Claimed timestamps and ingestion timestamps are within seconds of each other.

HireMe decides this applicant has a credible participation history on ShopDirect.

## What HireMe Cannot Conclude

- Whether the transactions actually occurred (MIR records claims, not facts).
- The applicant's real identity (only a pseudonymous hash was shared).
- Whether ShopDirect is a trustworthy marketplace (domain verification proves control, not legitimacy).
- The applicant's behavior on other platforms (the hash is domain-scoped).

## Key Takeaways

- **No PII was exchanged.** The applicant shared a hash, not a username or email.
- **The applicant controlled disclosure.** They chose to share their ShopDirect hash. They could have omitted it.
- **Verification was one API call.** No cryptographic signature verification, no certificate chains. The registry is the trust anchor.
- **Claims speak for themselves.** HireMe interprets the claims. MIR does not score or recommend.
