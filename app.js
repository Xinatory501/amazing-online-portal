document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ─────────────────────────────
  const html          = document.documentElement;
  const themeBtn      = document.getElementById('theme-toggle');
  const themeIcon     = themeBtn.querySelector('i');
  const themeLabel    = themeBtn.querySelector('span');

  const navItems      = document.querySelectorAll('.nav-item[data-tab]');
  const tabs          = document.querySelectorAll('.tab');
  const gotoLectures  = document.getElementById('goto-lectures');

  // Lectures tab DOM refs
  const lecturesHeader = document.getElementById('lectures-dashboard-header');
  const searchInput    = document.getElementById('search-input');
  const filtersEl      = document.getElementById('category-filters');
  const gridEl         = document.getElementById('lectures-grid');
  const viewerEl       = document.getElementById('lecture-viewer');

  const toast         = document.getElementById('toast');
  const toastMsg      = document.getElementById('toast-msg');

  // ── State ─────────────────────────────────
  let activeCategory  = 'Все';
  let activeLecId     = null;
  let toastTimer      = null;
  let currentFontSize = parseInt(localStorage.getItem('reader-font-size')) || 18;

  // ── Theme ─────────────────────────────────
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  themeBtn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      themeIcon.className  = 'fa-solid fa-sun';
      themeLabel.textContent = 'Светлая тема';
    } else {
      themeIcon.className  = 'fa-solid fa-moon';
      themeLabel.textContent = 'Тёмная тема';
    }
  }

  // ── Tab navigation ─────────────────────────
  function switchTab(id) {
    navItems.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${id}`));
    
    // Reset reader view when leaving or entering the lectures tab
    if (id === 'lectures') {
      closeReader();
    }
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (gotoLectures) {
    gotoLectures.addEventListener('click', () => switchTab('lectures'));
  }

  // ── Toast ──────────────────────────────────
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Скопировано!'))
      .catch(() => showToast('Ошибка копирования'));
  }

  // ── Categories ────────────────────────────
  function buildCategories() {
    const cats = ['Все', ...new Set(lecturesData.map(l => l.category))];
    filtersEl.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${cat === activeCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeCategory = cat;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildGrid();
      });
      filtersEl.appendChild(btn);
    });
  }

  // ── Lectures Grid ─────────────────────────
  function buildGrid() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const filtered = lecturesData.filter(l => {
      const catOk = activeCategory === 'Все' || l.category === activeCategory;
      const qOk = !q || l.title.toLowerCase().includes(q) || l.text.toLowerCase().includes(q);
      return catOk && qOk;
    });

    gridEl.innerHTML = '';
    if (!filtered.length) {
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; min-height: 250px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>Ничего не найдено. Попробуйте изменить запрос.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(lec => {
      const card = document.createElement('div');
      card.className = 'card card-action';
      card.innerHTML = `
        <div class="lec-item-cat" style="color: var(--accent); margin-bottom: 8px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em;">
          ${lec.category}
        </div>
        <h3 style="font-size: 20px; margin-bottom: 12px; font-family: 'DM Serif Display', serif;">
          ${lec.title}
        </h3>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 16px;">
          ${lec.description}
        </p>
        <span class="card-cta" style="font-size: 13px; font-weight: 500; color: var(--accent); display: inline-flex; align-items: center; gap: 6px; margin-top: auto;">
          Читать лекцию <i class="fa-solid fa-arrow-right"></i>
        </span>
      `;
      
      card.addEventListener('click', () => {
        activeLecId = lec.id;
        openReader(lec);
      });
      gridEl.appendChild(card);
    });
  }

  // ── Reader View Toggle ────────────────────
  function openReader(lec) {
    // Hide grid elements
    lecturesHeader.style.display = 'none';
    filtersEl.style.display = 'none';
    gridEl.style.display = 'none';

    // Show viewer
    viewerEl.classList.remove('hidden');
    renderViewer(lec);
  }

  function closeReader() {
    activeLecId = null;
    
    // Hide viewer
    viewerEl.classList.add('hidden');
    viewerEl.innerHTML = '';

    // Show grid elements
    lecturesHeader.style.display = 'flex';
    filtersEl.style.display = 'flex';
    gridEl.style.display = 'grid';
    
    buildGrid(); // Re-render grid to reflect search/filter state
  }

  // ── Lecture Viewer ─────────────────────────
  function renderViewer(lec) {
    const paragraphsHtml = lec.text.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p class="reader-para">${p}</p>`)
      .join('');

    viewerEl.innerHTML = `
      <div class="viewer-inner">
        <button class="btn btn-secondary btn-back" id="back-to-grid-btn">
          <i class="fa-solid fa-arrow-left"></i> Назад к списку
        </button>

        <div class="viewer-header">
          <div class="viewer-cat">${lec.category}</div>
          <h2 class="viewer-title">${lec.title}</h2>
          <p class="viewer-desc">${lec.description}</p>
        </div>

        <div class="viewer-actions">
          <button class="btn btn-primary" id="copy-btn">
            <i class="fa-solid fa-copy"></i> Скопировать весь текст
          </button>
          
          <div class="font-controls">
            <button class="btn btn-secondary btn-icon" id="font-decrease" title="Уменьшить шрифт">
              <i class="fa-solid fa-minus"></i>
            </button>
            <span class="font-label">А</span>
            <button class="btn btn-secondary btn-icon" id="font-increase" title="Увеличить шрифт">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>

          <span class="reader-hint">
            <i class="fa-solid fa-circle-info"></i> Кликните на абзац, чтобы выделить его при чтении
          </span>
        </div>

        <div class="lecture-reader-body" id="reader-body" style="font-size: ${currentFontSize}px;">
          ${paragraphsHtml}
        </div>
      </div>
    `;

    // Back event
    document.getElementById('back-to-grid-btn').addEventListener('click', closeReader);

    // Copy event
    document.getElementById('copy-btn').addEventListener('click', () => {
      copyText(lec.text);
    });

    // Font size controls
    const readerBody = document.getElementById('reader-body');
    
    document.getElementById('font-increase').addEventListener('click', () => {
      if (currentFontSize < 32) {
        currentFontSize += 2;
        readerBody.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('reader-font-size', currentFontSize);
      }
    });

    document.getElementById('font-decrease').addEventListener('click', () => {
      if (currentFontSize > 14) {
        currentFontSize -= 2;
        readerBody.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('reader-font-size', currentFontSize);
      }
    });

    // Click to highlight paragraph
    const paras = readerBody.querySelectorAll('.reader-para');
    paras.forEach(para => {
      para.addEventListener('click', () => {
        const wasActive = para.classList.contains('active-para');
        paras.forEach(p => p.classList.remove('active-para'));
        if (!wasActive) {
          para.classList.add('active-para');
        }
      });
    });
  }

  // ── Search ────────────────────────────────
  searchInput.addEventListener('input', buildGrid);

  // ── Init ──────────────────────────────────
  buildCategories();
  buildGrid();

});
