import test from 'node:test';
import assert from 'node:assert/strict';
import * as auth from '../functions/api/admin/auth.js';
import * as manage from '../functions/api/admin/manage.js';
import * as publish from '../functions/api/admin/publish.js';
import { createSession, hasSession } from '../lib/admin-session.js';
import { createGithubFixture } from './github-fixture.mjs';

const origin = 'https://vuongchi.vn';
const env = { ADMIN_PASSWORD: 'local-test-password-only', GITHUB_TOKEN: 'mock-token' };
const sample = {
  slug: 'nha-pho-bao-loc', title: 'Nhà phố Bảo Lộc', type: 'nha-pho',
  description: 'Thi công nhà phố', content: 'Nội dung công trình.\nĐoạn thứ hai.',
  images: ['gallery-01-villa-hien-dai-2-tang/test.webp'], hidden: false
};
const cookie = async () => `vc_admin_session=${await createSession(env)}`;
const context = (path, { method = 'GET', body, headers = {}, bindings = env } = {}) => ({
  env: bindings,
  request: new Request(`${origin}/api/admin/${path}`, {
    method, body,
    headers: { Origin: origin, ...headers }
  })
});
const form = values => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  return data;
};
const image = new Blob([Uint8Array.from([0x52, 0x49, 0x46, 0x46])], { type: 'image/webp' });

test('login requires the configured username and password, creates secure cookie, and logout clears it', async () => {
  const login = input => auth.onRequestPost(context('auth', {
    method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' }
  }));
  assert.equal((await login({ username: 'wrong', password: env.ADMIN_PASSWORD })).status, 401);
  assert.equal((await login({ username: 'daongocvuongchi', password: 'wrong' })).status, 401);
  assert.equal((await login(null)).status, 400);
  const response = await login({ username: 'daongocvuongchi', password: env.ADMIN_PASSWORD });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).username, 'daongocvuongchi');
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);
  assert.ok(!setCookie.includes(env.ADMIN_PASSWORD));
  assert.equal((await auth.onRequestGet(context('auth', { headers: { Cookie: setCookie.split(';')[0] } }))).status, 200);
  const logout = auth.onRequestDelete(context('auth', { method: 'DELETE' }));
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('tampered, expired, malformed, and password-rotated sessions are rejected', async () => {
  const token = await cookie();
  assert.equal(await hasSession(context('auth', { headers: { Cookie: `${token}x` } })), false);
  assert.equal(await hasSession(context('auth', { headers: { Cookie: 'vc_admin_session=broken' } })), false);
  assert.equal(await hasSession(context('auth', { headers: { Cookie: token }, bindings: { ...env, ADMIN_PASSWORD: 'changed' } })), false);
  const now = Date.now;
  let expired;
  try {
    Date.now = () => now() - 9 * 60 * 60 * 1000;
    expired = await cookie();
  } finally { Date.now = now; }
  assert.equal(await hasSession(context('auth', { headers: { Cookie: expired } })), false);
});

test('unauthenticated, legacy password-only, and cross-origin mutations cannot access content', async () => {
  for (const handler of [manage.onRequestPost, publish.onRequestPost]) {
    assert.equal((await handler(context('manage', { method: 'POST' }))).status, 401);
    assert.equal((await handler(context('manage', { method: 'POST', headers: { 'X-Admin-Password': env.ADMIN_PASSWORD } }))).status, 401);
    assert.equal((await handler(context('manage', { method: 'POST', headers: { Cookie: await cookie(), Origin: 'https://other.example' } }))).status, 403);
  }
  assert.equal((await manage.onRequestGet(context('manage'))).status, 401);
  assert.equal((await auth.onRequestPost(context('auth', { method: 'POST', headers: { Origin: 'https://other.example' } }))).status, 403);
});

test('publish, edit, hide, show, and permanent delete preserve unrelated projects and use atomic commits', async t => {
  const other = { ...sample, slug: 'another-project', title: 'Bài khác' };
  const fixture = createGithubFixture([sample, other]);
  t.mock.method(globalThis, 'fetch', fixture.fetch);
  const headers = { Cookie: await cookie() };
  const list = await manage.onRequestGet(context('manage', { headers }));
  assert.equal((await list.json()).projects.length, 2);

  const created = { ...sample, slug: 'cong-trinh-moi', title: 'Công trình mới', hidden: true };
  const data = form({ project: created });
  data.append('images', image, 'cover.webp');
  const published = await publish.onRequestPost(context('publish', { method: 'POST', body: data, headers }));
  assert.equal(published.status, 200);
  assert.equal(fixture.projects()[0].hidden, true);
  assert.match(fixture.projects()[0].images[0], /^uploads\/projects\/cong-trinh-moi\//);

  const edited = { ...sample, title: 'Nhà phố đã chỉnh sửa', content: 'Nội dung mới' };
  const updated = await manage.onRequestPost(context('manage', {
    method: 'POST', headers,
    body: form({ action: 'update', slug: sample.slug, project: edited, imageOrder: [{ kind: 'existing', path: sample.images[0] }] })
  }));
  assert.equal(updated.status, 200);
  assert.equal(fixture.projects().find(item => item.slug === sample.slug).title, edited.title);

  for (const hidden of ['true', 'false']) {
    const response = await manage.onRequestPost(context('manage', {
      method: 'POST', headers, body: form({ action: 'visibility', slug: sample.slug, hidden })
    }));
    assert.equal(response.status, 200);
    assert.equal(fixture.projects().find(item => item.slug === sample.slug).hidden, hidden === 'true');
  }

  const beforeDelete = fixture.calls.filter(call => call.method === 'PATCH').length;
  const rejected = await manage.onRequestPost(context('manage', {
    method: 'POST', headers, body: form({ action: 'delete', slug: sample.slug, confirmSlug: 'wrong' })
  }));
  assert.equal(rejected.status, 400);
  assert.equal(fixture.calls.filter(call => call.method === 'PATCH').length, beforeDelete);
  const deleted = await manage.onRequestPost(context('manage', {
    method: 'POST', headers, body: form({ action: 'delete', slug: sample.slug, confirmSlug: sample.slug })
  }));
  assert.equal(deleted.status, 200);
  assert.ok(!fixture.projects().some(item => item.slug === sample.slug));
  assert.deepEqual(fixture.projects().find(item => item.slug === other.slug), other);
  assert.equal(fixture.projects().length, 2);
});

test('duplicate slugs, invalid images, and conflicting commits do not overwrite live content', async t => {
  const fixture = createGithubFixture([sample]);
  t.mock.method(globalThis, 'fetch', fixture.fetch);
  const headers = { Cookie: await cookie() };
  const duplicate = form({ project: sample });
  duplicate.append('images', image, 'cover.webp');
  assert.equal((await publish.onRequestPost(context('publish', { method: 'POST', headers, body: duplicate }))).status, 409);
  const invalid = form({ action: 'update', slug: sample.slug, project: sample, imageOrder: [{ kind: 'existing', path: 'not-owned.webp' }] });
  assert.equal((await manage.onRequestPost(context('manage', { method: 'POST', headers, body: invalid }))).status, 400);
  fixture.setConflict(true);
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await manage.onRequestPost(context('manage', {
      method: 'POST', headers, body: form({ action: 'delete', slug: sample.slug, confirmSlug: sample.slug })
    }));
    assert.equal(response.status, 409);
    assert.deepEqual(fixture.projects(), [sample]);
  } finally { console.error = originalError; }
});
