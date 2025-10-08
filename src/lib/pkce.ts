export function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

export async function sha256(buffer: Uint8Array) {
  if (!crypto.subtle) {
    throw new Error('crypto.subtle is not available. Please use HTTPS or a modern browser.');
  }
  const hash = await crypto.subtle.digest('SHA-256', buffer.buffer as ArrayBuffer);
  return new Uint8Array(hash as ArrayBuffer);
}

function base64UrlEncode(bytes: Uint8Array) {
  let s = btoa(String.fromCharCode(...Array.from(bytes)));
  s = s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return s;
}

export async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const hashed = await sha256(data);
  return base64UrlEncode(hashed);
}

export function generateVerifier(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  // base64-url
  return base64UrlEncode(arr);
}
