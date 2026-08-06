/**
 * Amazing Online Portal - Authentication, Admin API & Wishes Module with Locked Admin Rank & Avatars
 */

const TURSO_CONFIG = {
  url: 'https://amazing-db-xinatory501.aws-eu-west-1.turso.io/v2/pipeline',
  token: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODU2MDM2NzUsImlkIjoiMDE5ZmJlNDQtMTEwMS03NjE1LTk0NzAtZDEyMTdiMjBkZDM3Iiwia2lkIjoibjd4RzFTZzlJalRqMm5GYTdUUmFWek1IeDhQNmxVaVFhSWFNMlZUeTVwTSIsInJpZCI6IjQ4Njg5OGNiLTRhNzktNDhiMS05ZDAxLTU4Njk5Yzk0MjQ3OSJ9.SLy-Kv-TGxN9IHCEvt6RpnR96qbjCQgHbV4uiekI9G-FIfQapnZkbm5aYb0GJgXl1k970DCUFB2C830oAZctBg'
};

const OFFICIAL_RANKS = [
  'Администратор портала',
  'Охранник',
  'Начальник охраны',
  'Адвокат',
  'Инспектор',
  'Советник',
  'Заместитель министра',
  'Министр',
  'Глава администрации',
  'Вице-губернатор',
  'Губернатор'
];

const OFFICIAL_DEPARTMENTS = [
  'Не назначен',
  'Региональная безопасность',
  'Адвокатская палата',
  'ООК',
  'Южный район',
  'Арзамасский район',
  'Батыревский район',
  'Отсутствует'
];

async function executeTursoQuery(statements) {
  const reqBody = {
    requests: [
      ...statements.map(stmt => ({
        type: 'execute',
        stmt: typeof stmt === 'string' ? { sql: stmt } : stmt
      })),
      { type: 'close' }
    ]
  };

  const res = await fetch(TURSO_CONFIG.url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TURSO_CONFIG.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(reqBody)
  });

  if (!res.ok) {
    throw new Error('Ошибка связи с сервером базы данных Turso');
  }

  const data = await res.json();
  const results = data.results || [];
  
  for (const r of results) {
    if (r.type === 'error') {
      throw new Error(r.error ? r.error.message : 'Ошибка выполнения SQL запроса');
    }
  }

  return results;
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + '_amazing_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateUUID() {
  return 'u_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

let cachedGeo = null;

async function fetchUserGeoLocation() {
  if (cachedGeo) return cachedGeo;
  const stored = sessionStorage.getItem('amazing_geo_cache');
  if (stored) {
    try {
      cachedGeo = JSON.parse(stored);
      return cachedGeo;
    } catch(e) {}
  }

  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && data.ip) {
        cachedGeo = {
          ip: data.ip,
          country: data.country || 'Не определена',
          city: data.city || ''
        };
        sessionStorage.setItem('amazing_geo_cache', JSON.stringify(cachedGeo));
        return cachedGeo;
      }
    }
  } catch(e) {}

  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        cachedGeo = {
          ip: data.ip,
          country: data.country_name || 'Не определена',
          city: data.city || ''
        };
        sessionStorage.setItem('amazing_geo_cache', JSON.stringify(cachedGeo));
        return cachedGeo;
      }
    }
  } catch(e) {}

  cachedGeo = { ip: 'Анонимный IP', country: 'Не определена', city: '' };
  return cachedGeo;
}

const HIGH_RANKS = ['Глава администрации', 'Вице-губернатор', 'Губернатор'];

