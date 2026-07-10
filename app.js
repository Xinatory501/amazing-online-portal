document.addEventListener("DOMContentLoaded", () => {
  // --- STATE ---
  let activeTab = "home";
  let activeCategory = "Все";
  let activeLectureId = null;
  let searchQuery = "";
  
  // --- DOM ELEMENTS ---
  const tabButtons = document.querySelectorAll(".menu-item[data-tab]");
  const tabContents = document.querySelectorAll(".tab-content");
  const homeLecturesCard = document.getElementById("go-to-lectures-card");
  
  const searchInput = document.getElementById("lecture-search");
  const categoriesContainer = document.getElementById("category-filters-list");
  const lecturesListContainer = document.getElementById("lectures-list-container");
  const activeLectureViewer = document.getElementById("active-lecture-viewer");
  
  const toast = document.getElementById("copy-toast");
  const toastMessage = document.getElementById("toast-message");

  // --- TAB NAVIGATION ---
  function switchTab(tabId) {
    activeTab = tabId;
    
    // Update menu buttons
    tabButtons.forEach(btn => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    
    // Update tab content visibility
    tabContents.forEach(content => {
      if (content.id === `tab-${tabId}`) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });

    // If switching to lectures and no lecture is selected yet, render list
    if (tabId === "lectures") {
      renderCategoryFilters();
      renderLecturesList();
      renderActiveLecture();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  if (homeLecturesCard) {
    homeLecturesCard.addEventListener("click", () => {
      switchTab("lectures");
    });
  }

  // --- TOAST NOTIFICATIONS ---
  let toastTimeout;
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add("show");
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
  }

  // --- CLIPBOARD ACTIONS ---
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers or non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
      } catch (e) {
        document.body.removeChild(textarea);
        console.error("Не удалось скопировать текст: ", e);
        return false;
      }
    }
  }

  // --- DATA PROCESSING ---
  function getCategories() {
    const categories = new Set();
    lecturesData.forEach(lec => {
      if (lec.category) categories.add(lec.category);
    });
    return ["Все", ...Array.from(categories)];
  }

  function getFilteredLectures() {
    return lecturesData.filter(lec => {
      const matchesCategory = activeCategory === "Все" || lec.category === activeCategory;
      const matchesSearch = lec.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            lec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            lec.content.some(line => line.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }

  // --- RENDER FUNCTIONS ---
  
  function renderCategoryFilters() {
    if (!categoriesContainer) return;
    const categories = getCategories();
    
    categoriesContainer.innerHTML = categories.map(cat => `
      <button class="category-tab ${activeCategory === cat ? 'active' : ''}" data-cat="${cat}">
        ${cat}
      </button>
    `).join("");

    // Add event listeners
    categoriesContainer.querySelectorAll(".category-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        activeCategory = tab.getAttribute("data-cat");
        renderCategoryFilters();
        renderLecturesList();
      });
    });
  }

  function renderLecturesList() {
    if (!lecturesListContainer) return;
    const filtered = getFilteredLectures();
    
    if (filtered.length === 0) {
      lecturesListContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Ничего не найдено
        </div>
      `;
      return;
    }

    lecturesListContainer.innerHTML = filtered.map(lec => `
      <div class="lecture-item ${activeLectureId === lec.id ? 'active' : ''}" data-id="${lec.id}">
        <div class="item-meta">
          <span class="item-badge">${lec.category}</span>
          <span class="item-lines">${lec.content.length} стр.</span>
        </div>
        <h4>${lec.title}</h4>
        <p>${lec.description}</p>
      </div>
    `).join("");

    // Add event listeners
    lecturesListContainer.querySelectorAll(".lecture-item").forEach(item => {
      item.addEventListener("click", () => {
        activeLectureId = item.getAttribute("data-id");
        // Re-render list to update active class
        document.querySelectorAll(".lecture-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        renderActiveLecture();
      });
    });
  }

  function renderActiveLecture() {
    if (!activeLectureViewer) return;
    
    const lecture = lecturesData.find(l => l.id === activeLectureId);
    
    if (!lecture) {
      activeLectureViewer.innerHTML = `
        <div class="viewer-empty-state">
          <i class="fa-solid fa-book-open"></i>
          <h3>Выберите лекцию из списка</h3>
          <p>Выберите лекцию слева, чтобы просмотреть её содержимое и активировать инструменты быстрого копирования.</p>
        </div>
      `;
      return;
    }

    // Build the viewer HTML
    activeLectureViewer.innerHTML = `
      <div class="lecture-view-container">
        
        <!-- Header -->
        <div class="viewer-header">
          <div class="header-meta">
            <span class="meta-badge">${lecture.category}</span>
            <h2 class="viewer-title">${lecture.title}</h2>
          </div>
        </div>

        <!-- Copy Settings Panel -->
        <div class="copy-config-panel">
          <div class="panel-title">Настройки форматирования</div>
          <div class="config-row">
            <label class="checkbox-label">
              <input type="checkbox" id="prefix-enable" checked>
              <span>Включить префикс рации</span>
            </label>
            <div class="input-group">
              <label for="prefix-text">Текст:</label>
              <input type="text" id="prefix-text" value="/r [Лектор]" placeholder="/r [Лектор]">
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="viewer-actions">
          <button class="btn btn-primary" id="btn-copy-all">
            <i class="fa-solid fa-copy"></i>
            <span>Скопировать всё</span>
          </button>
          <button class="btn btn-secondary" id="btn-reset-lines">
            <i class="fa-solid fa-rotate-left"></i>
            <span>Сбросить отметки</span>
          </button>
        </div>

        <!-- Lines List -->
        <div class="lecture-body">
          <div class="body-header">
            <span>Строка</span>
            <span>Текст лекции (нажмите для копирования)</span>
            <span>Статус</span>
          </div>
          <div class="lecture-lines" id="lecture-lines-list">
            ${lecture.content.map((line, idx) => `
              <div class="lecture-line" data-line-index="${idx}">
                <span class="line-number">${idx + 1}</span>
                <span class="line-text">${line}</span>
                <i class="fa-solid fa-check-double line-status-icon"></i>
              </div>
            `).join("")}
          </div>
        </div>

      </div>
    `;

    // Hook up active lecture listeners
    setupLectureViewListeners(lecture);
  }

  function setupLectureViewListeners(lecture) {
    const prefixEnable = document.getElementById("prefix-enable");
    const prefixText = document.getElementById("prefix-text");
    const btnCopyAll = document.getElementById("btn-copy-all");
    const btnResetLines = document.getElementById("btn-reset-lines");
    const lineElements = document.querySelectorAll(".lecture-line");

    // Format single line function
    function formatLine(text) {
      if (prefixEnable && prefixEnable.checked) {
        const prefix = prefixText ? prefixText.value.trim() : "";
        return `${prefix} ${text}`;
      }
      return text;
    }

    // Line click listener
    lineElements.forEach(lineEl => {
      lineEl.addEventListener("click", async () => {
        const idx = parseInt(lineEl.getAttribute("data-line-index"), 10);
        const originalText = lecture.content[idx];
        const formattedText = formatLine(originalText);
        
        const success = await copyToClipboard(formattedText);
        if (success) {
          // Visual feedback on the line
          lineEl.classList.add("copied");
          
          // Add temporary ripple effect
          const ripple = document.createElement("div");
          ripple.className = "copied-ripple";
          lineEl.appendChild(ripple);
          setTimeout(() => ripple.remove(), 500);

          showToast(`Скопирована строка ${idx + 1}`);
        }
      });
    });

    // Copy All listener
    if (btnCopyAll) {
      btnCopyAll.addEventListener("click", async () => {
        const formattedLines = lecture.content.map(line => formatLine(line));
        const fullText = formattedLines.join("\n");
        
        const success = await copyToClipboard(fullText);
        if (success) {
          // Highlight all lines
          lineElements.forEach(el => el.classList.add("copied"));
          showToast("Вся лекция скопирована в буфер!");
        }
      });
    }

    // Reset lines marks listener
    if (btnResetLines) {
      btnResetLines.addEventListener("click", () => {
        lineElements.forEach(el => el.classList.remove("copied"));
        showToast("Отметки сброшены");
      });
    }
  }

  // --- SEARCH EVENTS ---
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderLecturesList();
    });
  }
});
