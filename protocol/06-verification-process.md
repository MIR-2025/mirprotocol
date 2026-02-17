# 06 — Verification Process

This document specifies the deterministic algorithm for verifying a MIR claim. Verification can be performed offline, by any party, without contacting a registry.

## Prerequisites

The verifier has:

1. A MIR claim (JSON document with `sig` field).
2. Network access to the domain's key publication endpoint (DNS or HTTPS) — or a cached copy of the domain's public key.

## Algorithm

```
VERIFY(claim):

  1. Parse the claim as JSON.
     REJECT(INVALID_SCHEMA) if malformed.

  2. Validate required fields exist:
     - mir, type, domain, subject, timestamp, keyFingerprint, sig
     REJECT(INVALID_SCHEMA) if any required field is missing.

  3. Validate field formats:
     - mir MUST equal 1.
     - type MUST match pattern: core (mir.{category}.{action}) or
       extension ({domain}:{category}.{action}).
     - domain MUST be a valid DNS hostname.
     - subject MUST be a 64-character lowercase hex string.
     - timestamp MUST be valid ISO 8601 with timezone.
     - keyFingerprint MUST be a 64-character lowercase hex string.
     - sig MUST be valid base64url (no padding), decoding to exactly 64 bytes.
     REJECT(INVALID_SCHEMA) if any validation fails.

  4. Extract the sig value. Remove the "sig" key from the claim object.

  5. Compute canonical form:
     - Sort all keys lexicographically (recursive).
     - Serialize as JSON with no whitespace.
     - Encode as UTF-8 bytes.
     REJECT(CANONICALIZATION_ERROR) if serialization fails.

  6. Discover the domain's public key:
     a. Fetch https://{domain}/.well-known/mir.json
     b. If unavailable, query DNS TXT at _mir-key.{domain}
     c. From the discovered keys, find the key whose
        SHA256(raw_32_byte_public_key) == claim.keyFingerprint
     REJECT(KEY_NOT_FOUND) if no matching key is found.

     6a. Check key temporal validity:
         If the matching key has a non-null `expires`:
         - The key SHOULD be considered valid if the claim's `timestamp`
           falls before the key's `expires` value (the key was active
           when the claim was issued).
         - Verifiers SHOULD allow up to 5 minutes of clock skew
           (accept claims with `timestamp` up to 5 minutes after `expires`).
         - REJECT(KEY_EXPIRED) if the verifier's policy rejects
           claims signed with expired keys, even when the claim
           predates the expiry.

  7. Base64url-decode the sig to obtain the 64-byte signature.

  8. Verify the Ed25519 signature:
     Ed25519_Verify(public_key, canonical_bytes, signature)
     REJECT(INVALID_SIGNATURE) if verification fails.

  9. ACCEPT. The claim is valid.
```

## Error Codes

Verification failures MUST include a machine-readable error code:

| Code | Meaning |
|------|---------|
| `INVALID_SCHEMA` | Malformed JSON, missing required field, or field format violation |
| `INVALID_SIGNATURE` | Ed25519 signature does not match canonical payload and public key |
| `KEY_NOT_FOUND` | No published key matches the claim's `keyFingerprint` |
| `KEY_EXPIRED` | Matching key exists but has expired (verifier policy) |
| `CLAIM_EXPIRED` | Claim timestamp exceeds verifier's freshness policy (verifier policy) |
| `CANONICALIZATION_ERROR` | Canonical serialization failed |
| `DOMAIN_MISMATCH` | Claim domain does not match expected domain (verifier policy) |

Codes prefixed with "verifier policy" are not protocol-level rejections — they are verifier-side decisions. The protocol defines `INVALID_SCHEMA`, `INVALID_SIGNATURE`, `KEY_NOT_FOUND`, and `CANONICALIZATION_ERROR` as mandatory rejection reasons. `KEY_EXPIRED`, `CLAIM_EXPIRED`, and `DOMAIN_MISMATCH` are verifier-optional.

## Result

Verification produces exactly one of two outcomes:

| Result | Meaning |
|--------|---------|
| **ACCEPT** | The claim was signed by a key controlled by the stated domain. It has not been altered. |
| **REJECT** | The claim is malformed, the signature is invalid, or the signing key could not be discovered. Includes an error code. |

There is no partial acceptance.

## What ACCEPT Means

- The claim was signed by a private key corresponding to a public key published by the domain.
- The claim payload has not been modified since signing.
- The `keyFingerprint` matches a key associated with the domain.

## What ACCEPT Does Not Mean

- The claim is true.
- The domain is trustworthy.
- The subject exists.
- The timestamp is accurate.
- A registry has indexed the claim.

## Offline Verification

If the verifier has previously cached the domain's public key, the entire verification algorithm executes offline. No network requests. No registry. No external dependencies.

This is the defining property of the MIR trust model: **claims are self-contained proofs of authorship.**

## Batch Verification

Multiple claims can be verified independently. There is no interdependency between claims. Each claim carries its own signature and key fingerprint.

For efficiency, verifiers SHOULD cache public keys by domain and fingerprint to avoid redundant discovery.

## Timestamp and Clock Skew

Verifiers SHOULD allow up to **5 minutes** of clock skew in all temporal comparisons. This applies to:

- **Key expiry:** A claim with `timestamp` up to 5 minutes after a key's `expires` SHOULD still be accepted.
- **Future claims:** Reject claims with `timestamp` more than 5 minutes in the future (`CLAIM_EXPIRED`).
- **Key creation:** Flag claims with `timestamp` significantly before the key's `created` date.

**Key validity is evaluated at the claim's `timestamp`, not at verification time.** A claim signed when the key was active remains valid even if the key has since expired. This preserves historical verifiability — an expired key does not retroactively invalidate claims signed during its active period.

Verifiers MAY cross-reference with registry ingestion timestamps if available.

These are verifier policy decisions, not protocol requirements. The protocol itself only mandates signature verification (step 8).
