/**
 * Encryption utilities for sensitive data using AES-GCM.
 * Uses Web Crypto API available in Deno edge functions.
 *
 * KEY REQUIREMENTS:
 * - INTEGRATION_ENCRYPTION_KEY must be a random string of at least 32 characters.
 * - Generate a new key with: openssl rand -base64 32
 * - Set it via: supabase secrets set INTEGRATION_ENCRYPTION_KEY=<value>
 * - NEVER commit this value. NEVER reuse across staging and production.
 * - If the key changes, all previously encrypted tokens become unrecoverable.
 *   Implement explicit key rotation before changing the key in production
 *   (users will need to reconnect their integrations).
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const MIN_KEY_LENGTH = 32;

async function getKey(keyString: string): Promise<CryptoKey> {
  if (!keyString || keyString.length < MIN_KEY_LENGTH) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters. ` +
      `Generate one with: openssl rand -base64 32`
    );
  }
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  const key = await getKey(encryptionKey);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedBase64: string, encryptionKey: string): Promise<string> {
  const key = await getKey(encryptionKey);
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("figd_")) return false;
  try {
    const decoded = atob(value);
    return decoded.length > 20;
  } catch {
    return false;
  }
}
