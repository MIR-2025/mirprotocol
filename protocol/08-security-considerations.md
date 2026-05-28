# 08 — Security Considerations

## Cryptographic Properties

### Ed25519 Strength

Ed25519 provides approximately 128 bits of security. Breaking a key requires roughly 2^128 operations. As of this writing, this is considered secure against classical computing. Ed25519 is not quantum-resistant; post-quantum migration is a future consideration (see [10 — Non-Goals](10-non-goals.md)).

### Signature Determinism

Ed25519 signatures are deterministic. The same key and the same message always produce the same signature. This eliminates an entire class of nonce-related vulnerabilities (such as those that affected ECDSA implementations).

### Canonical Serialization

The canonical serialization rules (sorted keys, no whitespace, UTF-8) ensure that any conformant implementation produces identical bytes for the same logical claim. Without canonical serialization, logically identical JSON objects could produce different bytes and different signatures.

Implementations MUST follow the canonical serialization rules exactly. A common source of bugs is inconsistent number serialization (e.g., `1.0` vs `1` vs `1.00`). The reference SDK provides a canonical serializer.

## Infrastructure Trust Assumptions

### DNS and HTTPS as Key Discovery Channels

MIR key discovery relies on DNS TXT records and HTTPS `.well-known` endpoints — the same infrastructure that underpins DKIM, DMARC, MTA-STS, and Let's Encrypt domain validation. An attacker who can hijack a domain's DNS or forge its TLS certificate can serve a false public key and sign claims as that domain.

This is not a risk unique to MIR. It is the ambient risk of any domain-anchored trust model. DKIM has the same exposure: a DNS hijack lets an attacker forge DKIM-signed email. The mitigations are the same: DNSSEC, certificate transparency, and operational monitoring.

MIR does not introduce a new PKI. It rides the existing DNS/HTTPS infrastructure because that infrastructure is already the trust boundary that domains manage. Adding a separate PKI would increase complexity without reducing the attack surface — any system that can hijack DNS can also compromise a custom PKI's enrollment flow.

**Mitigations:**
- DNSSEC prevents DNS record forgery.
- `.well-known` over HTTPS provides TLS-protected key discovery as an independent channel.
- Verifiers SHOULD use both channels and flag discrepancies.
- Registry `ingestedAt` timestamps provide a temporal anchor that survives DNS changes.

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

### Domain Ownership Transfer

The domain field is the identity anchor in MIR. If a domain changes ownership — through acquisition, bankruptcy, or expiration — the new owner controls key publication for that domain. This creates two risks:

1. **Historical claims become unverifiable.** If the new owner does not republish the old keys, verifiers cannot discover the public key needed to verify historical claims.
2. **Impersonation.** The new owner can publish new keys and sign claims as the historical entity.

These are the same risks that affect DKIM, SPF, and any domain-anchored identity system. MIR does not solve domain continuity — no domain-anchored protocol does.

**Mitigations for verifiers:**
- Cross-reference registry `ingestedAt` timestamps. Claims ingested before an ownership transfer date are attributable to the original entity.
- Key fingerprint discontinuity is a detectable signal. A sudden change in published keys without overlap suggests an ownership change, not a routine rotation.
- Verifiers consuming historical claims SHOULD cache public keys and not rely solely on live discovery.

**Mitigations for domains:**
- Domains that anticipate a transfer SHOULD set key expiry dates before the transfer completes.
- Registries holding historical claims provide continuity even after domain ownership changes.

### Timestamp Integrity

The `timestamp` field in a claim is asserted by the signing domain. The protocol does not prove that the event actually occurred at the stated time. A domain can backdate claims — signing a `mir.transaction.completed` today with a timestamp from six months ago.

**Mitigations:**
- Registry `ingestedAt` provides an independent lower bound on when a claim was first observed. A claim cannot have been created before it was ingested.
- Verifiers SHOULD compare `timestamp` against `ingestedAt` when both are available. A large discrepancy (claim timestamp significantly before ingestion) is not necessarily invalid — legitimate delayed submission exists — but it is a signal worth logging.
- Without a registry, there is no independent timestamp integrity. This is an inherent limitation of any self-asserted timestamp model.

This is comparable to X.509 `notBefore` and `notAfter` fields, which are also CA-asserted rather than proven by an independent time authority.

## Subject Privacy

### Hash Preimage

Subject hashes are `SHA256("{domain}:{externalUserId}")`. If the domain and the format of external user IDs are known, an attacker could attempt to brute-force the hash to identify the subject.

