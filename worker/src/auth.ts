export async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<{ uid: string; email: string; plan: string } | null> {
  try {
    const keysRes = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    const keys = await keysRes.json() as Record<string, string>;
    const [headerB64] = token.split('.');
    const header = JSON.parse(atob(headerB64));
    const pemKey = keys[header.kid];
    if (!pemKey) return null;

    const key = await importPublicKey(pemKey);
    const [h, p, sig] = token.split('.');
    const data = new TextEncoder().encode(`${h}.${p}`);
    const signature = base64UrlDecode(sig);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(p));
    if (payload.aud !== projectId) return null;
    if (payload.exp < Date.now() / 1000) return null;

    return { uid: payload.sub, email: payload.email ?? '', plan: payload.plan ?? 'starter' };
  } catch {
    return null;
  }
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
