/**
 * Amazing Online Portal - Authentication & Turso DB API Module
 */

const TURSO_CONFIG = {
  url: 'https://amazing-db-xinatory501.aws-eu-west-1.turso.io/v2/pipeline',
  token: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODU2MDM2NzUsImlkIjoiMDE5ZmJlNDQtMTEwMS03NjE1LTk0NzAtZDEyMTdiMjBkZDM3Iiwia2lkIjoibjd4RzFTZzlJalRqMm5GYTdUUmFWek1IeDhQNmxVaVFhSWFNMlZUeTVwTSIsInJpZCI6IjQ4Njg5OGNiLTRhNzktNDhiMS05ZDAxLTU4Njk5Yzk0MjQ3OSJ9.SLy-Kv-TGxN9IHCEvt6RpnR96qbjCQgHbV4uiekI9G-FIfQapnZkbm5aYb0GJgXl1k970DCUFB2C830oAZctBg'
};

const OFFICIAL_RANKS = [
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
  'Региональная безопасность',
  'Адвокатская палата',
  'ООК',
  'Южный район',
  'Арзамасский',
  'Батыревский',
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
    return this.currentUser;
  },

  getCurrentUser() {
    return this.currentUser;
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

    // Check if username exists
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

    // Insert user
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

  logout() {
    this.currentUser = null;
    localStorage.removeItem('amazing_portal_user');
  }
};

if (typeof window !== 'undefined') {
  window.AuthService = AuthService;
  AuthService.init();
}
