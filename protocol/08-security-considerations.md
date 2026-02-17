# 08 — Security Considerations

## Cryptographic Properties

### Ed25519 Strength

Ed25519 provides approximately 128 bits of security. Breaking a key requires roughly 2^128 operations. As of this writing, this is considered secure against classical computing. Ed25519 is not quantum-resistant; post-quantum migration is a future consideration (see [10 — Non-Goals](10-non-goals.md)).

### Signature Determinism

Ed25519 signatures are deterministic. The same key and the same message always produce the same signature. This eliminates an entire class of nonce-related vulnerabilities (such as those that affected ECDSA implementations).

### Canonical Serialization

The canonical serialization rules (sorted keys, no whitespace, UTF-8) ensure that any conformant implementation produces identical bytes for the same logical claim. Without canonical serialization, logically identical JSON objects could produce different bytes and different signatures.

Implementations MUST follow the canonical serialization rules exactly. A common source of bugs is inconsistent number serialization (e.g., `1.0` vs `1` vs `1.00`). The reference SDK provides a canonical serializer.

## Key Management

### Key Compromise

If a domain's private key is compromised, an attacker can sign claims as that domain. The protocol does not prevent this — it is an operational security concern for the domain.

**Mitigations:**
- Rotate keys regularly.
- Publish key expiry dates via `.well-known/mir.json`.
- When a key is compromised, remove it from publication immediately. Claims signed with the compromised key remain verifiable (the signature is still mathematically valid), but verifiers can check whether the key was active at the claimed timestamp.

### Key Rotation

Domains SHOULD rotate keys periodically. The protocol supports multiple simultaneous active keys via the `keyFingerprint` field. Rotation process:

1. Generate a new key pair.
2. Publish the new public key (DNS and/or `.well-known`).
3. Begin signing new claims with the new key.
4. Retain the old public key in publication (with expiry) for historical verification.

### Key Revocation

The protocol does not define a formal revocation mechanism. Removing a key from publication is the revocation signal. Verifiers encountering a `keyFingerprint` that cannot be discovered MUST reject the claim.

## Subject Privacy

### Hash Preimage

Subject hashes are `SHA256("{domain}:{externalUserId}")`. If the domain and the format of external user IDs are known, an attacker could attempt to brute-force the hash to identify the subject.

**Mitigations:**
- Use sufficiently random or long external user IDs.
- Domains MAY add a domain-specific salt to the hash input (must be consistent and documented).

### Cross-Domain Correlation

By design, the same real-world user has different subject hashes on different domains. An observer cannot correlate subjects across domains from hashes alone. Correlation requires the subject to voluntarily disclose their hashes.

## Transport Security

Claims are signed, not encrypted. The signature protects integrity and authorship but does not protect confidentiality.

- Claims submitted to registries SHOULD use HTTPS.
- `.well-known/mir.json` MUST be served over HTTPS.
- DNS TXT records are inherently unencrypted; DNSSEC is RECOMMENDED.

## Replay Considerations

A valid signed claim can be presented to multiple registries or verifiers. This is by design — claims are portable. The claim itself is not a token or credential; presenting it does not grant access or authorize actions. It is an assertion of historical fact.
