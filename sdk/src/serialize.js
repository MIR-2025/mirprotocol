/**
 * Canonical JSON serialization for MIR claims.
 *
 * Rules:
 * - Keys sorted lexicographically (recursive).
 * - No whitespace between tokens.
 * - UTF-8 encoded.
 * - The "sig" field is excluded from serialization.
 */

/**
 * Sort object keys recursively and produce deterministic JSON.
 * @param {unknown} value
 * @returns {unknown}
 */
function sortDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

  const sorted = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    sorted[key] = sortDeep(value[key]);
  }
  return sorted;
}

/**
 * Produce the canonical byte representation of a claim payload.
 * Removes the "sig" field, sorts keys recursively, serializes
 * as compact JSON, and returns UTF-8 bytes.
 *
 * @param {object} claim - The claim object (may or may not include "sig").
 * @returns {Uint8Array} The canonical UTF-8 bytes for signing/verification.
 */
export function canonicalize(claim) {
  const { sig, ...payload } = claim;
  const sorted = sortDeep(payload);
  const json = JSON.stringify(sorted);
  return new TextEncoder().encode(json);
}

/**
 * Produce the canonical JSON string (for inspection/debugging).
 *
 * @param {object} claim - The claim object.
 * @returns {string} The canonical JSON string.
 */
export function canonicalString(claim) {
  const { sig, ...payload } = claim;
  const sorted = sortDeep(payload);
  return JSON.stringify(sorted);
}
