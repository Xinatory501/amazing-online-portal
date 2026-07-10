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
    
    tabButtons.forEach(btn => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    
    tabContents.forEach(content => {
      if (content.id === `tab-${tabId}`) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });

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
        console.error("Не удалось скопировать: ", e);
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
                            lec.text.toLowerCase().includes(searchQuery.toLowerCase());
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
        </div>
        <h4>${lec.title}</h4>
        <p>${lec.description}</p>
      </div>
    `).join("");

    lecturesListContainer.querySelectorAll(".lecture-item").forEach(item => {
      item.addEventListener("click", () => {
        activeLectureId = item.getAttribute("data-id");
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
          <p>Выберите лекцию слева для просмотра текста и копирования.</p>
        </div>
      `;
      return;
    }

    activeLectureViewer.innerHTML = `
      <div class="lecture-view-container">
        
        <div class="viewer-header">
          <div class="header-meta">
            <span class="meta-badge">${lecture.category}</span>
            <h2 class="viewer-title">${lecture.title}</h2>
          </div>
        </div>

        <!-- Copy Settings Panel -->
        <div class="copy-config-panel">
          <div class="panel-title">Настройки текста</div>
          <div class="config-row">
            <label class="checkbox-label">
              <input type="checkbox" id="prefix-enable" checked>
              <span>Префикс рации (/r)</span>
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
            <span>Скопировать текст</span>
          </button>
        </div>

        <!-- Plain Text Viewer -->
        <div class="lecture-body">
          <textarea id="lecture-textarea" readonly class="lecture-textarea-field"></textarea>
        </div>

      </div>
    `;

    setupLectureViewListeners(lecture);
  }

  function setupLectureViewListeners(lecture) {
    const prefixEnable = document.getElementById("prefix-enable");
    const prefixText = document.getElementById("prefix-text");
    const btnCopyAll = document.getElementById("btn-copy-all");
    const textarea = document.getElementById("lecture-textarea");

    function updateTextareaContent() {
      if (!textarea) return;
      
      const lines = lecture.text.split("\n");
      const usePrefix = prefixEnable && prefixEnable.checked;
      const prefix = prefixText ? prefixText.value : "";
      
      if (usePrefix && prefix) {
        textarea.value = lines.map(line => `${prefix} ${line}`).join("\n");
      } else {
        textarea.value = lecture.text;
      }
    }

    // Initialize content
    updateTextareaContent();

    // Event listeners for real-time formatting updates
    if (prefixEnable) {
      prefixEnable.addEventListener("change", updateTextareaContent);
    }
    if (prefixText) {
      prefixText.addEventListener("input", updateTextareaContent);
    }

    // Copy action
    if (btnCopyAll) {
      btnCopyAll.addEventListener("click", async () => {
        if (!textarea) return;
        const success = await copyToClipboard(textarea.value);
        if (success) {
          showToast("Текст лекции скопирован!");
        }
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
