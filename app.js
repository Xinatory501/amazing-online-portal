document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ─────────────────────────────
  const html          = document.documentElement;
  const themeBtn      = document.getElementById('theme-toggle');
  const themeIcon     = document.getElementById('theme-icon');
  const themeLabel    = document.getElementById('theme-label');

  const navItems      = document.querySelectorAll('.nav-item[data-tab]');
  const tabs          = document.querySelectorAll('.tab');
  const gotoLectures  = document.getElementById('goto-lectures');

  const searchInput   = document.getElementById('search-input');
  const filtersEl     = document.getElementById('category-filters');
  const listEl        = document.getElementById('lectures-list');
  const viewerEl      = document.getElementById('lecture-viewer');

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
        buildList();
      });
      filtersEl.appendChild(btn);
    });
  }

  // ── Lectures List ─────────────────────────
  function buildList() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const filtered = lecturesData.filter(l => {
      const catOk = activeCategory === 'Все' || l.category === activeCategory;
      const qOk = !q || l.title.toLowerCase().includes(q) || l.text.toLowerCase().includes(q);
      return catOk && qOk;
    });

    listEl.innerHTML = '';
    if (!filtered.length) {
      listEl.innerHTML = `<div style="padding:16px;font-size:13px;color:var(--text-muted)">Ничего не найдено</div>`;
      return;
    }

    filtered.forEach(lec => {
      const el = document.createElement('div');
      el.className = `lec-item ${lec.id === activeLecId ? 'active' : ''}`;
      el.innerHTML = `
        <div class="lec-item-cat">${lec.category}</div>
        <div class="lec-item-title">${lec.title}</div>
      `;
      el.addEventListener('click', () => {
        activeLecId = lec.id;
        document.querySelectorAll('.lec-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        renderViewer(lec);
      });
      listEl.appendChild(el);
    });
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
  searchInput.addEventListener('input', buildList);

  // ── Init ──────────────────────────────────
  buildCategories();
  buildList();

});
