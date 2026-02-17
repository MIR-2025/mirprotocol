# 10 — Non-Goals

The following are explicitly outside the scope of the MIR protocol. These are not future features. They are architectural exclusions.

## Reputation Scoring

MIR does not calculate trust scores, reputation rankings, or behavioral ratings. Claims are raw records of participation. Scoring is a downstream application concern, not a protocol function.

## Trust Evaluation

MIR does not determine whether a domain is trustworthy or whether a claim is true. The protocol proves *who* signed a claim, not *whether* the claim is accurate. Evaluating source credibility is the verifier's responsibility.

## Identity Verification

MIR verifies that a domain controls a signing key. It does not verify real-world identity of individuals, organizations, or the subjects referenced in claims. MIR is not an identity provider.

## Behavioral Analytics

MIR does not model, predict, or profile user behavior. Claim data is structured for portability and verification, not for analysis pipelines.

## Content Evaluation

MIR does not assess the quality, accuracy, or nature of events referenced in claims. A `mir.review.submitted` claim means the domain attests a review was submitted. MIR does not evaluate the review itself.

## Surveillance

Subject identifiers are domain-scoped hashes. The protocol is designed to resist cross-domain correlation without subject consent. MIR does not provide tracking, monitoring, or surveillance capabilities.

## Access Control

MIR claims are not credentials. They do not grant or deny access to systems. A verifier may use claims as input to access decisions, but that is the verifier's logic, not the protocol's.

## Encryption

MIR claims are signed, not encrypted. The protocol provides integrity and authorship guarantees, not confidentiality. Claims are designed to be publicly verifiable.

## Consensus

MIR does not use distributed consensus, blockchain, or any replicated state machine. Claims are signed documents, not ledger entries. There is no global ordering requirement.

## Post-Quantum Cryptography

The current specification uses Ed25519. Migration to post-quantum signature algorithms is a future concern that will be addressed in a future protocol version if and when it becomes necessary. The protocol version field (`mir`) enables this migration path.

## Centralized Authority

No single entity — including any registry operator — is the authoritative source of truth for MIR claims. Claims are independently verifiable. Multiple registries may coexist. The protocol is designed to function without any central coordinator.
