import { database } from '../../../lib/cms-store.js';
import { hasSession } from '../../../lib/admin-session.js';

export async function onRequestGet(context) {
  try {
    const row = await database(context.env).prepare('SELECT cms_images.content, cms_images.content_type, cms_projects.hidden FROM cms_images JOIN cms_projects ON cms_images.project_slug = cms_projects.slug WHERE cms_images.id = ?')
      .bind(context.params.id).first();
    if (!row || (row.hidden && !(await hasSession(context)))) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(row.content), { headers: {
      'Content-Type': row.content_type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie'
    } });
  } catch { return new Response('Not found', { status: 404 }); }
}
