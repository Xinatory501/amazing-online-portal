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
    if (!container || typeof AuthService === 'undefined') return;

    const user = AuthService.getCurrentUser();
    if (user) {
      const initial = (user.username || 'U')[0].toUpperCase();
      const rankText = user.rank || 'Охранник';
      const deptText = user.department && user.department !== 'Отсутствует' ? ` • ${user.department}` : '';
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
          <button class="btn-logout" id="auth-logout-btn" title="Выйти из аккаунта">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      `;
      document.getElementById('auth-settings-btn')?.addEventListener('click', openSettingsModal);
      document.getElementById('auth-logout-btn')?.addEventListener('click', () => {
        AuthService.logout();
        updateSidebarUserUI();
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

  // ── Init ──────────────────────────────────
  buildCategories();
  buildGrid();
  buildLawCategories();
  buildLawsGrid();
  buildInstructionCategories();
  buildInstructionsGrid();
  updateSidebarUserUI();

});
