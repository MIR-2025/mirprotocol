# Resolution

**Status:** Draft

Resolution is the process of looking up claims in the MIR registry. This document specifies how claims are addressed, queried, filtered, and paginated.

## Addressing

Every claim in the registry has a unique, opaque identifier assigned at ingestion time.

```
claim_{random_id}
```

Claims can be resolved by:

- **Claim ID:** Direct lookup of a specific claim.
- **Subject hash:** All claims for a given pseudonymous subject.
- **Domain:** All claims submitted by a given domain.
- **Type:** All claims of a given type.

These dimensions can be combined.

## Endpoints

### Single Claim

```
GET /v1/claims/{claimId}
```

Returns the full claim record or `404` if not found.

### Query Claims

```
GET /v1/claims?subject={hash}&domain={domain}&type={type}
```

At least one query parameter is required. The registry MUST NOT support unfiltered listing of all claims.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `subject` | string | SHA-256 subject hash (64-char hex) |
| `domain` | string | Submitting domain |
| `type` | string | Claim type (e.g., `transaction.completed`) |
| `after` | string (ISO 8601) | Claims with timestamp after this date |
| `before` | string (ISO 8601) | Claims with timestamp before this date |
| `cursor` | string | Pagination cursor from previous response |
| `limit` | integer | Results per page (default: 50, max: 200) |

### Subject History

```
GET /v1/subjects/{subjectHash}/claims
```

Returns all claims associated with a subject hash, across all domains. This is the portability primitive — a user can retrieve their full claim history by providing their subject hash.

#### Ordering

Results are ordered by `timestamp` descending (most recent first) by default. The `order` parameter accepts:

- `timestamp:asc` — oldest first
- `timestamp:desc` — newest first (default)

## Pagination

The registry uses cursor-based pagination. Each response includes:

```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6ImNsYWltXzEyMyJ9",
    "hasMore": true,
    "total": 847
  }
}
```

- `cursor`: Opaque string. Pass as `?cursor=` to get the next page.
- `hasMore`: Boolean indicating whether more results exist.
- `total`: Total count of matching claims (may be approximate for large result sets).

Cursors are stateless and stable — they encode the position in the result set and can be used indefinitely.

## Cross-Domain Resolution

A single subject may have claims from multiple domains. When querying by subject hash without a domain filter, the response includes claims from all domains:

```
GET /v1/subjects/{subjectHash}/claims
```

Each claim in the response carries its `domain` field, allowing the verifier to evaluate claims per-source.

## Batch Resolution

Multiple claims can be resolved in a single request:

```
POST /v1/claims/batch
Content-Type: application/json

{
  "claimIds": ["claim_abc123", "claim_def456", "claim_ghi789"]
}
```

The response includes each requested claim (or a `404` status for missing IDs). Maximum batch size: 100.

## Portability

Users own their claim history. The portability flow:

1. User computes their subject hash for a given domain: `SHA256("{domain}:{userId}")`.
2. User queries `GET /v1/subjects/{subjectHash}/claims`.
3. Registry returns all claims — the user can present this to any verifier.

Because subject hashes are domain-scoped, a user has a different hash per domain. To aggregate across domains, the user must provide all relevant subject hashes.

## Rate Limiting

Resolution endpoints are rate-limited. Authenticated partners receive higher limits based on their tier. Unauthenticated verification queries are permitted but at lower rates.

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid query parameters |
| `404` | Claim not found |
| `429` | Rate limit exceeded |
