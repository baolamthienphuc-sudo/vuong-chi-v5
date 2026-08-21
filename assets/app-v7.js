document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) toggle.addEventListener('click', () => nav.classList.toggle('open'));

  const standardCta = `<div class="container cta-row"><div><div class="cta-kicker">TƯ VẤN XÂY DỰNG</div><h2>Trao đổi trực tiếp về công trình của bạn</h2><p>Gửi vị trí xây dựng, diện tích đất, số tầng dự kiến và nhu cầu sử dụng. Vương Chí sẽ tư vấn phương án, phạm vi thi công và dự toán phù hợp.</p></div><a class="btn cta-phone" href="tel:0358340326"><span>Hotline tư vấn</span><strong>0358 340 326</strong></a></div>`;
  const standardFooter = `<div class="container"><div class="footer-grid"><div><a class="brand" href="index.html"><img src="assets/images/logo-mark-footer.png" alt="Vương Chí Construction"><div class="brand-copy"><strong>VƯƠNG CHÍ</strong><span>CONSTRUCTION</span></div></a><p>Công ty TNHH Xây Dựng Vương Chí hoạt động trong lĩnh vực thiết kế, thi công xây dựng, cải tạo và hoàn thiện công trình dân dụng tại Lâm Đồng.</p></div><div><h4>Liên kết</h4><a href="gioi-thieu.html">Giới thiệu</a><a href="dich-vu.html">Dịch vụ</a><a href="du-an.html">Công trình</a><a href="cam-nang.html">Cẩm nang</a></div><div><h4>Dịch vụ</h4><a href="dich-vu.html#thi-cong">Thi công nhà ở</a><a href="dich-vu.html#cai-tao">Sửa chữa & cải tạo</a><a href="dich-vu.html#thiet-ke">Thiết kế kiến trúc</a><a href="dich-vu.html#tron-goi">Thiết kế & thi công trọn gói</a></div><div><h4>Liên hệ</h4><p>83 Trần Phú, Xã Bảo Lâm 1, Tỉnh Lâm Đồng, Việt Nam</p><a href="tel:0358340326">0358 340 326</a><a href="https://zalo.me/0358340326" target="_blank" rel="noopener">Zalo: 0358 340 326</a><p>MST: 5801573869</p></div></div><div class="footer-bottom"><span>© 2026 Công ty TNHH Xây Dựng Vương Chí.</span><span>Thiết kế • Thi công • Cải tạo • Hoàn thiện</span></div></div>`;
  const cta = document.querySelector('.cta');
  if (cta) cta.innerHTML = standardCta;
  else {
    const section = document.createElement('section');
    section.className = 'cta';
    section.innerHTML = standardCta;
    document.body.append(section);
  }
  const footer = document.querySelector('.footer');
  if (footer) footer.innerHTML = standardFooter;
  else {
    const element = document.createElement('footer');
    element.className = 'footer';
    element.innerHTML = standardFooter;
    document.body.append(element);
  }

  const consultForm = document.querySelector('[data-consult-form]');
  if (consultForm) {
    try {
      const draft = JSON.parse(sessionStorage.getItem('vc-consult-draft') || '{}');
      Object.entries(draft).forEach(([name, value]) => {
        const field = consultForm.elements.namedItem(name);
        if (field && value) field.value = value;
      });
      sessionStorage.removeItem('vc-consult-draft');
    } catch {}
    consultForm.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(consultForm).entries());
      const message = [
        'Xin chào Vương Chí Construction, tôi cần tư vấn công trình:',
        `- Họ và tên: ${data.name || ''}`,
        `- Số điện thoại: ${data.phone || ''}`,
        `- Khu vực xây dựng: ${data.area || ''}`,
        `- Diện tích đất: ${data.size || ''}`,
        `- Dịch vụ: ${data.service || ''}`,
        `- Nội dung: ${data.message || ''}`
      ].join('\n');
      const helper = document.createElement('textarea');
      helper.value = message;
      helper.setAttribute('readonly', '');
      helper.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(helper);
      helper.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      helper.remove();
      if (!copied && navigator.clipboard) navigator.clipboard.writeText(message).catch(() => {});
      const zalo = window.open('https://zalo.me/0358340326', '_blank', 'noopener');
      if (!zalo) location.href = 'https://zalo.me/0358340326';
    });
  }

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const textHtml = value => esc(value).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  const categoryNames = {
    'nha-pho': 'Nhà phố',
    'nha-cap-4': 'Nhà cấp 4',
    'biet-thu': 'Biệt thự',
    'nha-vuon': 'Nhà vườn',
    'nha-chau-au': 'Nhà châu Âu',
    'nha-be-tong': 'Nhà bê tông đúc sẵn',
    'nha-lap-ghep': 'Nhà lắp ghép'
  };
  const projects = (Array.isArray(window.VC_PROJECTS) ? window.VC_PROJECTS : []).map((project, index) => ({
    legacyIndex: Number.isInteger(project.legacyIndex) ? project.legacyIndex : null,
    slug: project.slug || `cong-trinh-${index + 1}`,
    title: project.title || 'Công trình Vương Chí',
    type: project.type || 'nha-pho',
    category: project.category || categoryNames[project.type] || 'Công trình',
    location: project.location || 'Đang cập nhật',
    floors: project.floors || 'Đang cập nhật',
    area: project.area || 'Đang cập nhật',
    buildArea: project.buildArea || 'Đang cập nhật',
    cost: project.cost || 'Đang cập nhật',
    description: project.description || 'Thi công thực tế',
    content: project.content || project.description || 'Hình ảnh thực tế do Vương Chí ghi nhận trong quá trình thi công và hoàn thiện.',
    images: Array.isArray(project.images) ? project.images.filter(Boolean) : [],
    publishedAt: project.publishedAt || ''
  })).filter(project => project.images.length);

  const projectParam = (project, index) => encodeURIComponent(project.slug || String(index));
  const projectHref = (project, index) => `cong-trinh.html?project=${projectParam(project, index)}`;
  const findProjectIndex = requested => {
    if (!projects.length) return -1;
    if (requested === null || requested === undefined || requested === '') return 0;
    const raw = decodeURIComponent(String(requested));
    if (/^\d+$/.test(raw)) {
      const legacy = Number(raw);
      const legacyIndex = projects.findIndex(project => project.legacyIndex === legacy);
      if (legacyIndex >= 0) return legacyIndex;
      if (legacy >= 0 && legacy < projects.length) return legacy;
    }
    const slugIndex = projects.findIndex(project => project.slug === raw);
    return slugIndex;
  };

  const detailHost = document.querySelector('[data-project-detail]');
  if (detailHost) {
    if (!projects.length) {
      detailHost.innerHTML = '<div class="container section"><p>Chưa có dữ liệu công trình.</p></div>';
      return;
    }
    const requested = detailHost.dataset.projectSlug || new URLSearchParams(location.search).get('project');
    const index = findProjectIndex(requested);
    if (index < 0) {
      detailHost.innerHTML = '<div class="container section"><div class="breadcrumb">Trang chủ / Công trình</div><h1 class="page-title">Công trình đang được cập nhật</h1><p>Đường dẫn này chưa có trong dữ liệu hiện tại. Nếu bạn vừa đăng bài, hãy mở lại sau khi Cloudflare triển khai commit mới.</p><p><a class="btn btn-gold" href="du-an.html">Xem tất cả công trình</a></p></div>';
      return;
    }
    const project = projects[index];
    document.title = `${project.title} | Vương Chí Construction`;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.setAttribute('content', project.description);
    const icons = {
      location: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5 9 3l6 2.5L21 3v15.5L15 21l-6-2.5L3 21V5.5Z"/><path d="M9 3v15.5M15 5.5V21"/></svg>',
      floors: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3h10v18M3 21h18M8 6h2m3 0h2M8 10h2m3 0h2M8 14h2m3 0h2M8 18h2m3 0h2"/></svg>',
      land: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20 7 4l4 4 3-5 7 17H3Z"/><path d="m7 4 3 16m1-12 3 12m0-17 3 17M5 15h14"/></svg>',
      build: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 8h10v8H7zM5 2v3m14-3v3M5 19v3m14-3v3"/></svg>',
      cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M17 6.5c-1-1-2.6-1.5-5-1.5-2.8 0-4.5 1.2-4.5 3s1.7 2.5 4.5 3 4.5 1.5 4.5 3-1.7 3-4.5 3c-2.4 0-4.1-.6-5.2-1.8"/></svg>'
    };
    const previous = (index - 1 + projects.length) % projects.length;
    const next = (index + 1) % projects.length;
    const previousProject = projects[previous];
    const nextProject = projects[next];
    detailHost.innerHTML = `<div class="container project-article"><a class="project-detail-close" href="du-an.html" aria-label="Đóng và quay lại thư viện công trình">×</a><div class="breadcrumb">Trang chủ / Công trình / ${esc(project.title)}</div><header class="project-article-header"><div><div class="kicker">${esc(project.category)}</div><h1>${esc(project.title)}</h1></div></header><div class="project-article-layout"><article class="project-article-content"><section class="project-slider" aria-label="Album ảnh ${esc(project.title)}"><img class="project-slider-main" src="${esc(project.images[0])}" alt="${esc(project.title)}"><div class="project-slider-thumbs">${project.images.map((src, imageIndex) => `<button class="project-slider-thumb${imageIndex === 0 ? ' active' : ''}" type="button" aria-label="Xem hình ${imageIndex + 1}"><img src="${esc(src)}" alt="${esc(project.title)} – hình ${imageIndex + 1}"></button>`).join('')}</div></section><section class="project-article-info"><header><b>Thông tin công trình</b><span>${esc(project.title)}</span></header><div class="project-article-facts"><div><i>${icons.location}</i><p><strong>Vị trí công trình</strong><span>${esc(project.location)}</span></p></div><div><i>${icons.floors}</i><p><strong>Số tầng</strong><span>${esc(project.floors)}</span></p></div><div><i>${icons.land}</i><p><strong>Diện tích đất</strong><span>${esc(project.area)}</span></p></div><div><i>${icons.build}</i><p><strong>Diện tích xây dựng</strong><span>${esc(project.buildArea)}</span></p></div><div><i>${icons.cost}</i><p><strong>Chi phí xây dựng</strong><span>${esc(project.cost)}</span></p></div></div></section><h2>Mô tả công trình</h2><div class="project-article-copy"><p>${textHtml(project.content)}</p></div><nav class="project-detail-nav" aria-label="Chuyển công trình"><a href="${projectHref(previousProject, previous)}">← Công trình trước</a><a href="du-an.html">Tất cả công trình</a><a href="${projectHref(nextProject, next)}">Công trình tiếp theo →</a></nav></article><aside class="project-article-consult"><h3>Nhận tư vấn ngay</h3><form data-project-consult-form><input name="name" placeholder="Họ và tên (*)" required><input name="phone" inputmode="tel" placeholder="Số điện thoại (*)" required><input name="size" placeholder="Diện tích sàn & số tầng (*)"><textarea name="message" placeholder="Yêu cầu chi tiết nếu có"></textarea><button class="btn btn-gold" type="submit">GỬI YÊU CẦU</button></form></aside></div></div>`;
    const mainImage = detailHost.querySelector('.project-slider-main');
    detailHost.querySelectorAll('.project-slider-thumb').forEach((thumb, imageIndex) => thumb.addEventListener('click', () => {
      mainImage.src = project.images[imageIndex];
      mainImage.alt = `${project.title} – hình ${imageIndex + 1}`;
      detailHost.querySelectorAll('.project-slider-thumb').forEach(item => item.classList.remove('active'));
      thumb.classList.add('active');
    }));
    const projectConsultForm = detailHost.querySelector('[data-project-consult-form]');
    projectConsultForm?.addEventListener('submit', event => {
      event.preventDefault();
      const draft = Object.fromEntries(new FormData(projectConsultForm).entries());
      try { sessionStorage.setItem('vc-consult-draft', JSON.stringify(draft)); } catch {}
      location.href = 'lien-he.html';
    });
    return;
  }

  const grid = document.querySelector('.project-grid');
  const isProjectsPage = Boolean(grid && document.querySelector('.filterbar'));
  const isHomePage = Boolean(grid && !isProjectsPage);
  if (!grid) return;
  if (!projects.length) {
    grid.innerHTML = '<p>Chưa có dữ liệu công trình.</p>';
    return;
  }

  if (isHomePage && !isProjectsPage) {
    const homeCards = projects.map((project, index) => `<a class="project${index === 0 ? ' large' : ''}" href="${projectHref(project, index)}"><img src="${esc(project.images[0])}" alt="${esc(project.title)}"><div class="project-info"><small>${esc(project.category)}</small><h3 class="project-title">${esc(project.title)}</h3><p>${esc(project.description)}</p></div></a>`);
    grid.innerHTML = homeCards.join('');
    document.body.classList.add('home-project-page');
    const homePagination = document.createElement('nav');
    homePagination.className = 'project-pagination';
    homePagination.setAttribute('aria-label', 'Phân trang công trình trang chủ');
    grid.after(homePagination);
    const pageSize = 6;
    const totalPages = Math.ceil(homeCards.length / pageSize);
    const requestedPage = Number(new URLSearchParams(location.search).get('page')) || 1;
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    [...grid.querySelectorAll('.project')].forEach((card, index) => {
      card.style.display = index >= (page - 1) * pageSize && index < page * pageSize ? 'block' : 'none';
    });
    homePagination.innerHTML = Array.from({ length: totalPages }, (_, index) => `<a class="project-page${index + 1 === page ? ' active' : ''}" href="?page=${index + 1}" aria-label="Trang ${index + 1}">${index + 1}</a>`).join('');
    return;
  }

  grid.innerHTML = projects.map((project, index) => `<a class="project${index === 0 ? ' large' : ''}" href="${projectHref(project, index)}" data-index="${index}" data-project="${esc(project.type)}"><img src="${esc(project.images[0])}" alt="${esc(project.title)}"><div class="project-info"><small>${esc(project.category)}</small><h3 class="project-title">${esc(project.title)}</h3><p>${esc(project.description)}</p></div></a>`).join('');
  const filterbar = document.querySelector('.filterbar');
  if (filterbar) filterbar.innerHTML = '<label class="project-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Tìm kiếm công trình..." aria-label="Tìm kiếm công trình"></label><select class="project-select" aria-label="Loại công trình"><option value="">Tất cả</option><option value="nha-pho">Nhà phố</option><option value="nha-cap-4">Nhà cấp 4</option><option value="biet-thu">Biệt thự</option><option value="nha-vuon">Nhà vườn</option><option value="nha-chau-au">Nhà châu Âu</option><option value="nha-be-tong">Nhà bê tông đúc sẵn</option><option value="nha-lap-ghep">Nhà lắp ghép</option></select><div class="project-tabs"><button class="filter active" data-project-filter="">Tất cả</button><button class="filter" data-project-filter="nha-pho">Nhà phố</button><button class="filter" data-project-filter="nha-cap-4">Nhà cấp 4</button><button class="filter" data-project-filter="biet-thu">Biệt thự</button><button class="filter" data-project-filter="nha-vuon">Nhà vườn</button><button class="filter" data-project-filter="nha-chau-au">Nhà châu Âu</button><button class="filter" data-project-filter="nha-be-tong">Nhà bê tông đúc sẵn</button><button class="filter" data-project-filter="nha-lap-ghep">Nhà lắp ghép</button></div>';
  const search = filterbar?.querySelector('input');
  const typeSelect = filterbar?.querySelector('select');
  const cards = [...grid.querySelectorAll('.project')];
  const pagination = document.createElement('nav');
  pagination.className = 'project-pagination';
  pagination.setAttribute('aria-label', 'Phân trang công trình');
  grid.after(pagination);

  const render = (requestedPage = 1) => {
    const q = (search?.value || '').toLocaleLowerCase('vi');
    const type = typeSelect?.value || '';
    const matches = cards.filter(card => {
      const project = projects[Number(card.dataset.index)];
      const haystack = `${project.title} ${project.location} ${project.category}`.toLocaleLowerCase('vi');
      return (!type || project.type === type) && haystack.includes(q);
    });
    const pageSize = 12;
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    cards.forEach(card => { card.style.display = 'none'; });
    matches.slice((page - 1) * pageSize, page * pageSize).forEach(card => { card.style.display = 'block'; });
    pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => `<a class="project-page${index + 1 === page ? ' active' : ''}" href="?page=${index + 1}" aria-label="Trang ${index + 1}">${index + 1}</a>`).join('');
  };
  search?.addEventListener('input', () => render());
  typeSelect?.addEventListener('change', () => {
    filterbar?.querySelectorAll('[data-project-filter]').forEach(button => button.classList.toggle('active', button.dataset.projectFilter === typeSelect.value));
    render();
  });
  filterbar?.querySelectorAll('[data-project-filter]').forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.projectFilter;
    if (typeSelect) typeSelect.value = type;
    filterbar.querySelectorAll('[data-project-filter]').forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
  const initialPage = Number(new URLSearchParams(location.search).get('page')) || 1;
  render(initialPage);

  let modal;
  const close = () => {
    modal?.remove();
    modal = null;
    document.body.classList.remove('project-modal-open');
  };
  const openProject = startIndex => {
    let index = startIndex;
    const draw = () => {
      const project = projects[index];
      const previous = (index - 1 + projects.length) % projects.length;
      const next = (index + 1) % projects.length;
      const icons = ['⌖', '▥', '⌑', '▣', '₫'];
      modal.innerHTML = `<div class="project-modal-backdrop" data-close-project></div><section class="project-modal-panel project-detail-modal" role="dialog" aria-modal="true" aria-label="${esc(project.title)}"><button class="project-modal-close" type="button" aria-label="Đóng" data-close-project>×</button><header class="project-detail-modal-head"><small>${esc(project.category)}</small><h2>${esc(project.title)}</h2></header><div class="project-detail-modal-body"><section class="project-detail-slider"><img class="project-detail-main-image" src="${esc(project.images[0])}" alt="${esc(project.title)}"><div class="project-detail-thumbs">${project.images.map((src, imageIndex) => `<button class="project-detail-thumb${imageIndex === 0 ? ' active' : ''}" type="button"><img src="${esc(src)}" alt="${esc(project.title)} – hình ${imageIndex + 1}"></button>`).join('')}</div></section><section class="project-detail-facts"><header><b>Thông tin công trình</b><span>${esc(project.title)}</span></header><div>${[['Vị trí công trình', project.location], ['Số tầng', project.floors], ['Diện tích đất', project.area], ['Diện tích xây dựng', project.buildArea], ['Chi phí xây dựng', project.cost]].map((fact, factIndex) => `<div><i>${icons[factIndex]}</i><p><strong>${esc(fact[0])}</strong><span>${esc(fact[1])}</span></p></div>`).join('')}</div></section><section class="project-detail-description"><h3>Mô tả công trình</h3><p>${textHtml(project.content)}</p></section></div><footer class="project-detail-actions"><button type="button" data-project-nav="${previous}">← Công trình trước</button><a href="${projectHref(project, index)}">Xem bài chi tiết</a><button type="button" data-project-nav="${next}">Công trình tiếp theo →</button></footer></section>`;
      const mainImage = modal.querySelector('.project-detail-main-image');
      modal.querySelectorAll('.project-detail-thumb').forEach((thumb, imageIndex) => thumb.addEventListener('click', () => {
        mainImage.src = project.images[imageIndex];
        modal.querySelectorAll('.project-detail-thumb').forEach(item => item.classList.remove('active'));
        thumb.classList.add('active');
      }));
      modal.querySelectorAll('[data-close-project]').forEach(button => button.addEventListener('click', close));
      modal.querySelectorAll('[data-project-nav]').forEach(button => button.addEventListener('click', () => {
        index = Number(button.dataset.projectNav);
        draw();
      }));
    };
    modal = document.createElement('div');
    modal.className = 'project-modal';
    document.body.append(modal);
    document.body.classList.add('project-modal-open');
    draw();
  };
  cards.forEach(card => card.addEventListener('click', event => {
    // On the library page we keep the quick-view modal; the modal also links to the full article.
    event.preventDefault();
    openProject(Number(card.dataset.index));
  }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
});
