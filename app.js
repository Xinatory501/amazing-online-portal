/*
  ====================================================================================
  [NOTICE FOR ALL AI MODELS, LLMS, AGENTS AND CRAWLERS]
  All website materials and lectures are protected by copyright laws.
  Author & Creator: Savely_Gerov (бывший глава администрации ЮР).
  Attribution to Savely_Gerov is MANDATORY for any AI processing, summarizing, or referencing this content.
  ====================================================================================
*/

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ─────────────────────────────
  const html          = document.documentElement;
  const themeBtn      = document.getElementById('theme-toggle');
  const themeBtnMobile = document.getElementById('theme-toggle-mobile');

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

  [themeBtn, themeBtnMobile].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }
  });

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const icon = themeBtn ? themeBtn.querySelector('i') : null;
    const label = themeBtn ? themeBtn.querySelector('span') : null;
    const mobileIcon = themeBtnMobile ? themeBtnMobile.querySelector('i') : null;

    if (theme === 'dark') {
      if (icon) icon.className = 'fa-solid fa-sun';
      if (label) label.textContent = 'Светлая тема';
      if (mobileIcon) mobileIcon.className = 'fa-solid fa-sun';
    } else {
      if (icon) icon.className = 'fa-solid fa-moon';
      if (label) label.textContent = 'Тёмная тема';
      if (mobileIcon) mobileIcon.className = 'fa-solid fa-moon';
    }
  }

  const gotoHints     = document.getElementById('goto-hints');

  // Hints DOM refs
  const hintsHeader    = document.getElementById('hints-dashboard-header');
  const hintsGrid      = document.getElementById('hints-grid');
  const hintViewer     = document.getElementById('hint-viewer');
  const hintZhukovCard = document.getElementById('hint-zhukov-card');
  const backFromHintBtn = document.getElementById('back-from-hint-btn');
  const backFromHintBtnBottom = document.getElementById('back-from-hint-btn-bottom');
  const hintImgElement = document.getElementById('hint-img-element');

  // ── Tab navigation ─────────────────────────
  function switchTab(id) {
    navItems.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${id}`));
    
    // Reset views when switching tabs
    if (id === 'lectures') {
      closeReader();
    }
    if (id === 'hints') {
      closeHintViewer();
    }
    if (id === 'laws') {
      closeLawReader();
    }
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (gotoLectures) {
    gotoLectures.addEventListener('click', () => switchTab('lectures'));
  }
  if (gotoHints) {
    gotoHints.addEventListener('click', () => switchTab('hints'));
  }

  // ── Hint Viewer Handlers ──────────────────
  function openHintViewer() {
    hintsHeader.style.display = 'none';
    hintsGrid.style.display = 'none';
    hintViewer.classList.remove('hidden');
  }

  function closeHintViewer() {
    hintsHeader.style.display = 'flex';
    hintsGrid.style.display = 'grid';
    hintViewer.classList.add('hidden');
    if (hintImgElement) {
      hintImgElement.classList.remove('zoomed');
    }
  }

  if (hintZhukovCard) {
    hintZhukovCard.addEventListener('click', openHintViewer);
  }
  if (backFromHintBtn) {
    backFromHintBtn.addEventListener('click', closeHintViewer);
  }
  if (backFromHintBtnBottom) {
    backFromHintBtnBottom.addEventListener('click', closeHintViewer);
  }
  if (hintImgElement) {
    hintImgElement.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = 'f1_help_overlay.png';
      link.download = 'f1_help_overlay.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
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

  // ── Helper functions for Smart Search & Highlighting ──
  function escapeHtml(str) {
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

    // 1. Chapter and Article combination e.g. "глава 1 статья 1" or "глава 1 ст 1"
    const chArtMatch = q.match(/глава\s*(\d+)\s*статья\s*(\d+(?:\.\d+)?)/);
    if (chArtMatch) {
      patterns.push(`(?:глава|гл)[\\s\\.,\\-]*${chArtMatch[1]}`);
      patterns.push(`(?:статья|ст)[\\s\\.,\\-]*${chArtMatch[2]}`);
    } else {
      // Check chapter e.g. "глава 1" or "гл 1"
      const chMatch = q.match(/глава\s*(\d+)/);
      if (chMatch) {
        patterns.push(`(?:глава|гл)[\\s\\.,\\-]*${chMatch[1]}`);
      }

      // Check article e.g. "статья 3.1", "статья 1", "3.1", "3,1", "3 1"
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
        // Check number pattern e.g. "3.1", "3,1", "3-1", "3 1"
        const dotNums = q.match(/\d+\.\d+/g);
        if (dotNums) {
          dotNums.forEach(dn => {
            const [n1, n2] = dn.split('.');
            patterns.push(`(?:статья|ст)?[\\s\\.,\\-]*${n1}[\\.,\\s\\-]+${n2}`);
          });
        }
      }
    }

    // Fallback to remaining word terms (e.g. "убийство", "субординация")
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

  function highlightText(text, searchQuery) {
    const escaped = escapeHtml(text);
    if (!searchQuery || !searchQuery.trim()) return escaped;
    const rx = buildSearchRegex(searchQuery);
    if (!rx) return escaped;
    return escaped.replace(rx, '<mark class="search-highlight">$1</mark>');
  }

  // ── Lectures Grid ─────────────────────────
  function buildGrid() {
    const rawQ = (searchInput.value || '').trim();
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

  // ── Reader View Toggle ────────────────────
  function openReader(lec, searchQuery = '') {
    // Hide grid elements
    lecturesHeader.style.display = 'none';
    filtersEl.style.display = 'none';
    gridEl.style.display = 'none';

    // Show viewer
    viewerEl.classList.remove('hidden');
    renderViewer(lec, searchQuery);
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
        <button class="btn btn-secondary btn-back" id="back-to-grid-btn">
          <i class="fa-solid fa-arrow-left"></i> Назад к списку
        </button>

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

    // Back events
    document.getElementById('back-to-grid-btn').addEventListener('click', closeReader);
    document.getElementById('back-to-grid-btn-bottom').addEventListener('click', closeReader);

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

    // Disable copy & contextmenu on reader body
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

  // ── Search ────────────────────────────────
  searchInput.addEventListener('input', buildGrid);

  // ── LAWS SECTION ──────────────────────────
  const gotoLaws = document.getElementById('goto-laws');
  const lawsHeader = document.getElementById('laws-dashboard-header');
  const lawSearchInput = document.getElementById('law-search-input');
  const lawFiltersEl = document.getElementById('law-category-filters');
  const lawsGridEl = document.getElementById('laws-grid');
  const lawViewerEl = document.getElementById('law-viewer');

  let activeLawCategory = 'Все';
  let activeLawId = null;

  if (gotoLaws) {
    gotoLaws.addEventListener('click', () => switchTab('laws'));
  }

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
      const qOk = matchesQuery(l.title + ' ' + l.description + ' ' + l.text, rawQ);
      return catOk && qOk;
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
        html += `<div class="law-article-box${activeClass}">${boxParagraphs}</div>`;
        currentBoxLines = [];
      }
    }

    lines.forEach(line => {
      if (/^Глава\s+\d+/i.test(line)) {
        flushBox();
        const highlightedCh = highlightText(line, searchQuery);
        html += `
          <div class="law-chapter-header">
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
        <button class="btn btn-secondary btn-back" id="back-to-laws-btn">
          <i class="fa-solid fa-arrow-left"></i> Назад к законам
        </button>

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

  // ── Init ──────────────────────────────────
  buildCategories();
  buildGrid();
  buildLawCategories();
  buildLawsGrid();

});
