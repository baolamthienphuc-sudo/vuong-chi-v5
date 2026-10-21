import test from 'node:test';
import assert from 'node:assert/strict';
import * as auth from '../functions/api/admin/auth.js';
import * as manage from '../functions/api/admin/manage.js';
import * as publish from '../functions/api/admin/publish.js';
import * as password from '../functions/api/admin/password.js';
import * as media from '../functions/api/media/[id].js';
import * as projectsApi from '../functions/api/projects.js';
import { createSession } from '../lib/admin-session.js';
import { getProject, listProjects } from '../lib/cms-store.js';
import { createTestDatabase } from './d1-fixture.mjs';

const origin = 'https://vuongchi.vn';
const sample = { slug: 'nha-pho', title: 'Nhà phố', type: 'nha-pho', description: 'Mô tả', content: 'Nội dung', images: ['gallery/test.webp'], hidden: false };
const setup = (projects = [sample]) => ({ ADMIN_PASSWORD: 'test-original-password', CMS_DB: createTestDatabase(projects) });
const context = (env, endpoint, method = 'GET', body, cookie = '', extra = {}) => ({ env, params: extra.params || {}, request: new Request(origin + '/api/' + endpoint, { method, body, headers: { Origin: origin, Cookie: cookie, ...extra.headers } }) });
const session = async env => 'vc_cms_session=' + await createSession(env);
const form = fields => { const data = new FormData(); for (const [key,value] of Object.entries(fields)) data.set(key, typeof value === 'string' ? value : JSON.stringify(value)); return data; };
const login = (env, username, password) => auth.onRequestPost(context(env, 'admin/auth', 'POST', JSON.stringify({ username, password })));
const image = new Blob([Uint8Array.from([82,73,70,70])], { type: 'image/webp' });

test('username login issues an HttpOnly root cookie; unauthenticated and cross-origin writes fail', async () => {
  const env = setup();
  assert.equal((await login(env, 'wrong', env.ADMIN_PASSWORD)).status, 401);
  const response = await login(env, 'daongocvuongchi', env.ADMIN_PASSWORD);
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie.includes('Path=/;')); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/);
  assert.ok(!cookie.includes(env.ADMIN_PASSWORD));
  assert.equal((await manage.onRequestGet(context(env,'admin/manage'))).status,401);
  assert.equal((await publish.onRequestPost(context(env,'admin/publish','POST',undefined,cookie,{headers:{Origin:'https://elsewhere.example'}}))).status,403);
  assert.equal((await auth.onRequestGet(context(env,'admin/auth','GET',undefined,cookie.split(';')[0]+'x'))).status,401);
  const logout=auth.onRequestDelete(context(env,'admin/auth','DELETE',undefined,cookie));
  assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  env.CMS_DB.close();
});

test('publishing writes immediately; editing replaces data; hiding excludes public content and protects media', async () => {
  const env=setup(); const cookie=await session(env);
  const newPost={...sample,slug:'bai-moi',title:'Bài mới'};
  const input=form({project:newPost}); input.append('images',image,'cover.webp');
  const response=await publish.onRequestPost(context(env,'admin/publish','POST',input,cookie));
  assert.equal(response.status,200);
  let project=(await response.json()).project;
  assert.ok((await listProjects(env)).some(item=>item.slug==='bai-moi'));
  const id=project.images[0].split('/').at(-1);
  assert.equal((await media.onRequestGet(context(env,'media/'+id,'GET',undefined,'',{params:{id}}))).status,200);
  const edited={...project,title:'Tiêu đề đã sửa',content:'Nội dung đã sửa'};
  const update=form({action:'update',slug:project.slug,version:project.version,project:edited,imageOrder:[{kind:'existing',path:project.images[0]}]});
  assert.equal((await manage.onRequestPost(context(env,'admin/manage','POST',update,cookie))).status,200);
  project=await getProject(env,project.slug); assert.equal(project.title,edited.title);
  const hide=form({action:'visibility',slug:project.slug,version:project.version,hidden:'true'});
  assert.equal((await manage.onRequestPost(context(env,'admin/manage','POST',hide,cookie))).status,200);
  assert.ok(!(await listProjects(env)).some(item=>item.slug===project.slug));
  const publicResponse=await projectsApi.onRequestGet(context(env,'projects?format=json'));
  assert.ok(!(await publicResponse.json()).projects.some(item=>item.slug===project.slug));
  const adminResponse=await projectsApi.onRequestGet(context(env,'projects?format=json','GET',undefined,cookie));
  assert.ok((await adminResponse.json()).projects.some(item=>item.slug===project.slug));
  assert.equal((await media.onRequestGet(context(env,'media/'+id,'GET',undefined,'',{params:{id}}))).status,404);
  assert.equal((await media.onRequestGet(context(env,'media/'+id,'GET',undefined,cookie,{params:{id}}))).status,200);
  project=await getProject(env,project.slug);
  assert.equal((await manage.onRequestPost(context(env,'admin/manage','POST',form({action:'visibility',slug:project.slug,version:project.version,hidden:'false'}),cookie))).status,200);
  assert.ok((await listProjects(env)).some(item=>item.slug===project.slug));
  env.CMS_DB.close();
});

