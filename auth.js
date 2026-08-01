/**
 * Amazing Online Portal - Authentication & Turso DB API Module
 * Works on both GitHub Pages and Cloudflare Pages
 */

const TURSO_CONFIG = {
  url: 'https://amazing-db-xinatory501.aws-eu-west-1.turso.io/v2/pipeline',
  token: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODU2MDM2NzUsImlkIjoiMDE5ZmJlNDQtMTEwMS03NjE1LTk0NzAtZDEyMTdiMjBkZDM3Iiwia2lkIjoibjd4RzFTZzlJalRqMm5GYTdUUmFWek1IeDhQNmxVaVFhSWFNMlZUeTVwTSIsInJpZCI6IjQ4Njg5OGNiLTRhNzktNDhiMS05ZDAxLTU4Njk5Yzk0MjQ3OSJ9.SLy-Kv-TGxN9IHCEvt6RpnR96qbjCQgHbV4uiekI9G-FIfQapnZkbm5aYb0GJgXl1k970DCUFB2C830oAZctBg'
};

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
  
  // Check for execution errors
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

  async register(username, password, role = 'Пользователь', rank = 'Сотрудник') {
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
      throw new Error('Пользователь с таким именем уже зарегистрирован');
    }

    // Insert user
    await executeTursoQuery([
      {
        sql: 'INSERT INTO users (id, username, password_hash, role, rank) VALUES (?, ?, ?, ?, ?)',
        args: [
          { type: 'text', value: userId },
          { type: 'text', value: cleanUser },
          { type: 'text', value: passwordHash },
          { type: 'text', value: role },
          { type: 'text', value: rank }
        ]
      }
    ]);

    const userObj = {
      id: userId,
      username: cleanUser,
      role: role,
      rank: rank,
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
        sql: 'SELECT id, username, password_hash, role, rank, avatar_url FROM users WHERE LOWER(username) = LOWER(?)',
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
      role: userRow[3]?.value || 'Пользователь',
      rank: userRow[4]?.value || 'Сотрудник',
      avatar_url: userRow[5]?.value || ''
    };

    this.currentUser = userObj;
    localStorage.setItem('amazing_portal_user', JSON.stringify(userObj));
    return userObj;
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
