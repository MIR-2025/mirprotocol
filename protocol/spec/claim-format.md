# Claim Format

**Status:** Draft

A MIR claim is the fundamental unit of the protocol. It records that a verified domain asserted something happened, at a specific time, involving a pseudonymous subject.

MIR records claims. It does not evaluate them.

## Structure

```json
{
  "version": 1,
  "type": "transaction.completed",
  "domain": "example.com",
  "subject": "a1b2c3d4e5f6...",
  "timestamp": "2026-02-14T12:00:00Z",
  "metadata": {}
}
```

## Fields

### `version` (required)

- **Type:** integer
- **Description:** Protocol version. Currently `1`.
- **Constraints:** Must be a positive integer. Implementations MUST reject claims with unrecognized versions.

### `type` (required)

- **Type:** string
- **Description:** The claim type from the MIR type registry. Uses dot-notation (e.g., `transaction.completed`).
- **Constraints:** Must be a registered claim type. See [Claim Types](#claim-types) below.

### `domain` (required)

- **Type:** string
- **Description:** The verified domain of the submitting partner. This is the authority anchor — the domain is the identity of the claim source.
- **Constraints:** Must be a domain that has completed [domain verification](domain-authority.md). The registry MUST reject claims from unverified domains.

### `subject` (required)

- **Type:** string
- **Description:** SHA-256 hash of the user identifier. The hash input is the concatenation of the provider identifier and the provider-scoped user ID (e.g., `SHA256("example.com:user_12345")`).
- **Constraints:**
  - Must be a valid hex-encoded SHA-256 hash (64 characters, lowercase).
  - No plaintext PII is permitted. The registry MUST reject unhashed identifiers.
  - The same real-world user produces different subject hashes on different platforms by design.

### `timestamp` (required)

- **Type:** string (ISO 8601)
- **Description:** When the event occurred, as reported by the submitting domain.
- **Constraints:**
  - Must be a valid ISO 8601 datetime with timezone (UTC recommended).
  - Must not be future-dated beyond a 5-minute clock skew tolerance.
  - The registry records both the claimed timestamp and the ingestion timestamp.

### `metadata` (optional)

- **Type:** object
- **Description:** Structured context specific to the claim type. The schema varies by type.
- **Constraints:**
  - Must be a JSON object if present.
  - Maximum size: 4 KB serialized.
  - Must not contain PII (names, emails, addresses, phone numbers).
  - Unknown fields are preserved but not indexed.

## Claim Types

Claims are organized into domains and classified by trust boundary.

### Trust Boundary Classification

| Class | Description |
|-------|-------------|
| `intra_system` | Actions within a single platform's trust boundary |
| `cross_system` | Actions where value (money, goods) crosses trust boundaries |
| `privileged` | Verification or enforcement actions requiring elevated authority |

### Transaction Claims (`cross_system`)

| Type | Description |
|------|-------------|
| `transaction.initiated` | A transaction has been started |
| `transaction.completed` | A transaction completed successfully |
| `transaction.fulfilled` | Goods or services were delivered |
| `transaction.cancelled` | A transaction was cancelled before completion |
| `transaction.refunded` | A completed transaction was refunded |
| `transaction.disputed` | A transaction is under dispute |
| `transaction.chargeback` | A chargeback was filed against a transaction |

### Account Claims (`intra_system` / `privileged`)

| Type | Boundary | Description |
|------|----------|-------------|
| `account.created` | `intra_system` | A new account was created |
| `account.updated` | `intra_system` | Account information was modified |
| `account.verified` | `privileged` | Account identity was verified by the platform |
| `account.suspended` | `privileged` | Account was suspended |
| `account.closed` | `intra_system` | Account was closed |

### Review Claims (`intra_system`)

| Type | Description |
|------|-------------|
| `review.submitted` | Subject submitted a review |
| `review.received` | Subject received a review |
| `rating.received` | Subject received a rating |

### Communication Claims (`intra_system`)

| Type | Description |
|------|-------------|
| `message.sent` | Subject sent a message |
| `message.received` | Subject received a message |
| `response.provided` | Subject responded to an inquiry |

### Policy Claims (`privileged`)

| Type | Description |
|------|-------------|
| `policy.warning` | Subject received a policy warning |
| `policy.violation` | Subject committed a policy violation |
| `terms.violation` | Subject violated terms of service |

### Signal Claims (`intra_system`)

| Type | Description |
|------|-------------|
| `signal.positive` | General positive signal |
| `signal.negative` | General negative signal |

## Immutability

Claims are append-only. Once a claim is accepted by the registry, it cannot be modified or deleted. Corrections are expressed as new claims (e.g., a `transaction.refunded` claim corrects a `transaction.completed` claim).

## Idempotency

Submitters may include an `Idempotency-Key` header. If the same key is submitted within 24 hours, the registry returns the original claim without creating a duplicate.
