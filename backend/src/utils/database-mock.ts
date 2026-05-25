import bcryptjs from 'bcryptjs';

// In-memory database for development
const db = {
  users: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'admin@tripnexus.com',
      name: 'Admin User',
      password: '', // Will be hashed
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      email: 'agent@tripnexus.com',
      name: 'Agent User',
      password: '', // Will be hashed
      role: 'agent',
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
  auditLogs: []
};

// Initialize with hashed passwords
async function initializeDb() {
  db.users[0].password = await bcryptjs.hash('Admin@123', 10);
  db.users[1].password = await bcryptjs.hash('Agent@123', 10);
}

initializeDb();

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
