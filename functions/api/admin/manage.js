const API_VERSION = '2026-03-10';
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['nha-pho','nha-cap-4','biet-thu','nha-vuon','nha-chau-au','nha-be-tong','nha-lap-ghep']);
const CATEGORY_NAMES = {
  'nha-pho': 'Nhà phố',
  'nha-cap-4': 'Nhà cấp 4',
  'biet-thu': 'Biệt thự',
  'nha-vuon': 'Nhà vườn',
  'nha-chau-au': 'Nhà châu Âu',
  'nha-be-tong': 'Nhà bê tông đúc sẵn',
  'nha-lap-ghep': 'Nhà lắp ghép'
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

const secureEqual = async (a, b) => {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(a || ''))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(b || '')))
  ]);
  const aa = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
};

const cleanText = (value, max = 500) => String(value || '').trim().replace(/\u0000/g, '').slice(0, max);
const cleanSlug = value => cleanText(value, 100).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const bytesToBase64 = bytes => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
};

const decodeGithubText = value => {
  const binary = atob(String(value || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

const parseProjectsFile = text => {
  const match = text.match(/^\s*window\.VC_PROJECTS\s*=\s*([\s\S]*?)\s*;?\s*$/);
  if (!match) throw new Error('Không đọc được assets/projects-data.js.');
  const projects = JSON.parse(match[1]);
  if (!Array.isArray(projects)) throw new Error('Dữ liệu công trình không hợp lệ.');
  return projects;
};

const imageExtension = type => type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';

const readGithubState = async (gh, branch) => {
  const [ref, currentFile] = await Promise.all([
    gh(`/git/ref/heads/${encodeURIComponent(branch)}`),
    gh(`/contents/assets/projects-data.js?ref=${encodeURIComponent(branch)}`)
  ]);
  const headSha = ref?.object?.sha;
  if (!headSha) throw new Error('Không đọc được commit hiện tại của GitHub.');
  const currentCommit = await gh(`/git/commits/${headSha}`);
  const baseTree = currentCommit?.tree?.sha;
  if (!baseTree) throw new Error('Không đọc được Git tree hiện tại.');
  const projects = parseProjectsFile(decodeGithubText(currentFile.content));
  return { headSha, baseTree, projects };
};

const commitProjects = async ({ gh, branch, headSha, baseTree, projects, treeEntries = [], message }) => {
  const projectsFile = `window.VC_PROJECTS = ${JSON.stringify(projects, null, 2)};\n`;
  const tree = await gh('/git/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTree,
      tree: [
        { path: 'assets/projects-data.js', mode: '100644', type: 'blob', content: projectsFile },
        ...treeEntries
      ]
    })
  });
  const commit = await gh('/git/commits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] })
  });
  await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
  return commit;
};

