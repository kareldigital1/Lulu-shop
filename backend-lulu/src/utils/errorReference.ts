import { randomBytes } from "node:crypto";

const ERROR_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ERROR_REFERENCE_LENGTH = 6;

export function createErrorReference() {
  const bytes = randomBytes(ERROR_REFERENCE_LENGTH);
  const suffix = Array.from(
    bytes,
    (byte) => ERROR_REFERENCE_ALPHABET[byte % ERROR_REFERENCE_ALPHABET.length],
  ).join("");

  return `ERR-${suffix}`;
}
