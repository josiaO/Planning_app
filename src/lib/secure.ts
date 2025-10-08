// Minimal WebCrypto helpers to encrypt/decrypt strings with a password using PBKDF2 + AES-GCM
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function ensureWebCrypto() {
  if (typeof crypto === 'undefined' || !crypto) throw new Error('Web Crypto API (global "crypto") is not available in this environment');
  if (!('getRandomValues' in crypto)) throw new Error('crypto.getRandomValues is not available');
  // subtle may be under crypto.subtle or crypto.webcrypto.subtle in some environments
  const subtle = (crypto as any).subtle || (crypto as any).webcrypto?.subtle;
  if (!subtle) throw new Error('Web Crypto Subtle API not available (crypto.subtle is undefined). Ensure you run in a secure browser context (https or localhost).');
  return subtle as SubtleCrypto;
}

function bufToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptWithPassword(plain: string, password: string) {
  const subtle = ensureWebCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pwKey = await subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const derived = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, pwKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, derived, encoder.encode(plain));
  return { ciphertext: bufToBase64(ct), iv: bufToBase64(iv.buffer), salt: bufToBase64(salt.buffer) };
}

export async function decryptWithPassword(payload: { ciphertext: string; iv: string; salt: string }, password: string) {
  const subtle = ensureWebCrypto();
  const saltBuf = base64ToBuf(payload.salt);
  const ivBuf = base64ToBuf(payload.iv);
  const ctBuf = base64ToBuf(payload.ciphertext);
  const pwKey = await subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const derived = await subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(saltBuf), iterations: 100_000, hash: 'SHA-256' }, pwKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuf) }, derived, ctBuf);
    return decoder.decode(plainBuf);
  } catch (e) {
    throw new Error('Failed to decrypt: invalid password or corrupted data');
  }
}

export default { encryptWithPassword, decryptWithPassword };
