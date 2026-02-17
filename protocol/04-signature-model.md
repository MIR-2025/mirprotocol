# 04 — Signature Model

Every MIR claim is cryptographically signed by the issuing domain using Ed25519. Verification is deterministic and requires no trusted third party.

## Algorithm

**Ed25519** (EdDSA over Curve25519) as specified in [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032).

- **Key size:** 32-byte private seed, 32-byte public key.
- **Signature size:** 64 bytes.
- **Deterministic:** Same input always produces the same signature. No random nonce.
- **Fast:** Verification is computationally inexpensive.

### Why Ed25519

- Deterministic signatures eliminate nonce-related vulnerabilities.
- Small keys and signatures minimize claim size.
- Widely supported across platforms and languages.
- No configuration parameters — one algorithm, one curve, no negotiation.

## Binary Encoding

All binary-to-text encoding in MIR MUST use **base64url without padding** ([RFC 4648 §5](https://datatracker.ietf.org/doc/html/rfc4648#section-5)).

- Alphabet: `A-Z a-z 0-9 - _`
- No padding (`=`). No `+` or `/`.
- Ed25519 signature (64 bytes) → exactly **86 characters**.
- Ed25519 public key (32 bytes) → exactly **43 characters**.

**Rationale:** Aligns with the JOSE/JWT/JWK ecosystem. Unambiguous without padding for fixed-size Ed25519 values. URL-safe.

## Canonical Serialization

The signature covers a **canonical form** of the claim payload. This ensures that any implementation produces identical bytes for the same logical claim.

### Rules

1. Start with the complete claim object.
2. **Remove** the `sig` field. No other fields are removed.
3. Serialize the remaining object as JSON with the following rules:
   - **Key ordering:** Keys sorted lexicographically by Unicode code point value, applied recursively to all nested objects.
   - **Whitespace:** No whitespace between tokens. No spaces after `:` or `,`. No newlines. No indentation.
   - **Trailing commas:** None.
   - **BOM:** None. The output MUST NOT begin with a UTF-8 BOM (`0xEF 0xBB 0xBF`).
   - **Strings:** Enclosed in double quotes. Characters escaped per RFC 8259 Section 7. Unicode escape sequences use lowercase hex (`\u00e9`, not `\u00E9`). The following characters MUST be escaped: `"`, `\`, and control characters U+0000 through U+001F. Forward slash (`/`) MUST NOT be escaped.
   - **Numbers:** See [Number Handling](#number-handling) below.
   - **Booleans:** `true` or `false` (lowercase).
   - **Null:** `null` (lowercase).
   - **Arrays:** Preserve element order. Apply rules recursively to elements.
   - **Newlines in strings:** MUST be represented as `\n` (two characters: backslash, lowercase n). No `\r\n`. No raw newline bytes.
4. Encode the resulting string as **UTF-8 bytes**. No null terminator.

These bytes are the **signing input** and the **verification input**.

### Number Handling

Floating-point numbers are the most common source of cross-language canonicalization failures. Different languages serialize `149.99` differently (`149.99` vs `149.98999999999999` vs `1.4999e2`).

**Rules for the signed payload (`mir`, `type`, `domain`, `subject`, `timestamp`, `keyFingerprint`):**

- All protocol-defined fields are strings or integers. No floats.

**Rules for `metadata`:**

- Integer values MUST serialize without a decimal point: `1`, not `1.0`.
- Implementations SHOULD avoid float values in metadata. Represent decimals as strings: `"149.99"` instead of `149.99`.
- If a float value is present, it MUST serialize using the shortest representation that round-trips: `149.99`, not `149.990` or `1.4999e2`. No leading zeros (`0.5`, not `00.5`). No positive sign. Negative zero serializes as `0`. No `NaN` or `Infinity`.
- When in doubt, use integer minor units (e.g., `14999` for $149.99) or string representations.

### Cross-Language Implementation Notes

The canonical serialization MUST produce identical bytes across all implementations. Common pitfalls:

| Language | Pitfall | Correct behavior |
|----------|---------|-----------------|
| JavaScript | `JSON.stringify` does not sort keys | Sort explicitly before serialization |
| Go | `encoding/json` does not sort map keys by default | Use sorted key iteration or `json.Marshal` on a struct with ordered fields |
| Java | `ObjectMapper` may use insertion order | Configure `ORDER_MAP_ENTRIES_BY_KEYS` or use `TreeMap` |
| Rust | `serde_json` preserves insertion order by default | Use `BTreeMap` or sort before serialization |
| Python | `json.dumps` preserves insertion order since 3.7 | Use `sort_keys=True` and `separators=(',', ':')` |

The [test vectors](../test-vectors/) are **normative for conformance**. Any implementation that produces different canonical bytes for the test vector claims is non-conformant. When in doubt, match the reference SDK's byte output.

### Example

Given this claim:

```json
{
  "mir": 1,
  "type": "transaction.completed",
  "domain": "example.com",
  "subject": "a55bea0a6788794ef1307951f98bc339db7ccf9309881180e9e6c080f63ae618",
  "timestamp": "2026-02-16T15:30:00Z",
  "metadata": {"currency": "USD", "count": 1},
  "keyFingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sig": "..."
}
```

The canonical form (before signing) is:

```
{"domain":"example.com","keyFingerprint":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","metadata":{"count":1,"currency":"USD"},"mir":1,"subject":"a55bea0a6788794ef1307951f98bc339db7ccf9309881180e9e6c080f63ae618","timestamp":"2026-02-16T15:30:00Z","type":"transaction.completed"}
```

Note: keys are sorted (`domain` < `keyFingerprint` < `metadata` < `mir` < ...), and within `metadata`, keys are also sorted (`count` < `currency`).

## Signing Process

```
1. Construct claim object (without sig).
2. Compute canonical form (sorted keys, no whitespace, UTF-8).
3. Sign the canonical bytes with the domain's Ed25519 private key.
4. Base64url-encode the 64-byte signature (no padding).
5. Add the "sig" field to the claim object.
```

## Verification Process

```
1. Extract and remove the "sig" field from the claim.
2. Compute canonical form of the remaining object.
3. Base64url-decode the sig to obtain the 64-byte signature.
4. Obtain the domain's public key (see 05-domain-key-discovery.md).
5. Verify the Ed25519 signature against the canonical bytes and public key.
6. Accept or reject.
```

Verification is binary: the signature is valid or it is not. There is no partial validity.

## Key Management

- Domains SHOULD rotate signing keys periodically (see [05 — Domain Key Discovery](05-domain-key-discovery.md#key-lifecycle)).
- Domains MAY have multiple active keys simultaneously.
- The `keyFingerprint` field in each claim identifies which key produced the signature.
- Key fingerprint is `SHA256(raw_32_byte_public_key)`, hex-encoded, lowercase.
- Retired keys SHOULD remain published (with an expiry date) so historical claims remain verifiable.
