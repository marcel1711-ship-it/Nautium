import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://nautium.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = 'mailto:hello@nautium.app';

// ── Base64URL helpers ──────────────────────────────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const b64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── VAPID JWT ──────────────────────────────────────────────────────────────

async function createVapidJWT(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    sub: VAPID_SUBJECT,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const keyData = base64UrlDecode(VAPID_PRIVATE_KEY);

  const pkcs8Prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04,
    0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Key = new Uint8Array(pkcs8Prefix.length + keyData.length);
  pkcs8Key.set(pkcs8Prefix);
  pkcs8Key.set(keyData, pkcs8Prefix.length);

  const key = await crypto.subtle.importKey(
    'pkcs8', pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key, enc.encode(unsignedToken)
  );

  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes[0] === 0x30) {
    const rLen = sigBytes[3];
    const rStart = 4;
    const sLenOffset = rStart + rLen + 1;
    const sLen = sigBytes[sLenOffset];
    const sStart = sLenOffset + 1;
    const r = sigBytes.slice(rStart, rStart + rLen);
    const s = sigBytes.slice(sStart, sStart + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  } else {
    rawSig = sigBytes;
  }

  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

// ── RFC 8291 Web Push Encryption (aes128gcm) ──────────────────────────────

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hkdf(
  salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial, length * 8
  );
  return new Uint8Array(bits);
}

function createInfo(
  type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array
): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(type);
  const header = enc.encode('Content-Encoding: ');
  const nul = new Uint8Array([0]);
  const prefix = enc.encode('P-256');

  return concat(
    header, typeBytes, nul,
    prefix, nul,
    new Uint8Array([0, clientPublicKey.length]),
    clientPublicKey,
    new Uint8Array([0, serverPublicKey.length]),
    serverPublicKey
  );
}

async function encryptPayload(
  plaintext: Uint8Array,
  subscriptionKeys: { p256dh: Uint8Array; auth: Uint8Array }
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  const clientPublicKey = await crypto.subtle.importKey(
    'raw', subscriptionKeys.p256dh,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeyPair.privateKey, 256
    )
  );

  const enc = new TextEncoder();

  // IKM = HKDF(auth, sharedSecret, "WebPush: info\0" || clientPub || serverPub, 32)
  const authInfo = concat(
    enc.encode('WebPush: info\0'),
    subscriptionKeys.p256dh,
    serverPublicKeyRaw
  );
  const ikm = await hkdf(subscriptionKeys.auth, sharedSecret, authInfo, 32);

  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK = HKDF-Extract(salt, IKM)
  // CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = createInfo('aes128gcm', subscriptionKeys.p256dh, serverPublicKeyRaw);
  const cek = await hkdf(salt, ikm, cekInfo, 16);

  // Nonce = HKDF-Expand(PRK, "Content-Encoding: nonce\0", 12)
  const nonceInfo = createInfo('nonce', subscriptionKeys.p256dh, serverPublicKeyRaw);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad the plaintext: content || 0x02 (delimiter for last record)
  const padded = concat(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  );

  // Build aes128gcm content coding header:
  // salt (16) || rs (4, big-endian uint32) || idlen (1) || keyid (65 = uncompressed point)
  const rs = plaintext.length + 17 + 1; // record size: content + padding + tag overhead
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, rs > 4096 ? 4096 : rs);

  const header = concat(
    salt,
    recordSize,
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw
  );

  return {
    ciphertext: concat(header, encrypted),
    serverPublicKey: serverPublicKeyRaw,
    salt,
  };
}

// ── Send to push service ──────────────────────────────────────────────────

async function sendPushToSubscription(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payloadJson: string
): Promise<boolean> {
  try {
    const p256dh = base64UrlDecode(subscription.keys_p256dh);
    const auth = base64UrlDecode(subscription.keys_auth);

    const { ciphertext } = await encryptPayload(
      new TextEncoder().encode(payloadJson),
      { p256dh, auth }
    );

    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJWT(audience);

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': String(ciphertext.length),
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: ciphertext,
    });

    if (res.status === 410 || res.status === 404) return false;
    return res.ok || res.status === 201;
  } catch (err) {
    console.error('Push delivery failed:', err);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isServiceCall = token === serviceRoleKey;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey
    );

    if (!isServiceCall) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

      const adminRoles = ['master_admin', 'customer_admin', 'owner'];
      const body_peek = await req.clone().json();
      if (!profile || (profile.company_id !== body_peek.company_id && profile.role !== 'master_admin')) {
        return new Response(JSON.stringify({ error: 'Not authorized for this company' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!adminRoles.includes(profile.role)) {
        return new Response(JSON.stringify({ error: 'Admin role required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json();
    const { company_id, user_ids, title, message, url, tag } = body;

    if (!company_id || !title || !message) {
      return new Response(JSON.stringify({ error: 'company_id, title, and message required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch subscriptions
    let query = supabase.from('push_subscriptions').select('*').eq('company_id', company_id);
    if (user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/dashboard',
      tag: tag || 'nautium-alert',
    });

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subscriptions) {
      const ok = await sendPushToSubscription(sub, payload);
      if (ok) {
        sent++;
      } else {
        expired.push(sub.id);
      }
    }

    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    return new Response(
      JSON.stringify({ sent, expired: expired.length, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('send-push error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
