import { json, requireAdmin } from '../../../lib/admin-session.js';
import { saveProject } from '../../../lib/cms-store.js';
import { parseProject, readImages, badRequest } from '../../../lib/project-input.js';

export async function onRequestPost(context) {
  try {
    const denied = await requireAdmin(context);
    if (denied) return denied;
    const form = await context.request.formData();
    const project = parseProject(form.get('project'));
    const images = readImages(form);
    if (!images.length) throw badRequest('Bạn cần chọn ít nhất một ảnh.');
    project.images = images.map(image => '/api/media/' + image.id);
    project.publishedAt = project.updatedAt = new Date().toISOString();
    const saved = await saveProject(context.env, project, images);
    return json({ ok: true, project: saved, slug: saved.slug });
  } catch (error) { return json({ error: error.status ? error.message : 'Không thể đăng bài. Vui lòng thử lại.' }, error.status || 500); }
}

export const onRequest = () => json({ error: 'Method not allowed' }, 405);