test('permanent deletion requires confirmation and removes only its own record and uploaded images', async () => {
  const env=setup(); const cookie=await session(env);
  const data=form({project:{...sample,slug:'delete-me'}}); data.append('images',image,'cover.webp');
  const created=await publish.onRequestPost(context(env,'admin/publish','POST',data,cookie));
  const project=(await created.json()).project; const id=project.images[0].split('/').at(-1);
  const deletion=confirmSlug=>manage.onRequestPost(context(env,'admin/manage','POST',form({action:'delete',slug:project.slug,version:project.version,confirmSlug}),cookie));
  assert.equal((await deletion('wrong')).status,400);
  assert.ok(await getProject(env,project.slug));
  assert.equal((await deletion(project.slug)).status,200);
  assert.equal(await getProject(env,project.slug),null);
  assert.ok(await getProject(env,sample.slug));
  assert.equal((await media.onRequestGet(context(env,'media/'+id,'GET',undefined,cookie,{params:{id}}))).status,404);
  env.CMS_DB.close();
});

test('password change checks the current password, persists a salted hash, and invalidates all previous sessions', async () => {
  const env=setup(); const cookie=await session(env); const newPassword='a-new-test-password-2026';
  const change=input=>password.onRequestPost(context(env,'admin/password','POST',JSON.stringify(input),cookie));
  const fields={currentPassword:env.ADMIN_PASSWORD,newPassword,confirmPassword:newPassword};
  assert.equal((await change({...fields,currentPassword:'wrong'})).status,400);
  assert.equal((await change({...fields,confirmPassword:'mismatch'})).status,400);
  assert.equal((await change(fields)).status,200);
  const stored=await env.CMS_DB.prepare('SELECT * FROM cms_account').first();
  assert.ok(stored.salt); assert.ok(!JSON.stringify(stored).includes(newPassword));
  assert.equal((await auth.onRequestGet(context(env,'admin/auth','GET',undefined,cookie))).status,401);
  assert.equal((await login(env,'daongocvuongchi',env.ADMIN_PASSWORD)).status,401);
  assert.equal((await login(env,'daongocvuongchi',newPassword)).status,200);
  env.CMS_DB.close();
});

test('stale edits are rejected, duplicate slugs roll back, and invalid images cannot be uploaded', async () => {
  const env=setup(); const cookie=await session(env); const project=await getProject(env,sample.slug);
  const stale=form({action:'visibility',slug:project.slug,version:'stale',hidden:'true'});
  assert.equal((await manage.onRequestPost(context(env,'admin/manage','POST',stale,cookie))).status,409);
  assert.equal((await getProject(env,project.slug)).hidden,false);
  const duplicate=form({project:sample}); duplicate.append('images',image,'cover.webp');
  assert.equal((await publish.onRequestPost(context(env,'admin/publish','POST',duplicate,cookie))).status,409);
  const invalid=form({project:{...sample,slug:'invalid'}}); invalid.append('images',new Blob(['bad'],{type:'text/html'}),'file.html');
  assert.equal((await publish.onRequestPost(context(env,'admin/publish','POST',invalid,cookie))).status,400);
  assert.equal(await getProject(env,'invalid'),null);
  env.CMS_DB.close();
});

test('login attempts are limited and initialization never resurrects deleted seed content', async () => {
  const env=setup();
  for(let i=0;i<10;i++) assert.equal((await login(env,'daongocvuongchi','wrong')).status,401);
  assert.equal((await login(env,'daongocvuongchi','wrong')).status,429);
  env.CMS_DB.close();
  const seeded=setup(null); const projects=await listProjects(seeded,true); assert.equal(projects.length,16);
  const first=projects[0]; const cookie=await session(seeded);
  await manage.onRequestPost(context(seeded,'admin/manage','POST',form({action:'delete',slug:first.slug,version:first.version,confirmSlug:first.slug}),cookie));
  assert.equal((await listProjects(seeded,true)).length,15);
  assert.equal((await listProjects(seeded,true)).length,15);
  seeded.CMS_DB.close();
});

test('existing signed admin sessions upgrade once and stop working after password change', async () => {
  const env = setup();
  const encoder = new TextEncoder();
  const payload = Buffer.from(JSON.stringify({ username: 'daongocvuongchi', expires: Math.floor(Date.now() / 1000) + 3600, nonce: 'legacy' })).toString('base64url');
  const key = await crypto.subtle.importKey('raw', encoder.encode('vuongchi-admin-v1:' + env.ADMIN_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))).toString('base64url');
  const legacy = 'vc_admin_session=' + payload + '.' + signature;
  const upgrade = await auth.onRequestGet(context(env, 'admin/auth', 'GET', undefined, legacy));
  assert.equal(upgrade.status, 200);
  assert.ok(upgrade.headers.getSetCookie().some(value => value.startsWith('vc_admin_session=;') && value.includes('Max-Age=0')));
  const cookie = upgrade.headers.get('set-cookie').split(';')[0];
  assert.ok(cookie.startsWith('vc_cms_session='));
  const newPassword = 'test-after-migration-password';
  const changed = await password.onRequestPost(context(env, 'admin/password', 'POST', JSON.stringify({ currentPassword: env.ADMIN_PASSWORD, newPassword, confirmPassword: newPassword }), cookie));
  assert.equal(changed.status, 200);
  assert.equal((await auth.onRequestGet(context(env, 'admin/auth', 'GET', undefined, legacy))).status, 401);
  assert.equal((await auth.onRequestGet(context(env, 'admin/auth', 'GET', undefined, cookie))).status, 401);
  env.CMS_DB.close();
});
