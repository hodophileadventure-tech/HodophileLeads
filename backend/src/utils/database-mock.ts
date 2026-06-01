import bcryptjs from 'bcryptjs';

// In-memory database for development
const db = {
  users: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'admin@hodophile.com',
      name: 'Admin User',
      password: '$2a$10$hbMKu.dCXAwpVBWqxFXAL.7SKl49B/IDXphos3pxT1FV/v8ASD4rW',
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  leads: [],
  followUps: [],
  itineraries: [],
  payments: [],
  availability: [],
  clientProfiles: [],
  auditLogs: [],
  screenCaptures: []
};

// Passwords are stored as bcrypt hashes in the mock DB seed above.

export const query = async (text: string, params?: any[]) => {
  console.log('[MOCK DB Query]', { text, params });

  // SELECT * FROM users WHERE email = $1
  if (text.includes('SELECT * FROM users WHERE email')) {
    const email = params?.[0];
    const user = db.users.find(u => u.email === email);
    return {
      rows: user ? [user] : [],
      rowCount: user ? 1 : 0
    };
  }

  // INSERT INTO users (email, name, password, role) VALUES ...
  if (text.includes('INSERT INTO users') && text.includes('RETURNING')) {
    const [email, name, password, role] = params || [];
    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
      password,
      role: role || 'agent',
      created_at: new Date(),
      updated_at: new Date()
    };
    db.users.push(newUser);
    return {
      rows: [newUser],
      rowCount: 1
    };
  }

  // Default response
  return {
    rows: [],
    rowCount: 0
  };
};

export const getClient = async () => {
  return {
    query,
    release: () => {}
  };
};

export default query;
