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
     REJECT if malformed.

  2. Validate required fields exist:
     - mir, type, domain, subject, timestamp, keyFingerprint, sig
     REJECT if any required field is missing.

  3. Validate field formats:
     - mir must equal 1.
     - type must be a registered claim type.
     - domain must be a valid DNS hostname.
     - subject must be a 64-character lowercase hex string.
     - timestamp must be valid ISO 8601 with timezone.
     - keyFingerprint must be a 64-character lowercase hex string.
     - sig must be valid Base64, decoding to exactly 64 bytes.
     REJECT if any validation fails.

  4. Extract the sig value. Remove the "sig" key from the claim object.

  5. Compute canonical form:
     - Sort all keys lexicographically (recursive).
     - Serialize as JSON with no whitespace.
     - Encode as UTF-8 bytes.

  6. Discover the domain's public key:
     a. Fetch https://{domain}/.well-known/mir.json
     b. If unavailable, query DNS TXT at _mir-key.{domain}
     c. From the discovered keys, find the key whose
        SHA256(raw_32_byte_public_key) == claim.keyFingerprint
     REJECT if no matching key is found.

  7. Base64-decode the sig to obtain the 64-byte signature.

  8. Verify the Ed25519 signature:
     Ed25519_Verify(public_key, canonical_bytes, signature)
     REJECT if verification fails.

  9. ACCEPT. The claim is valid.
```

## Result

Verification produces exactly one of two outcomes:

| Result | Meaning |
|--------|---------|
| **ACCEPT** | The claim was signed by a key controlled by the stated domain. It has not been altered. |
| **REJECT** | The claim is malformed, the signature is invalid, or the signing key could not be discovered. |

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

## Timestamp Validation

Verifiers MAY apply additional timestamp checks:

- Reject claims with timestamps more than 5 minutes in the future.
- Flag claims with timestamps significantly before the key's `created` date.
- Cross-reference with registry ingestion timestamps if available.

These are verifier policy decisions, not protocol requirements.
