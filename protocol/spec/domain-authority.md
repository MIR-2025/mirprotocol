# Domain Authority

**Status:** Draft

Domain authority is the foundation of the MIR trust model. A claim is only as trustworthy as the domain that submitted it. MIR uses DNS TXT record verification to establish that a partner controls the domain they claim to represent.

## Overview

1. Partner registers with a domain (e.g., `example.com`).
2. MIR generates a verification token.
3. Partner adds a DNS TXT record containing the token.
4. MIR verifies the record via DNS lookup.
5. Domain is marked as verified. Claims from this domain are now accepted.

## Verification Token

- Generated as 16 cryptographically random bytes, hex-encoded (32 characters).
- Example: `a4f8e2b1c3d7f6a9e0b5d4c8f2a1e3b7`
- Tokens are single-use and bound to a specific domain registration.

## DNS TXT Record

The partner must add a TXT record at the following subdomain:

```
_mir-verify.{domain}
```

With the value:

```
mir-verify={token}
```

### Example

For domain `example.com` with token `a4f8e2b1c3d7f6a9e0b5d4c8f2a1e3b7`:

```
_mir-verify.example.com.  IN  TXT  "mir-verify=a4f8e2b1c3d7f6a9e0b5d4c8f2a1e3b7"
```

## Verification Process

1. Registry performs a DNS TXT lookup on `_mir-verify.{domain}`.
2. All returned TXT records are checked for an exact match of `mir-verify={expected_token}`.
3. Match found: domain is verified. The partner is authorized to submit claims under this domain.
4. No match: verification fails. The partner may retry.

### Timing

- The verification token is valid for **7 days** from generation.
- DNS propagation may take up to 72 hours. Partners should add the record promptly.
- If the token expires before verification succeeds, a new token must be generated.

## Post-Verification

Once verified, the domain remains in verified status. The DNS TXT record may be removed after verification succeeds — it is not checked on every claim submission.

### Re-verification

Domain ownership can change. The registry SHOULD periodically re-verify domains:

- **Recommended cadence:** Every 90 days.
- Re-verification uses the same process (new token, new TXT record).
- If re-verification fails after a grace period, the domain status is downgraded and new claims are rejected until verification is restored.
- Existing claims from the domain remain valid — they are historical records of what was asserted while the domain was verified.

## Subdomains

- `example.com` and `shop.example.com` are treated as separate domains.
- Verification of `example.com` does NOT grant authority over `shop.example.com`.
- Each subdomain must be independently verified.

## Constraints

- A domain can only be registered to one partner at a time.
- Transferring domain authority requires the current partner to release it.
- The registry MUST NOT accept claims from unverified domains.
- Wildcard domains are not supported.
