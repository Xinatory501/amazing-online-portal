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
      themeIcon.className  = 'fa-regular fa-sun';
      themeLabel.textContent = 'Светлая тема';
    } else {
      themeIcon.className  = 'fa-regular fa-moon';
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
    viewerEl.innerHTML = `
      <div class="viewer-inner">
        <div class="viewer-header">
          <div class="viewer-cat">${lec.category}</div>
          <h2 class="viewer-title">${lec.title}</h2>
          <p class="viewer-desc">${lec.description}</p>
        </div>
        <div class="viewer-actions">
          <button class="btn btn-primary" id="copy-btn">
            <i class="fa-regular fa-copy"></i> Скопировать текст
          </button>
        </div>
        <div>
          <textarea class="lecture-text-area" readonly id="lec-textarea">${lec.text}</textarea>
        </div>
      </div>
    `;
    document.getElementById('copy-btn').addEventListener('click', () => {
      copyText(document.getElementById('lec-textarea').value);
    });
  }

  // ── Search ────────────────────────────────
  searchInput.addEventListener('input', buildList);

  // ── Init ──────────────────────────────────
  buildCategories();
  buildList();

});
