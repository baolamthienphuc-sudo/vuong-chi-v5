import { hasSession, json } from '../../lib/admin-session.js';
import { listProjects } from '../../lib/cms-store.js';

export async function onRequestGet(context) {
  try {
    const admin = await hasSession(context);
    const projects = await listProjects(context.env, admin);
    if (new URL(context.request.url).searchParams.get('format') === 'json') return json({ ok: true, projects, admin }, 200, { Vary: 'Cookie' });
    return new Response(`window.VC_IS_ADMIN = ${admin}; window.VC_PROJECTS = ${JSON.stringify(projects).replace(/</g, '\\u003c')};`, {
      headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch {
    return new Response('window.VC_PROJECTS = []; window.VC_PROJECTS_ERROR = true;', {
      headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
}
