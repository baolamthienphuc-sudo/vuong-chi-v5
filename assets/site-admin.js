document.addEventListener('DOMContentLoaded', async () => {
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = '/assets/site-admin.css?v=20261021-cms';
  if (!document.querySelector('link[href*="site-admin.css"]')) document.head.append(style);
  const returnTo = location.pathname + location.search;
  const loginUrl = '/admin/?returnTo=' + encodeURIComponent(returnTo);
  const api = async (endpoint, init = {}) => {
    const response = await fetch('/api/admin/' + endpoint, { credentials: 'same-origin', cache: 'no-store', ...init });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      if (response.status === 401) location.assign(loginUrl);
      throw new Error(data?.error || 'Không kết nối được dịch vụ quản trị.');
    }
    return data;
  };
  const authResponse = await fetch('/api/admin/auth', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
  if (!authResponse?.ok) {
    const link = document.createElement('a');
    link.href = loginUrl; link.className = 'cms-admin-login'; link.textContent = 'Đăng nhập quản trị';
    (document.querySelector('.footer .container') || document.body).append(link);
    return;
  }
  document.body.classList.add('cms-signed-in');
  const toolbar = document.createElement('div');
  toolbar.className = 'cms-toolbar';
  toolbar.innerHTML = '<strong>VƯƠNG CHÍ · Quản trị</strong><nav aria-label="Quản trị website"><button class="cms-new" data-cms-new>＋ Đăng bài</button><button data-cms-manage>Quản lý bài</button><button data-cms-account>Đổi mật khẩu</button><button data-cms-logout>Đăng xuất</button></nav>';
  document.body.prepend(toolbar);
  new ResizeObserver(() => document.documentElement.style.setProperty('--cms-toolbar-height', toolbar.offsetHeight + 'px')).observe(toolbar);
  const dialog = document.createElement('dialog');
  dialog.className = 'cms-dialog';
  dialog.setAttribute('aria-label', 'Chỉnh sửa nội dung website');
  dialog.innerHTML = '<div class="cms-dialog-head"><strong data-cms-dialog-title></strong><button type="button" data-cms-close>Đóng ×</button></div><iframe title="Biểu mẫu quản trị bài đăng"></iframe>';
  document.body.append(dialog);
  const frame = dialog.querySelector('iframe');
  const openEditor = (query, title) => {
    dialog.querySelector('[data-cms-dialog-title]').textContent = title;
    frame.src = '/admin/?embed=1&' + query;
    dialog.showModal();
  };
  dialog.querySelector('[data-cms-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { frame.src = 'about:blank'; });
  toolbar.querySelector('[data-cms-new]').addEventListener('click', () => openEditor('new=1', 'Đăng bài mới'));
  toolbar.querySelector('[data-cms-manage]').addEventListener('click', () => openEditor('view=manage', 'Quản lý tất cả bài đăng'));
  toolbar.querySelector('[data-cms-account]').addEventListener('click', () => openEditor('account=1', 'Đổi mật khẩu quản trị'));
  toolbar.querySelector('[data-cms-logout]').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try { await api('auth', { method: 'DELETE' }); location.reload(); }
    catch (error) { alert(error.message); event.currentTarget.disabled = false; }
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'vc-cms-saved') location.reload();
    if (event.data?.type === 'vc-cms-password-changed') location.assign(loginUrl + '&changed=1');
  });
  let projects;
  try { projects = (await api('manage')).projects; }
  catch (error) {
    const status = document.createElement('p'); status.textContent = error.message; toolbar.append(status); return;
  }
  const bySlug = new Map(projects.map(project => [project.slug, project]));
  const deletion = document.createElement('dialog');
  deletion.className = 'cms-dialog cms-delete-dialog';
  deletion.setAttribute('aria-labelledby', 'cms-delete-title');
  deletion.innerHTML = '<form><h2 id="cms-delete-title">Xóa vĩnh viễn bài đăng?</h2><p data-title></p><p>Bài và ảnh tải lên riêng cho bài này sẽ bị xóa ngay. Không có thùng rác để khôi phục.</p><label>Nhập lại đường dẫn bài:<code data-slug></code><input name="confirmSlug" aria-label="Xác nhận đường dẫn bài" autocomplete="off" required></label><p class="cms-error" role="status"></p><div class="cms-delete-actions"><button type="button" data-cancel>Giữ lại bài</button><button class="cms-danger" type="submit">Xóa vĩnh viễn</button></div></form>';
  document.body.append(deletion);
  deletion.querySelector('[data-cancel]').addEventListener('click', () => deletion.close());
  let pendingDelete;
  deletion.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const message = deletion.querySelector('[role="status"]');
    const confirmSlug = new FormData(event.currentTarget).get('confirmSlug');
    if (confirmSlug !== pendingDelete.slug) { message.textContent = 'Đường dẫn chưa khớp. Bài chưa bị xóa.'; return; }
    const button = deletion.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries({ action: 'delete', slug: pendingDelete.slug, version: pendingDelete.version, confirmSlug })) form.set(key, value);
      await api('manage', { method: 'POST', body: form });
      if (new URLSearchParams(location.search).get('project') === pendingDelete.slug) location.assign('/du-an.html');
      else location.reload();
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  });
  const actionsFor = (project, detail = false) => {
    const actions = document.createElement('div');
    actions.className = detail ? 'cms-detail-actions' : 'cms-card-actions';
    actions.setAttribute('aria-label', 'Quản lý: ' + project.title);
    if (project.hidden) {
      const label = document.createElement('span'); label.className = 'cms-hidden-label'; label.textContent = 'Đang ẩn'; actions.append(label);
    }
    const button = (text, handler) => {
      const element = document.createElement('button'); element.type = 'button'; element.textContent = text;
      element.addEventListener('click', handler); actions.append(element); return element;
    };
    button('Sửa bài', () => openEditor('edit=' + encodeURIComponent(project.slug), 'Sửa: ' + project.title));
    button(project.hidden ? 'Hiện bài' : 'Ẩn bài', async event => {
      event.currentTarget.disabled = true;
      try {
        const form = new FormData();
        for (const [key, value] of Object.entries({ action: 'visibility', slug: project.slug, version: project.version, hidden: String(!project.hidden) })) form.set(key, value);
        await api('manage', { method: 'POST', body: form }); location.reload();
      } catch (error) { alert(error.message); event.currentTarget.disabled = false; }
    });
    button('Xóa', () => {
      pendingDelete = project;
      deletion.querySelector('form').reset();
      deletion.querySelector('[data-title]').textContent = project.title;
      deletion.querySelector('[data-slug]').textContent = project.slug;
      deletion.querySelector('[role="status"]').textContent = '';
      deletion.querySelector('button[type="submit"]').disabled = false;
      deletion.showModal();
    });
    return actions;
  };
  document.querySelectorAll('[data-project-slug]').forEach(card => {
    const project = bySlug.get(card.dataset.projectSlug);
    if (project) card.append(actionsFor(project));
  });
  const detail = document.querySelector('[data-project-detail]');
  if (detail) {
    const slug = new URLSearchParams(location.search).get('project');
    const project = bySlug.get(slug) || (!slug ? projects[0] : null);
    if (project) (detail.querySelector('.project-article') || detail).prepend(actionsFor(project, true));
  }
});
