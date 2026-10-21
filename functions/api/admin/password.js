import { json, requireAdmin, secureEqual, sessionCookie } from '../../../lib/admin-session.js';
import { accountVersion, verifyPassword, updatePassword, takeLoginAttempt } from '../../../lib/admin-account.js';

export async function onRequestPost(context) {
  try {
    const denied = await requireAdmin(context);
    if (denied) return denied;
    const input = await context.request.json().catch(() => null);
    if (!input || typeof input.currentPassword !== 'string' || typeof input.newPassword !== 'string'
      || input.currentPassword.length > 1024 || input.newPassword.length < 12 || input.newPassword.length > 128) {
      return json({ error: 'Mật khẩu mới cần từ 12 đến 128 ký tự.' }, 400);
    }
    if (input.newPassword !== input.confirmPassword) return json({ error: 'Hai lần nhập mật khẩu mới chưa khớp.' }, 400);
    if (input.currentPassword === input.newPassword) return json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' }, 400);
    const clearAttempts = await takeLoginAttempt(context);
    const version = await accountVersion(context.env);
    if (!(await verifyPassword(context.env, input.currentPassword, secureEqual))) return json({ error: 'Mật khẩu hiện tại không đúng.' }, 400);
    await updatePassword(context.env, input.newPassword, version);
    await clearAttempts();
    return json({ ok: true, message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.' }, 200, {
      'set-cookie': sessionCookie(context.request, '', 0)
    });
  } catch (error) {
    return json({ error: error.status ? error.message : 'Không thể đổi mật khẩu. Vui lòng thử lại.' }, error.status || 500);
  }
}

export const onRequest = () => json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
