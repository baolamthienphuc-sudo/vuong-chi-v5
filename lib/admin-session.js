import { accountVersion } from './admin-account.js';
export const ADMIN_USERNAME = 'daongocvuongchi';
const COOKIE_NAME = 'vc_cms_session';
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  }
});

export const sameOrigin = request => request.headers.get('Origin') === new URL(request.url).origin
  && request.headers.get('Sec-Fetch-Site') !== 'cross-site';

export const secureEqual = async (a, b) => {
  const hashes = await Promise.all([a, b].map(value => crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')))));
  const [left, right] = hashes.map(hash => new Uint8Array(hash));
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
};

const signingKey = env => crypto.subtle.importKey('raw', encoder.encode(`vuongchi-admin-v1:${env.ADMIN_PASSWORD}`),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));

export const sessionCookie = (request, value, maxAge = SESSION_SECONDS) =>
  `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;

export const createSession = async env => {
  const payload = encode(encoder.encode(JSON.stringify({
    username: ADMIN_USERNAME,
    version: await accountVersion(env),
    expires: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: crypto.randomUUID()
  })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
};

export const hasSession = async ({ request, env }) => {
  if (!env.ADMIN_PASSWORD) return false;
  try {
    const token = (request.headers.get('Cookie') || '').split(';').map(part => part.trim())
      .find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (!token || token.length > 2048) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (!(await crypto.subtle.verify('HMAC', await signingKey(env), decode(signature), encoder.encode(payload)))) return false;
    const session = JSON.parse(new TextDecoder().decode(decode(payload)));
    const now = Math.floor(Date.now() / 1000);
    return session.username === ADMIN_USERNAME && Number.isInteger(session.expires)
      && session.expires > now && session.expires <= now + SESSION_SECONDS
      && session.version === await accountVersion(env);
  } catch {
    return false;
  }
};

export const requireAdmin = async context => {
  if (!context.env.ADMIN_PASSWORD) return json({ error: 'Chưa cấu hình mật khẩu quản trị trên Cloudflare.' }, 503);
  if (!context.env.CMS_DB) return json({ error: 'Chưa kết nối kho dữ liệu quản trị trên Cloudflare.' }, 503);
  if (!['GET', 'HEAD'].includes(context.request.method) && !sameOrigin(context.request)) {
    return json({ error: 'Yêu cầu phải được gửi từ website quản trị.' }, 403);
  }
  if (!(await hasSession(context))) return json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }, 401);
  return null;
};