**Mitigations:**
- Use HMAC-SHA256 subject derivation (see [03 — Claim Format](03-claim-format.md#recommended-derivation-hmac-sha256)). HMAC resists brute-force even when the ID format is known.
- Domains MUST use HMAC derivation when external user IDs have predictable format or fewer than 128 bits of entropy (e.g., sequential integers, short alphanumeric codes, phone numbers).
- Domains using plain SHA-256 SHOULD use sufficiently random identifiers (UUIDs, database-generated IDs with at least 128 bits of randomness).

### Cross-Domain Correlation

By design, the same real-world user has different subject hashes on different domains. An observer cannot correlate subjects across domains from hashes alone. Correlation requires the subject to voluntarily disclose their hashes.

## Transport Security

Claims are signed, not encrypted. The signature protects integrity and authorship but does not protect confidentiality.

- Claims submitted to registries SHOULD use HTTPS.
- `.well-known/mir.json` MUST be served over HTTPS.
- DNS TXT records are inherently unencrypted; DNSSEC is RECOMMENDED.

## Replay and Freshness

### Claims Are Not Credentials

A MIR claim is an assertion of historical fact, not a bearer token. Presenting a claim does not grant access or authorize actions. A valid claim can be presented to multiple registries or verifiers without changing its meaning. This is by design — claims are portable.

### Why Claims Have No Expiry

Claims do not expire. A `mir.transaction.completed` from 2024 is still a valid assertion in 2030. The signature proves authorship and integrity regardless of age. Expiry would destroy the continuity property that MIR exists to provide.

### Freshness Is a Verifier Concern

The protocol does not enforce freshness. Verifiers MAY apply their own freshness policies:

- **Recency windows:** Accept only claims with `timestamp` within the last N days.
- **Registry cross-reference:** Check the registry's `ingestedAt` to bound when a claim was first seen.
- **Key validity windows:** Accept only claims whose `timestamp` falls within the signing key's `created`–`expires` range.

These are verifier-side policy decisions. The protocol provides the data; the verifier applies the rules.

### Context Binding

MIR claims are intentionally unbound — they carry no audience, nonce, or relying party field. This is a design choice:

- **Bound claims** (like OIDC tokens) are single-use and context-specific. They prevent replay but sacrifice portability.
- **Unbound claims** (like MIR) are reusable and portable. They can be verified by anyone, anywhere, anytime.

If a verifier needs context binding (e.g., "this claim was presented specifically to me, right now"), the binding MUST happen at the application layer — not in the MIR protocol. For example, a verifier can require the subject to sign a challenge that includes the claim ID, proving they control the subject hash and are presenting the claim intentionally.

### Duplicate Submission

A claim submitted to multiple registries is not an attack — it's expected behavior. Registries SHOULD deduplicate by claim signature (identical `sig` values represent the same claim). A claim's identity is its signature.

## Metadata and Data Protection

### PII in Metadata

The `metadata` field is an arbitrary JSON object up to 4 KB. The protocol requires that metadata MUST NOT contain PII (see [03 — Claim Format](03-claim-format.md#metadata-optional)). However, this is a normative requirement with no technical enforcement — the protocol cannot inspect or reject specific metadata content.

A domain that includes personal data in metadata (e.g., email addresses, names, phone numbers) is non-conformant, but the resulting claim is still cryptographically valid and will pass signature verification.

### Immutability and Erasure

Claims are immutable by design. The Ed25519 signature covers the entire payload including metadata. Modifying or redacting any field — including metadata — invalidates the signature.

This creates a tension with data protection frameworks that provide a right to erasure (e.g., GDPR Article 17, CCPA). If PII enters a signed claim:

- The claim cannot be modified without breaking the signature.
- Deleting the claim from a registry removes it from that index but does not affect copies held by other registries or verifiers.

**Mitigations:**
- Domains bear sole responsibility for ensuring no personal data enters claim payloads. This is an operational control, not a protocol-level guarantee.
- Registries facing erasure requests for claims containing PII SHOULD remove the claim from their index and note the removal reason. The underlying signature remains mathematically valid but the claim is no longer served.
- Verifiers SHOULD NOT cache claim metadata beyond their operational needs.
- The strongest mitigation is prevention: domains SHOULD validate metadata content before signing, and SHOULD implement automated checks that reject PII patterns (email addresses, phone numbers, government ID formats) at claim creation time.
