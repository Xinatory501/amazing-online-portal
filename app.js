document.addEventListener('DOMContentLoaded', () => {
  // ── State ──────────────────────────────────
  let activeCategory = 'Все';
  let activeLecId = null;
  let currentFontSize = parseInt(localStorage.getItem('reader-font-size')) || 18;

  // ── DOM refs ──────────────────────────────
  const navItems        = document.querySelectorAll('.nav-item');
  const tabs            = document.querySelectorAll('.tab');
  const filtersEl       = document.getElementById('category-filters');
  const gridEl          = document.getElementById('lectures-grid');
  const searchInput     = document.getElementById('search-input');
  const viewerEl        = document.getElementById('lecture-viewer');

  const lecturesHeader  = document.getElementById('lectures-dashboard-header');
  const gotoLectures    = document.getElementById('goto-lectures');
  const gotoHints       = document.getElementById('goto-hints');
  const gotoLaws        = document.getElementById('goto-laws');
  const gotoInstructions = document.getElementById('goto-instructions');

  const themeToggleBtn  = document.getElementById('theme-toggle');
  const themeIcon       = document.getElementById('theme-icon');
  const themeLabel      = document.getElementById('theme-label');
  const toast           = document.getElementById('toast');
  const toastMsg        = document.getElementById('toast-msg');
  let toastTimer        = null;

  // ── Theme ──────────────────────────────────
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const isDark = theme === 'dark';
    if (themeIcon) themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (themeLabel) themeLabel.textContent = isDark ? 'Светлая тема' : 'Тёмная тема';

    const mobileBtn = document.getElementById('mobile-theme-toggle');
    if (mobileBtn) {
      const mobileIcon = mobileBtn.querySelector('i');
      if (mobileIcon) mobileIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  const mobileToggleBtn = document.getElementById('mobile-theme-toggle');
  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
      const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  // ── Hints DOM refs ──────────────────────────
  const hintsHeader            = document.getElementById('hints-dashboard-header');
  const hintsGrid              = document.getElementById('hints-grid');
  const hintViewer             = document.getElementById('hint-viewer');
  const hintZhukovCard         = document.getElementById('hint-zhukov-card');
  const hintPravitelstvoCard   = document.getElementById('hint-pravitelstvo-card');
  const backFromHintBtn        = document.getElementById('back-from-hint-btn');
  const backFromHintBtnBottom  = document.getElementById('back-from-hint-btn-bottom');
  const hintImgElement         = document.getElementById('hint-img-element');
  const downloadHintBtn        = document.getElementById('download-hint-btn');

  let currentHintFile = 'f1_help_overlay.png';

  // ── Laws DOM refs ───────────────────────────
  const lawsHeader       = document.getElementById('laws-dashboard-header');
  const lawSearchInput   = document.getElementById('law-search-input');
  const lawFiltersEl     = document.getElementById('law-category-filters');
  const lawsGridEl       = document.getElementById('laws-grid');
  const lawViewerEl      = document.getElementById('law-viewer');

  let activeLawCategory  = 'Все';
  let activeLawId        = null;

  // ── Instructions DOM refs ───────────────────
  const instructionsHeader      = document.getElementById('instructions-dashboard-header');
  const instructionSearchInput  = document.getElementById('instruction-search-input');
  const instructionFiltersEl    = document.getElementById('instruction-category-filters');
  const instructionsGridEl      = document.getElementById('instructions-grid');
  const instructionViewerEl    = document.getElementById('instruction-viewer');

  let activeInstructionCategory = 'Все';
  let activeInstructionId       = null;

  // ── Tab Navigation ─────────────────────────
  function switchTab(id) {
    navItems.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${id}`));
    
    // Reset views when switching tabs or going home
    if (id === 'lectures' || id === 'home') closeReader();
    if (id === 'hints' || id === 'home') closeHintViewer();
    if (id === 'laws' || id === 'home') closeLawReader();
    if (id === 'instructions' || id === 'home') closeInstructionViewer();
    if (id === 'wishes') loadUserWishes();
    if (id === 'admin') loadAdminData();
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (gotoLectures) gotoLectures.addEventListener('click', () => switchTab('lectures'));
  if (gotoHints) gotoHints.addEventListener('click', () => switchTab('hints'));
  if (gotoLaws) gotoLaws.addEventListener('click', () => switchTab('laws'));
  if (gotoInstructions) gotoInstructions.addEventListener('click', () => switchTab('instructions'));

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-back-home');
    if (btn) {
      switchTab('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ── Toast & Copy ───────────────────────────
  function showToast(msg) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // ── Search & Highlighting Helpers ──────────
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeSearchQuery(query) {
    if (!query || !query.trim()) return '';
    return query.trim().toLowerCase()
      .replace(/\bгл\.?\b|\bглава\b/gi, 'глава')
      .replace(/\bст\.?\b|\bстатья\b/gi, 'статья')
      .replace(/\bп\.?\b|\bпункт\b/gi, 'пункт')
      .replace(/(\d+)[\.,\s\-]+(\d+)/g, '$1.$2');
  }

  function buildSearchRegex(query) {
    if (!query || !query.trim()) return null;
    const q = normalizeSearchQuery(query);
    if (!q) return null;

    const patterns = [];

    // Combination: "глава 1 статья 1"
    const chArtMatch = q.match(/глава\s*(\d+)\s*статья\s*(\d+(?:\.\d+)?)/);
    if (chArtMatch) {
      patterns.push(`(?:глава|гл)[\\s\\.,\\-]*${chArtMatch[1]}`);
      patterns.push(`(?:статья|ст)[\\s\\.,\\-]*${chArtMatch[2]}`);
    } else {
      const chMatch = q.match(/глава\s*(\d+)/);
      if (chMatch) patterns.push(`(?:глава|гл)[\\s\\.,\\-]*${chMatch[1]}`);

      const artMatch = q.match(/статья\s*(\d+(?:\.\d+)?)/);
      if (artMatch) {
        const artNum = artMatch[1];
        if (artNum.includes('.')) {
          const [n1, n2] = artNum.split('.');
          patterns.push(`(?:статья|ст)?[\\s\\.,\\-]*${n1}[\\.,\\s\\-]+${n2}`);
        } else {
          patterns.push(`(?:статья|ст)[\\s\\.,\\-]*${artNum}`);
        }
      } else {
        const dotNums = q.match(/\d+\.\d+/g);
        if (dotNums) {
          dotNums.forEach(dn => {
            const [n1, n2] = dn.split('.');
            patterns.push(`(?:статья|ст)?[\\s\\.,\\-]*${n1}[\\.,\\s\\-]+${n2}`);
          });
        }
      }
    }

    const words = q.split(/\s+/).filter(w => w.length >= 2 && !['глава', 'статья', 'пункт'].includes(w));
    words.forEach(w => {
      if (!/^\d+(\.\d+)?$/.test(w)) {
        patterns.push(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
    });

    if (!patterns.length) {
      patterns.push(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }

    try {
      return new RegExp(`(${patterns.join('|')})`, 'gi');
    } catch (e) {
      return null;
    }
  }

  function matchesQuery(content, searchQuery) {
    if (!searchQuery || !searchQuery.trim()) return true;
    const rx = buildSearchRegex(searchQuery);
    if (rx && rx.test(content)) return true;
    return content.toLowerCase().includes(searchQuery.trim().toLowerCase());
  }

  function isLawMatch(law, searchQuery) {
    if (!searchQuery || !searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();

    const artMatch = q.match(/(?:статья|ст\.?|ст)\s*(\d+(?:\.\d+)?)/i) || q.match(/(\d+(?:\.\d+)?)\s*(?:статья|ст\.?|ст)/i);
    const chMatch = q.match(/(?:глава|гл\.?|гл)\s*(\d+)/i) || q.match(/(\d+)\s*(?:глава|гл\.?|гл)/i);

    const chNum = chMatch ? chMatch[1] : null;
    const artNum = artMatch ? artMatch[1] : null;

    if (!chNum && !artNum) return true;

    const lines = law.text.split('\n').map(s => s.trim()).filter(Boolean);
    const items = [];
    let curCh = null;

    lines.forEach(l => {
      const cM = l.match(/^Глава\s+(\d+)/i);
      if (cM) {
        curCh = cM[1];
        items.push({ type: 'chapter', chapter: curCh });
      }
      const aM = l.match(/^(?:Статья\s*(\d+(?:\.\d+)?)|(\d+\.\d+))/i);
      if (aM) {
        const aNum = aM[1] || aM[2];
        items.push({ type: 'article', chapter: curCh, article: aNum });
      }
    });

    if (chNum && artNum) {
      const hasArtInCh = items.some(i => i.type === 'article' && i.chapter === chNum && (i.article === artNum || i.article === `${chNum}.${artNum}` || i.article.endsWith('.' + artNum)));
      if (!hasArtInCh) return false;
    }
    else if (chNum && !artNum) {
      const hasCh = items.some(i => i.type === 'chapter' && i.chapter === chNum);
      if (!hasCh) return false;
    }
    else if (artNum && !chNum) {
      const hasArt = items.some(i => i.type === 'article' && (i.article === artNum || i.article.endsWith('.' + artNum) || i.article.startsWith(artNum + '.')));
      if (!hasArt) return false;
    }

    return true;
  }

  function highlightText(text, searchQuery) {
    const escaped = escapeHtml(text);
    if (!searchQuery || !searchQuery.trim()) return escaped;
    const rx = buildSearchRegex(searchQuery);
    if (!rx) return escaped;
    return escaped.replace(rx, '<mark class="search-highlight">$1</mark>');
  }

  // ── LECTURES SECTION ───────────────────────
  function buildCategories() {
    if (!filtersEl || typeof lecturesData === 'undefined') return;
    const cats = ['Все', ...new Set(lecturesData.map(l => l.category))];
    filtersEl.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${cat === activeCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeCategory = cat;
        document.querySelectorAll('#category-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildGrid();
      });
      filtersEl.appendChild(btn);
    });
  }

  function buildGrid() {
    if (!gridEl || typeof lecturesData === 'undefined') return;
    const rawQ = (searchInput ? searchInput.value || '' : '').trim();
    const filtered = lecturesData.filter(l => {
      const catOk = activeCategory === 'Все' || l.category === activeCategory;
      const qOk = matchesQuery(l.title + ' ' + l.description + ' ' + l.text, rawQ);
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
        openReader(lec, rawQ);
      });
      gridEl.appendChild(card);
    });
  }

  function openReader(lec, searchQuery = '') {
    if (!lecturesHeader || !filtersEl || !gridEl || !viewerEl) return;
    lecturesHeader.style.display = 'none';
    filtersEl.style.display = 'none';
    gridEl.style.display = 'none';
    viewerEl.classList.remove('hidden');
    renderViewer(lec, searchQuery);
  }

  function closeReader() {
    activeLecId = null;
    if (!lecturesHeader || !filtersEl || !gridEl || !viewerEl) return;
    viewerEl.classList.add('hidden');
    viewerEl.innerHTML = '';
    lecturesHeader.style.display = 'flex';
    filtersEl.style.display = 'flex';
    gridEl.style.display = 'grid';
    buildGrid();
  }

  function renderViewer(lec, searchQuery = '') {
    const paragraphsHtml = lec.text.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p class="reader-para">${highlightText(p, searchQuery)}</p>`)
      .join('');

    const searchBadgeHtml = searchQuery.trim() ? `
      <div class="search-badge">
        <i class="fa-solid fa-magnifying-glass"></i> Найдено по запросу: "${escapeHtml(searchQuery.trim())}"
      </div>
    ` : '';

    viewerEl.innerHTML = `
      <div class="viewer-inner">
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px;">
          <button class="btn btn-secondary" id="back-to-grid-btn">
            <i class="fa-solid fa-arrow-left"></i> Назад к списку
          </button>
          <button class="btn btn-secondary btn-back-home">
            <i class="fa-solid fa-house"></i> В главное меню
          </button>
        </div>

        <div class="viewer-header">
          <div class="viewer-cat">${lec.category}</div>
          <h2 class="viewer-title">${lec.title}</h2>
          <p class="viewer-desc">${lec.description}</p>
          ${searchBadgeHtml}
        </div>

        <div class="viewer-actions">
          <div class="font-controls">
            <button class="btn btn-secondary btn-icon" id="font-decrease" title="Уменьшить шрифт">
              <i class="fa-solid fa-minus"></i>
            </button>
            <span class="font-label">А</span>
            <button class="btn btn-secondary btn-icon" id="font-increase" title="Увеличить шрифт">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>

        <div class="lecture-reader-body" id="reader-body" style="font-size: ${currentFontSize}px;">
          ${paragraphsHtml}
        </div>

        <div class="copyright-notice">
          <i class="fa-solid fa-shield-halved"></i>
          <p>© Все материалы данного раздела охраняются законом об интеллектуальной собственности и авторском праве. Категорически запрещено любое копирование, брание без спроса или использование материалов. Авторство принадлежит <strong>Savely_Gerov</strong> (бывшему главе администрации ЮР).</p>
        </div>

        <div class="viewer-footer">
          <button class="btn btn-secondary btn-back" id="back-to-grid-btn-bottom">
            <i class="fa-solid fa-arrow-left"></i> Назад к списку
          </button>
        </div>
      </div>
    `;

    document.getElementById('back-to-grid-btn').addEventListener('click', closeReader);
    document.getElementById('back-to-grid-btn-bottom').addEventListener('click', closeReader);

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

    readerBody.addEventListener('copy', (e) => e.preventDefault());
    readerBody.addEventListener('contextmenu', (e) => e.preventDefault());
    readerBody.addEventListener('selectstart', (e) => e.preventDefault());

    if (searchQuery.trim()) {
      setTimeout(() => {
        const firstMatch = readerBody.querySelector('.search-highlight');
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', buildGrid);
  }

  // ── HINTS SECTION ─────────────────────────
  function openHintViewer(type) {
    if (!hintsHeader || !hintsGrid || !hintViewer) return;
    
    const viewerCat = hintViewer.querySelector('.viewer-cat');
    const viewerTitle = hintViewer.querySelector('.viewer-title');
    const copyrightP = hintViewer.querySelector('.copyright-notice p');
    
    if (type === 'pravitelstvo') {
      currentHintFile = 'assets/images/f1_help_overlay_pravitelstvo.png';
      if (viewerCat) viewerCat.textContent = 'Разработчик: Андрей Морозов';
      if (viewerTitle) viewerTitle.textContent = 'Подсказка Морозова';
      if (hintImgElement) {
        hintImgElement.src = 'assets/images/f1_help_overlay_pravitelstvo.png';
        hintImgElement.alt = 'Подсказка Морозова (кликните для скачивания)';
      }
      if (downloadHintBtn) {
        downloadHintBtn.href = 'assets/images/f1_help_overlay_pravitelstvo.png';
        downloadHintBtn.download = 'f1_help_overlay_pravitelstvo.png';
      }
      if (copyrightP) {
        copyrightP.innerHTML = '© Данный справочный оверлей разработан <strong>Андреем Морозовым</strong>. Опубликован на портале для быстрого скачивания и использования.';
      }
    } else {
      currentHintFile = 'f1_help_overlay.png';
      if (viewerCat) viewerCat.textContent = 'Разработчик: Жуков';
      if (viewerTitle) viewerTitle.textContent = 'Подсказка Жукова';
      if (hintImgElement) {
        hintImgElement.src = 'f1_help_overlay.png';
        hintImgElement.alt = 'Подсказка Жукова (кликните для скачивания)';
      }
      if (downloadHintBtn) {
        downloadHintBtn.href = 'f1_help_overlay.png';
        downloadHintBtn.download = 'f1_help_overlay.png';
      }
      if (copyrightP) {
        copyrightP.innerHTML = '© Данная подсказка разработана <strong>Жуковым</strong> (ZHUKOV - X). Материал опубликован на портале для быстрого скачивания и использования.';
      }
    }

    hintsHeader.style.display = 'none';
    hintsGrid.style.display = 'none';
    hintViewer.classList.remove('hidden');
  }

  function closeHintViewer() {
    if (!hintsHeader || !hintsGrid || !hintViewer) return;
    hintsHeader.style.display = 'flex';
    hintsGrid.style.display = 'grid';
    hintViewer.classList.add('hidden');
    if (hintImgElement) hintImgElement.classList.remove('zoomed');
  }

  if (hintZhukovCard) hintZhukovCard.addEventListener('click', () => openHintViewer('zhukov'));
  if (hintPravitelstvoCard) hintPravitelstvoCard.addEventListener('click', () => openHintViewer('pravitelstvo'));
  if (backFromHintBtn) backFromHintBtn.addEventListener('click', closeHintViewer);
  if (backFromHintBtnBottom) backFromHintBtnBottom.addEventListener('click', closeHintViewer);
  if (hintImgElement) {
    hintImgElement.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = currentHintFile;
      link.download = currentHintFile.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // ── LAWS SECTION ──────────────────────────
  function buildLawCategories() {
    if (!lawFiltersEl || typeof lawsData === 'undefined') return;
    const cats = ['Все', ...new Set(lawsData.map(l => l.category))];
    lawFiltersEl.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${cat === activeLawCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeLawCategory = cat;
        document.querySelectorAll('#law-category-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildLawsGrid();
      });
      lawFiltersEl.appendChild(btn);
    });
  }

  function buildLawsGrid() {
    if (!lawsGridEl || typeof lawsData === 'undefined') return;
    const rawQ = (lawSearchInput ? lawSearchInput.value || '' : '').trim();
    const filtered = lawsData.filter(l => {
      const catOk = activeLawCategory === 'Все' || l.category === activeLawCategory;
      const matchOk = isLawMatch(l, rawQ);
      const qOk = matchesQuery(l.title + ' ' + l.description + ' ' + l.text, rawQ);
      return catOk && matchOk && qOk;
    });

    lawsGridEl.innerHTML = '';
    if (!filtered.length) {
      lawsGridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; min-height: 250px;">
          <i class="fa-solid fa-scale-balanced"></i>
          <p>По вашему запросу нормативных актов не найдено.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(law => {
      const card = document.createElement('div');
      card.className = 'card card-action';
      card.innerHTML = `
        <div class="lec-item-cat" style="color: var(--accent); margin-bottom: 8px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em;">
          ${law.category}
        </div>
        <h3 style="font-size: 20px; margin-bottom: 12px; font-family: 'DM Serif Display', serif;">
          ${law.title}
        </h3>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 16px;">
          ${law.description}
        </p>
        <span class="card-cta" style="font-size: 13px; font-weight: 500; color: var(--accent); display: inline-flex; align-items: center; gap: 6px; margin-top: auto;">
          Читать закон <i class="fa-solid fa-arrow-right"></i>
        </span>
      `;
      card.addEventListener('click', () => {
        activeLawId = law.id;
        openLawReader(law, rawQ);
      });
      lawsGridEl.appendChild(card);
    });
  }

  function openLawReader(law, searchQuery = '') {
    if (!lawsHeader || !lawFiltersEl || !lawsGridEl || !lawViewerEl) return;
    window.scrollTo(0, 0);
    lawsHeader.style.display = 'none';
    lawFiltersEl.style.display = 'none';
    lawsGridEl.style.display = 'none';
    lawViewerEl.classList.remove('hidden');
    renderLawViewer(law, searchQuery);
  }

  function closeLawReader() {
    activeLawId = null;
    if (!lawsHeader || !lawFiltersEl || !lawsGridEl || !lawViewerEl) return;
    lawViewerEl.classList.add('hidden');
    lawViewerEl.innerHTML = '';
    lawsHeader.style.display = 'flex';
    lawFiltersEl.style.display = 'flex';
    lawsGridEl.style.display = 'grid';
    buildLawsGrid();
  }

  function formatLawContent(text, searchQuery) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    let html = '';
    let currentBoxLines = [];

    function flushBox() {
      if (currentBoxLines.length > 0) {
        const boxText = currentBoxLines.join('\n');
        const hasSearchMatch = searchQuery.trim() && matchesQuery(boxText, searchQuery);
        
        let artAttr = '';
        const firstLine = currentBoxLines[0] || '';
        const artMatch = firstLine.match(/^(?:Статья\s*(\d+(?:\.\d+)?)|(\d+\.\d+))/i);
        if (artMatch) {
          artAttr = ` data-article="${artMatch[1] || artMatch[2]}"`;
        }

        const boxParagraphs = currentBoxLines
          .map((p, idx) => {
            const highlighted = highlightText(p, searchQuery);
            if (idx === 0 && (p.startsWith('Статья') || /^\d+\.\d+/.test(p))) {
              return `<div class="law-box-title">${highlighted}</div>`;
            }
            return `<div class="law-box-text">${highlighted}</div>`;
          })
          .join('');

        const activeClass = hasSearchMatch ? ' search-matched-box' : '';
        html += `<div class="law-article-box${activeClass}"${artAttr}>${boxParagraphs}</div>`;
        currentBoxLines = [];
      }
    }

    lines.forEach(line => {
      const chMatch = line.match(/^Глава\s+(\d+)/i);
      if (chMatch) {
        flushBox();
        const chNum = chMatch[1];
        const highlightedCh = highlightText(line, searchQuery);
        html += `
          <div class="law-chapter-header" data-chapter="${chNum}">
            <i class="fa-solid fa-bookmark"></i>
            <span>${highlightedCh}</span>
          </div>
        `;
      } 
      else if (/^(Статья\s+\d+|Статья\s+[\d\.]+|\d+\.\d+)/i.test(line)) {
        flushBox();
        currentBoxLines.push(line);
      } 
      else {
        currentBoxLines.push(line);
      }
    });

    flushBox();
    return html;
  }

  function renderLawViewer(law, searchQuery = '') {
    const paragraphsHtml = formatLawContent(law.text, searchQuery);

    const searchBadgeHtml = searchQuery.trim() ? `
      <div class="search-badge">
        <i class="fa-solid fa-magnifying-glass"></i> Найдено по запросу: "${escapeHtml(searchQuery.trim())}"
      </div>
    ` : '';

    lawViewerEl.innerHTML = `
      <div class="viewer-inner">
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px;">
          <button class="btn btn-secondary" id="back-to-laws-btn">
            <i class="fa-solid fa-arrow-left"></i> Назад к законам
          </button>
          <button class="btn btn-secondary btn-back-home">
            <i class="fa-solid fa-house"></i> В главное меню
          </button>
        </div>

        <div class="viewer-header">
          <div class="viewer-cat">${law.category}</div>
          <h2 class="viewer-title">${law.title}</h2>
          <p class="viewer-desc">${law.description}</p>
          ${searchBadgeHtml}
        </div>

        <div class="viewer-actions">
          <div class="font-controls">
            <button class="btn btn-secondary btn-icon" id="law-font-decrease" title="Уменьшить шрифт">
              <i class="fa-solid fa-minus"></i>
            </button>
            <span class="font-label">А</span>
            <button class="btn btn-secondary btn-icon" id="law-font-increase" title="Увеличить шрифт">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>

        <div class="lecture-reader-body" id="law-reader-body" style="font-size: ${currentFontSize}px;">
          ${paragraphsHtml}
        </div>

        <div class="copyright-notice">
          <i class="fa-solid fa-shield-halved"></i>
          <p>© Все законодательные и нормативно-правовые акты Нижегородской области. Опубликовано на портале <strong>Savely_Gerov</strong> (бывшего главы администрации ЮР).</p>
        </div>

        <div class="viewer-footer">
          <button class="btn btn-secondary btn-back" id="back-to-laws-btn-bottom">
            <i class="fa-solid fa-arrow-left"></i> Назад к законам
          </button>
        </div>
      </div>
    `;

    document.getElementById('back-to-laws-btn').addEventListener('click', closeLawReader);
    document.getElementById('back-to-laws-btn-bottom').addEventListener('click', closeLawReader);

    // Smooth scroll and pulse highlight targeted article or chapter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      
      const artMatch = q.match(/(?:статья|ст\.?|ст)\s*(\d+(?:\.\d+)?)/i) || q.match(/(\d+(?:\.\d+)?)\s*(?:статья|ст\.?|ст)/i);
      const chMatch = q.match(/(?:глава|гл\.?|гл)\s*(\d+)/i) || q.match(/(\d+)\s*(?:глава|гл\.?|гл)/i);

      const chNum = chMatch ? chMatch[1] : null;
      const artNum = artMatch ? artMatch[1] : null;
      
      let targetEl = null;

      // Case A: Both chapter & article specified
      if (chNum && artNum) {
        const chHeader = lawViewerEl.querySelector(`.law-chapter-header[data-chapter="${chNum}"]`);
        if (chHeader) {
          let curr = chHeader.nextElementSibling;
          while (curr && !curr.classList.contains('law-chapter-header')) {
            const elArt = curr.getAttribute('data-article');
            if (elArt === artNum || elArt === `${chNum}.${artNum}` || (elArt && (elArt.endsWith('.' + artNum) || elArt.startsWith(artNum + '.')))) {
              targetEl = curr;
              break;
            }
            curr = curr.nextElementSibling;
          }
          // If the requested article does not exist in this chapter, strictly target this chapter header
          if (!targetEl) {
            targetEl = chHeader;
          }
        }
      }

      // Case B: Only article specified (no chapter specified)
      if (!targetEl && artNum && !chNum) {
        targetEl = lawViewerEl.querySelector(`.law-article-box[data-article="${artNum}"]`);
        if (!targetEl) {
          const allArtBoxes = Array.from(lawViewerEl.querySelectorAll('.law-article-box'));
          targetEl = allArtBoxes.find(el => {
            const a = el.getAttribute('data-article');
            return a && (a.endsWith('.' + artNum) || a.startsWith(artNum + '.'));
          }) || null;
        }
      }

      // Case C: Only chapter specified
      if (!targetEl && chNum) {
        targetEl = lawViewerEl.querySelector(`.law-chapter-header[data-chapter="${chNum}"]`);
      }

      // Case D: Fallback to first search-matched box
      if (!targetEl) {
        targetEl = lawViewerEl.querySelector('.search-matched-box');
      }

      if (targetEl) {
        lawViewerEl.querySelectorAll('.pulse-target').forEach(el => el.classList.remove('pulse-target'));
        targetEl.classList.add('pulse-target');
        
        requestAnimationFrame(() => {
          setTimeout(() => {
            let top = 0;
            let el = targetEl;
            while (el) {
              top += el.offsetTop || 0;
              el = el.offsetParent;
            }
            const targetY = Math.max(0, top - 120);
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          }, 100);
        });
      }
    }

    const lawReaderBody = document.getElementById('law-reader-body');

    document.getElementById('law-font-increase').addEventListener('click', () => {
      if (currentFontSize < 32) {
        currentFontSize += 2;
        lawReaderBody.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('reader-font-size', currentFontSize);
      }
    });

    document.getElementById('law-font-decrease').addEventListener('click', () => {
      if (currentFontSize > 14) {
        currentFontSize -= 2;
        lawReaderBody.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('reader-font-size', currentFontSize);
      }
    });

    lawReaderBody.addEventListener('copy', (e) => e.preventDefault());
    lawReaderBody.addEventListener('contextmenu', (e) => e.preventDefault());
    lawReaderBody.addEventListener('selectstart', (e) => e.preventDefault());

    if (searchQuery.trim()) {
      setTimeout(() => {
        const firstMatch = lawReaderBody.querySelector('.search-highlight');
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }

  if (lawSearchInput) {
    lawSearchInput.addEventListener('input', buildLawsGrid);
  }

  // ── INSTRUCTIONS SECTION ────────────────────
  function buildInstructionCategories() {
    if (!instructionFiltersEl || typeof instructionsData === 'undefined') return;
    const cats = ['Все', ...new Set(instructionsData.map(i => i.category))];
    instructionFiltersEl.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${cat === activeInstructionCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeInstructionCategory = cat;
        document.querySelectorAll('#instruction-category-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildInstructionsGrid();
      });
      instructionFiltersEl.appendChild(btn);
    });
  }

  function buildInstructionsGrid() {
    if (!instructionsGridEl || typeof instructionsData === 'undefined') return;
    const rawQ = (instructionSearchInput ? instructionSearchInput.value || '' : '').trim();
    const filtered = instructionsData.filter(inst => {
      const catOk = activeInstructionCategory === 'Все' || inst.category === activeInstructionCategory;
      const fullText = inst.title + ' ' + inst.description + ' ' + (inst.sections ? inst.sections.map(s => s.subtitle + ' ' + s.text).join(' ') : '');
      const qOk = matchesQuery(fullText, rawQ);
      return catOk && qOk;
    });

    instructionsGridEl.innerHTML = '';
    if (!filtered.length) {
      instructionsGridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; min-height: 250px;">
          <i class="fa-solid fa-clipboard-list"></i>
          <p>По вашему запросу инструкций не найдено.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(inst => {
      const card = document.createElement('div');
      card.className = 'card card-action';
      card.innerHTML = `
        <div class="lec-item-cat" style="color: var(--accent); margin-bottom: 8px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em;">
          ${inst.category}
        </div>
        <h3 style="font-size: 20px; margin-bottom: 12px; font-family: 'DM Serif Display', serif;">
          ${inst.title}
        </h3>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 16px;">
          ${inst.description}
        </p>
        <span class="card-cta" style="font-size: 13px; font-weight: 500; color: var(--accent); display: inline-flex; align-items: center; gap: 6px; margin-top: auto;">
          Открыть инструкцию <i class="fa-solid fa-arrow-right"></i>
        </span>
      `;
      card.addEventListener('click', () => {
        activeInstructionId = inst.id;
        openInstructionReader(inst, rawQ);
      });
      instructionsGridEl.appendChild(card);
    });
  }

  function openInstructionReader(inst, searchQuery = '') {
    if (!instructionsHeader || !instructionFiltersEl || !instructionsGridEl || !instructionViewerEl) return;
    instructionsHeader.style.display = 'none';
    instructionFiltersEl.style.display = 'none';
    instructionsGridEl.style.display = 'none';
    instructionViewerEl.classList.remove('hidden');
    renderInstructionViewer(inst, searchQuery);
  }

  function closeInstructionViewer() {
    activeInstructionId = null;
    if (!instructionsHeader || !instructionFiltersEl || !instructionsGridEl || !instructionViewerEl) return;
    instructionViewerEl.classList.add('hidden');
    instructionViewerEl.innerHTML = '';
    instructionsHeader.style.display = 'flex';
    instructionFiltersEl.style.display = 'flex';
    instructionsGridEl.style.display = 'grid';
    buildInstructionsGrid();
  }

  function renderInstructionViewer(inst, searchQuery = '') {
    let sectionsHtml = '';
    if (inst.sections && inst.sections.length) {
      sectionsHtml = inst.sections.map(sec => {
        let imgsHtml = '';
        if (sec.images && sec.images.length) {
          imgsHtml = `
            <div class="instruction-gallery">
              ${sec.images.map(img => `
                <div class="instruction-img-card">
                  <img src="${img.url}" alt="${escapeHtml(img.title)}" class="instruction-img" onclick="this.classList.toggle('zoomed')">
                  <div class="instruction-img-title">${escapeHtml(img.title)}</div>
                </div>
              `).join('')}
            </div>
          `;
        }

        const subtitleH = highlightText(sec.subtitle, searchQuery);
        const textH = highlightText(sec.text, searchQuery);
        const hasSearchMatch = searchQuery.trim() && matchesQuery(sec.subtitle + ' ' + sec.text, searchQuery);

        return `
          <div class="law-article-box ${hasSearchMatch ? 'search-matched-box' : ''}">
            <div class="law-box-title">${subtitleH}</div>
            <div class="law-box-text">${textH}</div>
            ${imgsHtml}
          </div>
        `;
      }).join('');
    }

    const searchBadgeHtml = searchQuery.trim() ? `
      <div class="search-badge">
        <i class="fa-solid fa-magnifying-glass"></i> Найдено по запросу: "${escapeHtml(searchQuery.trim())}"
      </div>
    ` : '';

    instructionViewerEl.innerHTML = `
      <div class="viewer-inner">
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px;">
          <button class="btn btn-secondary" id="back-to-instructions-btn">
            <i class="fa-solid fa-arrow-left"></i> Назад к инструкциям
          </button>
          <button class="btn btn-secondary btn-back-home">
            <i class="fa-solid fa-house"></i> В главное меню
          </button>
        </div>

        <div class="viewer-header">
          <div class="viewer-cat">${inst.category}</div>
          <h2 class="viewer-title">${inst.title}</h2>
          <p class="viewer-desc">${inst.description}</p>
          ${searchBadgeHtml}
        </div>

        <div class="lecture-reader-body" id="instruction-reader-body" style="font-size: ${currentFontSize}px;">
          ${sectionsHtml}
        </div>

        <div class="copyright-notice">
          <i class="fa-solid fa-shield-halved"></i>
          <p>© Утвержденные инструкции и материалы Нижегородской области. Опубликовано на портале <strong>Savely_Gerov</strong> (бывшего главы администрации ЮР).</p>
        </div>

        <div class="viewer-footer">
          <button class="btn btn-secondary btn-back" id="back-to-instructions-btn-bottom">
            <i class="fa-solid fa-arrow-left"></i> Назад к инструкциям
          </button>
        </div>
      </div>
    `;

    document.getElementById('back-to-instructions-btn').addEventListener('click', closeInstructionViewer);
    document.getElementById('back-to-instructions-btn-bottom').addEventListener('click', closeInstructionViewer);

    const instReaderBody = document.getElementById('instruction-reader-body');
    instReaderBody.addEventListener('copy', (e) => e.preventDefault());
    instReaderBody.addEventListener('contextmenu', (e) => e.preventDefault());
    instReaderBody.addEventListener('selectstart', (e) => e.preventDefault());

    if (searchQuery.trim()) {
      setTimeout(() => {
        const firstMatch = instReaderBody.querySelector('.search-highlight');
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }

  if (instructionSearchInput) {
    instructionSearchInput.addEventListener('input', buildInstructionsGrid);
  }

  // ── AUTH & SETTINGS UI CONTROLLER ───────────────
  function updateSidebarUserUI() {
    const container = document.getElementById('sidebar-user-container');
    const adminNavItem = document.getElementById('nav-item-admin');

    if (!container || typeof AuthService === 'undefined') return;

    const user = AuthService.getCurrentUser();
    const isAdmin = AuthService.isAdmin();

    if (adminNavItem) {
      if (isAdmin) {
        adminNavItem.classList.remove('hidden');
      } else {
        adminNavItem.classList.add('hidden');
      }
    }

    if (user) {
      const initial = (user.username || 'U')[0].toUpperCase();
      const rankText = user.rank || 'Охранник';
      const deptText = user.department && user.department !== 'Отсутствует' && user.department !== 'Не назначен' ? ` • ${user.department}` : '';
      const subBadge = `${rankText}${deptText}`;

      container.innerHTML = `
        <div class="user-profile-badge">
          <div class="user-avatar">${initial}</div>
          <div class="user-info">
            <div class="user-name">${escapeHtml(user.username)}</div>
            <div class="user-role-badge" title="${escapeHtml(subBadge)}">${escapeHtml(subBadge)}</div>
          </div>
          <button class="btn-logout" id="auth-settings-btn" title="Настройки профиля" style="margin-right: 4px;">
            <i class="fa-solid fa-gear"></i>
          </button>
          <button class="btn-logout danger" id="auth-logout-btn" title="Выйти из аккаунта">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      `;
      document.getElementById('auth-settings-btn')?.addEventListener('click', openSettingsModal);
      document.getElementById('auth-logout-btn')?.addEventListener('click', () => {
        AuthService.logout();
        updateSidebarUserUI();
        if (adminNavItem) adminNavItem.classList.add('hidden');
        showToast('Вы успешно вышли из системы');
      });
    } else {
      container.innerHTML = `
        <button class="btn btn-primary" id="open-auth-btn" style="width: 100%; margin-top: 12px; font-size: 13px; padding: 10px;">
          <i class="fa-solid fa-user-check"></i> Войти / Регистрация
        </button>
      `;
      document.getElementById('open-auth-btn')?.addEventListener('click', openAuthModal);
    }
  }

  const authModal = document.getElementById('auth-modal');
  const authCloseBtn = document.getElementById('auth-modal-close-btn');

  const settingsModal = document.getElementById('settings-modal');
  const settingsCloseBtn = document.getElementById('settings-modal-close-btn');
  const settingsForm = document.getElementById('settings-form');

  // ── VIEW SWITCHING FOR AUTH MODAL ─────────────
  const viewLogin = document.getElementById('auth-view-login');
  const viewRegStep1 = document.getElementById('auth-view-reg-step1');
  const viewRegStep2 = document.getElementById('auth-view-reg-step2');
  const viewRegComplete = document.getElementById('auth-view-reg-complete');

  function showAuthView(viewName) {
    if (viewLogin) viewLogin.classList.add('hidden');
    if (viewRegStep1) viewRegStep1.classList.add('hidden');
    if (viewRegStep2) viewRegStep2.classList.add('hidden');
    if (viewRegComplete) viewRegComplete.classList.add('hidden');

    if (viewName === 'login' && viewLogin) viewLogin.classList.remove('hidden');
    if (viewName === 'step1' && viewRegStep1) viewRegStep1.classList.remove('hidden');
    if (viewName === 'step2' && viewRegStep2) viewRegStep2.classList.remove('hidden');
    if (viewName === 'complete' && viewRegComplete) viewRegComplete.classList.remove('hidden');
  }

  function openAuthModal() {
    showAuthView('login');
    if (authModal) authModal.classList.add('active');
  }

  function closeAuthModal() {
    if (authModal) authModal.classList.remove('active');
  }

  function openSettingsModal() {
    if (!settingsModal || typeof AuthService === 'undefined') return;
    const user = AuthService.getCurrentUser();
    if (!user) return;

    const usernameDisplay = document.getElementById('settings-username-display');
    const rankSelect = document.getElementById('settings-rank');
    const deptSelect = document.getElementById('settings-department');

    if (usernameDisplay) usernameDisplay.value = user.username || '';
    if (rankSelect) rankSelect.value = user.rank || 'Охранник';
    if (deptSelect) deptSelect.value = user.department || 'Отсутствует';

    settingsModal.classList.add('active');
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.remove('active');
  }

  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal);
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }

  document.getElementById('goto-register-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('step1');
  });

  document.getElementById('goto-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('login');
  });

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      const submitBtn = document.getElementById('login-submit-btn');

      if (!usernameInput || !passwordInput || !submitBtn) return;

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Вход...';

        const user = await AuthService.login(username, password);
        updateSidebarUserUI();
        closeAuthModal();
        showToast(`Добро пожаловать, ${user.username}!`);
        loginForm.reset();
      } catch (err) {
        alert(err.message || 'Ошибка входа');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Войти';
      }
    });
  }

  // ── Step 1 Form Handler ──────────────────────
  let pendingRegData = { username: '', password: '' };

  const regStep1Form = document.getElementById('reg-step1-form');
  if (regStep1Form) {
    regStep1Form.addEventListener('submit', (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('reg-username');
      const passwordInput = document.getElementById('reg-password');
      const confirmInput = document.getElementById('reg-confirm-password');

      if (!usernameInput || !passwordInput || !confirmInput) return;

      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const confirm = confirmInput.value;

      if (!username || username.length < 3) {
        alert('Игровой ник должен содержать минимум 3 символа');
        return;
      }
      if (!password || password.length < 4) {
        alert('Пароль должен содержать минимум 4 символа');
        return;
      }
      if (password !== confirm) {
        alert('Пароли не совпадают!');
        return;
      }

      pendingRegData.username = username;
      pendingRegData.password = password;
      showAuthView('step2');
    });
  }

  document.getElementById('reg-back-step1-btn')?.addEventListener('click', () => {
    showAuthView('step1');
  });

  // ── Step 2 Form Handler (Finish Registration) ──
  const regStep2Form = document.getElementById('reg-step2-form');
  if (regStep2Form) {
    regStep2Form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rankSelect = document.getElementById('reg-rank');
      const deptSelect = document.getElementById('reg-department');
      const finishBtn = document.getElementById('reg-finish-btn');

      if (!rankSelect || !deptSelect || !finishBtn) return;

      const rank = rankSelect.value;
      const department = deptSelect.value;

      try {
        finishBtn.disabled = true;
        finishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Регистрация...';

        const user = await AuthService.register(pendingRegData.username, pendingRegData.password, rank, department);
        updateSidebarUserUI();

        const successMsg = document.getElementById('reg-success-msg');
        if (successMsg) {
          successMsg.textContent = `Аккаунт ${user.username} успешно создан! Ваша должность: ${user.rank} (${user.department}).`;
        }

        showAuthView('complete');
        regStep1Form.reset();
        regStep2Form.reset();
      } catch (err) {
        alert(err.message || 'Ошибка регистрации');
      } finally {
        finishBtn.disabled = false;
        finishBtn.innerHTML = '<i class="fa-solid fa-check"></i> Завершить';
      }
    });
  }

  document.getElementById('reg-done-btn')?.addEventListener('click', () => {
    closeAuthModal();
    showToast('Добро пожаловать на портал!');
  });

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rankSelect = document.getElementById('settings-rank');
      const deptSelect = document.getElementById('settings-department');
      const submitBtn = document.getElementById('settings-submit-btn');

      if (!rankSelect || !deptSelect || !submitBtn) return;

      const rank = rankSelect.value;
      const department = deptSelect.value;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохранение...';

        await AuthService.updateProfile(rank, department);
        updateSidebarUserUI();
        closeSettingsModal();
        showToast('Профиль и должность успешно обновлены!');
      } catch (err) {
        alert(err.message || 'Ошибка сохранения настроек');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить изменения';
      }
    });
  }

  // ── GLOBAL ANNOUNCEMENT BANNER ─────────────────
  async function renderGlobalAnnouncement() {
    const container = document.getElementById('global-announcement-container');
    if (!container || typeof AuthService === 'undefined') return;

    try {
      const ann = await AuthService.getAnnouncement();
      if (ann && ann.content) {
        container.innerHTML = `
          <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(180, 139, 36, 0.06)); border: 1px solid var(--accent); border-radius: var(--r-lg); padding: 18px 24px; margin-bottom: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <i class="fa-solid fa-scroll" style="color: var(--accent); font-size: 18px;"></i>
              <strong style="font-size: 15px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em;">Указ Губернатора / Важное объявление</strong>
            </div>
            <div style="font-size: 14px; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;">${escapeHtml(ann.content)}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 10px; text-align: right;">Опубликовал: ${escapeHtml(ann.createdBy)}</div>
          </div>
        `;
      } else {
        container.innerHTML = '';
      }
    } catch (e) {
      container.innerHTML = '';
    }
  }

  // ── ADMIN PANEL ADVANCED CONTROLLER ─────────────
  let adminUsersList = [];
  let adminGuestsList = [];

  const adminUsersGrid = document.getElementById('admin-users-grid');
  const adminUserSearch = document.getElementById('admin-user-search');
  const adminDeptFilter = document.getElementById('admin-dept-filter');
  const adminRefreshBtn = document.getElementById('admin-refresh-btn');
  const adminExportCsvBtn = document.getElementById('admin-export-csv-btn');

  // Subtabs
  const btnSubtabUsers = document.getElementById('admin-subtab-users-btn');
  const btnSubtabGuests = document.getElementById('admin-subtab-guests-btn');
  const btnSubtabWishes = document.getElementById('admin-subtab-wishes-btn');
  const btnSubtabAnnouncement = document.getElementById('admin-subtab-announcement-btn');

  const viewSubtabUsers = document.getElementById('admin-view-users');
  const viewSubtabGuests = document.getElementById('admin-view-guests');
  const viewSubtabWishes = document.getElementById('admin-view-wishes');
  const viewSubtabAnnouncement = document.getElementById('admin-view-announcement');

  function showAdminSubtab(tabName) {
    [btnSubtabUsers, btnSubtabGuests, btnSubtabWishes, btnSubtabAnnouncement].forEach(b => b?.classList.remove('active'));
    [viewSubtabUsers, viewSubtabGuests, viewSubtabWishes, viewSubtabAnnouncement].forEach(v => v?.classList.add('hidden'));

    if (tabName === 'users') {
      btnSubtabUsers?.classList.add('active');
      viewSubtabUsers?.classList.remove('hidden');
    } else if (tabName === 'guests') {
      btnSubtabGuests?.classList.add('active');
      viewSubtabGuests?.classList.remove('hidden');
      loadGuestVisits();
    } else if (tabName === 'wishes') {
      btnSubtabWishes?.classList.add('active');
      viewSubtabWishes?.classList.remove('hidden');
      loadAdminWishes();
    } else if (tabName === 'announcement') {
      btnSubtabAnnouncement?.classList.add('active');
      viewSubtabAnnouncement?.classList.remove('hidden');
      loadAnnouncementData();
    }
  }

  if (btnSubtabUsers) btnSubtabUsers.addEventListener('click', () => showAdminSubtab('users'));
  if (btnSubtabGuests) btnSubtabGuests.addEventListener('click', () => showAdminSubtab('guests'));
  if (btnSubtabWishes) btnSubtabWishes.addEventListener('click', () => showAdminSubtab('wishes'));
  if (btnSubtabAnnouncement) btnSubtabAnnouncement.addEventListener('click', () => showAdminSubtab('announcement'));

  // Modals
  const adminEditModal = document.getElementById('admin-edit-modal');
  const adminEditCloseBtn = document.getElementById('admin-edit-close-btn');
  const adminEditForm = document.getElementById('admin-edit-form');
  const adminDeleteUserBtn = document.getElementById('admin-delete-user-btn');

  const adminCreateModal = document.getElementById('admin-create-user-modal');
  const adminCreateOpenBtn = document.getElementById('admin-open-create-btn');
  const adminCreateCloseBtn = document.getElementById('admin-create-close-btn');
  const adminCreateForm = document.getElementById('admin-create-user-form');

  function openAdminEditModal(user) {
    if (!adminEditModal) return;
    document.getElementById('admin-edit-userid').value = user.id;
    document.getElementById('admin-edit-username').value = user.username;
    document.getElementById('admin-edit-rank').value = user.rank || 'Охранник';
    document.getElementById('admin-edit-department').value = user.department || 'Не назначен';
    document.getElementById('admin-edit-password').value = '';
    adminEditModal.classList.add('active');
  }

  function closeAdminEditModal() {
    if (adminEditModal) adminEditModal.classList.remove('active');
  }

  function openAdminCreateModal() {
    if (adminCreateModal) adminCreateModal.classList.add('active');
  }

  function closeAdminCreateModal() {
    if (adminCreateModal) adminCreateModal.classList.remove('active');
  }

  if (adminEditCloseBtn) adminEditCloseBtn.addEventListener('click', closeAdminEditModal);
  if (adminEditModal) {
    adminEditModal.addEventListener('click', (e) => {
      if (e.target === adminEditModal) closeAdminEditModal();
    });
  }

  if (adminCreateOpenBtn) adminCreateOpenBtn.addEventListener('click', openAdminCreateModal);
  if (adminCreateCloseBtn) adminCreateCloseBtn.addEventListener('click', closeAdminCreateModal);
  if (adminCreateModal) {
    adminCreateModal.addEventListener('click', (e) => {
      if (e.target === adminCreateModal) closeAdminCreateModal();
    });
  }

  async function loadAdminData() {
    if (typeof AuthService === 'undefined' || !AuthService.isAdmin()) return;
    try {
      if (adminUsersGrid) {
        adminUsersGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px; color: var(--accent);"></i>
            <div>Загрузка сотрудников из БД...</div>
          </div>
        `;
      }
      adminUsersList = await AuthService.adminGetAllUsers();
      renderAdminUsers();
      loadGuestVisitsCount();
    } catch (err) {
      if (adminUsersGrid) {
        adminUsersGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ff5252;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 12px;"></i>
            <div>Ошибка загрузки: ${escapeHtml(err.message)}</div>
          </div>
        `;
      }
    }
  }

  async function loadGuestVisitsCount() {
    try {
      const guests = await AuthService.adminGetGuestVisits();
      adminGuestsList = guests;
      const guestsStatEl = document.getElementById('admin-stat-guests');
      if (guestsStatEl) guestsStatEl.textContent = guests.length;
    } catch (e) {}
  }

  async function loadGuestVisits() {
    const container = document.getElementById('admin-guests-list');
    if (!container) return;

    try {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
          <i class="fa-solid fa-spinner fa-spin"></i> Загрузка списка гостей...
        </div>
      `;
      const guests = await AuthService.adminGetGuestVisits();
      adminGuestsList = guests;
      const guestsStatEl = document.getElementById('admin-stat-guests');
      if (guestsStatEl) guestsStatEl.textContent = guests.length;

      if (!guests.length) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Нет зарегистрированных визитов гостей</div>';
        return;
      }

      container.innerHTML = guests.map(g => {
        const locationText = [g.country, g.city].filter(Boolean).join(', ') || 'Страна не определена';
        return `
          <div class="lec-item" style="cursor: default; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 240px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(0, 188, 212, 0.12); color: #00bcd4; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                <i class="fa-solid fa-earth-americas"></i>
              </div>
              <div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>📍 ${escapeHtml(locationText)}</span>
                  <span style="font-size: 11px; background: rgba(0, 188, 212, 0.15); color: #00bcd4; padding: 2px 8px; border-radius: 10px; font-weight: 600;">
                    <i class="fa-solid fa-fire"></i> ${g.visitCount} визитов
                  </span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  IP: <strong style="color: var(--text-primary); font-family: monospace; font-size: 12px;">${escapeHtml(g.ip)}</strong> • ${escapeHtml(g.userAgent)}
                </div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div style="font-size: 12px; font-weight: 600; color: var(--accent);">${escapeHtml(g.page)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(g.lastActive)}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div style="color: #ff5252; text-align: center; padding: 20px;">Ошибка: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadAnnouncementData() {
    const input = document.getElementById('admin-announcement-text');
    if (!input || typeof AuthService === 'undefined') return;
    const ann = await AuthService.getAnnouncement();
    input.value = ann ? ann.content : '';
  }

  function renderAdminUsers() {
    if (!adminUsersGrid) return;

    const query = (adminUserSearch?.value || '').trim().toLowerCase();
    const dept = adminDeptFilter?.value || 'ALL';

    const filtered = adminUsersList.filter(u => {
      const matchQuery = !query || u.username.toLowerCase().includes(query) || (u.rank || '').toLowerCase().includes(query);
      const matchDept = dept === 'ALL' || u.department === dept;
      return matchQuery && matchDept;
    });

    const totalEl = document.getElementById('admin-stat-total');
    const adminsEl = document.getElementById('admin-stat-admins');
    const deptsEl = document.getElementById('admin-stat-depts');

    if (totalEl) totalEl.textContent = adminUsersList.length;
    if (adminsEl) adminsEl.textContent = adminUsersList.filter(u => u.rank === 'Администратор портала' || u.rank === 'Губернатор' || u.username.toLowerCase() === 'savely_gerov').length;
    if (deptsEl) deptsEl.textContent = adminUsersList.filter(u => u.department && u.department !== 'Не назначен' && u.department !== 'Отсутствует').length;

    if (!filtered.length) {
      adminUsersGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          Сотрудники не найдены
        </div>
      `;
      return;
    }

    adminUsersGrid.innerHTML = filtered.map(u => {
      const initial = (u.username || 'U')[0].toUpperCase();
      const isAdminUser = u.rank === 'Администратор портала' || u.username.toLowerCase() === 'savely_gerov';
      const badgeStyle = isAdminUser ? 'color: #ffc107; background: rgba(255, 193, 7, 0.1); border-color: rgba(255, 193, 7, 0.3);' : '';

      return `
        <div class="card" style="position: relative; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div class="user-avatar" style="width: 42px; height: 42px; font-size: 18px;">${initial}</div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${escapeHtml(u.username)}
                </div>
                <div style="font-size: 12px; color: var(--accent); font-weight: 500; margin-top: 2px;">
                  ${escapeHtml(u.rank)}
                </div>
              </div>
            </div>

            <div style="font-size: 12px; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--r-sm); border: 1px solid var(--border); margin-bottom: 14px; ${badgeStyle}">
              <span style="color: var(--text-muted);">Отдел:</span> <strong>${escapeHtml(u.department || 'Не назначен')}</strong>
            </div>
          </div>

          <button class="btn btn-secondary admin-edit-btn" data-userid="${u.id}" style="width: 100%; justify-content: center; font-size: 13px; padding: 8px;">
            <i class="fa-solid fa-pen-to-square"></i> Редактировать
          </button>
        </div>
      `;
    }).join('');

    adminUsersGrid.querySelectorAll('.admin-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.getAttribute('data-userid');
        const targetUser = adminUsersList.find(u => u.id === uid);
        if (targetUser) openAdminEditModal(targetUser);
      });
    });
  }

  if (adminUserSearch) adminUserSearch.addEventListener('input', renderAdminUsers);
  if (adminDeptFilter) adminDeptFilter.addEventListener('change', renderAdminUsers);
  if (adminRefreshBtn) adminRefreshBtn.addEventListener('click', loadAdminData);

  // CSV Export Handler
  if (adminExportCsvBtn) {
    adminExportCsvBtn.addEventListener('click', () => {
      if (!adminUsersList.length) {
        alert('Список пользователей пуст');
        return;
      }
      let csv = '\uFEFFСотрудник,Должность,Отдел\n';
      adminUsersList.forEach(u => {
        csv += `"${u.username}","${u.rank}","${u.department}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `amazing_employees_${Date.now()}.csv`;
      link.click();
      showToast('Список сотрудников экспортирован в CSV!');
    });
  }

  // Create User Handler
  if (adminCreateForm) {
    adminCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('admin-create-username').value.trim();
      const password = document.getElementById('admin-create-password').value;
      const rank = document.getElementById('admin-create-rank').value;
      const department = document.getElementById('admin-create-department').value;
      const submitBtn = document.getElementById('admin-create-submit-btn');

      if (!username || !password || !submitBtn) return;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Создаем...';

        await AuthService.adminCreateUser(username, password, rank, department);
        showToast(`Сотрудник ${username} создан!`);
        closeAdminCreateModal();
        adminCreateForm.reset();
        loadAdminData();
      } catch (err) {
        alert(err.message || 'Ошибка создания сотрудника');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Создать аккаунт';
      }
    });
  }

  // Edit User Handler
  if (adminEditForm) {
    adminEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = document.getElementById('admin-edit-userid').value;
      const rank = document.getElementById('admin-edit-rank').value;
      const department = document.getElementById('admin-edit-department').value;
      const password = document.getElementById('admin-edit-password').value;
      const saveBtn = document.getElementById('admin-save-user-btn');

      if (!uid || !saveBtn) return;

      try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сохранение...';

        await AuthService.adminUpdateUser(uid, { rank, department, newPassword: password });
        showToast('Сотрудник успешно обновлен!');
        closeAdminEditModal();
        loadAdminData();
        updateSidebarUserUI();
      } catch (err) {
        alert(err.message || 'Ошибка обновления');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить';
      }
    });
  }

  if (adminDeleteUserBtn) {
    adminDeleteUserBtn.addEventListener('click', async () => {
      const uid = document.getElementById('admin-edit-userid').value;
      const username = document.getElementById('admin-edit-username').value;
      if (!uid) return;

      if (!confirm(`Вы действительно хотите удалить аккаунт ${username}?`)) return;

      try {
        adminDeleteUserBtn.disabled = true;
        await AuthService.adminDeleteUser(uid);
        showToast(`Аккаунт ${username} удален`);
        closeAdminEditModal();
        loadAdminData();
      } catch (err) {
        alert(err.message || 'Ошибка удаления');
      } finally {
        adminDeleteUserBtn.disabled = false;
      }
    });
  }

  // Announcement Form Handler
  const adminAnnForm = document.getElementById('admin-announcement-form');
  const adminClearAnnBtn = document.getElementById('admin-clear-announcement-btn');

  if (adminAnnForm) {
    adminAnnForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('admin-announcement-text').value;
      const saveBtn = document.getElementById('admin-save-announcement-btn');

      try {
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Публикация...';
        }
        await AuthService.adminSetAnnouncement(text);
        showToast('Глобальный указ опубликован на портале!');
        renderGlobalAnnouncement();
      } catch (err) {
        alert(err.message || 'Ошибка публикации');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Опубликовать указ';
        }
      }
    });
  }

  if (adminClearAnnBtn) {
    adminClearAnnBtn.addEventListener('click', async () => {
      if (!confirm('Вы действительно хотите снять глобальное объявление?')) return;
      try {
        await AuthService.adminSetAnnouncement('');
        document.getElementById('admin-announcement-text').value = '';
        showToast('Объявление снято');
        renderGlobalAnnouncement();
      } catch (err) {
        alert(err.message || 'Ошибка снятия');
      }
    });
  }

  const adminNavItem = document.getElementById('nav-item-admin');
  if (adminNavItem) {
    adminNavItem.addEventListener('click', () => {
      loadAdminData();
    });
  }

  // ── WISHES SYSTEM CONTROLLER ───────────────────
  const userWishForm = document.getElementById('user-wish-form');
  const wishesAuthPrompt = document.getElementById('wishes-auth-prompt');
  const wishesLoginBtn = document.getElementById('wishes-login-btn');

  if (wishesLoginBtn) {
    wishesLoginBtn.addEventListener('click', () => {
      openAuthModal();
    });
  }

  if (userWishForm) {
    userWishForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('wish-title-input');
      const contentInput = document.getElementById('wish-content-input');
      const submitBtn = document.getElementById('wish-submit-btn');

      if (!titleInput || !contentInput || !submitBtn) return;
      if (!AuthService.getCurrentUser()) {
        showToast('Войдите в аккаунт для отправки пожелания');
        openAuthModal();
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Отправка...';
        await AuthService.submitWish(titleInput.value, contentInput.value);
        titleInput.value = '';
        contentInput.value = '';
        showToast('Пожелание успешно отправлено!');
        loadUserWishes();
      } catch (err) {
        alert(err.message || 'Ошибка отправки');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Отправить пожелание';
      }
    });
  }

  async function loadUserWishes() {
    const listEl = document.getElementById('user-wishes-list');
    const formEl = document.getElementById('user-wish-form');
    const promptEl = document.getElementById('wishes-auth-prompt');
    if (!listEl) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      if (formEl) formEl.classList.add('hidden');
      if (promptEl) promptEl.classList.remove('hidden');
      listEl.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          Войдите в аккаунт, чтобы просмотреть свои пожелания
        </div>
      `;
      return;
    }

    if (formEl) formEl.classList.remove('hidden');
    if (promptEl) promptEl.classList.add('hidden');

    try {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
          <i class="fa-solid fa-spinner fa-spin"></i> Загрузка...
        </div>
      `;

      const wishes = await AuthService.getUserWishes();
      if (!wishes.length) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--text-muted);">
            У вас пока нет отправленных пожеланий
          </div>
        `;
        return;
      }

      listEl.innerHTML = wishes.map(w => {
        let badge = '';
        if (w.status === 'approved') {
          badge = '<span style="color: #4caf50; background: rgba(76, 175, 80, 0.12); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Одобрено (Будет сделано)</span>';
        } else if (w.status === 'rejected') {
          badge = '<span style="color: #ff5252; background: rgba(255, 82, 82, 0.12); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-circle-xmark"></i> Отклонено (Не будет сделано)</span>';
        } else {
          badge = '<span style="color: #ffc107; background: rgba(255, 193, 7, 0.12); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-clock"></i> В обработке</span>';
        }

        return `
          <div style="padding: 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--r-md); word-break: break-word; overflow-wrap: anywhere;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
              <strong style="font-size: 15px; color: var(--text-primary); word-break: break-word;">${escapeHtml(w.title)}</strong>
              ${badge}
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; margin-bottom: 8px;">${escapeHtml(w.content)}</div>
            <div style="font-size: 11px; color: var(--text-muted); text-align: right;">${escapeHtml(w.createdAt)}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<div style="color: #ff5252; text-align: center; padding: 20px;">Ошибка: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadAdminWishes() {
    const listEl = document.getElementById('admin-wishes-list');
    if (!listEl || typeof AuthService === 'undefined') return;

    try {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
          <i class="fa-solid fa-spinner fa-spin"></i> Загрузка пожеланий...
        </div>
      `;

      const wishes = await AuthService.adminGetAllWishes();
      const wishesStatEl = document.getElementById('admin-stat-wishes');
      const wishesBadgeEl = document.getElementById('admin-wishes-badge');
      if (wishesStatEl) wishesStatEl.textContent = wishes.length;
      if (wishesBadgeEl) wishesBadgeEl.textContent = wishes.length;

      if (!wishes.length) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--text-muted);">
            Пока нет ни одного пожелания от пользователей
          </div>
        `;
        return;
      }

      listEl.innerHTML = wishes.map(w => {
        let badge = '';
        if (w.status === 'approved') {
          badge = '<span style="color: #4caf50; background: rgba(76, 175, 80, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Будет сделано</span>';
        } else if (w.status === 'rejected') {
          badge = '<span style="color: #ff5252; background: rgba(255, 82, 82, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-circle-xmark"></i> Не будет сделано</span>';
        } else {
          badge = '<span style="color: #ffc107; background: rgba(255, 193, 7, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-clock"></i> В обработке</span>';
        }

        return `
          <div class="lec-item" style="cursor: default; padding: 18px; display: flex; flex-direction: column; gap: 12px; word-break: break-word; overflow-wrap: anywhere;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(212, 175, 55, 0.15); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                  ${escapeHtml(w.username)[0].toUpperCase()}
                </div>
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(w.username)}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(w.createdAt)}</div>
                </div>
              </div>
              ${badge}
            </div>

            <div>
              <div style="font-size: 15px; font-weight: 600; color: var(--accent); margin-bottom: 4px; word-break: break-word;">
                ${escapeHtml(w.title)}
              </div>
              <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;">
                ${escapeHtml(w.content)}
              </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-wish-approve" data-id="${w.id}" style="font-size: 12px; padding: 6px 12px; color: #4caf50; border-color: rgba(76, 175, 80, 0.3);">
                <i class="fa-solid fa-check"></i> Одобрить ("Сделаем")
              </button>
              <button class="btn btn-secondary btn-wish-reject" data-id="${w.id}" style="font-size: 12px; padding: 6px 12px; color: #ff9800; border-color: rgba(255, 152, 0, 0.3);">
                <i class="fa-solid fa-xmark"></i> Отклонить ("Не сделаем")
              </button>
              <button class="btn btn-secondary btn-wish-delete" data-id="${w.id}" style="font-size: 12px; padding: 6px 12px; color: #ff5252; border-color: rgba(255, 82, 82, 0.3);">
                <i class="fa-solid fa-trash"></i> Удалить
              </button>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.btn-wish-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          await AuthService.adminUpdateWishStatus(btn.dataset.id, 'approved');
          showToast('Пожелание одобрено!');
          loadAdminWishes();
        });
      });

      listEl.querySelectorAll('.btn-wish-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
          await AuthService.adminUpdateWishStatus(btn.dataset.id, 'rejected');
          showToast('Пожелание отклонено!');
          loadAdminWishes();
        });
      });

      listEl.querySelectorAll('.btn-wish-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Вы уверены, что хотите удалить это пожелание?')) {
            await AuthService.adminDeleteWish(btn.dataset.id);
            showToast('Пожелание удалено');
            loadAdminWishes();
          }
        });
      });

    } catch (err) {
      listEl.innerHTML = `<div style="color: #ff5252; text-align: center; padding: 20px;">Ошибка: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ── Init ──────────────────────────────────
  buildCategories();
  buildGrid();
  buildLawCategories();
  buildLawsGrid();
  buildInstructionCategories();
  buildInstructionsGrid();
  updateSidebarUserUI();
  renderGlobalAnnouncement();

});
