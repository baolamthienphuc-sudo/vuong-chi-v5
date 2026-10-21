import { ADMIN_USERNAME, json, sameOrigin, secureEqual, createSession, sessionCookie, requireAdmin } from '../../../lib/admin-session.js';
import { verifyPassword, takeLoginAttempt } from '../../../lib/admin-account.js';

export async function onRequestPost(context) {
  try {
  if (!sameOrigin(context.request)) return json({ error: 'Yêu cầu đăng nhập không hợp lệ.' }, 403);
  if (!context.env.ADMIN_PASSWORD) return json({ error: 'Chưa cấu hình mật khẩu quản trị trên Cloudflare.' }, 503);
  let input;
  try { input = await context.request.json(); } catch { return json({ error: 'Thông tin đăng nhập không hợp lệ.' }, 400); }
  if (!input || typeof input.username !== 'string' || typeof input.password !== 'string'
    || input.username.length > 100 || input.password.length > 1024) {
    return json({ error: 'Thông tin đăng nhập không hợp lệ.' }, 400);
  }
  const clearAttempts = await takeLoginAttempt(context);
  const [usernameValid, passwordValid] = await Promise.all([
    secureEqual(input.username.trim(), ADMIN_USERNAME),
    verifyPassword(context.env, input.password, secureEqual)
  ]);
  if (!usernameValid || !passwordValid) return json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, 401);
  await clearAttempts();
  return json({ ok: true, username: ADMIN_USERNAME }, 200, {
    'set-cookie': sessionCookie(context.request, await createSession(context.env))
  });
  } catch (error) {
    return json({ error: error.status ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.' }, error.status || 500);
  }
}

export async function onRequestGet(context) {
  const denied = await requireAdmin(context);
  return denied || json({ ok: true, username: ADMIN_USERNAME });
}

export function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: 'Yêu cầu đăng xuất không hợp lệ.' }, 403);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(context.request, '', 0) });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, DELETE' });
}
