document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const tabBtns = document.querySelectorAll('.menu-item[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  const goToLecturesCard = document.getElementById('go-to-lectures-card');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const htmlRoot = document.documentElement;
  
  const lecturesListContainer = document.getElementById('lectures-list-container');
  const categoryFiltersList = document.getElementById('category-filters-list');
  const activeLectureViewer = document.getElementById('active-lecture-viewer');
  const searchInput = document.getElementById('lecture-search');
  const toast = document.getElementById('copy-toast');
  const toastMessage = document.getElementById('toast-message');

  // --- State ---
  let activeCategory = 'Все';
  let activeLectureId = null;

  // --- Theme Toggle Logic ---
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlRoot.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  });

  function setTheme(theme) {
    htmlRoot.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update button content
    const icon = themeToggleBtn.querySelector('i');
    const text = themeToggleBtn.querySelector('span');
    
    if (theme === 'dark') {
      icon.className = 'fa-solid fa-sun';
      text.textContent = 'Светлая тема';
    } else {
      icon.className = 'fa-solid fa-moon';
      text.textContent = 'Темная тема';
    }
  }

  // --- Tab Navigation ---
  function switchTab(tabId) {
    // Update buttons
    tabBtns.forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update content panels
    tabContents.forEach(content => {
      if (content.id === `tab-${tabId}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('disabled')) {
        switchTab(btn.dataset.tab);
      }
    });
  });

  if (goToLecturesCard) {
    goToLecturesCard.addEventListener('click', () => switchTab('lectures'));
  }

  // --- Toast Notification ---
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // --- Copy Functionality ---
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Текст скопирован!');
    }).catch(err => {
      console.error('Ошибка копирования: ', err);
      showToast('Ошибка при копировании');
    });
  }

  // --- Render Categories ---
  function renderCategories() {
    // Get unique categories
    const categories = ['Все', ...new Set(lecturesData.map(l => l.category))];
    
    categoryFiltersList.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `category-tab ${cat === activeCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeCategory = cat;
        // Update active class
        document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderLecturesList();
      });
      categoryFiltersList.appendChild(btn);
    });
  }

  // --- Render Lectures List ---
  function renderLecturesList() {
    const query = searchInput.value.toLowerCase().trim();
    
    // Filter data
    const filteredLectures = lecturesData.filter(lecture => {
      const matchCategory = activeCategory === 'Все' || lecture.category === activeCategory;
      const matchSearch = lecture.title.toLowerCase().includes(query) || 
                          lecture.text.toLowerCase().includes(query);
      return matchCategory && matchSearch;
    });

    lecturesListContainer.innerHTML = '';

    if (filteredLectures.length === 0) {
      lecturesListContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">
          Ничего не найдено
        </div>
      `;
      return;
    }

    filteredLectures.forEach(lecture => {
      const item = document.createElement('div');
      item.className = `lecture-item ${lecture.id === activeLectureId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="item-meta">
          <span class="item-badge">${lecture.category}</span>
        </div>
        <h4>${lecture.title}</h4>
        <p>${lecture.description}</p>
      `;
      
      item.addEventListener('click', () => {
        activeLectureId = lecture.id;
        // Update active classes
        document.querySelectorAll('.lecture-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        renderActiveLecture();
      });
      
      lecturesListContainer.appendChild(item);
    });
  }

  // --- Render Active Lecture ---
  function renderActiveLecture() {
    if (!activeLectureId) return;

    const lecture = lecturesData.find(l => l.id === activeLectureId);
    if (!lecture) return;

    activeLectureViewer.innerHTML = `
      <div class="lecture-view-container animation-fade-in">
        <div class="viewer-header">
          <div class="header-meta">
            <span class="meta-badge">${lecture.category}</span>
            <h2 class="viewer-title">${lecture.title}</h2>
          </div>
        </div>

        <div class="viewer-actions">
          <button class="btn btn-primary" id="copy-full-btn">
            <i class="fa-solid fa-copy"></i> Скопировать весь текст
          </button>
        </div>

        <div class="lecture-body">
          <textarea class="lecture-textarea-field" id="lecture-textarea" readonly></textarea>
        </div>
      </div>
    `;

    const textarea = document.getElementById('lecture-textarea');
    textarea.value = lecture.text;

    // Set up copy button event
    document.getElementById('copy-full-btn').addEventListener('click', () => {
      copyToClipboard(textarea.value);
    });
  }

  // --- Event Listeners ---
  searchInput.addEventListener('input', () => {
    renderLecturesList();
  });

  // --- Initialization ---
  renderCategories();
  renderLecturesList();
});
