(() => {
  const pageOptions = new URLSearchParams(location.search);
  const embedded = pageOptions.get('embed') === '1';
  if (embedded) document.body.classList.add('embedded-admin');
  const imageUrl = path => String(path || '').startsWith('/') ? path : '/' + path;
  const notifySaved = (project = {}) => {
    if (embedded) window.parent.postMessage({ type: 'vc-cms-saved', slug: project.slug }, location.origin);
  };

  const loginScreen = document.querySelector('[data-login-screen]');
  const adminShell = document.querySelector('[data-admin-shell]');
  const loginForm = document.querySelector('[data-login-form]');
  const loginMessage = document.querySelector('[data-login-message]');
  const projectForm = document.querySelector('[data-project-form]');
  const imageInput = document.querySelector('[data-image-input]');
  const dropzone = document.querySelector('[data-dropzone]');
  const imageGrid = document.querySelector('[data-image-grid]');
  const imageProgress = document.querySelector('[data-image-progress]');
  const coverPreview = document.querySelector('[data-cover-preview]');
  const publishButton = document.querySelector('[data-publish]');
  const publishHeading = document.querySelector('[data-publish-heading]');
  const publishStatus = document.querySelector('[data-publish-status]');
  const publishMessage = document.querySelector('[data-publish-message]');
  const projectList = document.querySelector('[data-project-list]');
  const projectEmpty = document.querySelector('[data-project-empty]');
  const projectSearch = document.querySelector('[data-project-search]');
  const projectFilter = document.querySelector('[data-project-filter]');
  const projectTotal = document.querySelector('[data-project-total]');
  const projectVisible = document.querySelector('[data-project-visible]');
  const projectHidden = document.querySelector('[data-project-hidden]');
  const editorEyebrow = document.querySelector('[data-editor-eyebrow]');
  const editorTitle = document.querySelector('[data-editor-title]');
  const editorCopy = document.querySelector('[data-editor-copy]');
  const slugHelp = document.querySelector('[data-slug-help]');
  const checkTitle = document.querySelector('[data-check-title]');
  const checkContent = document.querySelector('[data-check-content]');
  const checkImages = document.querySelector('[data-check-images]');
  const cancelEditButtons = [...document.querySelectorAll('[data-cancel-edit]')];

  const categoryNames = {
    'nha-pho': 'Nhà phố',
    'nha-cap-4': 'Nhà cấp 4',
    'biet-thu': 'Biệt thự',
    'nha-vuon': 'Nhà vườn',
    'nha-chau-au': 'Nhà châu Âu',
    'nha-be-tong': 'Nhà bê tông đúc sẵn',
    'nha-lap-ghep': 'Nhà lắp ghép'
  };

  const projects = [];

  let slugTouched = false;
  let selectedImages = [];
  let editingSlug = '';

  const slugify = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  const showMessage = (el, text, type = '') => {
    if (!el) return;
    el.textContent = text;
    el.className = `${el === publishMessage ? 'publish-message' : 'form-message'}${type ? ` ${type}` : ''}`;
  };

  const managerMessage = document.querySelector('[data-manager-message]');
  const deleteDialog = document.querySelector('[data-delete-dialog]');
  const deleteForm = document.querySelector('[data-delete-form]');
  let deletingSlug = '';

  // Remove the old plaintext password saved by previous admin versions.
  try { sessionStorage.removeItem('vc-admin-password'); } catch {}

  const showManagerMessage = (message, type = '') => {
    managerMessage.textContent = message;
    managerMessage.className = 'manager-feedback' + (type ? ' ' + type : '');
    managerMessage.hidden = !message;
  };

  const returnToLogin = message => {
    loginScreen.hidden = false;
    adminShell.hidden = true;
    if (deleteDialog.open) deleteDialog.close();
    loginForm.elements.namedItem('password').value = '';
    showMessage(loginMessage, message, 'error');
  };

  const api = async (path, init = {}) => {
    const response = await fetch('/api/admin/' + path, { credentials: 'same-origin', cache: 'no-store', ...init });
    const data = await response.json().catch(() => null);
    if (response.status === 401 && path !== 'auth') returnToLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Không kết nối được dịch vụ quản trị. Vui lòng thử lại.');
    return data;
  };

  const refreshProjects = async () => {
    showManagerMessage('Đang tải danh sách bài đăng...');
    try {
      const data = await api('manage');
      projects.splice(0, projects.length, ...data.projects);
      renderManager();
      showManagerMessage('');
    } catch (error) {
      showManagerMessage(error.message, 'error');
    }
  };

  const enterAdmin = async () => {
    loginScreen.hidden = true;
    adminShell.hidden = false;
    loginForm.elements.namedItem('password').value = '';
    updateChecks();
    updatePublishMode();
    if (!embedded && pageOptions.get('manage') !== '1' && pageOptions.get('account') !== '1') {
      const target = new URL(pageOptions.get('returnTo') || '/', location.origin);
      location.assign(target.origin === location.origin && !target.pathname.startsWith('/admin') ? target.href : '/');
      return;
    }
    await refreshProjects();
    if (pageOptions.get('account') === '1') {
      document.querySelector('[data-account-panel]').hidden = false;
    } else if (embedded && pageOptions.get('view') === 'manage') {
      document.body.classList.add('show-manager');
    } else if (pageOptions.has('edit')) {
      const index = findProjectIndexBySlug(pageOptions.get('edit'));
      if (index >= 0) loadProjectForEdit(index);
      else showManagerMessage('Bài không còn tồn tại.', 'error');
    } else if (embedded) resetForm(false);
  };

  const tryStoredLogin = async () => {
    try {
      await api('auth');
      await enterAdmin();
    } catch { /* No active session: keep the login form visible. */ }
  };

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    const fields = new FormData(loginForm);
    showMessage(loginMessage, 'Đang kiểm tra...');
    button.disabled = true;
    try {
      await api('auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fields.get('username'), password: fields.get('password') })
      });
      showMessage(loginMessage, '');
      await enterAdmin();
    } catch (error) {
      showMessage(loginMessage, error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try {
      await api('auth', { method: 'DELETE' });
      location.reload();
    } catch (error) {
      showManagerMessage(error.message, 'error');
    }
  });
  document.querySelector('[data-refresh-projects]')?.addEventListener('click', refreshProjects);

  const renderManager = () => {
    const total = projects.length;
    const hiddenCount = projects.filter(project => project.hidden).length;
    if (projectTotal) projectTotal.textContent = String(total);
    if (projectVisible) projectVisible.textContent = String(total - hiddenCount);
    if (projectHidden) projectHidden.textContent = String(hiddenCount);

    const keyword = String(projectSearch?.value || '').trim().toLocaleLowerCase('vi');
    const filter = projectFilter?.value || 'all';
    const visibleProjects = projects
      .map((project, index) => ({ project, index }))
      .filter(({ project }) => {
        if (filter === 'visible' && project.hidden) return false;
        if (filter === 'hidden' && !project.hidden) return false;
        if (!keyword) return true;
        return [project.title, project.location, project.category, project.description, project.slug]
          .some(value => String(value || '').toLocaleLowerCase('vi').includes(keyword));
      });

    if (projectEmpty) projectEmpty.hidden = visibleProjects.length > 0;
    if (!projectList) return;
    projectList.innerHTML = visibleProjects.map(({ project, index }) => {
      const cover = project.images?.[0] || '';
      const statusClass = project.hidden ? 'hidden' : 'visible';
      const statusText = project.hidden ? 'Ẩn / bản nháp' : 'Đang hiển thị';
      const href = `../cong-trinh.html?project=${encodeURIComponent(project.slug || '')}`;
      return `<article class="manager-item${project.hidden ? ' is-hidden' : ''}">
        <div class="manager-cover">${cover ? `<img src="${escapeHtml(imageUrl(cover))}" alt="">` : '<span>Chưa có ảnh</span>'}</div>
        <div class="manager-info">
          <div class="manager-meta"><span class="status-badge ${statusClass}">${statusText}</span><span>${escapeHtml(project.category || 'Công trình')}</span></div>
          <h3>${escapeHtml(project.title || 'Công trình')}</h3>
          <p>${escapeHtml(project.location || 'Đang cập nhật')} · ${project.images?.length || 0} ảnh</p>
        </div>
        <div class="manager-actions">
          <button type="button" class="mini-button edit" data-edit-index="${index}">Sửa</button>
          <button type="button" class="mini-button delete" data-delete-index="${index}">Xóa</button>
          <button type="button" class="mini-button visibility ${project.hidden ? 'show' : 'hide'}" data-visibility-index="${index}">${project.hidden ? 'Hiện bài' : 'Ẩn bài'}</button>
          ${project.hidden ? '<span class="mini-muted">Không hiển thị công khai</span>' : `<a class="mini-button view" href="${href}" target="_blank" rel="noopener">Xem ↗</a>`}
        </div>
      </article>`;
    }).join('');
  };

  projectSearch?.addEventListener('input', renderManager);
  projectFilter?.addEventListener('change', renderManager);

  const findProjectIndexBySlug = slug => projects.findIndex(project => project.slug === slug);

  const revokeNewImages = () => {
    selectedImages.forEach(item => {
      if (item.kind === 'new' && item.url) URL.revokeObjectURL(item.url);
    });
  };

  const setFormValue = (name, value) => {
    const field = projectForm?.elements.namedItem(name);
    if (field) field.value = value ?? '';
  };

  const setEditorMode = project => {
    document.querySelector('#editor').hidden = false;
    const isEditing = Boolean(project);
    if (editorEyebrow) editorEyebrow.textContent = isEditing ? 'CHỈNH SỬA BÀI' : 'ĐĂNG BÀI MỚI';
    if (editorTitle) editorTitle.textContent = isEditing ? `Sửa: ${project.title || 'Công trình'}` : 'Đăng công trình mới';
    if (editorCopy) editorCopy.textContent = isEditing
      ? 'Sửa thông tin, nội dung, ảnh và trạng thái hiển thị. Đường dẫn được khóa để tránh làm hỏng link cũ.'
      : 'Bài mới có thể để hiển thị ngay hoặc lưu ở trạng thái ẩn / bản nháp.';
    cancelEditButtons.forEach(button => { button.hidden = !isEditing; });
    if (slugHelp) slugHelp.textContent = isEditing
      ? 'Đường dẫn được khóa khi chỉnh sửa để giữ nguyên link và SEO của bài.'
      : 'Không dấu, dùng dấu gạch ngang. Hệ thống sẽ tự tạo theo tiêu đề.';
    const slugInput = projectForm?.elements.namedItem('slug');
    if (slugInput) slugInput.readOnly = isEditing;
    updatePublishMode();
  };

  const loadProjectForEdit = index => {
    const project = projects[index];
    if (!project) return;
    revokeNewImages();
    editingSlug = project.slug;
    slugTouched = true;
    setFormValue('title', project.title);
    setFormValue('slug', project.slug);
    setFormValue('type', project.type || 'nha-pho');
    setFormValue('visibility', project.hidden ? 'hidden' : 'visible');
    setFormValue('location', project.location === 'Đang cập nhật' ? '' : project.location);
    setFormValue('floors', project.floors === 'Đang cập nhật' ? '' : project.floors);
    setFormValue('area', project.area === 'Đang cập nhật' ? '' : project.area);
    setFormValue('buildArea', project.buildArea === 'Đang cập nhật' ? '' : project.buildArea);
    setFormValue('cost', project.cost === 'Đang cập nhật' ? '' : project.cost);
    setFormValue('description', project.description);
    setFormValue('content', project.content);
    selectedImages = (project.images || []).map(path => ({ kind: 'existing', path, url: imageUrl(path) }));
    setEditorMode(project);
    renderImages();
    showMessage(publishMessage, '');
    document.querySelector('#editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetForm = (scroll = true) => {
    revokeNewImages();
    selectedImages = [];
    editingSlug = '';
    slugTouched = false;
    projectForm?.reset();
    setFormValue('visibility', 'visible');
    setEditorMode(null);
    renderImages();
    showMessage(publishMessage, '');
    if (scroll) document.querySelector('#editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.querySelectorAll('[data-new-project]').forEach(button => button.addEventListener('click', event => {
    if (button.tagName === 'A') event.preventDefault();
    resetForm(true);
  }));
  cancelEditButtons.forEach(button => button.addEventListener('click', () => resetForm(true)));

  projectList?.addEventListener('click', async event => {
    const deleteButton = event.target.closest('[data-delete-index]');
    if (deleteButton) {
      const project = projects[Number(deleteButton.dataset.deleteIndex)];
      if (!project) return;
      deletingSlug = project.slug;
      deleteForm.reset();
      document.querySelector('[data-delete-title]').textContent = project.title;
      document.querySelector('[data-delete-slug]').textContent = project.slug;
      document.querySelector('[data-delete-message]').textContent = '';
      deleteDialog.showModal();
      deleteForm.elements.namedItem('confirmSlug').focus();
      return;
    }
    const editButton = event.target.closest('[data-edit-index]');
    if (editButton) {
      loadProjectForEdit(Number(editButton.dataset.editIndex));
      return;
    }
    const visibilityButton = event.target.closest('[data-visibility-index]');
    if (!visibilityButton) return;
    const index = Number(visibilityButton.dataset.visibilityIndex);
    const project = projects[index];
    if (!project) return;
    const nextHidden = !project.hidden;
    if (nextHidden && !confirm(`Ẩn “${project.title}” khỏi website?\n\nBài vẫn được giữ trong Admin và có thể hiện lại bất cứ lúc nào.`)) return;
    visibilityButton.disabled = true;
    visibilityButton.textContent = nextHidden ? 'Đang ẩn...' : 'Đang hiện...';
    try {
      const formData = new FormData();
      formData.append('action', 'visibility');
      formData.append('slug', project.slug);
      formData.append('version', project.version);
      formData.append('hidden', String(nextHidden));
      const data = await api('manage', { method: 'POST', body: formData });
      Object.assign(project, data.project);
      project.hidden = nextHidden;
      project.updatedAt = data.project?.updatedAt || new Date().toISOString();
      showManagerMessage('Đã cập nhật trạng thái bài trên website.', 'success');
      notifySaved(project);
      renderManager();
      if (editingSlug === project.slug) {
        setFormValue('visibility', nextHidden ? 'hidden' : 'visible');
        updatePublishMode();
      }
    } catch (error) {
      alert(error.message);
      renderManager();
    }
  });

  document.querySelector('[data-cancel-delete]').addEventListener('click', () => deleteDialog.close());
  deleteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.querySelector('[data-delete-message]');
    const confirmSlug = deleteForm.elements.namedItem('confirmSlug').value;
    if (confirmSlug !== deletingSlug) {
      message.textContent = 'Đường dẫn chưa khớp. Bài chưa bị xóa.';
      return;
    }
    const button = document.querySelector('[data-confirm-delete]');
    button.disabled = true;
    message.textContent = 'Đang xóa bài...';
    try {
      const form = new FormData();
      form.set('action', 'delete');
      form.set('slug', deletingSlug);
      form.set('confirmSlug', confirmSlug);
      form.set('version', projects.find(project => project.slug === deletingSlug)?.version || '');
      await api('manage', { method: 'POST', body: form });
      const index = findProjectIndexBySlug(deletingSlug);
      if (index >= 0) projects.splice(index, 1);
      if (editingSlug === deletingSlug) {
        resetForm(false);
        document.querySelector('#editor').hidden = true;
      }
      renderManager();
      deleteDialog.close();
      showManagerMessage('Đã xóa bài khỏi website.', 'success');
      notifySaved();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  const titleInput = projectForm?.elements.namedItem('title');
  const slugInput = projectForm?.elements.namedItem('slug');
  const visibilityInput = projectForm?.elements.namedItem('visibility');

  titleInput?.addEventListener('input', () => {
    if (!editingSlug && !slugTouched) slugInput.value = slugify(titleInput.value);
    updateChecks();
  });
  slugInput?.addEventListener('input', () => {
    if (editingSlug) return;
    slugTouched = true;
    const start = slugInput.selectionStart;
    slugInput.value = slugify(slugInput.value);
    try { slugInput.setSelectionRange(start, start); } catch {}
  });
  visibilityInput?.addEventListener('change', updatePublishMode);
  projectForm?.elements.namedItem('content')?.addEventListener('input', updateChecks);
  projectForm?.elements.namedItem('description')?.addEventListener('input', updateChecks);

  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể xử lý ảnh.')), type, quality);
  });

  const convertImage = async file => {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    let blob = await canvasToBlob(canvas, 'image/webp', 0.82);
    if (blob.size > 1500000) blob = await canvasToBlob(canvas, 'image/webp', 0.65);
    if (blob.size > 1500000) throw new Error('Ảnh còn quá lớn. Vui lòng chọn ảnh nhỏ hơn.');
    const baseName = slugify(file.name.replace(/\.[^.]+$/, '')) || 'anh-cong-trinh';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  };

  const addFiles = async fileList => {
    const incoming = [...fileList].filter(file => /^image\/(jpeg|png|webp)$/.test(file.type));
    if (!incoming.length) return;
    const capacity = Math.max(0, 20 - selectedImages.length);
    const files = incoming.slice(0, capacity);
    if (!files.length) {
      showMessage(publishMessage, 'Tối đa 20 ảnh cho một công trình.', 'error');
      return;
    }
    imageProgress.hidden = false;
    for (let i = 0; i < files.length; i++) {
      imageProgress.textContent = `Đang tối ưu ảnh ${i + 1}/${files.length}: ${files[i].name}`;
      try {
        const file = await convertImage(files[i]);
        selectedImages.push({ kind: 'new', file, url: URL.createObjectURL(file) });
      } catch (error) {
        showMessage(publishMessage, `Không xử lý được ảnh ${files[i].name}: ${error.message}`, 'error');
      }
    }
    imageProgress.hidden = true;
    renderImages();
  };

  const renderImages = () => {
    if (!imageGrid) return;
    imageGrid.innerHTML = selectedImages.map((item, index) => `<div class="image-item${item.kind === 'existing' ? ' existing-image' : ' new-image'}">
      <img src="${escapeHtml(item.url)}" alt="Ảnh ${index + 1}">
      <span class="image-order">${index + 1}</span>
      <span class="image-kind">${item.kind === 'existing' ? 'Ảnh cũ' : 'Ảnh mới'}</span>
      <div class="image-actions">
        <button type="button" data-move="left" data-index="${index}" aria-label="Đưa ảnh sang trái">←</button>
        <button type="button" data-move="right" data-index="${index}" aria-label="Đưa ảnh sang phải">→</button>
        <button type="button" class="remove" data-remove data-index="${index}" aria-label="Xóa ảnh khỏi bài">×</button>
      </div>
    </div>`).join('');

    imageGrid.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const item = selectedImages[index];
      if (item?.kind === 'new' && item.url) URL.revokeObjectURL(item.url);
      selectedImages.splice(index, 1);
      renderImages();
    }));
    imageGrid.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const target = button.dataset.move === 'left' ? index - 1 : index + 1;
      if (target < 0 || target >= selectedImages.length) return;
      [selectedImages[index], selectedImages[target]] = [selectedImages[target], selectedImages[index]];
      renderImages();
    }));

    if (selectedImages[0]) {
      coverPreview.style.backgroundImage = `url("${selectedImages[0].url}")`;
      coverPreview.classList.add('has-image');
    } else {
      coverPreview.style.backgroundImage = '';
      coverPreview.classList.remove('has-image');
    }
    updateChecks();
  };

  document.querySelector('[data-pick-images]')?.addEventListener('click', event => {
    event.stopPropagation();
    imageInput.click();
  });
  dropzone?.addEventListener('click', event => {
    if (!event.target.closest('[data-pick-images]')) imageInput.click();
  });
  dropzone?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      imageInput.click();
    }
  });
  imageInput?.addEventListener('change', () => {
    addFiles(imageInput.files);
    imageInput.value = '';
  });
  ['dragenter', 'dragover'].forEach(name => dropzone?.addEventListener(name, event => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(name => dropzone?.addEventListener(name, event => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
  }));
  dropzone?.addEventListener('drop', event => addFiles(event.dataTransfer.files));

  function updateChecks() {
    const titleOk = Boolean(titleInput?.value.trim());
    const contentOk = Boolean(
      projectForm?.elements.namedItem('description')?.value.trim() &&
      projectForm?.elements.namedItem('content')?.value.trim()
    );
    const imagesOk = selectedImages.length > 0;
    checkTitle?.classList.toggle('ok', titleOk);
    checkContent?.classList.toggle('ok', contentOk);
    checkImages?.classList.toggle('ok', imagesOk);
  }

  function updatePublishMode() {
    const hidden = visibilityInput?.value === 'hidden';
    if (publishStatus) {
      publishStatus.textContent = hidden ? 'ẨN / BẢN NHÁP' : 'HIỂN THỊ TRÊN WEBSITE';
      publishStatus.classList.toggle('is-hidden', hidden);
    }
    if (editingSlug) {
      if (publishHeading) publishHeading.textContent = 'Lưu thay đổi?';
      if (publishButton && !publishButton.disabled) publishButton.textContent = 'Cập nhật công trình';
    } else {
      if (publishHeading) publishHeading.textContent = hidden ? 'Lưu bản nháp?' : 'Sẵn sàng đăng?';
      if (publishButton && !publishButton.disabled) publishButton.textContent = hidden ? 'Lưu bản nháp' : 'Đăng bài';
    }
  }

  const buildProjectFields = () => {
    const fields = Object.fromEntries(new FormData(projectForm).entries());
    fields.slug = slugify(fields.slug || fields.title);
    fields.category = categoryNames[fields.type] || 'Công trình';
    fields.hidden = fields.visibility === 'hidden';
    return fields;
  };

  const submitNewProject = async fields => {
    const formData = new FormData();
    formData.append('project', JSON.stringify(fields));
    selectedImages.forEach((item, index) => {
      if (item.kind === 'new') formData.append('images', item.file, `${String(index + 1).padStart(2, '0')}.webp`);
    });
    const data = await api('publish', { method: 'POST', body: formData });
    if (data.project) {
      projects.unshift({ ...data.project, hidden: data.project.hidden === true, images: [...(data.project.images || [])] });
      renderManager();
    }
    return data;
  };

  const submitProjectUpdate = async fields => {
    const newFiles = [];
    const order = selectedImages.map(item => {
      if (item.kind === 'existing') return { kind: 'existing', path: item.path };
      const index = newFiles.length;
      newFiles.push(item.file);
      return { kind: 'new', index };
    });
    const formData = new FormData();
    formData.append('action', 'update');
    formData.append('slug', editingSlug);
    formData.append('version', projects.find(project => project.slug === editingSlug)?.version || '');
    formData.append('project', JSON.stringify(fields));
    formData.append('imageOrder', JSON.stringify(order));
    newFiles.forEach((file, index) => formData.append('images', file, `${String(index + 1).padStart(2, '0')}.webp`));
    const data = await api('manage', { method: 'POST', body: formData });
    if (data.project) {
      const index = findProjectIndexBySlug(editingSlug);
      if (index >= 0) projects[index] = { ...data.project, hidden: data.project.hidden === true, images: [...(data.project.images || [])] };
      editingSlug = data.project.slug;
      selectedImages = (data.project.images || []).map(path => ({ kind: 'existing', path, url: imageUrl(path) }));
      renderManager();
      renderImages();
      setEditorMode(data.project);
    }
    return data;
  };

  projectForm?.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage(publishMessage, '');
    if (!projectForm.reportValidity()) return;
    if (!selectedImages.length) {
      showMessage(publishMessage, 'Bạn cần giữ lại hoặc chọn ít nhất 1 hình ảnh.', 'error');
      return;
    }
    const fields = buildProjectFields();
    const isEditing = Boolean(editingSlug);
    publishButton.disabled = true;
    publishButton.textContent = isEditing ? 'Đang cập nhật...' : (fields.hidden ? 'Đang lưu bản nháp...' : 'Đang đăng bài...');
    showMessage(publishMessage, isEditing
      ? `Đang lưu nội dung và ${selectedImages.length} ảnh...`
      : `Đang gửi ${selectedImages.length} ảnh và tạo bài...`);
    try {
      const data = isEditing ? await submitProjectUpdate(fields) : await submitNewProject(fields);
      const project = data.project || fields;
      notifySaved(project);
      const hidden = project.hidden === true || fields.hidden === true;
      const url = `../cong-trinh.html?project=${encodeURIComponent(project.slug || fields.slug)}`;
      publishMessage.className = 'publish-message success';
      publishMessage.innerHTML = hidden
        ? `Đã lưu thành công ở trạng thái <b>Ẩn / bản nháp</b>. Bài không xuất hiện với khách truy cập.<br><button type="button" class="text-button" data-back-manager>Quay lại danh sách công trình</button>`
        : `Đã lưu bài thành công. Nội dung đã cập nhật trên website.<br><a href="${url}" target="_blank" rel="noopener">Mở bài công trình ↗</a> &nbsp;•&nbsp; <button type="button" class="text-button" data-back-manager>Quay lại danh sách</button>`;
      publishMessage.querySelector('[data-back-manager]')?.addEventListener('click', () => {
        document.querySelector('#manage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      if (!isEditing) {
        revokeNewImages();
        selectedImages = [];
        projectForm.reset();
        slugTouched = false;
        setFormValue('visibility', 'visible');
        renderImages();
        updatePublishMode();
      }
    } catch (error) {
      showMessage(publishMessage, error.message, 'error');
    } finally {
      publishButton.disabled = false;
      updatePublishMode();
    }
  });

  document.querySelector('[data-open-account]').addEventListener('click', event => {
    event.preventDefault();
    const panel = document.querySelector('[data-account-panel]');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelector('[data-password-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const message = document.querySelector('[data-password-message]');
    const fields = Object.fromEntries(new FormData(form));
    if (fields.newPassword !== fields.confirmPassword) {
      showMessage(message, 'Hai lần nhập mật khẩu mới chưa khớp.', 'error');
      return;
    }
    button.disabled = true;
    try {
      const data = await api('password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      form.reset();
      if (embedded) window.parent.postMessage({ type: 'vc-cms-password-changed' }, location.origin);
      returnToLogin(data.message);
      showMessage(loginMessage, data.message, 'success');
    } catch (error) {
      showMessage(message, error.message, 'error');
    } finally { button.disabled = false; }
  });
  if (pageOptions.get('changed') === '1') showMessage(loginMessage, 'Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.', 'success');
  tryStoredLogin();
})();
