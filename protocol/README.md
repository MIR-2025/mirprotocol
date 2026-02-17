# MIR Protocol — Memory Infrastructure Registry

**Version:** 0.1.0 (Draft)
**Status:** Draft Specification — Subject to iteration

---

MIR is a neutral, non-scoring continuity layer for digital participation. It defines a structured, verifiable format for publishing timestamped claims tied to domain authority — without reputation scoring, surveillance, or behavioral ranking.

- MIR is not identity.
- MIR is not a reputation score.
- MIR does not evaluate trust.
- MIR preserves verifiable continuity.

## Why MIR Exists

In distributed systems — especially identity and AI-driven ecosystems — context disappears. Claims become ephemeral. Participation becomes untraceable.

MIR introduces a portable memory primitive: a structured record of participation, submitted by registered partner organizations and anchored to time.

## What MIR Is

| Component | Specification |
|-----------|--------------|
| Claim format | [`spec/claim-format.md`](spec/claim-format.md) |
| Domain validation model | [`spec/domain-authority.md`](spec/domain-authority.md) |
| Verification process | [`spec/verification.md`](spec/verification.md) |
| Registry resolution framework | [`spec/resolution.md`](spec/resolution.md) |
| Trust and threat model | [`spec/threat-model.md`](spec/threat-model.md) |

## What MIR Is Not

- **Not a scoring system.** MIR records claims. It does not calculate, weight, or rank.
- **Not identity replacement.** MIR anchors claims to domains, not to people.
- **Not surveillance.** Subject identifiers are hashed. No PII enters the registry.
- **Not a centralized reputation authority.** MIR is infrastructure, not a judge.
- **Not behavioral analytics.** MIR does not model, predict, or profile.

## Design Principles

- **Infrastructure, not product.** MIR is a specification, not a platform.
- **Neutral, not evaluative.** The registry records; it does not interpret.
- **Deterministic, not heuristic.** Behavior is specified, not learned.
- **Minimal and composable.** No feature creep, no hidden dependencies.
- **Independently implementable.** Anyone can implement MIR from this specification alone.

## Intended Use

- Identity governance stacks
- Zero Trust architectures
- AI workflow audit trails
- Event participation systems
- Provenance tracking systems
- Cross-domain continuity frameworks

## Quick Start

A MIR claim is a structured JSON record:

```json
{
  "version": 1,
  "type": "transaction.completed",
  "domain": "example.com",
  "subject": "a1b2c3d4e5f6...",
  "timestamp": "2026-02-14T12:00:00Z",
  "metadata": {
    "amount": 150.00,
    "currency": "USD"
  }
}
```

See [`examples/`](examples/) for complete examples and [`schema/claim.schema.json`](schema/claim.schema.json) for the formal JSON Schema.

## Repository Structure

```
protocol/
├── README.md                        # This file
├── LICENSE                          # MIT
├── spec/
│   ├── claim-format.md              # Claim structure, fields, constraints
│   ├── domain-authority.md          # DNS TXT verification model
│   ├── verification.md              # Verify claims against registry
│   ├── resolution.md                # Registry lookup framework
│   └── threat-model.md              # Trust model, non-goals
├── schema/
│   └── claim.schema.json            # JSON Schema for claims
└── examples/
    ├── claim-transaction.json       # Example: transaction claim
    ├── claim-review.json            # Example: review claim
    └── verification-walkthrough.md  # End-to-end verification walkthrough
```

## Open-Core Boundary

**Open (this specification):**

- Claim structure and field definitions
- Hashing rules for subject identifiers
- Domain verification method
- Registry resolution behavior
- Public verification logic

**Commercial (not part of this specification):**

- Hosted MIR Registry nodes
- Enterprise dashboards and reporting
- SLA-backed validation services
- Large-scale ingestion pipelines
- Managed compliance integrations

Rule of thumb: if someone can independently implement MIR without asking permission, it belongs in this specification. If it requires operational infrastructure or enterprise orchestration, it is commercial.

## License

[MIT](LICENSE)
