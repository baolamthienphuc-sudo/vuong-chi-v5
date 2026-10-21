import { json, requireAdmin } from '../../../lib/admin-session.js';
import { listProjects, getProject, saveProject, deleteProject } from '../../../lib/cms-store.js';
import { cleanSlug, parseProject, readImages, badRequest } from '../../../lib/project-input.js';

export async function onRequestGet(context) {
  try {
    const denied = await requireAdmin(context);
    return denied || json({ ok: true, projects: await listProjects(context.env, true) });
  } catch (error) { return json({ error: error.status ? error.message : 'Không thể tải danh sách bài.' }, error.status || 500); }
}

export async function onRequestPost(context) {
  try {
    const denied = await requireAdmin(context);
    if (denied) return denied;
    const form = await context.request.formData();
    const slug = cleanSlug(form.get('slug'));
    const current = await getProject(context.env, slug);
    if (!current) return json({ error: 'Bài không còn tồn tại.' }, 404);
    const version = form.get('version');
    if (version !== current.version) return json({ error: 'Bài đã thay đổi. Vui lòng tải lại trước khi thao tác.' }, 409);
    const action = form.get('action');
    if (action === 'delete') {
      if (form.get('confirmSlug') !== slug) throw badRequest('Nhập chính xác đường dẫn bài để xác nhận xóa.');
      await deleteProject(context.env, slug, version);
      return json({ ok: true, slug });
    }
    let project;
    let images = [];
    if (action === 'visibility') {
      if (!['true', 'false'].includes(form.get('hidden'))) throw badRequest('Trạng thái bài không hợp lệ.');
      project = { ...current, hidden: form.get('hidden') === 'true' };
    } else if (action === 'update') {
      const input = parseProject(form.get('project'));
      if (input.slug !== slug) throw badRequest('Không thể đổi đường dẫn của bài đã đăng.');
      images = readImages(form);
      let order;
      try { order = JSON.parse(form.get('imageOrder')); } catch { throw badRequest('Thứ tự ảnh không hợp lệ.'); }
      if (!Array.isArray(order) || !order.length || order.length > 20) throw badRequest('Bài cần từ 1 đến 20 ảnh.');
      const paths = order.map(item => {
        if (item?.kind === 'existing' && current.images.includes(item.path)) return item.path;
        if (item?.kind === 'new' && Number.isInteger(item.index) && images[item.index]) return '/api/media/' + images[item.index].id;
        throw badRequest('Danh sách ảnh không hợp lệ.');
      });
      images = images.filter(image => paths.includes('/api/media/' + image.id));
      project = { ...current, ...input, images: paths };
    } else { throw badRequest('Thao tác không hợp lệ.'); }
    project.updatedAt = new Date().toISOString();
    const saved = await saveProject(context.env, project, images, version);
    return json({ ok: true, project: saved });
  } catch (error) { return json({ error: error.status ? error.message : 'Không thể lưu bài. Vui lòng thử lại.' }, error.status || 500); }
}

export const onRequest = () => json({ error: 'Method not allowed' }, 405);
