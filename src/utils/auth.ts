import crypto from "crypto";

// Stored hash for password "rift"
// Generated using: crypto.createHash('sha256').update('rift').digest('hex')
const ADMIN_PASSWORD_HASH =
  "168ee09f96df4c38849d14d6b72b238995289c6014d8602d1c0b71f0db58c429";

/**
 * Hash a password using SHA-256
 */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Verify if the provided password matches the stored admin password
 */
export function verifyAdminPassword(password: string): boolean {
  const hashedInput = hashPassword(password);
  return hashedInput === ADMIN_PASSWORD_HASH;
}

/**
 * Generate the actual hash for "rift" (for reference)
 */
export function generateRiftHash(): string {
  return hashPassword("rift");
}
