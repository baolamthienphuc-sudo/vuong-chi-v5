import { database } from './cms-store.js';
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
export const getAccount = env => database(env).prepare('SELECT password_hash, salt, version FROM cms_account WHERE id = 1').first();
export const accountVersion = async env => (await getAccount(env))?.version || 'bootstrap';

const derivePassword = async (password, salt) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256));
};

export async function verifyPassword(env, password, equal) {
  const account = await getAccount(env);
  return account ? equal(await derivePassword(password, account.salt), account.password_hash) : equal(password, env.ADMIN_PASSWORD);
}

export async function updatePassword(env, password, oldVersion) {
  const salt = crypto.randomUUID();
  const version = crypto.randomUUID();
  const hash = await derivePassword(password, salt);
  const result = await database(env).prepare('INSERT INTO cms_account (id, password_hash, salt, version) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, version = excluded.version WHERE cms_account.version = ?')
    .bind(hash, salt, version, oldVersion).run();
  if (!result.meta.changes) throw Object.assign(new Error('Mật khẩu vừa thay đổi ở phiên khác. Vui lòng đăng nhập lại.'), { status: 409 });
}

export async function takeLoginAttempt(context) {
  const db = database(context.env);
  const key = hex(await crypto.subtle.digest('SHA-256', encoder.encode(context.request.headers.get('CF-Connecting-IP') || 'local')));
  const now = Date.now();
  const result = await db.prepare('INSERT INTO cms_login_attempts (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at < ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END RETURNING attempts')
    .bind(key, now + 15 * 60 * 1000, now, now).first();
  if (result.attempts > 10) throw Object.assign(new Error('Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.'), { status: 429 });
  return () => db.prepare('DELETE FROM cms_login_attempts WHERE key = ? OR reset_at < ?').bind(key, now).run();
}
