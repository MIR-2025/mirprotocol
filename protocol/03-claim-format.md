# 03 — Claim Format

A MIR claim is a signed JSON document. It is the fundamental unit of the protocol.

## Structure

```json
{
  "mir": 1,
  "type": "transaction.completed",
  "domain": "marketplace.example.com",
  "subject": "a55bea0a6788794ef1307951f98bc339db7ccf9309881180e9e6c080f63ae618",
  "timestamp": "2026-02-16T15:30:00Z",
  "metadata": {
    "amount": 149.99,
    "currency": "USD"
  },
  "keyFingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sig": "base64-encoded-ed25519-signature"
}
```

## Fields

### `mir` (required)

- **Type:** integer
- **Value:** `1`
- Protocol version. Implementations MUST reject claims with unrecognized versions.

### `type` (required)

- **Type:** string
- Claim type from the MIR type registry. Dot-notation (e.g., `transaction.completed`).
- See [Claim Types](#claim-types) below.

### `domain` (required)

- **Type:** string
- The DNS domain of the issuing organization.
- This is the authority anchor. The domain controls the signing key.
- Must be a valid DNS hostname. No wildcards. No IP addresses.

### `subject` (required)

- **Type:** string
- SHA-256 hash of the participant identifier: `SHA256("{domain}:{externalUserId}")`.
- 64-character lowercase hex string.
- No plaintext PII is permitted.

### `timestamp` (required)

- **Type:** string (ISO 8601)
- When the event occurred, as reported by the issuing domain.
- Must include timezone. UTC recommended.
- Must not be future-dated beyond 5-minute clock skew.

### `metadata` (optional)

- **Type:** object
- Structured context specific to the claim type.
- Maximum: 4 KB serialized.
- Must not contain PII.
- Unknown fields are preserved.

### `keyFingerprint` (required)

- **Type:** string
- SHA-256 hash of the 32-byte Ed25519 public key that signed this claim.
- 64-character lowercase hex string.
- Allows verifiers to select the correct public key when a domain publishes multiple keys.

### `sig` (required)

- **Type:** string
- Ed25519 signature over the [canonical form](04-signature-model.md) of the claim payload (all fields except `sig`).
- Base64-encoded. 88 characters (64 bytes decoded).

## Claim Types

### Transaction (`cross_system`)

| Type | Description |
|------|-------------|
| `transaction.initiated` | Transaction started |
| `transaction.completed` | Transaction completed |
| `transaction.fulfilled` | Goods or services delivered |
| `transaction.cancelled` | Transaction cancelled |
| `transaction.refunded` | Transaction refunded |
| `transaction.disputed` | Transaction under dispute |
| `transaction.chargeback` | Chargeback filed |

### Account (`intra_system` / `privileged`)

| Type | Boundary | Description |
|------|----------|-------------|
| `account.created` | `intra_system` | Account created |
| `account.updated` | `intra_system` | Account modified |
| `account.verified` | `privileged` | Identity verified by platform |
| `account.suspended` | `privileged` | Account suspended |
| `account.closed` | `intra_system` | Account closed |

### Review (`intra_system`)

| Type | Description |
|------|-------------|
| `review.submitted` | Subject submitted a review |
| `review.received` | Subject received a review |
| `rating.received` | Subject received a rating |

### Communication (`intra_system`)

| Type | Description |
|------|-------------|
| `message.sent` | Message sent |
| `message.received` | Message received |
| `response.provided` | Response to inquiry |

### Policy (`privileged`)

| Type | Description |
|------|-------------|
| `policy.warning` | Policy warning issued |
| `policy.violation` | Policy violation recorded |
| `terms.violation` | Terms of service violated |

### Signal (`intra_system`)

| Type | Description |
|------|-------------|
| `signal.positive` | General positive signal |
| `signal.negative` | General negative signal |

## Immutability

Claims are append-only. A signed claim cannot be modified — the signature would invalidate. Corrections are expressed as new claims (e.g., `transaction.refunded` follows `transaction.completed`).
