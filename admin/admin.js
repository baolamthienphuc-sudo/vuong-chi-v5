(() => {
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
  const publishMessage = document.querySelector('[data-publish-message]');
  const existingList = document.querySelector('[data-existing-list]');
  const projectCount = document.querySelector('[data-project-count]');
  const checkTitle = document.querySelector('[data-check-title]');
  const checkContent = document.querySelector('[data-check-content]');
  const checkImages = document.querySelector('[data-check-images]');
  const projects = Array.isArray(window.VC_PROJECTS) ? window.VC_PROJECTS : [];
  const categoryNames = {
    'nha-pho': 'Nhà phố', 'nha-cap-4': 'Nhà cấp 4', 'biet-thu': 'Biệt thự', 'nha-vuon': 'Nhà vườn',
    'nha-chau-au': 'Nhà châu Âu', 'nha-be-tong': 'Nhà bê tông đúc sẵn', 'nha-lap-ghep': 'Nhà lắp ghép'
  };
  let adminPassword = '';
  let slugTouched = false;
  let selectedImages = [];

  const slugify = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

  const showMessage = (el, text, type = '') => {
    el.textContent = text || '';
    el.className = el.className.replace(/\s(error|success)\b/g, '') + (type ? ` ${type}` : '');
  };

  const auth = async password => {
    const response = await fetch('../api/admin/auth', {
      method: 'POST',
      headers: { 'X-Admin-Password': password }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || (response.status === 401 ? 'Mật khẩu không đúng.' : 'Không kết nối được API quản trị.'));
    }
    return response.json();
  };

  const enterAdmin = password => {
    adminPassword = password;
    sessionStorage.setItem('vc-admin-password', password);
    loginScreen.hidden = true;
    adminShell.hidden = false;
    renderExisting();
    updateChecks();
  };

  const tryStoredLogin = async () => {
    const stored = sessionStorage.getItem('vc-admin-password');
    if (!stored) return;
    try {
      await auth(stored);
      enterAdmin(stored);
    } catch {
      sessionStorage.removeItem('vc-admin-password');
    }
  };

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    const password = new FormData(loginForm).get('password')?.toString() || '';
    showMessage(loginMessage, 'Đang kiểm tra...');
    button.disabled = true;
    try {
      await auth(password);
      showMessage(loginMessage, 'Đăng nhập thành công.', 'success');
      enterAdmin(password);
    } catch (error) {
      showMessage(loginMessage, error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('[data-logout]')?.addEventListener('click', () => {
    sessionStorage.removeItem('vc-admin-password');
    location.reload();
  });

  const renderExisting = () => {
    projectCount.textContent = projects.length;
    existingList.innerHTML = projects.slice(0, 8).map((project, index) => {
      const src = project.images?.[0] || '';
      const href = `../cong-trinh.html?project=${encodeURIComponent(project.slug || (project.legacyIndex ?? index))}`;
      return `<a class="existing-item" href="${href}" target="_blank" rel="noopener"><img src="../${src}" alt=""><span><b>${escapeHtml(project.title || 'Công trình')}</b><small>${escapeHtml(project.location || project.category || '')}</small></span></a>`;
    }).join('');
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

  const titleInput = projectForm?.elements.namedItem('title');
  const slugInput = projectForm?.elements.namedItem('slug');
  titleInput?.addEventListener('input', () => {
    if (!slugTouched) slugInput.value = slugify(titleInput.value);
    updateChecks();
  });
  slugInput?.addEventListener('input', () => {
    slugTouched = true;
    const start = slugInput.selectionStart;
    slugInput.value = slugify(slugInput.value);
    try { slugInput.setSelectionRange(start, start); } catch {}
  });
  projectForm?.elements.namedItem('content')?.addEventListener('input', updateChecks);
  projectForm?.elements.namedItem('description')?.addEventListener('input', updateChecks);

  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể xử lý ảnh.')), type, quality));

  const convertImage = async file => {
    const bitmap = await createImageBitmap(file);
    const max = 2200;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await canvasToBlob(canvas, 'image/webp', 0.86);
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
        selectedImages.push({ file, url: URL.createObjectURL(file) });
      } catch (error) {
        showMessage(publishMessage, `Không xử lý được ảnh ${files[i].name}: ${error.message}`, 'error');
      }
    }
    imageProgress.hidden = true;
    renderImages();
  };

  const renderImages = () => {
    imageGrid.innerHTML = selectedImages.map((item, index) => `<div class="image-item"><img src="${item.url}" alt="Ảnh ${index + 1}"><span class="image-order">${index + 1}</span><div class="image-actions"><button type="button" data-move="left" data-index="${index}" aria-label="Đưa ảnh sang trái">←</button><button type="button" data-move="right" data-index="${index}" aria-label="Đưa ảnh sang phải">→</button><button type="button" class="remove" data-remove data-index="${index}" aria-label="Xóa ảnh">×</button></div></div>`).join('');
    imageGrid.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      URL.revokeObjectURL(selectedImages[index].url);
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
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); imageInput.click(); }
  });
  imageInput?.addEventListener('change', () => { addFiles(imageInput.files); imageInput.value = ''; });
  ['dragenter','dragover'].forEach(name => dropzone?.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('dragging'); }));
  ['dragleave','drop'].forEach(name => dropzone?.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
  dropzone?.addEventListener('drop', event => addFiles(event.dataTransfer.files));

  function updateChecks() {
    const titleOk = Boolean(titleInput?.value.trim());
    const contentOk = Boolean(projectForm?.elements.namedItem('description')?.value.trim() && projectForm?.elements.namedItem('content')?.value.trim());
    const imagesOk = selectedImages.length > 0;
    checkTitle?.classList.toggle('ok', titleOk);
    checkContent?.classList.toggle('ok', contentOk);
    checkImages?.classList.toggle('ok', imagesOk);
  }

  const resetForm = () => {
    selectedImages.forEach(item => URL.revokeObjectURL(item.url));
    selectedImages = [];
    projectForm.reset();
    slugTouched = false;
    renderImages();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  projectForm?.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage(publishMessage, '');
    if (!projectForm.reportValidity()) return;
    if (!selectedImages.length) {
      showMessage(publishMessage, 'Bạn cần chọn ít nhất 1 hình ảnh.', 'error');
      return;
    }
    const fields = Object.fromEntries(new FormData(projectForm).entries());
    fields.slug = slugify(fields.slug || fields.title);
    fields.category = categoryNames[fields.type] || 'Công trình';
    const formData = new FormData();
    formData.append('project', JSON.stringify(fields));
    selectedImages.forEach((item, index) => formData.append('images', item.file, `${String(index + 1).padStart(2, '0')}.webp`));
    publishButton.disabled = true;
    publishButton.textContent = 'Đang đăng lên GitHub...';
    showMessage(publishMessage, `Đang gửi ${selectedImages.length} ảnh và tạo bài...`);
    try {
      const response = await fetch('../api/admin/publish', {
        method: 'POST',
        headers: { 'X-Admin-Password': adminPassword },
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Không thể đăng công trình.');
      const url = `../cong-trinh.html?project=${encodeURIComponent(fields.slug)}`;
      publishMessage.className = 'publish-message success';
      publishMessage.innerHTML = `Đã tạo commit thành công. Cloudflare sẽ tự deploy bản mới.<br><a href="${url}" target="_blank" rel="noopener">Mở bài công trình ↗</a> &nbsp;•&nbsp; <button type="button" class="text-button" data-new-post>Đăng bài khác</button>`;
      publishMessage.querySelector('[data-new-post]')?.addEventListener('click', resetForm);
    } catch (error) {
      showMessage(publishMessage, error.message, 'error');
    } finally {
      publishButton.disabled = false;
      publishButton.textContent = 'Đăng công trình';
    }
  });

  tryStoredLogin();
})();