function validateTwoWordNickname(name) {
  const clean = (name || '').trim();
  const parts = clean.split(/[ _]+/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  const letterRegex = /^[A-Za-zА-Яа-яЁё]+$/;
  return letterRegex.test(parts[0]) && letterRegex.test(parts[1]);
}

const AuthService = {
  currentUser: null,
  ranks: OFFICIAL_RANKS,
  departments: OFFICIAL_DEPARTMENTS,

  init() {
    const stored = localStorage.getItem('amazing_portal_user');
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch (e) {
        this.currentUser = null;
        localStorage.removeItem('amazing_portal_user');
      }
    }
    this.logGuestVisit('Главная');
    this.syncSessionFromDB();
    return this.currentUser;
  },

  async syncSessionFromDB() {
    if (!this.currentUser || !this.currentUser.username) return;
    try {
      const res = await executeTursoQuery([
        {
          sql: "SELECT id, username, role, rank, department, avatar_url, COALESCE(is_admin, 0), COALESCE(is_banned, 0), COALESCE(pending_rank, '') FROM users WHERE LOWER(username) = LOWER(?)",
          args: [{ type: 'text', value: this.currentUser.username }]
        }
      ]);
      const rows = res[0]?.response?.result?.rows || [];
      if (rows.length > 0) {
        const r = rows[0];
        const isBanned = Number(r[7]?.value || 0) === 1;
        if (isBanned) {
          this.logout();
          if (typeof window !== 'undefined' && typeof window.updateSidebarUserUI === 'function') window.updateSidebarUserUI();
          return;
        }
        this.currentUser.id = r[0]?.value || this.currentUser.id;
        this.currentUser.username = r[1]?.value || this.currentUser.username;
        this.currentUser.rank = r[3]?.value || r[2]?.value || this.currentUser.rank;
        this.currentUser.department = r[4]?.value || this.currentUser.department;
        this.currentUser.avatar_url = r[5]?.value || this.currentUser.avatar_url;
        this.currentUser.is_admin = Number(r[6]?.value || 0);
        this.currentUser.is_banned = 0;
        this.currentUser.pending_rank = r[8]?.value || '';

        localStorage.setItem('amazing_portal_user', JSON.stringify(this.currentUser));
        if (typeof window !== 'undefined' && typeof window.updateSidebarUserUI === 'function') {
          window.updateSidebarUserUI();
        }
      }
    } catch(e) {}
  },

  getCurrentUser() {
    return this.currentUser;
  },

  isAdmin() {
    if (!this.currentUser) return false;
    const rank = (this.currentUser.rank || '').toLowerCase();
    const name = (this.currentUser.username || '').toLowerCase();
    const isAdminFlag = this.currentUser.is_admin === 1 || this.currentUser.is_admin === true || this.currentUser.role === 'admin';
    return rank === 'администратор портала' || name === 'savely_gerov' || isAdminFlag;
  },

  async logGuestVisit(pageName = 'Главная') {
    if (this.currentUser) return;
    try {
      const geo = await fetchUserGeoLocation();
      const ipKey = 'ip_' + String(geo.ip).replace(/[^a-zA-Z0-9_]/g, '_');
      const ua = navigator.userAgent ? navigator.userAgent.substring(0, 80) : 'Браузер';

      await executeTursoQuery([
        {
          sql: 'INSERT INTO guest_visits (id, ip_address, user_agent, page, country, city, last_active, visit_count) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1) ON CONFLICT(id) DO UPDATE SET page = ?, country = ?, city = ?, last_active = CURRENT_TIMESTAMP, visit_count = COALESCE(visit_count, 1) + 1',
          args: [
            { type: 'text', value: ipKey },
            { type: 'text', value: geo.ip },
            { type: 'text', value: ua },
            { type: 'text', value: pageName },
            { type: 'text', value: geo.country },
            { type: 'text', value: geo.city },
            { type: 'text', value: pageName },
            { type: 'text', value: geo.country },
            { type: 'text', value: geo.city }
          ]
        }
      ]);
    } catch (e) {}
  },

  async register(username, password, rank = 'Охранник', department = 'Отсутствует', avatarUrl = '') {
    const cleanUser = username.trim();
    if (!validateTwoWordNickname(cleanUser)) {
      throw new Error('Никнейм должен состоять ровно из 2 слов (например: Savely_Gerov или Savely Gerov)');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен содержать минимум 4 символа');
    }

    const passwordHash = await sha256(password);
    const userId = generateUUID();

    const checkRes = await executeTursoQuery([
      {
        sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
        args: [{ type: 'text', value: cleanUser }]
      }
    ]);

    const existingRows = checkRes[0]?.response?.result?.rows || [];
    if (existingRows.length > 0) {
      throw new Error('Пользователь с таким ником уже зарегистрирован');
    }

    // 🔒 Ranks above Minister require Admin Approval
    let activeRank = rank;
    let pendingRank = '';
    const isHighRank = HIGH_RANKS.includes(rank);
    if (isHighRank) {
      activeRank = 'Министр';
      pendingRank = rank;
    }

    await executeTursoQuery([
      {
        sql: 'INSERT INTO users (id, username, password_hash, role, rank, department, avatar_url, pending_rank, is_admin, is_banned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)',
        args: [
          { type: 'text', value: userId },
          { type: 'text', value: cleanUser },
          { type: 'text', value: passwordHash },
          { type: 'text', value: activeRank },
          { type: 'text', value: activeRank },
          { type: 'text', value: department },
          { type: 'text', value: avatarUrl || '' },
          { type: 'text', value: pendingRank }
        ]
      }
    ]);

    const userObj = {
      id: userId,
      username: cleanUser,
      rank: activeRank,
      department: department,
      avatar_url: avatarUrl || '',
      pending_rank: pendingRank,
      is_admin: 0,
      is_banned: 0
    };

    this.currentUser = userObj;
    localStorage.setItem('amazing_portal_user', JSON.stringify(userObj));
    return userObj;
  },

  async login(username, password) {
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      throw new Error('Введите имя пользователя и пароль');
    }

    const passwordHash = await sha256(password);

    const res = await executeTursoQuery([
      {
        sql: "SELECT id, username, password_hash, role, rank, department, avatar_url, COALESCE(is_admin, 0), COALESCE(is_banned, 0), COALESCE(pending_rank, '') FROM users WHERE LOWER(username) = LOWER(?)",
        args: [{ type: 'text', value: cleanUser }]
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    if (!rows.length) {
      throw new Error('Пользователь не найден. Проверьте логин или зарегистрируйтесь');
    }

    const userRow = rows[0];
    const dbPassHash = userRow[2]?.value || '';
    const isBanned = Number(userRow[8]?.value || 0) === 1;

    if (isBanned) {
      throw new Error('Ваш аккаунт заблокирован администратором.');
    }

    if (dbPassHash !== passwordHash) {
      throw new Error('Неверный пароль');
    }

    const isAdminVal = Number(userRow[7]?.value || 0);

    const userObj = {
      id: userRow[0]?.value || '',
      username: userRow[1]?.value || cleanUser,
      rank: userRow[4]?.value || userRow[3]?.value || 'Охранник',
      department: userRow[5]?.value || 'Отсутствует',
      avatar_url: userRow[6]?.value || '',
      is_admin: isAdminVal,
      is_banned: 0,
      pending_rank: userRow[9]?.value || ''
    };

    this.currentUser = userObj;
    localStorage.setItem('amazing_portal_user', JSON.stringify(userObj));
    return userObj;
  },

  async updateProfile(rank, department, avatarUrl = null) {
    if (!this.currentUser) {
      throw new Error('Вы не авторизованы');
    }

    // 🔒 Admin Rank Lock Check
    let targetRank = rank;
    let pendingRank = this.currentUser.pending_rank || '';
    const isUserAdmin = this.isAdmin();
    
    if (isUserAdmin) {
      targetRank = 'Администратор портала'; // Lock rank for administrator
      pendingRank = '';
    } else if (HIGH_RANKS.includes(rank)) {
      // High ranks require Admin approval for regular users
      pendingRank = rank;
      targetRank = this.currentUser.rank && !HIGH_RANKS.includes(this.currentUser.rank) ? this.currentUser.rank : 'Министр';
    }

    const finalAvatar = avatarUrl !== null ? avatarUrl : (this.currentUser.avatar_url || '');

    await executeTursoQuery([
      {
        sql: 'UPDATE users SET rank = ?, department = ?, pending_rank = ?, avatar_url = ? WHERE id = ?',
        args: [
          { type: 'text', value: targetRank },
          { type: 'text', value: department },
          { type: 'text', value: pendingRank },
          { type: 'text', value: finalAvatar },
          { type: 'text', value: this.currentUser.id }
        ]
      }
    ]);

    this.currentUser.rank = targetRank;
    this.currentUser.department = department;
    this.currentUser.pending_rank = pendingRank;
    this.currentUser.avatar_url = finalAvatar;
    localStorage.setItem('amazing_portal_user', JSON.stringify(this.currentUser));
    return this.currentUser;
  },

  // ── WISHES SYSTEM API ────────────────────────────
  async submitWish(title, content) {
    if (!this.currentUser) {
      throw new Error('Для отправки пожелания необходимо войти в аккаунт.');
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle || cleanTitle.length < 3) {
      throw new Error('Укажите краткую тему пожелания (не менее 3 символов).');
    }
    if (!cleanContent || cleanContent.length < 10) {
      throw new Error('Подробно опишите ваше пожелание (не менее 10 символов).');
    }

    const wishId = 'w_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();

    await executeTursoQuery([
      {
        sql: 'INSERT INTO wishes (id, user_id, username, title, content, status) VALUES (?, ?, ?, ?, ?, \'pending\')',
        args: [
          { type: 'text', value: wishId },
          { type: 'text', value: this.currentUser.id },
          { type: 'text', value: this.currentUser.username },
          { type: 'text', value: cleanTitle },
          { type: 'text', value: cleanContent }
        ]
      }
    ]);

    return wishId;
  },

  async getUserWishes() {
    if (!this.currentUser) return [];

    const res = await executeTursoQuery([
      {
        sql: 'SELECT id, title, content, status, created_at FROM wishes WHERE user_id = ? ORDER BY created_at DESC',
        args: [{ type: 'text', value: this.currentUser.id }]
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    return rows.map(r => ({
      id: r[0]?.value || '',
      title: r[1]?.value || '',
      content: r[2]?.value || '',
      status: r[3]?.value || 'pending',
      createdAt: r[4]?.value || ''
    }));
  },

  async adminGetAllWishes() {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT id, user_id, username, title, content, status, created_at FROM wishes ORDER BY created_at DESC'
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    return rows.map(r => ({
      id: r[0]?.value || '',
      userId: r[1]?.value || '',
      username: r[2]?.value || 'Пользователь',
      title: r[3]?.value || '',
      content: r[4]?.value || '',
      status: r[5]?.value || 'pending',
      createdAt: r[6]?.value || ''
    }));
  },

  async adminUpdateWishStatus(wishId, status) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    await executeTursoQuery([
      {
        sql: 'UPDATE wishes SET status = ? WHERE id = ?',
        args: [
          { type: 'text', value: status },
          { type: 'text', value: wishId }
        ]
      }
    ]);
  },

  async adminDeleteWish(wishId) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    await executeTursoQuery([
      {
        sql: 'DELETE FROM wishes WHERE id = ?',
        args: [{ type: 'text', value: wishId }]
      }
    ]);
  },

  // ── ADMIN PANEL ADVANCED API ─────────────────────
  async adminGetAllUsers() {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: "SELECT id, username, rank, department, role, avatar_url, COALESCE(is_admin, 0), COALESCE(is_banned, 0), COALESCE(pending_rank, '') FROM users ORDER BY username ASC"
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    return rows.map(r => ({
      id: r[0]?.value || '',
      username: r[1]?.value || '',
      rank: r[2]?.value || r[4]?.value || 'Охранник',
      department: r[3]?.value || 'Отсутствует',
      avatarUrl: r[5]?.value || '',
      is_admin: Number(r[6]?.value || 0) === 1 || r[2]?.value === 'Администратор портала' || (r[1]?.value || '').toLowerCase() === 'savely_gerov',
      is_banned: Number(r[7]?.value || 0) === 1,
      pending_rank: r[8]?.value || ''
    }));
  },

  async adminToggleAdmin(userId, makeAdmin) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT username FROM users WHERE id = ?',
        args: [{ type: 'text', value: userId }]
      }
    ]);
    const targetName = (res[0]?.response?.result?.rows?.[0]?.[0]?.value || '').toLowerCase();
    if (targetName === 'savely_gerov' && !makeAdmin) {
      throw new Error('Снять права администратора с Savely_Gerov невозможно!');
    }

    const isAdmVal = makeAdmin ? 1 : 0;
    const roleVal = makeAdmin ? 'admin' : 'user';
    const rankVal = makeAdmin ? 'Администратор портала' : 'Охранник';

    await executeTursoQuery([
      {
        sql: 'UPDATE users SET is_admin = ?, role = ?, rank = ? WHERE id = ?',
        args: [
          { type: 'integer', value: isAdmVal },
          { type: 'text', value: roleVal },
          { type: 'text', value: rankVal },
          { type: 'text', value: userId }
        ]
      }
    ]);
  },

  async adminToggleBan(userId, ban) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT username FROM users WHERE id = ?',
        args: [{ type: 'text', value: userId }]
      }
    ]);
    const targetName = (res[0]?.response?.result?.rows?.[0]?.[0]?.value || '').toLowerCase();
    if (targetName === 'savely_gerov' && ban) {
      throw new Error('Заблокировать аккаунт Savely_Gerov невозможно!');
    }

    const banVal = ban ? 1 : 0;

    await executeTursoQuery([
      {
        sql: 'UPDATE users SET is_banned = ? WHERE id = ?',
        args: [
          { type: 'integer', value: banVal },
          { type: 'text', value: userId }
        ]
      }
    ]);
  },

  async adminApproveRank(userId) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT pending_rank FROM users WHERE id = ?',
        args: [{ type: 'text', value: userId }]
      }
    ]);

    const pendingRank = res[0]?.response?.result?.rows?.[0]?.[0]?.value;
    if (!pendingRank) return;

    await executeTursoQuery([
      {
        sql: "UPDATE users SET rank = ?, role = ?, pending_rank = '' WHERE id = ?",
        args: [
          { type: 'text', value: pendingRank },
          { type: 'text', value: pendingRank },
          { type: 'text', value: userId }
        ]
      }
    ]);
  },

  async adminRejectRank(userId) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    await executeTursoQuery([
      {
        sql: "UPDATE users SET pending_rank = '' WHERE id = ?",
        args: [{ type: 'text', value: userId }]
      }
    ]);
  },

  async adminGetGuestVisits() {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT id, ip_address, user_agent, page, country, city, last_active, COALESCE(visit_count, 1) FROM guest_visits ORDER BY last_active DESC LIMIT 50'
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    return rows.map(r => ({
      id: r[0]?.value || '',
      ip: r[1]?.value || r[0]?.value || 'Анонимный IP',
      userAgent: r[2]?.value || 'Браузер',
      page: r[3]?.value || 'Главная',
      country: r[4]?.value || '',
      city: r[5]?.value || '',
      lastActive: r[6]?.value || '',
      visitCount: r[7]?.value || 1
    }));
  },

  async adminCreateUser(username, password, rank, department) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const cleanUser = username.trim();
    if (!validateTwoWordNickname(cleanUser)) {
      throw new Error('Никнейм должен состоять ровно из 2 слов (например: Savely_Gerov или Savely Gerov)');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен содержать минимум 4 символа');
    }

    const passwordHash = await sha256(password);
    const userId = generateUUID();

    const checkRes = await executeTursoQuery([
      {
        sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
        args: [{ type: 'text', value: cleanUser }]
      }
    ]);

    if ((checkRes[0]?.response?.result?.rows || []).length > 0) {
      throw new Error('Сотрудник с таким никнеймом уже зарегистрирован');
    }

    await executeTursoQuery([
      {
        sql: 'INSERT INTO users (id, username, password_hash, role, rank, department) VALUES (?, ?, ?, ?, ?, ?)',
        args: [
          { type: 'text', value: userId },
          { type: 'text', value: cleanUser },
          { type: 'text', value: passwordHash },
          { type: 'text', value: rank },
          { type: 'text', value: rank },
          { type: 'text', value: department }
        ]
      }
    ]);
  },

  async adminUpdateUser(userId, { rank, department, newPassword }) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    // Check target user to protect Admin rank
    const userRes = await executeTursoQuery([
      {
        sql: 'SELECT username, rank FROM users WHERE id = ?',
        args: [{ type: 'text', value: userId }]
      }
    ]);
    const targetRow = userRes[0]?.response?.result?.rows?.[0];
    const targetName = (targetRow?.[0]?.value || '').toLowerCase();
    const targetCurrentRank = targetRow?.[1]?.value || '';

    let finalRank = rank;
    if (targetCurrentRank === 'Администратор портала' || targetName === 'savely_gerov') {
      finalRank = 'Администратор портала'; // Lock admin rank
    }

    const statements = [];

    if (newPassword && newPassword.trim().length >= 4) {
      const passHash = await sha256(newPassword.trim());
      statements.push({
        sql: 'UPDATE users SET rank = ?, department = ?, role = ?, password_hash = ? WHERE id = ?',
        args: [
          { type: 'text', value: finalRank },
          { type: 'text', value: department },
          { type: 'text', value: finalRank },
          { type: 'text', value: passHash },
          { type: 'text', value: userId }
        ]
      });
    } else {
      statements.push({
        sql: 'UPDATE users SET rank = ?, department = ?, role = ? WHERE id = ?',
        args: [
          { type: 'text', value: finalRank },
          { type: 'text', value: department },
          { type: 'text', value: finalRank },
          { type: 'text', value: userId }
        ]
      });
    }

    await executeTursoQuery(statements);

    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser.rank = finalRank;
      this.currentUser.department = department;
      localStorage.setItem('amazing_portal_user', JSON.stringify(this.currentUser));
    }
  },

  async adminDeleteUser(userId) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT username FROM users WHERE id = ?',
        args: [{ type: 'text', value: userId }]
      }
    ]);
    const targetName = (res[0]?.response?.result?.rows?.[0]?.[0]?.value || '').toLowerCase();
    if (targetName === 'savely_gerov') {
      throw new Error('Удаление Главного Администратора (Savely_Gerov) запрещено!');
    }

    await executeTursoQuery([
      {
        sql: 'DELETE FROM users WHERE id = ?',
        args: [{ type: 'text', value: userId }]
      }
    ]);
  },

  async getAnnouncement() {
    try {
      const res = await executeTursoQuery([
        {
          sql: 'SELECT content, created_by, created_at FROM announcements ORDER BY created_at DESC LIMIT 1'
        }
      ]);
      const rows = res[0]?.response?.result?.rows || [];
      if (!rows.length) return null;
      return {
        content: rows[0][0]?.value || '',
        createdBy: rows[0][1]?.value || '',
        createdAt: rows[0][2]?.value || ''
      };
    } catch (e) {
      return null;
    }
  },

  async adminSetAnnouncement(content) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const clean = content.trim();
    if (!clean) {
      await executeTursoQuery([{ sql: 'DELETE FROM announcements' }]);
      return;
    }

    const id = 'ann_' + Date.now();
    const creator = this.currentUser ? this.currentUser.username : 'Администрация';

    await executeTursoQuery([
      { sql: 'DELETE FROM announcements' },
      {
        sql: 'INSERT INTO announcements (id, content, created_by) VALUES (?, ?, ?)',
        args: [
          { type: 'text', value: id },
          { type: 'text', value: clean },
          { type: 'text', value: creator }
        ]
      }
    ]);
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('amazing_portal_user');
  }
};

if (typeof window !== 'undefined') {
  window.AuthService = AuthService;
  AuthService.init();
}
