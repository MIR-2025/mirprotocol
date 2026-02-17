# 09 — Threat Model

## Trust Assumptions

The MIR protocol assumes:

1. **Ed25519 is secure.** The signature algorithm has not been broken.
2. **DNS/HTTPS is honest (or DNSSEC is used).** Public key discovery relies on DNS or HTTPS. A network attacker who can forge DNS responses or intercept HTTPS could serve a false public key. DNSSEC and certificate pinning mitigate this.
3. **Domains control their keys.** The protocol proves that a claim was signed by a key published by a domain. It does not prove that the domain's operational security is sound.

## Threats and Mitigations

### Claim Forgery

**Threat:** An attacker produces a claim appearing to come from a domain they do not control.

**Mitigation:** The attacker cannot produce a valid Ed25519 signature without the domain's private key. Verification against the domain's published public key will fail.

### Claim Tampering

**Threat:** An attacker modifies a claim after it was signed.

**Mitigation:** Any modification invalidates the Ed25519 signature. Verification will fail.

### False Claims by Legitimate Domains

**Threat:** A verified domain signs a claim about an event that did not occur.

**Mitigation:** None at the protocol level. MIR proves authorship, not truthfulness. This is an explicit design boundary. Verifiers must evaluate the trustworthiness of the issuing domain independently.

### Key Compromise

**Threat:** An attacker obtains a domain's private signing key.

**Mitigation:** The attacker can sign claims as that domain until the key is rotated. Domains should rotate keys regularly and remove compromised keys from publication. Verifiers can check whether a key was published at the time a claim was made.

### DNS Spoofing

**Threat:** An attacker spoofs DNS TXT records to serve a false public key, then signs claims with the corresponding private key.

**Mitigation:** DNSSEC prevents DNS spoofing. The `.well-known` endpoint served over HTTPS provides an alternative discovery path protected by TLS.

### Registry Compromise

**Threat:** A compromised registry serves tampered claims.

**Mitigation:** Claims carry their own signatures. A verifier checking the signature against the domain's published key will detect tampering regardless of the registry's integrity. This is why the registry is not a trust anchor.

### Replay

**Threat:** An attacker re-submits a valid claim to a different registry.

**Mitigation:** Claims are idempotent assertions. Re-submitting a valid claim to another registry does not change its meaning. The claim is the same regardless of where it is stored.

### Subject Deanonymization

**Threat:** An attacker brute-forces subject hashes to identify real users.

**Mitigation:** Depends on the entropy of the external user ID. Domains SHOULD use sufficiently random identifiers. The hash is domain-scoped, limiting cross-domain correlation.

### Collusion

**Threat:** Multiple domains coordinate to submit misleading claims about the same subject.

**Mitigation:** None at the protocol level. Verifiers consuming claims from multiple domains must apply their own analysis. Each claim's source domain is visible and independently verifiable.

## Attack Surface Summary

| Attack | Prevented? | Mechanism |
|--------|-----------|-----------|
| Claim forgery | Yes | Ed25519 signature |
| Claim tampering | Yes | Ed25519 signature |
| False claims (honest domain) | No | Out of scope |
| Key compromise | Partially | Key rotation, expiry |
| DNS spoofing | Partially | DNSSEC, `.well-known` fallback |
| Registry tampering | Yes | Client-side signature verification |
| Subject deanonymization | Partially | Hash entropy, domain scoping |
| Collusion | No | Out of scope |
