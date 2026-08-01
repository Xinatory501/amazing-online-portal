/**
 * Amazing Online Portal - Authentication, Admin API & Guest Analytics Module
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

function getGuestSessionId() {
  let gid = localStorage.getItem('amazing_guest_session');
  if (!gid) {
    gid = 'guest_' + Math.random().toString(36).substr(2, 8);
    localStorage.setItem('amazing_guest_session', gid);
  }
  return gid;
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
    return this.currentUser;
  },

  getCurrentUser() {
    return this.currentUser;
  },

  isAdmin() {
    if (!this.currentUser) return false;
    const rank = (this.currentUser.rank || '').toLowerCase();
    const name = (this.currentUser.username || '').toLowerCase();
    return rank === 'администратор портала' || rank === 'губернатор' || name === 'savely_gerov';
  },

  async logGuestVisit(pageName = 'Портал') {
    if (this.currentUser) return; // Don't log as guest if logged in
    try {
      const gid = getGuestSessionId();
      const ua = navigator.userAgent ? navigator.userAgent.substring(0, 80) : 'Browser';
      await executeTursoQuery([
        {
          sql: 'INSERT INTO guest_visits (id, user_agent, page, last_active) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET page = ?, last_active = CURRENT_TIMESTAMP',
          args: [
            { type: 'text', value: gid },
            { type: 'text', value: ua },
            { type: 'text', value: pageName },
            { type: 'text', value: pageName }
          ]
        }
      ]);
    } catch (e) {
      // Ignore background analytics logging errors
    }
  },

  async register(username, password, rank = 'Охранник', department = 'Отсутствует') {
    const cleanUser = username.trim();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Имя пользователя должно быть не менее 3 символов');
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

    const userObj = {
      id: userId,
      username: cleanUser,
      rank: rank,
      department: department,
      avatar_url: ''
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
        sql: 'SELECT id, username, password_hash, role, rank, department, avatar_url FROM users WHERE LOWER(username) = LOWER(?)',
        args: [{ type: 'text', value: cleanUser }]
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    if (!rows.length) {
      throw new Error('Пользователь не найден. Проверьте логин или зарегистрируйтесь');
    }

    const userRow = rows[0];
    const dbPassHash = userRow[2]?.value || '';

    if (dbPassHash !== passwordHash) {
      throw new Error('Неверный пароль');
    }

    const userObj = {
      id: userRow[0]?.value || '',
      username: userRow[1]?.value || cleanUser,
      rank: userRow[4]?.value || userRow[3]?.value || 'Охранник',
      department: userRow[5]?.value || 'Отсутствует',
      avatar_url: userRow[6]?.value || ''
    };

    this.currentUser = userObj;
    localStorage.setItem('amazing_portal_user', JSON.stringify(userObj));
    return userObj;
  },

  async updateProfile(rank, department) {
    if (!this.currentUser) {
      throw new Error('Вы не авторизованы');
    }

    await executeTursoQuery([
      {
        sql: 'UPDATE users SET rank = ?, department = ? WHERE id = ?',
        args: [
          { type: 'text', value: rank },
          { type: 'text', value: department },
          { type: 'text', value: this.currentUser.id }
        ]
      }
    ]);

    this.currentUser.rank = rank;
    this.currentUser.department = department;
    localStorage.setItem('amazing_portal_user', JSON.stringify(this.currentUser));
    return this.currentUser;
  },

  // ── ADMIN PANEL ADVANCED API ─────────────────────
  async adminGetAllUsers() {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен. Требуются права администратора.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT id, username, rank, department, role FROM users ORDER BY username ASC'
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    return rows.map(r => ({
      id: r[0]?.value || '',
      username: r[1]?.value || '',
      rank: r[2]?.value || r[4]?.value || 'Охранник',
      department: r[3]?.value || 'Отсутствует'
    }));
  },

  async adminGetGuestVisits() {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const res = await executeTursoQuery([
      {
        sql: 'SELECT id, user_agent, page, last_active FROM guest_visits ORDER BY last_active DESC LIMIT 50'
      }
    ]);

    const rows = res[0]?.response?.result?.rows || [];
    return rows.map(r => ({
      id: r[0]?.value || '',
      userAgent: r[1]?.value || 'Браузер',
      page: r[2]?.value || 'Главная',
      lastActive: r[3]?.value || ''
    }));
  },

  async adminCreateUser(username, password, rank, department) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
    }

    const cleanUser = username.trim();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Имя пользователя должно быть не менее 3 символов');
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

    const statements = [];

    if (newPassword && newPassword.trim().length >= 4) {
      const passHash = await sha256(newPassword.trim());
      statements.push({
        sql: 'UPDATE users SET rank = ?, department = ?, role = ?, password_hash = ? WHERE id = ?',
        args: [
          { type: 'text', value: rank },
          { type: 'text', value: department },
          { type: 'text', value: rank },
          { type: 'text', value: passHash },
          { type: 'text', value: userId }
        ]
      });
    } else {
      statements.push({
        sql: 'UPDATE users SET rank = ?, department = ?, role = ? WHERE id = ?',
        args: [
          { type: 'text', value: rank },
          { type: 'text', value: department },
          { type: 'text', value: rank },
          { type: 'text', value: userId }
        ]
      });
    }

    await executeTursoQuery(statements);

    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser.rank = rank;
      this.currentUser.department = department;
      localStorage.setItem('amazing_portal_user', JSON.stringify(this.currentUser));
    }
  },

  async adminDeleteUser(userId) {
    if (!this.isAdmin()) {
      throw new Error('Доступ запрещен.');
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
