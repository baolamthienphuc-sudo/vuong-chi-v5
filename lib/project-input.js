const TYPES = { 'nha-pho': 'Nhà phố', 'nha-cap-4': 'Nhà cấp 4', 'biet-thu': 'Biệt thự', 'nha-vuon': 'Nhà vườn', 'nha-chau-au': 'Nhà châu Âu', 'nha-be-tong': 'Nhà bê tông đúc sẵn', 'nha-lap-ghep': 'Nhà lắp ghép' };
export const badRequest = message => Object.assign(new Error(message), { status: 400 });
const clean = (value, max) => String(value || '').trim().replace(/\u0000/g, '').slice(0, max);
export const cleanSlug = value => clean(value, 100).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
export const parseProject = value => {
  let input;
  try { input = JSON.parse(value); } catch { throw badRequest('Nội dung bài không hợp lệ.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Nội dung bài không hợp lệ.');
  const project = { slug: cleanSlug(input.slug), title: clean(input.title, 120), type: clean(input.type, 40), description: clean(input.description, 180), content: clean(input.content, 5000), hidden: input.hidden === true || input.visibility === 'hidden' };
  if (!project.slug || !project.title || !project.description || !project.content) throw badRequest('Tên, đường dẫn, mô tả và nội dung là bắt buộc.');
  if (!TYPES[project.type]) throw badRequest('Loại công trình không hợp lệ.');
  project.category = TYPES[project.type];
  for (const key of ['location', 'floors', 'area', 'buildArea', 'cost']) project[key] = clean(input[key], 100) || 'Đang cập nhật';
  return project;
};
export const readImages = form => {
  const files = form.getAll('images').filter(file => typeof file?.arrayBuffer === 'function');
  if (files.length > 20) throw badRequest('Tối đa 20 ảnh cho một bài.');
  if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) throw badRequest('Tổng dung lượng ảnh sau tối ưu không được vượt quá 20 MB.');
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw badRequest('Chỉ hỗ trợ ảnh JPG, PNG và WebP.');
    if (!file.size || file.size > 1500000) throw badRequest('Mỗi ảnh sau tối ưu phải nhỏ hơn 1,5 MB.');
  }
  return files.map(file => ({ file, type: file.type, id: crypto.randomUUID() }));
};
