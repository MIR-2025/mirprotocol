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
   - **Numbers:** Integers serialize without decimal point (`1`, not `1.0`). Floats serialize with minimal decimal digits (`149.99`, not `149.990`). No leading zeros (`0.5`, not `00.5`). No positive sign (`1`, not `+1`). Negative zero serializes as `0`. No `NaN` or `Infinity` — these are not valid JSON.
   - **Booleans:** `true` or `false` (lowercase).
   - **Null:** `null` (lowercase).
   - **Arrays:** Preserve element order. Apply rules recursively to elements.
4. Encode the resulting string as **UTF-8 bytes**. No null terminator.

These bytes are the **signing input** and the **verification input**.

### Cross-Language Implementation Notes

The canonical serialization MUST produce identical bytes across all implementations. Common pitfalls:

| Language | Pitfall | Correct behavior |
|----------|---------|-----------------|
| JavaScript | `JSON.stringify` does not sort keys | Sort explicitly before serialization |
| Go | `encoding/json` does not sort map keys by default | Use sorted key iteration or `json.Marshal` on a struct with ordered fields |
| Java | `ObjectMapper` may use insertion order | Configure `ORDER_MAP_ENTRIES_BY_KEYS` or use `TreeMap` |
| Rust | `serde_json` preserves insertion order by default | Use `BTreeMap` or sort before serialization |
| Python | `json.dumps` preserves insertion order since 3.7 | Use `sort_keys=True` and `separators=(',', ':')` |

**Number serialization** is the most common source of interop failures. The reference SDK's `canonicalize()` function and the test vectors in [`/test-vectors/`](../test-vectors/) are the authoritative reference. When in doubt, match the reference SDK's byte output.

### Example

Given this claim:

```json
{
  "mir": 1,
  "type": "transaction.completed",
  "domain": "example.com",
  "subject": "a55bea0a6788794ef1307951f98bc339db7ccf9309881180e9e6c080f63ae618",
  "timestamp": "2026-02-16T15:30:00Z",
  "metadata": {"currency": "USD", "amount": 149.99},
  "keyFingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sig": "..."
}
```

The canonical form (before signing) is:

```
{"domain":"example.com","keyFingerprint":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","metadata":{"amount":149.99,"currency":"USD"},"mir":1,"subject":"a55bea0a6788794ef1307951f98bc339db7ccf9309881180e9e6c080f63ae618","timestamp":"2026-02-16T15:30:00Z","type":"transaction.completed"}
```

Note: keys are sorted (`domain` < `keyFingerprint` < `metadata` < `mir` < ...), and within `metadata`, keys are also sorted (`amount` < `currency`).

## Signing Process

```
1. Construct claim object (without sig).
2. Compute canonical form (sorted keys, no whitespace, UTF-8).
3. Sign the canonical bytes with the domain's Ed25519 private key.
4. Base64-encode the 64-byte signature.
5. Add the "sig" field to the claim object.
```

## Verification Process

```
1. Extract and remove the "sig" field from the claim.
2. Compute canonical form of the remaining object.
3. Decode the Base64 signature to 64 bytes.
4. Obtain the domain's public key (see 05-domain-key-discovery.md).
5. Verify the Ed25519 signature against the canonical bytes and public key.
6. Accept or reject.
```

Verification is binary: the signature is valid or it is not. There is no partial validity.

## Key Management

- Domains SHOULD rotate signing keys periodically.
- Domains MAY have multiple active keys simultaneously.
- The `keyFingerprint` field in each claim identifies which key produced the signature.
- Key fingerprint is `SHA256(raw_32_byte_public_key)`, hex-encoded, lowercase.
- Retired keys SHOULD remain published (with an expiry date) so historical claims remain verifiable.
