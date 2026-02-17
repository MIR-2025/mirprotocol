# 05 — Domain Key Discovery

Verifiers need the domain's Ed25519 public key to check a claim signature. This document specifies two mechanisms for publishing keys. Domains MUST support at least one.

## Mechanism 1: DNS TXT Record

The domain publishes a TXT record at:

```
_mir-key.{domain}
```

### Format

```
mir-key={base64-encoded-public-key}
```

The value is the raw 32-byte Ed25519 public key, Base64-encoded (44 characters).

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
| `pub` | yes | Base64-encoded 32-byte Ed25519 public key |
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

## Domain Scoping

- `example.com` and `shop.example.com` are separate domains with separate keys.
- A key published at `_mir-key.example.com` does NOT cover `shop.example.com`.
- Each domain manages its own keys independently.