export async function onRequestPost(context) {
  try {
    if (!context.env.ADMIN_PASSWORD) return json({ error: 'Chưa cấu hình ADMIN_PASSWORD trong Cloudflare Secrets.' }, 503);
    if (!context.env.GITHUB_TOKEN) return json({ error: 'Chưa cấu hình GITHUB_TOKEN trong Cloudflare Secrets.' }, 503);
    const suppliedPassword = context.request.headers.get('X-Admin-Password') || '';
    if (!(await secureEqual(suppliedPassword, context.env.ADMIN_PASSWORD))) return json({ error: 'Mật khẩu quản trị không đúng.' }, 401);

    const form = await context.request.formData();
    const action = cleanText(form.get('action'), 30);
    const slug = cleanSlug(form.get('slug'));
    if (!slug) return json({ error: 'Thiếu đường dẫn công trình cần xử lý.' }, 400);

    const owner = context.env.GITHUB_OWNER || 'baolamthienphuc-sudo';
    const repo = context.env.GITHUB_REPO || 'vuong-chi-v5';
    const branch = context.env.GITHUB_BRANCH || 'main';
    const token = context.env.GITHUB_TOKEN;
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    const gh = async (path, init = {}) => {
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'vuong-chi-admin',
          ...(init.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.message ? `GitHub: ${data.message}` : `GitHub HTTP ${response.status}`;
        throw new Error(detail);
      }
      return data;
    };

    const state = await readGithubState(gh, branch);
    const projectIndex = state.projects.findIndex(project => project.slug === slug);
    if (projectIndex < 0) return json({ error: `Không tìm thấy công trình “${slug}” trong dữ liệu GitHub.` }, 404);
    const current = state.projects[projectIndex];

    if (action === 'visibility') {
      const hidden = String(form.get('hidden')).toLowerCase() === 'true';
      const updated = { ...current, hidden, updatedAt: new Date().toISOString() };
      state.projects[projectIndex] = updated;
      const commit = await commitProjects({
        gh,
        branch,
        headSha: state.headSha,
        baseTree: state.baseTree,
        projects: state.projects,
        message: `${hidden ? 'Ẩn' : 'Hiện'} công trình: ${current.title || slug}`
      });
      return json({
        ok: true,
        project: updated,
        commit: commit.sha,
        message: hidden ? 'Đã ẩn công trình khỏi website.' : 'Đã đưa công trình trở lại website.'
      });
    }

    if (action !== 'update') return json({ error: 'Thao tác quản trị không hợp lệ.' }, 400);

    const rawProject = form.get('project');
    if (typeof rawProject !== 'string') return json({ error: 'Thiếu dữ liệu công trình.' }, 400);
    let input;
    try { input = JSON.parse(rawProject); } catch { return json({ error: 'Dữ liệu công trình không hợp lệ.' }, 400); }

    const requestedSlug = cleanSlug(input.slug || slug);
    if (requestedSlug !== slug) return json({ error: 'Không thể đổi đường dẫn khi chỉnh sửa. Hãy giữ nguyên slug để bảo toàn link cũ.' }, 400);
    const title = cleanText(input.title, 120);
    const type = cleanText(input.type, 40);
    const description = cleanText(input.description, 180);
    const content = cleanText(input.content, 5000);
    if (!title || !description || !content) return json({ error: 'Tên, mô tả ngắn và nội dung chi tiết là bắt buộc.' }, 400);
    if (!ALLOWED_TYPES.has(type)) return json({ error: 'Loại công trình không hợp lệ.' }, 400);

    let order;
    try { order = JSON.parse(String(form.get('imageOrder') || '[]')); } catch { return json({ error: 'Thứ tự hình ảnh không hợp lệ.' }, 400); }
    if (!Array.isArray(order) || !order.length) return json({ error: 'Công trình cần có ít nhất 1 hình ảnh.' }, 400);
    if (order.length > MAX_IMAGES) return json({ error: `Tối đa ${MAX_IMAGES} hình ảnh cho một công trình.` }, 400);

    const files = form.getAll('images').filter(file => file && typeof file.arrayBuffer === 'function');
    let totalBytes = 0;
    for (const file of files) {
      if (!['image/webp','image/jpeg','image/png'].includes(file.type)) return json({ error: `Định dạng ảnh không hỗ trợ: ${file.type || 'không xác định'}.` }, 400);
      if (file.size > MAX_IMAGE_BYTES) return json({ error: `Ảnh ${file.name || ''} vượt quá 8 MB.` }, 400);
      totalBytes += file.size;
    }
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) return json({ error: 'Tổng dung lượng ảnh mới vượt quá 50 MB.' }, 400);

    const allowedExisting = new Set(Array.isArray(current.images) ? current.images : []);
    const newRefs = order.filter(item => item?.kind === 'new');
    if (newRefs.some(item => !Number.isInteger(item.index) || item.index < 0 || item.index >= files.length)) {
      return json({ error: 'Thứ tự ảnh mới không khớp với dữ liệu tải lên.' }, 400);
    }
    if (order.some(item => item?.kind === 'existing' && !allowedExisting.has(String(item.path || '')))) {
      return json({ error: 'Danh sách ảnh cũ chứa đường dẫn không hợp lệ.' }, 400);
    }

    const imageEntries = [];
    const newPaths = [];
    const stamp = Date.now().toString(36);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = await gh('/git/blobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: bytesToBase64(bytes), encoding: 'base64' })
      });
      const extension = imageExtension(file.type);
      const path = `uploads/projects/${slug}/edit-${stamp}-${String(index + 1).padStart(2, '0')}.${extension}`;
      newPaths.push(path);
      imageEntries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const images = order.map(item => {
      if (item?.kind === 'existing') return String(item.path);
      if (item?.kind === 'new') return newPaths[item.index];
      return '';
    }).filter(Boolean);
    if (!images.length) return json({ error: 'Công trình cần có ít nhất 1 hình ảnh.' }, 400);

    const hidden = input.hidden === true || input.visibility === 'hidden';
    const updated = {
      ...current,
      slug,
      title,
      type,
      category: CATEGORY_NAMES[type] || 'Công trình',
      location: cleanText(input.location, 100) || 'Đang cập nhật',
      floors: cleanText(input.floors, 50) || 'Đang cập nhật',
      area: cleanText(input.area, 80) || 'Đang cập nhật',
      buildArea: cleanText(input.buildArea, 80) || 'Đang cập nhật',
      cost: cleanText(input.cost, 100) || 'Đang cập nhật',
      description,
      content,
      images,
      hidden,
      updatedAt: new Date().toISOString()
    };
    state.projects[projectIndex] = updated;

    const commit = await commitProjects({
      gh,
      branch,
      headSha: state.headSha,
      baseTree: state.baseTree,
      projects: state.projects,
      treeEntries: imageEntries,
      message: `Cập nhật công trình: ${title}`
    });

    return json({
      ok: true,
      project: updated,
      commit: commit.sha,
      path: `cong-trinh?project=${slug}`,
      message: hidden
        ? 'Đã cập nhật bài ở trạng thái ẩn / bản nháp.'
        : 'Đã cập nhật bài. Cloudflare sẽ tự triển khai commit mới.'
    });
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || 'Lỗi máy chủ khi cập nhật công trình.' }, 500);
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
