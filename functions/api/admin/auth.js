const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

const secureEqual = async (a, b) => {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(a || ''))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(b || '')))
  ]);
  const aa = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
};

export async function onRequestPost(context) {
  if (!context.env.ADMIN_PASSWORD) return json({ error: 'Chưa cấu hình ADMIN_PASSWORD trong Cloudflare Secrets.' }, 503);
  const supplied = context.request.headers.get('X-Admin-Password') || '';
  if (!(await secureEqual(supplied, context.env.ADMIN_PASSWORD))) return json({ error: 'Mật khẩu quản trị không đúng.' }, 401);
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
