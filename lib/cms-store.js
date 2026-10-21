import { seedProjects } from './seed-projects.js';

export const database = env => {
  if (!env.CMS_DB) throw Object.assign(new Error('Chưa kết nối kho dữ liệu quản trị. Vui lòng kiểm tra cấu hình Cloudflare.'), { status: 503 });
  return env.CMS_DB;
};

export async function seedDatabase(env) {
  const db = database(env);
  if (await db.prepare("SELECT value FROM cms_meta WHERE key = 'seeded'").first()) return;
  const statements = seedProjects.map((project, index) => db.prepare(
    "INSERT OR IGNORE INTO cms_projects (slug, data, hidden, position, version) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM cms_meta WHERE key = 'seeded')"
  ).bind(project.slug, JSON.stringify(project), project.hidden === true ? 1 : 0, seedProjects.length - index, 'seed-' + project.slug));
  statements.push(db.prepare("INSERT OR IGNORE INTO cms_meta (key, value) VALUES ('seeded', '1')"));
  await db.batch(statements);
}

export async function listProjects(env, includeHidden = false) {
  await seedDatabase(env);
  const { results } = await database(env).prepare(
    `SELECT data, version FROM cms_projects ${includeHidden ? '' : 'WHERE hidden = 0'} ORDER BY position DESC, slug`
  ).all();
  return results.map(row => ({ ...JSON.parse(row.data), ...(includeHidden ? { version: row.version } : {}) }));
}

export async function getProject(env, slug) {
  await seedDatabase(env);
  const row = await database(env).prepare('SELECT data, version FROM cms_projects WHERE slug = ?').bind(slug).first();
  return row ? { ...JSON.parse(row.data), version: row.version } : null;
}

export async function saveProject(env, project, files, expectedVersion = null) {
  const db = database(env);
  await seedDatabase(env);
  const version = crypto.randomUUID();
  const { version: ignored, ...data } = project;
  const write = expectedVersion === null
    ? db.prepare('INSERT INTO cms_projects (slug, data, hidden, position, version) VALUES (?, ?, ?, ?, ?)')
      .bind(project.slug, JSON.stringify(data), project.hidden ? 1 : 0, Date.now(), version)
    : db.prepare('UPDATE cms_projects SET data = ?, hidden = ?, version = ? WHERE slug = ? AND version = ?')
      .bind(JSON.stringify(data), project.hidden ? 1 : 0, version, project.slug, expectedVersion);
  const statements = [write];
  for (const file of files) {
    statements.push(db.prepare('INSERT INTO cms_images (id, project_slug, content_type, content) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM cms_projects WHERE slug = ? AND version = ?)')
      .bind(file.id, project.slug, file.type, await file.file.arrayBuffer(), project.slug, version));
  }
  const ids = project.images.filter(path => path.startsWith('/api/media/')).map(path => path.slice('/api/media/'.length));
  statements.push(db.prepare(`DELETE FROM cms_images WHERE project_slug = ? ${ids.length ? `AND id NOT IN (${ids.map(() => '?').join(',')})` : ''} AND EXISTS (SELECT 1 FROM cms_projects WHERE slug = ? AND version = ?)`)
    .bind(project.slug, ...ids, project.slug, version));
  let results;
  try { results = await db.batch(statements); } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) throw Object.assign(new Error('Đường dẫn bài đã tồn tại. Hãy chọn đường dẫn khác.'), { status: 409 });
    throw error;
  }
  if (!results[0].meta.changes) throw Object.assign(new Error('Bài vừa thay đổi ở phiên khác. Vui lòng tải lại bài trước khi lưu.'), { status: 409 });
  return { ...data, version };
}

export async function deleteProject(env, slug, version) {
  const result = await database(env).prepare('DELETE FROM cms_projects WHERE slug = ? AND version = ?').bind(slug, version).run();
  if (!result.meta.changes) throw Object.assign(new Error('Bài vừa thay đổi hoặc đã bị xóa. Vui lòng tải lại danh sách.'), { status: 409 });
}
