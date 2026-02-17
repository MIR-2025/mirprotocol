# 03 — Claim Format

A MIR claim is a signed JSON document. It is the fundamental unit of the protocol.

## Structure

```json
{
  "mir": 1,
  "type": "mir.transaction.completed",
  "domain": "marketplace.example.com",
  "subject": "a55bea0a6788794ef1307951f98bc339db7ccf9309881180e9e6c080f63ae618",
  "timestamp": "2026-02-16T15:30:00Z",
  "metadata": {
    "currency": "USD",
    "count": 1
  },
  "keyFingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sig": "base64url-encoded-ed25519-signature"
}
```

## Encoding

All binary values in MIR claims MUST use **base64url encoding without padding** ([RFC 4648 Section 5](https://datatracker.ietf.org/doc/html/rfc4648#section-5)).

- Alphabet: `A-Z`, `a-z`, `0-9`, `-`, `_`
- No padding characters (`=`)
- No `+` or `/` characters (those are standard Base64)

**Rationale:** Base64url aligns with the JOSE/JWT/JWK ecosystem that IAM teams already use. It is URL-safe and unambiguous without padding since Ed25519 signatures are a fixed 64 bytes (always encodes to exactly 86 characters).

This applies to the `sig` field in claims and the `pub` field in `.well-known/mir.json` and DNS TXT records.

## Fields

### `mir` (required)

- **Type:** integer
- **Value:** `1`
- Protocol version. Implementations MUST reject claims with unrecognized versions.

### `type` (required)

- **Type:** string
- Claim type. See [Claim Types](#claim-types) and [Type Extensibility](#type-extensibility) below.
- Core types use the `mir.` namespace: `mir.{category}.{action}` (e.g., `mir.transaction.completed`).
- Extension types use domain-scoped prefix: `{domain}:{category}.{action}` (e.g., `shopify.com:loyalty.earned`).

### `domain` (required)

- **Type:** string
- The DNS domain of the issuing organization.
- This is the authority anchor. The domain controls the signing key.
- MUST be a valid DNS hostname. No wildcards. No IP addresses.

### `subject` (required)

- **Type:** string
- Pseudonymous identifier for the participant. 64-character lowercase hex string.
- See [Subject Identifier](#subject-identifier) below for derivation rules.
- No plaintext PII is permitted.

### `timestamp` (required)

- **Type:** string (ISO 8601)
- When the event occurred, as reported by the issuing domain.
- MUST include timezone. UTC recommended.
- MUST NOT be future-dated beyond 5-minute clock skew.

### `metadata` (optional)

- **Type:** object
- Structured context specific to the claim type.
- Maximum: 4 KB serialized.
- MUST NOT contain PII.
- SHOULD use integers for numeric values. Decimal amounts SHOULD be represented as strings (e.g., `"149.99"`) or as integer minor units (e.g., `14999` for cents). See [04 — Signature Model](04-signature-model.md#number-handling) for rationale.
- Unknown fields are preserved.

### `keyFingerprint` (required)

- **Type:** string
- SHA-256 hash of the 32-byte Ed25519 public key that signed this claim.
- 64-character lowercase hex string.
- Allows verifiers to select the correct public key when a domain publishes multiple keys.

### `sig` (required)

- **Type:** string
- Ed25519 signature over the [canonical form](04-signature-model.md) of the claim payload (all fields except `sig`).
- Base64url-encoded, no padding. Exactly 86 characters (64 bytes decoded).

## Subject Identifier

The subject field is a pseudonymous hash that identifies a participant without exposing PII.

### Basic Derivation (SHA-256)

```
subject = hex(SHA256("{domain}:{externalUserId}"))
```

### Recommended Derivation (HMAC-SHA256)

For stronger privacy protection, domains SHOULD use HMAC-based derivation:

```
subject = hex(HMAC-SHA256(domainSecret, "{domain}:{externalUserId}"))
```

Where `domainSecret` is a stable, per-domain secret that is:
- Never published or shared.
- Never rotated per-user (must be consistent so the same user always produces the same hash).
- Stored securely by the domain.

HMAC derivation prevents brute-force reversal even when the user ID format is known.

### Requirements

- The `externalUserId` input MUST NOT be an email address, phone number, SSN, or other directly identifiable value — unless the domain uses HMAC derivation with a strong secret.
- Domains SHOULD use opaque, sufficiently random internal identifiers (e.g., UUIDs, database IDs) as `externalUserId`.
- The same real-world person has different subject hashes on different domains. This is by design.
- Either SHA-256 or HMAC-SHA256 output is valid — both produce a 64-character lowercase hex string. The protocol does not distinguish between them.

## Claim Types

### Core Types (Protocol-Defined)

All core types use the `mir.` namespace prefix to prevent collisions with external taxonomies. The `mir.` prefix is reserved for protocol-defined types. New core types are added through protocol versioning.

The following types are defined by the protocol. They record structural participation events — not scores, ratings, or evaluations.

#### Transaction

| Type | Description |
|------|-------------|
| `mir.transaction.initiated` | Transaction started |
| `mir.transaction.completed` | Transaction completed |
| `mir.transaction.fulfilled` | Goods or services delivered |
| `mir.transaction.cancelled` | Transaction cancelled |
| `mir.transaction.refunded` | Transaction refunded |
| `mir.transaction.disputed` | Transaction under dispute |
| `mir.transaction.chargeback` | Chargeback filed |

#### Account

| Type | Description |
|------|-------------|
| `mir.account.created` | Account created |
| `mir.account.updated` | Account modified |
| `mir.account.verified` | Identity verified by platform |
| `mir.account.suspended` | Account suspended |
| `mir.account.closed` | Account closed |

#### Review

| Type | Description |
|------|-------------|
| `mir.review.submitted` | Subject submitted a review |
| `mir.review.received` | Subject received a review |

#### Communication

| Type | Description |
|------|-------------|
| `mir.message.sent` | Message sent |
| `mir.message.received` | Message received |
| `mir.response.provided` | Response to inquiry |

#### Policy

| Type | Description |
|------|-------------|
| `mir.policy.warning` | Policy warning issued |
| `mir.policy.violation` | Policy violation recorded |
| `mir.terms.violation` | Terms of service violated |

### Type Extensibility

Domains MAY define extension types for domain-specific events not covered by core types.

**Extension type format:** `{domain}:{category}.{action}`

```
shopify.com:loyalty.earned
university.edu:credential.issued
bank.example.com:kyc.completed
```

**Rules:**

- The domain prefix MUST be a valid DNS hostname.
- The `{category}.{action}` suffix follows the same format as core types: lowercase alphanumeric, dot-separated.
- Types starting with `mir.` are **reserved** for the MIR protocol. Implementations MUST NOT create `mir.`-prefixed types outside of protocol versions.
- Extension types are validated by format only. No central registry of extension types exists.
- Verifiers that do not recognize an extension type SHOULD still verify the claim's signature. Type recognition is independent of signature validity.

## Immutability

Claims are append-only. A signed claim cannot be modified — the signature would invalidate. Corrections are expressed as new claims (e.g., `mir.transaction.refunded` follows `mir.transaction.completed`).
