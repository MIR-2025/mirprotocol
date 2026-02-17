# 05 — Domain Key Discovery

Verifiers need the domain's Ed25519 public key to check a claim signature. This document specifies two mechanisms for publishing keys. Domains MUST support at least one.

## Mechanism 1: DNS TXT Record

The domain publishes a TXT record at:

```
_mir-key.{domain}
```

### Format

```
mir-key={base64url-encoded-public-key}
```

The value is the raw 32-byte Ed25519 public key, base64url-encoded without padding (43 characters).

### Example

For domain `marketplace.example.com`:

```
_mir-key.marketplace.example.com.  IN  TXT  "mir-key=O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik="
```

### Multiple Keys

Multiple TXT records may exist for the same subdomain. Each record represents one active key. Verifiers match against the `keyFingerprint` field in the claim.

```
_mir-key.example.com.  IN  TXT  "mir-key=O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik="
_mir-key.example.com.  IN  TXT  "mir-key=dGhpcyBpcyBhIHNlY29uZCBrZXkgZXhhbXBsZQ=="
```

### Advantages

- No HTTP infrastructure required.
- DNS is cached and distributed.
- Proof of domain control is implicit.

### Limitations

- DNS TXT records are limited to 255 bytes per string (sufficient for Ed25519).
- Propagation delay on updates.
- No metadata (expiry, algorithm) beyond the key itself.

## Mechanism 2: Well-Known Endpoint

The domain serves a JSON document at:

```
https://{domain}/.well-known/mir.json
```

### Format

```json
{
  "keys": [
    {
      "pub": "O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik=",
      "fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "alg": "Ed25519",
      "created": "2026-01-15T00:00:00Z",
      "expires": null
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `pub` | yes | Base64url-encoded (no padding) 32-byte Ed25519 public key |
| `fingerprint` | yes | SHA-256 hash of the raw public key bytes, hex-encoded |
| `alg` | yes | Algorithm identifier. Must be `"Ed25519"` |
| `created` | yes | ISO 8601 datetime when the key was created |
| `expires` | yes | ISO 8601 datetime when the key expires, or `null` for no expiry |

### Requirements

- MUST be served over HTTPS.
- MUST return `Content-Type: application/json`.
- MUST include all active keys and recently retired keys (for historical verification).
- Retired keys SHOULD remain listed with a non-null `expires` value for at least 1 year after expiry.

### Advantages

- Richer metadata (creation date, expiry).
- Easier programmatic management.
- No DNS propagation delay.

## Discovery Priority

When verifying a claim, the verifier:

1. Compute the expected key fingerprint from the claim's `keyFingerprint` field.
2. Attempt `.well-known/mir.json` first (richer metadata, HTTPS-secured).
3. Fall back to DNS TXT records if `.well-known` is unavailable.
4. Match the key whose fingerprint equals the claim's `keyFingerprint`.
5. If no matching key is found, verification fails.

## Caching

- Verifiers SHOULD cache discovered keys.
- DNS: respect TTL.
- `.well-known`: respect `Cache-Control` headers. Recommended: `max-age=3600` (1 hour).
- If a `keyFingerprint` is not found in cache, re-fetch before failing.

## Key Lifecycle

### Rotation

Domains SHOULD rotate signing keys on a regular cadence. Recommended: every 90 days.

**Rotation procedure:**

1. Generate a new Ed25519 key pair.
2. Publish the new public key via DNS TXT and/or `.well-known/mir.json`.
3. Begin signing new claims with the new key.
4. Set `expires` on the old key in `.well-known/mir.json` to the current time plus a grace period.
5. Keep the old key published for at least **1 year** after its last use, so historical claims remain verifiable.

During rotation, a domain has multiple active keys. The `keyFingerprint` field in each claim tells verifiers which key to use. There is no ambiguity.

### Grace Period

When rotating, domains SHOULD maintain a **7-day overlap** where both old and new keys are active (no `expires` set on either). This accommodates:

- Claims in transit that were signed with the old key.
- Verifier caches that have not yet refreshed.
- Clock skew between signing and verification.

### Revocation

The protocol does not define a formal revocation list. The revocation signal is **removing the key from publication**.

- Remove the compromised key from DNS TXT records.
- Set `expires` to the compromise discovery time in `.well-known/mir.json`.
- Verifiers encountering a `keyFingerprint` with no matching published key MUST reject the claim.
- Verifiers MAY accept claims where the `keyFingerprint` matches a key with a non-null `expires`, provided the claim's `timestamp` falls before the key's `expires` value. This preserves historical verifiability.

### Compromised Key Response

If a key is compromised:

1. **Immediately** remove it from DNS and set `expires` in `.well-known`.
2. Generate and publish a new key.
3. Re-sign any claims that were issued during the suspected compromise window, using the new key, with updated timestamps.
4. Notify any registries holding claims signed with the compromised key.

The protocol cannot retroactively invalidate claims signed with a compromised key — the signatures are mathematically valid. The domain's response is operational: narrow the window, rotate fast, and communicate.

### Cache TTLs

| Mechanism | Recommended TTL | Notes |
|-----------|----------------|-------|
| DNS TXT | Respect DNS TTL; recommend 3600s (1 hour) | Lower TTL during rotation |
| `.well-known` | `Cache-Control: max-age=3600` | Lower to `max-age=300` during rotation |
| Verifier local cache | 1 hour default | MUST re-fetch on fingerprint miss before rejecting |

### Multiple Active Keys

A domain MAY have multiple active keys at any time. Use cases:

- **Rotation overlap:** Old and new key both active during transition.
- **Regional signing:** Different infrastructure regions use different keys.
- **Delegation:** A domain issues a sub-key to a department or team.

All active keys MUST be published. The `keyFingerprint` field in each claim is the selector.

## Domain Scoping

- `example.com` and `shop.example.com` are separate domains with separate keys.
- A key published at `_mir-key.example.com` does NOT cover `shop.example.com`.
- Each domain manages its own keys independently.
