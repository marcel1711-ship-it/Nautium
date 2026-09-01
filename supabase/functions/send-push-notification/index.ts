import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = 'mailto:hello@nautium.app';

async function importCryptoKey(base64Key: string, usage: 'sign' | 'deriveBits'): Promise<CryptoKey> {
  const padding = '='.repeat((4 - base64Key.length % 4) % 4);
  const b64 = (base64Key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawKey = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  if (usage === 'sign') {
    return crypto.subtle.importKey('pkcs8', rawKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  return crypto.subtle.importKey('raw', rawKey, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(audience: string): Promise<string> {
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

  const keyData = Uint8Array.from(atob(
    (VAPID_PRIVATE_KEY + '='.repeat((4 - VAPID_PRIVATE_KEY.length % 4) % 4))
      .replace(/-/g, '+').replace(/_/g, '/')
  ), c => c.charCodeAt(0));

  // Build PKCS8 wrapper for the raw 32-byte EC private key
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
    key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes[0] === 0x30) {
    // DER encoded
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

async function sendPushToSubscription(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createJWT(audience);

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        'Content-Encoding': 'aes128gcm',
      },
      body: payload,
    });

    // 201 = delivered, 410 = subscription expired
    if (res.status === 410 || res.status === 404) return false;
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { company_id, user_ids, title, message, url, tag } = body;

    if (!company_id || !title || !message) {
      return new Response(JSON.stringify({ error: 'company_id, title, and message required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Clean up expired subscriptions
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
