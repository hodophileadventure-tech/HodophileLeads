import { Pool, PoolClient } from 'pg';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logDatabaseSchema } from './logDatabaseSchema';

dotenv.config();

type MockRow = Record<string, any>;

// In-memory mock database for development
const mockDb: {
  users: MockRow[];
  leads: MockRow[];
  followUps: MockRow[];
  itineraries: MockRow[];
  payments: MockRow[];
  availability: MockRow[];
  clientProfiles: MockRow[];
  auditLogs: MockRow[];
  screenCaptures: MockRow[];
  dailyReports: MockRow[];
} = {
  users: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'admin@hodophile.com',
      name: 'Admin User',
      // bcrypt hash for password 'admin@123'
      password: '$2a$10$hbMKu.dCXAwpVBWqxFXAL.7SKl49B/IDXphos3pxT1FV/v8ASD4rW',
      role: 'admin',
      last_login_at: null,
      last_logout_at: null,
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
  screenCaptures: [],
  dailyReports: []
};

// Passwords are stored as bcrypt hashes in the mock DB seed above.

let pool: Pool | null = null;
let useMockDb = true;

export const initDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    console.log('[DB INIT] No DATABASE_URL provided — staying in mock DB mode.');
    useMockDb = true;
    return;
  }

  try {
    const p = getPool();
    // simple test query
    await p.query('SELECT 1');
    useMockDb = false;
    console.log('[DB INIT] Connected to Postgres — real DB enabled.');
    
    // Automatically initialize database schema
    await initializeSchema();
    
    await logDatabaseSchema(query);
  } catch (err: any) {
    console.error('[DB INIT] Failed to connect to Postgres, continuing in mock mode.', err?.message || err);
    useMockDb = true;
  }
};

const initializeSchema = async () => {
  try {
    // First check if tables already exist to avoid re-creating and losing data
    const tableCheckResult = await query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    const tableExists = tableCheckResult.rows?.[0]?.count > 0;
    
    if (tableExists) {
      console.log('[SCHEMA INIT] Database schema already exists - skipping initialization');
      return;
    }
    
    console.log('[SCHEMA INIT] Database schema not found - initializing...');
    
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolons and filter out empty statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`[SCHEMA INIT] Executing ${statements.length} SQL statements`);
    
    let successCount = 0;
    for (const statement of statements) {
      try {
        await query(statement);
        successCount++;
      } catch (error: any) {
        // Ignore "already exists" errors - tables may already be created
        if (error.message?.includes('already exists') || error.code === '42P07' || error.code === '42701') {
          console.log(`[SCHEMA INIT] Skipped existing object`);
          successCount++;
        } else {
          console.warn(`[SCHEMA INIT] Warning executing statement:`, error.message);
          // Don't throw - continue with other statements
        }
      }
    }
    
    console.log(`[SCHEMA INIT] Schema initialization complete - ${successCount}/${statements.length} statements executed`);
  } catch (error: any) {
    console.error('[SCHEMA INIT] Failed to initialize schema:', error.message);
    // Don't throw - schema might already exist or be in a valid state
  }
};

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
};

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    // Use mock database by default
    if (useMockDb) {
      console.log('[MOCK DB Query]', { text, params });
      const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
      
      // SELECT * FROM users WHERE email = $1
      if (text.includes('SELECT * FROM users WHERE email')) {
        const email = params?.[0];
        const user = mockDb.users.find(u => u.email === email);
        return {
          rows: user ? [user] : [],
          rowCount: user ? 1 : 0
        };
      }

      // SELECT id, email, name, role FROM users
      if (normalized === "select id, email, name, role, last_login_at, last_logout_at from users where role = 'agent' order by created_at desc" || normalized === 'select id, email, name, role, last_login_at, last_logout_at from users order by created_at desc' || normalized === 'select id, email, name, role from users' || normalized === 'select id, email, name, role from users order by created_at desc') {
        const sourceUsers = normalized.includes("where role = 'agent'")
          ? mockDb.users.filter(u => u.role === 'agent')
          : mockDb.users;
        const rows = sourceUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          last_login_at: u.last_login_at || null,
          last_logout_at: u.last_logout_at || null,
          created_at: u.created_at
        }));
        return { rows, rowCount: rows.length };
      }

      // SELECT * FROM users WHERE id = $1
      if (normalized.includes('select * from users where id = $1')) {
        const id = params?.[0];
        const user = mockDb.users.find(u => u.id === id);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }

      // UPDATE users SET email = $1, name = $2 WHERE id = $3
      if (normalized.includes('update users set') && normalized.includes('where id = $')) {
        const id = params?.[params.length - 1];
        const userIndex = mockDb.users.findIndex(u => u.id === id);
        if (userIndex >= 0) {
          const email = normalized.includes('email = $1') ? params?.[0] ?? mockDb.users[userIndex].email : mockDb.users[userIndex].email;
          const name = normalized.includes('name = $2') ? params?.[1] ?? mockDb.users[userIndex].name : mockDb.users[userIndex].name;
          const nextUser: any = { ...mockDb.users[userIndex], email, name, updated_at: new Date() };
          if (normalized.includes('last_login_at = now()')) nextUser.last_login_at = new Date().toISOString();
          if (normalized.includes('last_logout_at = now()')) nextUser.last_logout_at = new Date().toISOString();
          if (normalized.includes('password = $1')) nextUser.password = params?.[0] ?? nextUser.password;
          mockDb.users[userIndex] = nextUser;
          const updated = mockDb.users[userIndex];
          return { rows: [{ id: updated.id, email: updated.email, name: updated.name, role: updated.role }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (normalized.includes('select count(*) filter (where date(created_at) = current_date) as today_leads') && normalized.includes('from leads') && !normalized.includes('join users u on u.id = l.agent_id')) {
        const leads = mockDb.leads;
        const today = new Date();
        const todayLeads = leads.filter((lead: any) => new Date(lead.created_at || lead.createdAt || Date.now()).toDateString() === today.toDateString()).length;
        const canceledLeads = leads.filter((lead: any) => lead.status === 'canceled').length;
        return {
          rows: [{ today_leads: String(todayLeads), total_leads: String(leads.length), canceled_leads: String(canceledLeads) }],
          rowCount: 1
        };
      }

      if (normalized.includes('select count(*) as canceled_followups') && normalized.includes('from follow_ups') && normalized.includes("where status = 'canceled'")) {
        const canceledFollowUps = mockDb.followUps.filter((item: any) => item.status === 'canceled').length;
        return { rows: [{ canceled_followups: String(canceledFollowUps) }], rowCount: 1 };
      }

      if (normalized.includes('with lead_stats as (') && normalized.includes('followup_stats as (') && normalized.includes('from users u')) {
        const rows = mockDb.users.filter((u) => u.role === 'agent').map((u) => {
          const assignedLeads = mockDb.leads.filter((lead: any) => lead.agent_id === u.id);
          const leadToday = assignedLeads.filter((lead: any) => new Date(lead.created_at || lead.createdAt || Date.now()).toDateString() === new Date().toDateString()).length;
          const canceledLeads = assignedLeads.filter((lead: any) => lead.status === 'canceled').length;
          const assignedFollowUps = mockDb.followUps.filter((item: any) => {
            const lead = mockDb.leads.find((lead: any) => lead.id === item.lead_id);
            return lead?.agent_id === u.id;
          });
          const canceledFollowUps = assignedFollowUps.filter((item: any) => item.status === 'canceled').length;
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            last_login_at: u.last_login_at || null,
            last_logout_at: u.last_logout_at || null,
            total_leads: String(assignedLeads.length),
            today_leads: String(leadToday),
            canceled_leads: String(canceledLeads),
            canceled_followups: String(canceledFollowUps)
          };
        });
        return { rows, rowCount: rows.length };
      }

      if (normalized.includes('select l.id, l.client_name, l.email, l.phone, l.destination, l.status, l.temperature, l.created_at, l.updated_at, l.agent_id, u.name as agent_name, u.email as agent_email') && normalized.includes('from leads l')) {
        const rows = mockDb.leads.map((lead: any) => {
          const agent = mockDb.users.find((user) => user.id === lead.agent_id);
          const followUps = mockDb.followUps.filter((item: any) => item.lead_id === lead.id);
          const canceledBy = mockDb.users.find((user) => user.id === lead.canceled_by);
          return {
            ...lead,
            agent_name: agent?.name || '',
            agent_email: agent?.email || '',
            canceled_by_name: canceledBy?.name || '',
            follow_up_count: String(followUps.length),
            canceled_followups: String(followUps.filter((item: any) => item.status === 'canceled').length)
          };
        }).sort((a: any, b: any) => {
          const agentCompare = String(a.agent_name || '').localeCompare(String(b.agent_name || ''));
          if (agentCompare !== 0) return agentCompare;
          return new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime();
        });
        return { rows, rowCount: rows.length };
      }

      if (normalized.includes("where l.status = 'canceled'") && normalized.includes('from leads l') && normalized.includes('canceled_reason')) {
        const rows = mockDb.leads
          .filter((lead: any) => lead.status === 'canceled')
          .map((lead: any) => {
            const agent = mockDb.users.find((user) => user.id === lead.agent_id);
            const canceledBy = mockDb.users.find((user) => user.id === lead.canceled_by);
            return {
              id: lead.id,
              client_name: lead.client_name || lead.clientName,
              email: lead.email,
              phone: lead.phone,
              destination: lead.destination,
              canceled_reason: lead.canceled_reason || lead.canceledReason || null,
              canceled_at: lead.canceled_at || lead.canceledAt || null,
              agent_id: lead.agent_id,
              agent_name: agent?.name || '',
              agent_email: agent?.email || '',
              canceled_by_name: canceledBy?.name || '',
              canceled_by_email: canceledBy?.email || ''
            };
          });
        return { rows, rowCount: rows.length };
      }

      if (normalized.includes("where f.status = 'canceled'") && normalized.includes('from follow_ups f') && normalized.includes('canceled_reason')) {
        const rows = mockDb.followUps
          .filter((item: any) => item.status === 'canceled')
          .map((item: any) => {
            const lead = mockDb.leads.find((l: any) => l.id === item.lead_id);
            const agent = mockDb.users.find((user) => user.id === lead?.agent_id);
            const canceledBy = mockDb.users.find((user) => user.id === item.canceled_by);
            return {
              id: item.id,
              title: item.task_type || item.title,
              description: item.notes || item.description,
              canceled_reason: item.canceled_reason || null,
              canceled_at: item.canceled_at || null,
              lead_id: item.lead_id,
              client_name: lead?.client_name || lead?.clientName || '',
              agent_id: lead?.agent_id || '',
              agent_name: agent?.name || '',
              agent_email: agent?.email || '',
              canceled_by_name: canceledBy?.name || '',
              canceled_by_email: canceledBy?.email || ''
            };
          });
        return { rows, rowCount: rows.length };
      }

      // UPDATE users SET password = $1 WHERE id = $2
      if (normalized.includes('update users set password =') && normalized.includes('where id = $')) {
        const id = params?.[1];
        const pwd = params?.[0];
        const userIndex = mockDb.users.findIndex(u => u.id === id);
        if (userIndex >= 0) {
          mockDb.users[userIndex].password = pwd;
          mockDb.users[userIndex].updated_at = new Date();
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
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
        const existing = mockDb.users.find(u => u.email === email);
        if (!existing) {
          mockDb.users.push(newUser);
        }
        return {
          rows: [newUser],
          rowCount: 1
        };
      }

      // INSERT INTO leads (...)
      if (normalized.includes('insert into leads') && normalized.includes('returning *')) {
        const normalizedParams = params || [];
        const hasExtendedShape = normalizedParams.length >= 13;

        const [
          clientName,
          email,
          phone,
          destination,
          destinationsRaw,
          source,
          temperature,
          status,
          budget,
          travelDatesRaw,
          hotelInfoRaw,
          hotelOptionsRaw,
          persons,
          agentId
        ] = normalizedParams;

        const createdAt = new Date().toISOString();
        const travelDates = typeof travelDatesRaw === 'string'
          ? (() => {
              try {
                return JSON.parse(travelDatesRaw);
              } catch {
                return { from: travelDatesRaw, to: travelDatesRaw };
              }
            })()
          : (travelDatesRaw || { from: '', to: '' });

        const hotelInfo = hotelInfoRaw
          ? (typeof hotelInfoRaw === 'string' ? JSON.parse(hotelInfoRaw) : hotelInfoRaw)
          : null;

          const destinations = destinationsRaw
            ? (typeof destinationsRaw === 'string' ? JSON.parse(destinationsRaw) : destinationsRaw)
            : destination
              ? [destination]
              : [];

          const hotelOptions = hotelOptionsRaw
            ? (typeof hotelOptionsRaw === 'string' ? JSON.parse(hotelOptionsRaw) : hotelOptionsRaw)
            : hotelInfo
              ? [hotelInfo]
              : [];

          const specialRequests = hasExtendedShape ? '' : (params?.[11] || '');

        const newLead = {
          id: Math.random().toString(36).slice(2, 11),
          clientName: clientName || '',
          email: email || '',
          phone: phone || '',
          destination: destination || '',
          travelDates,
          budget: Number(budget || 0),
          source: source || 'direct',
          leadSource: source || 'whatsapp',
          budgetRange: Number(budget || 0) > 800000 ? 'premium' : Number(budget || 0) > 300000 ? 'standard' : 'economy',
          persons: Number(persons || 1),
          adults: Number(normalizedParams[19] ?? 1),
          kids: Number(normalizedParams[20] ?? 0),
          seniors: 0,
          temperature: temperature || 'cold',
          status: status || 'new',
          lead_outcome: params?.[20] || null,
          leadOutcome: params?.[20] || null,
          pipelineStage: 'new_lead',
          agentId: agentId || '',
          specialRequests: specialRequests || '',
          canceledReason: null,
          canceledBy: null,
          canceledAt: null,
          hotelInfo,
          createdAt,
          updatedAt: createdAt,
          // Keep snake_case mirrors for compatibility with any raw SQL-shaped consumers
          client_name: clientName || '',
          destinations,
          travel_dates: travelDates,
          hotel_info: hotelInfo,
          hotel_options: hotelOptions,
          agent_id: agentId || '',
          pipeline_stage: 'new_lead',
          special_requests: specialRequests || '',
          canceled_reason: null,
          canceled_by: null,
          canceled_at: null,
          created_at: createdAt,
          updated_at: createdAt
        };

        mockDb.leads.unshift(newLead);
        return {
          rows: [newLead],
          rowCount: 1
        };
      }

      // Leads list by agent
      if (normalized.includes('select * from leads where agent_id = $1')) {
        const agentId = params?.[0];
        const leads = mockDb.leads.filter((lead: any) => lead.agent_id === agentId);
        return {
          rows: leads,
          rowCount: leads.length
        };
      }

      // Leads list without agent filter
      if (normalized.includes('select * from leads order by created_at desc')) {
        return {
          rows: [...mockDb.leads],
          rowCount: mockDb.leads.length
        };
      }

      // Lead by id
      if (normalized.includes('select * from leads where id = $1')) {
        const id = params?.[0];
        const row = mockDb.leads.find((lead: any) => lead.id === id);
        console.log('[MOCK DB] SELECT lead by id:', id, '-> found:', !!row, 'status:', row?.status);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // Lead update
      if (normalized.includes('update leads set') && normalized.includes('where id = $') && normalized.includes('returning *')) {
        const id = params?.[params.length - 1];
        const index = mockDb.leads.findIndex((lead: any) => lead.id === id);
        if (index < 0) {
          console.log('[MOCK DB] Lead update: Lead not found with id', id);
          return { rows: [], rowCount: 0 };
        }

        const oldStatus = mockDb.leads[index].status;
        const oldPotential = mockDb.leads[index].potential;
        
        const setStart = text.toLowerCase().indexOf('set') + 3;
        const setEnd = text.toLowerCase().lastIndexOf(', updated_at = now()');
        const setClause = text.slice(setStart, setEnd).trim();
        const assignments = setClause.split(',').map((item) => item.trim());

        console.log('[MOCK DB] Lead update SQL:', text.substring(0, Math.min(text.length, 100)));
        console.log('[MOCK DB] Lead update assignments:', assignments);
        console.log('[MOCK DB] Lead update params:', params);

        const updatedLead = { ...mockDb.leads[index] };
        let updateCount = 0;
        for (const assignment of assignments) {
          const match = assignment.match(/^([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/);
          if (!match) {
            console.log('[MOCK DB] Lead update: Assignment did not match regex:', assignment);
            continue;
          }

          const dbKey = match[1];
          const paramIndex = Number(match[2]) - 1;
          const rawValue = params?.[paramIndex];
          const value = dbKey === 'travel_dates' && typeof rawValue === 'string'
            ? JSON.parse(rawValue)
            : (dbKey === 'hotel_info' || dbKey === 'hotel_options' || dbKey === 'destinations') && typeof rawValue === 'string'
              ? JSON.parse(rawValue)
              : rawValue;

          console.log(`[MOCK DB] Lead update: Setting ${dbKey} = ${JSON.stringify(value)} (was ${JSON.stringify(updatedLead[dbKey])})`);
          updatedLead[dbKey] = value;
          const camelKey = dbKey.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
          updatedLead[camelKey] = value;
          updateCount++;
        }

        const now = new Date().toISOString();
        updatedLead.updated_at = now;
        updatedLead.updatedAt = now;

        mockDb.leads[index] = updatedLead;
        
        console.log('[MOCK DB] Lead update completed:', {
          id,
          updated: updateCount,
          oldStatus,
          newStatus: updatedLead.status,
          oldPotential,
          newPotential: updatedLead.potential
        });
        
        return { rows: [updatedLead], rowCount: 1 };
      }

      if (normalized.includes('from leads l') && normalized.includes('join users u on u.id = l.agent_id') && normalized.includes('follow_up_count') && normalized.includes('lead_outcome')) {
        const rows = mockDb.leads.map((lead: any) => {
          const agent = mockDb.users.find((user) => user.id === lead.agent_id || user.id === lead.agentId);
          const followUps = mockDb.followUps.filter((item: any) => item.lead_id === lead.id);
          return {
            id: lead.id,
            client_name: lead.client_name || lead.clientName,
            email: lead.email,
            phone: lead.phone,
            destination: lead.destination,
            status: lead.status,
            temperature: lead.temperature,
            created_at: lead.created_at || lead.createdAt,
            updated_at: lead.updated_at || lead.updatedAt,
            agent_id: lead.agent_id || lead.agentId,
            agent_name: agent?.name || '',
            agent_email: agent?.email || '',
            lead_outcome: lead.lead_outcome || lead.leadOutcome || null,
            canceled_reason: lead.canceled_reason || lead.canceledReason || null,
            canceled_at: lead.canceled_at || lead.canceledAt || null,
            follow_up_count: String(followUps.length),
            canceled_followups: String(followUps.filter((item: any) => item.status === 'canceled').length)
          };
        });
        return { rows, rowCount: rows.length };
      }

      // Lead delete
      if (normalized.includes('delete from leads where id = $1')) {
        const id = params?.[0];
        const before = mockDb.leads.length;
        mockDb.leads = mockDb.leads.filter((lead: any) => lead.id !== id);
        const deleted = before - mockDb.leads.length;
        return { rows: [], rowCount: deleted };
      }

      // Payments by lead
      if (normalized.includes('select * from payments where lead_id = $1')) {
        const leadId = params?.[0];
        const rows = mockDb.payments.filter((payment: any) => payment.lead_id === leadId || payment.leadId === leadId);
        return { rows, rowCount: rows.length };
      }

      if (normalized.includes('insert into payments') && normalized.includes('returning *')) {
        const [leadId, amount, status, method, dueDate, paidDate, notes] = params || [];
        const now = new Date().toISOString();
        const item = {
          id: Math.random().toString(36).slice(2, 11),
          lead_id: leadId,
          amount: Number(amount || 0),
          status: status || 'pending',
          method,
          due_date: dueDate,
          paid_date: paidDate || null,
          notes: notes || '',
          created_at: now,
          updated_at: now
        };
        mockDb.payments.unshift(item);
        return { rows: [item], rowCount: 1 };
      }

      // INSERT INTO client_profiles
      if (normalized.includes('insert into client_profiles') && normalized.includes('returning')) {
        const [phone, name, email, address, gender, age] = params || [];
        const now = new Date().toISOString();
        const newProfile = {
          id: Math.random().toString(36).slice(2, 11),
          phone: phone || '',
          name: name || '',
          email: email || '',
          address: address || null,
          gender: gender || null,
          age: age ?? null,
          created_at: now,
          updated_at: now
        };
        mockDb.clientProfiles.unshift(newProfile);
        return { rows: [newProfile], rowCount: 1 };
      }

      if (normalized.includes('insert into screen_captures') && normalized.includes('returning *')) {
        const [requestId, agentId, requestedBy, fileName, mimeType, url, size, expiresAt] = params || [];
        const now = new Date().toISOString();
        const row = {
          id: Math.random().toString(36).slice(2, 11),
          request_id: requestId,
          agent_id: agentId,
          requested_by: requestedBy || null,
          file_name: fileName,
          mime_type: mimeType,
          url,
          size: Number(size || 0),
          expires_at: expiresAt,
          created_at: now
        };
        mockDb.screenCaptures.unshift(row);
        return { rows: [row], rowCount: 1 };
      }

      if (normalized.includes('select * from screen_captures where id = $1')) {
        const id = params?.[0];
        const row = mockDb.screenCaptures.find((item: any) => item.id === id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (normalized.includes('select * from screen_captures where expires_at <= now()')) {
        const now = Date.now();
        const rows = mockDb.screenCaptures.filter((item: any) => new Date(item.expires_at).getTime() <= now);
        return { rows, rowCount: rows.length };
      }

      if (normalized.includes('delete from screen_captures where id = $1')) {
        const id = params?.[0];
        const before = mockDb.screenCaptures.length;
        mockDb.screenCaptures = mockDb.screenCaptures.filter((item: any) => item.id !== id);
        return { rows: [], rowCount: before - mockDb.screenCaptures.length };
      }

      if (normalized.includes('update payments set') && normalized.includes('returning *')) {
        const id = params?.[0];
        const index = mockDb.payments.findIndex((item: any) => item.id === id);
        if (index < 0) return { rows: [], rowCount: 0 };

        const updated = { ...mockDb.payments[index] };
        if (normalized.includes('status = $2')) updated.status = params?.[1] ?? updated.status;
        if (normalized.includes('paid_date = $3')) updated.paid_date = params?.[2] ?? updated.paid_date;
        if (normalized.includes('amount = coalesce($2, amount)')) {
          updated.amount = params?.[1] ?? updated.amount;
          updated.status = params?.[2] ?? updated.status;
          updated.method = params?.[3] ?? updated.method;
          updated.due_date = params?.[4] ?? updated.due_date;
          updated.paid_date = params?.[5] ?? updated.paid_date;
          updated.notes = params?.[6] ?? updated.notes;
        }
        updated.updated_at = new Date().toISOString();
        mockDb.payments[index] = updated;
        return { rows: [updated], rowCount: 1 };
      }

      if (normalized.includes('delete from payments where id = $1 returning *')) {
        const id = params?.[0];
        const index = mockDb.payments.findIndex((item: any) => item.id === id);
        if (index < 0) return { rows: [], rowCount: 0 };
        const [deleted] = mockDb.payments.splice(index, 1);
        return { rows: [deleted], rowCount: 1 };
      }

      // INSERT INTO follow_ups (...)
      if (normalized.includes('insert into follow_ups') && normalized.includes('returning *')) {
        const [leadId, type, title, description, dueDate, status, priority, assignedTo, completedAt, canceledReason, canceledBy, canceledAt] = params || [];

        const now = new Date().toISOString();
        const item = {
          id: Math.random().toString(36).slice(2, 11),
          lead_id: leadId,
          type: type || 'manual',
          title: title || '',
          description: description || '',
          assigned_to: assignedTo,
          due_date: dueDate,
          status: status || 'upcoming',
          priority: priority || 'medium',
          completed_at: completedAt || null,
          canceled_reason: canceledReason || null,
          canceled_by: canceledBy || null,
          canceled_at: canceledAt || null,
          created_at: now,
          updated_at: now,
          task_type: type || 'manual',
          notes: description || ''
        };

        mockDb.followUps.unshift(item);
        return { rows: [item], rowCount: 1 };
      }

      // follow-ups by assignee (and optional status)
      if (normalized.includes('select * from follow_ups where assigned_to = $1')) {
        const assignedTo = params?.[0];
        const statusFilter = params?.[1];
        const rows = mockDb.followUps
          .filter((item: any) => item.assigned_to === assignedTo)
          .filter((item: any) => (statusFilter ? item.status === statusFilter : true))
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        return { rows, rowCount: rows.length };
      }

      // follow-ups by lead
      if (normalized.includes('select * from follow_ups where lead_id = $1')) {
        const leadId = params?.[0];
        const rows = mockDb.followUps
          .filter((item: any) => item.lead_id === leadId)
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        return { rows, rowCount: rows.length };
      }

      // complete follow-up
      if (normalized.includes("update follow_ups set status = 'completed'")) {
        const id = params?.[0];
        const index = mockDb.followUps.findIndex((item: any) => item.id === id);
        if (index < 0) return { rows: [], rowCount: 0 };

        const now = new Date().toISOString();
        mockDb.followUps[index] = {
          ...mockDb.followUps[index],
          status: 'completed',
          completed_at: now,
          updated_at: now
        };

        return { rows: [mockDb.followUps[index]], rowCount: 1 };
      }

      if (normalized.includes("update follow_ups set status = 'canceled'")) {
        const id = params?.[0];
        const index = mockDb.followUps.findIndex((item: any) => item.id === id);
        if (index < 0) return { rows: [], rowCount: 0 };

        const now = new Date().toISOString();
        mockDb.followUps[index] = {
          ...mockDb.followUps[index],
          status: 'canceled',
          canceled_reason: params?.[1] || '',
          canceled_by: params?.[2] || null,
          canceled_at: now,
          updated_at: now
        };

        return { rows: [mockDb.followUps[index]], rowCount: 1 };
      }

      if (normalized.includes('update follow_ups set type = coalesce($2') || normalized.includes('update follow_ups set task_type = coalesce($2')) {
        const id = params?.[0];
        const index = mockDb.followUps.findIndex((item: any) => item.id === id);
        if (index < 0) return { rows: [], rowCount: 0 };

        const updated: any = {
          ...mockDb.followUps[index],
          type: params?.[1] ?? mockDb.followUps[index].type,
          title: params?.[2] ?? mockDb.followUps[index].title,
          description: params?.[3] ?? mockDb.followUps[index].description,
          due_date: params?.[4] ?? mockDb.followUps[index].due_date,
          status: params?.[5] ?? mockDb.followUps[index].status,
          priority: params?.[6] ?? mockDb.followUps[index].priority,
          completed_at: params?.[7] ?? mockDb.followUps[index].completed_at,
          canceled_reason: params?.[8] ?? mockDb.followUps[index].canceled_reason,
          canceled_by: params?.[9] ?? mockDb.followUps[index].canceled_by,
          canceled_at: params?.[10] ?? mockDb.followUps[index].canceled_at,
          updated_at: new Date().toISOString()
        };

        updated.task_type = updated.type;
        updated.notes = updated.description;
        mockDb.followUps[index] = updated;
        return { rows: [updated], rowCount: 1 };
      }

      // delete follow-up
      if (normalized.includes('delete from follow_ups where id = $1 returning *')) {
        const id = params?.[0];
        const index = mockDb.followUps.findIndex((item: any) => item.id === id);
        if (index < 0) return { rows: [], rowCount: 0 };
        const [deleted] = mockDb.followUps.splice(index, 1);
        return { rows: [deleted], rowCount: 1 };
      }

      // overdue follow-ups
      if (normalized.includes("select * from follow_ups where status != 'completed' and due_date < now()")) {
        const now = Date.now();
        const rows = mockDb.followUps
          .filter((item: any) => item.status !== 'completed' && new Date(item.due_date).getTime() < now)
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        return { rows, rowCount: rows.length };
      }

      // availability by lead
      if (normalized.includes('select * from availability where lead_id = $1')) {
        const leadId = params?.[0];
        const row = mockDb.availability.find((item: any) => item.lead_id === leadId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // insert availability
      if (normalized.includes('insert into availability') && normalized.includes('returning *')) {
        const [leadId, hotelStatus, transportStatus, guideStatus, holdExpiry, providerName, providerContact, bookingReference, evidenceNote, clientApproved, updatedBy] = params || [];
        const now = new Date().toISOString();
        const row = {
          id: Math.random().toString(36).slice(2, 11),
          lead_id: leadId,
          hotel_status: hotelStatus || 'not_checked',
          transport_status: transportStatus || 'not_checked',
          guide_status: guideStatus || 'not_checked',
          hold_expiry: holdExpiry || null,
          provider_name: providerName || '',
          provider_contact: providerContact || '',
          booking_reference: bookingReference || '',
          evidence_note: evidenceNote || '',
          client_approved: !!clientApproved,
          updated_by: updatedBy || '',
          created_at: now,
          updated_at: now
        };
        mockDb.availability.unshift(row);
        return { rows: [row], rowCount: 1 };
      }

      // update availability
      if (normalized.includes('update availability set') && normalized.includes('where lead_id = $11')) {
        const [hotelStatus, transportStatus, guideStatus, holdExpiry, providerName, providerContact, bookingReference, evidenceNote, clientApproved, updatedBy, leadId] = params || [];
        const index = mockDb.availability.findIndex((item: any) => item.lead_id === leadId);
        if (index < 0) return { rows: [], rowCount: 0 };

        const now = new Date().toISOString();
        mockDb.availability[index] = {
          ...mockDb.availability[index],
          hotel_status: hotelStatus,
          transport_status: transportStatus,
          guide_status: guideStatus,
          hold_expiry: holdExpiry,
          provider_name: providerName,
          provider_contact: providerContact,
          booking_reference: bookingReference,
          evidence_note: evidenceNote,
          client_approved: !!clientApproved,
          updated_by: updatedBy,
          updated_at: now
        };

        return { rows: [mockDb.availability[index]], rowCount: 1 };
      }

      // admin: quoted stuck
      if (normalized.includes("select * from leads where (pipeline_stage = 'quoted' or status = 'negotiation')")) {
        const threshold = Date.now() - 72 * 60 * 60 * 1000;
        const rows = mockDb.leads.filter((lead: any) => {
          const isQuoted = lead.pipeline_stage === 'quoted' || lead.status === 'negotiation';
          const createdAt = new Date(lead.created_at || lead.createdAt || Date.now()).getTime();
          return isQuoted && createdAt < threshold;
        });
        return { rows, rowCount: rows.length };
      }

      // admin: expired holds
      if (normalized.includes('select * from availability where hold_expiry is not null and hold_expiry < now()')) {
        const now = Date.now();
        const rows = mockDb.availability.filter((item: any) => {
          if (!item.hold_expiry) return false;
          const expired = new Date(item.hold_expiry).getTime() < now;
          const hasOnHold = item.hotel_status === 'on_hold' || item.transport_status === 'on_hold' || item.guide_status === 'on_hold';
          return expired && hasOnHold;
        });
        return { rows, rowCount: rows.length };
      }

      // Dashboard stats aggregate
      if (normalized.includes('count(*) filter') && normalized.includes('as total_leads') && normalized.includes('from leads') && normalized.includes('where agent_id = $1')) {
        const agentId = params?.[0];
        const leads = mockDb.leads.filter((lead: any) => lead.agent_id === agentId);
        const month = new Date().getMonth();
        const totalLeads = leads.length;
        const hotLeads = leads.filter((lead: any) => lead.temperature === 'hot').length;
        const bookingsThisMonth = leads.filter((lead: any) => {
          if (lead.status !== 'booked') return false;
          const createdAt = new Date(lead.created_at ?? Date.now());
          return createdAt.getMonth() === month;
        }).length;
        const totalRevenue = leads
          .filter((lead: any) => lead.status === 'booked')
          .reduce((sum: number, lead: any) => sum + Number(lead.budget ?? 0), 0);

        return {
          rows: [{
            total_leads: String(totalLeads),
            hot_leads: String(hotLeads),
            bookings_this_month: String(bookingsThisMonth),
            total_revenue: String(totalRevenue)
          }],
          rowCount: 1
        };
      }

      // Dashboard pipeline aggregate
      if (normalized.includes('select status, count(*) as count, temperature from leads') && normalized.includes('group by status, temperature')) {
        const agentId = params?.[0];
        const leads = mockDb.leads.filter((lead: any) => lead.agent_id === agentId);
        const grouped = new Map<string, { status: string; temperature: string; count: number }>();

        for (const lead of leads) {
          const status = lead.status ?? 'new';
          const temperature = lead.temperature ?? 'cold';
          const key = `${status}::${temperature}`;
          const current = grouped.get(key);
          if (current) {
            current.count += 1;
          } else {
            grouped.set(key, { status, temperature, count: 1 });
          }
        }

        return {
          rows: Array.from(grouped.values()).map((item) => ({ ...item, count: String(item.count) })),
          rowCount: grouped.size
        };
      }

      // Dashboard analytics aggregate
      if (normalized.includes('count(*) filter (where temperature =') && normalized.includes('as hot_leads') && normalized.includes('count(distinct agent_id) as total_agents')) {
        const leads = mockDb.leads;
        const hot = leads.filter((lead: any) => lead.temperature === 'hot').length;
        const warm = leads.filter((lead: any) => lead.temperature === 'warm').length;
        const cold = leads.filter((lead: any) => lead.temperature === 'cold').length;
        const dead = leads.filter((lead: any) => lead.temperature === 'dead').length;
        const budgets = leads.map((lead: any) => Number(lead.budget ?? 0)).filter((value: number) => !Number.isNaN(value));
        const avg = budgets.length > 0 ? budgets.reduce((a: number, b: number) => a + b, 0) / budgets.length : 0;
        const agentCount = new Set(leads.map((lead: any) => lead.agent_id).filter(Boolean)).size;

        return {
          rows: [{
            hot_leads: String(hot),
            warm_leads: String(warm),
            cold_leads: String(cold),
            dead_leads: String(dead),
            avg_budget: String(avg),
            total_agents: String(agentCount)
          }],
          rowCount: 1
        };
      }

      // Dashboard health aggregate
      if (normalized.includes("count(*) filter (where status in ('booked', 'completed')) as completed_bookings") && normalized.includes('where agent_id = $1')) {
        const agentId = params?.[0];
        const leads = mockDb.leads.filter((lead: any) => lead.agent_id === agentId);
        const completed = leads.filter((lead: any) => ['booked', 'completed'].includes(lead.status)).length;
        const negotiation = leads.filter((lead: any) => lead.status === 'negotiation').length;
        const fresh = leads.filter((lead: any) => lead.status === 'new').length;

        return {
          rows: [{
            completed_bookings: String(completed),
            in_negotiation: String(negotiation),
            new_leads: String(fresh)
          }],
          rowCount: 1
        };
      }

        // Dashboard pending/confirmed payments aggregate
        if (normalized.includes('count(*) filter (where status = \'pending\') as pending_payments') && normalized.includes('from payments p') && normalized.includes('join leads l on l.id = p.lead_id')) {
          const agentId = params?.[0];
          const leadIds = new Set(mockDb.leads.filter((lead: any) => lead.agent_id === agentId).map((lead: any) => lead.id));
          const payments = mockDb.payments.filter((payment: any) => leadIds.has(payment.lead_id || payment.leadId));
          const pending = payments.filter((payment: any) => payment.status === 'pending').length;
          const confirmed = payments.filter((payment: any) => payment.status === 'confirmed').length;

          return {
            rows: [{
              pending_payments: String(pending),
              confirmed_payments: String(confirmed)
            }],
            rowCount: 1
          };
        }

        // Dashboard overdue follow-up aggregate
        if (normalized.includes('select count(*) as overdue_tasks') && normalized.includes('from follow_ups f') && normalized.includes('join leads l on l.id = f.lead_id')) {
          const agentId = params?.[0];
          const leadIds = new Set(mockDb.leads.filter((lead: any) => lead.agent_id === agentId).map((lead: any) => lead.id));
          const now = Date.now();
          const overdue = mockDb.followUps.filter((item: any) => leadIds.has(item.lead_id) && item.status !== 'completed' && new Date(item.due_date).getTime() < now).length;

          return {
            rows: [{ overdue_tasks: String(overdue) }],
            rowCount: 1
          };
        }

        // Admin revenue stats per agent (mock implementation)
        if (normalized.includes('left join leads l on u.id = l.agent_id') && normalized.includes('sum(coalesce(l.budget')) {
          const rows = mockDb.users.map((u) => {
            const assignedLeads = mockDb.leads.filter((l: any) => l.agent_id === u.id && ['booked', 'completed'].includes(l.status));
            const total = assignedLeads.reduce((s: number, x: any) => s + Number(x.budget || 0), 0);
            return { agent_id: u.id, name: u.name, total_revenue: String(total), bookings: String(assignedLeads.length) };
          });
          return { rows, rowCount: rows.length };
        }

        // Admin follow-up stats per agent (mock implementation)
        if (normalized.includes('left join follow_ups f on u.id = f.assigned_to') || normalized.includes('select u.id as agent_id')) {
          const rows = mockDb.users.map((u) => {
            const assigned = mockDb.followUps.filter((f: any) => f.assigned_to === u.id);
            const total = assigned.length;
            const now = Date.now();
            const overdue = assigned.filter((f: any) => f.status !== 'completed' && new Date(f.due_date).getTime() < now).length;
            const pending = assigned.filter((f: any) => f.status !== 'completed' && new Date(f.due_date).getTime() >= now).length;
            const completed = assigned.filter((f: any) => f.status === 'completed').length;
            return { agent_id: u.id, name: u.name, total: String(total), overdue: String(overdue), pending: String(pending), completed: String(completed) };
          });
          return { rows, rowCount: rows.length };
        }

      // INSERT INTO audit_logs
      if (normalized.includes('insert into audit_logs')) {
        const [entityType, entityId, action, changes, userId] = params || [];
        const newLog = {
          id: Math.random().toString(36).substr(2, 9),
          entity_type: entityType,
          entity_id: entityId,
          action,
          changes: typeof changes === 'string' ? JSON.parse(changes) : changes || {},
          user_id: userId,
          created_at: new Date().toISOString()
        };
        mockDb.auditLogs.push(newLog);
        return { rows: [newLog], rowCount: 1 };
      }

      // SELECT FROM audit_logs for reports
      if (normalized.includes('select entity_type, action, changes, user_id, created_at') && normalized.includes('from audit_logs')) {
        const userId = params?.[0];
        const startDate = params?.[1];
        const endDate = params?.[2];
        
        let logs = mockDb.auditLogs.filter((log: any) => log.user_id === userId);
        
        if (startDate && endDate) {
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).getTime();
          logs = logs.filter((log: any) => {
            const logTime = new Date(log.created_at).getTime();
            return logTime >= start && logTime <= end;
          });
        }
        
        logs = logs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return { rows: logs, rowCount: logs.length };
      }

      // INSERT INTO daily_reports (upsert)
      if (normalized.includes('insert into daily_reports') && normalized.includes('on conflict')) {
        const [reportType, reportDate, userId, periodStart, periodEnd, reportData, totalActivities] = params || [];
        
        const existingIndex = mockDb.dailyReports.findIndex((r: any) => 
          r.report_type === reportType && r.report_date === reportDate && r.user_id === userId
        );
        
        const reportObj = {
          id: Math.random().toString(36).substr(2, 9),
          report_type: reportType,
          report_date: reportDate,
          user_id: userId,
          period_start: periodStart,
          period_end: periodEnd,
          report_data: typeof reportData === 'string' ? JSON.parse(reportData) : reportData || {},
          total_activities: totalActivities,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
          mockDb.dailyReports[existingIndex] = reportObj;
        } else {
          mockDb.dailyReports.push(reportObj);
        }
        
        return { rows: [reportObj], rowCount: 1 };
      }

      // SELECT FROM daily_reports
      if (normalized.includes('select * from daily_reports') && normalized.includes('where')) {
        let reports = [...mockDb.dailyReports];
        
        // Filter by user_id if present
        if (normalized.includes('where user_id = $1')) {
          const userId = params?.[0];
          const reportType = params?.[1];
          reports = reports.filter((r: any) => r.user_id === userId && r.report_type === reportType);
          
          const limit = Number(params?.[2]) || 50;
          const offset = Number(params?.[3]) || 0;
          reports = reports.slice(offset, offset + limit);
        } else if (normalized.includes('where report_type = $1 and report_date between')) {
          // Admin query for date range
          const reportType = params?.[0];
          const startDate = params?.[1];
          const endDate = params?.[2];
          
          reports = reports.filter((r: any) => {
            return r.report_type === reportType && 
              r.report_date >= startDate && 
              r.report_date <= endDate;
          });
          
          if (params?.[3] && !isNaN(params[3])) {
            const limit = Number(params[3]) || 100;
            const offset = Number(params[4]) || 0;
            reports = reports.slice(offset, offset + limit);
          }
        } else if (normalized.includes('where report_type = $1 and report_date = $2 and user_id = $3')) {
          const reportType = params?.[0];
          const reportDate = params?.[1];
          const userId = params?.[2];
          
          reports = reports.filter((r: any) => 
            r.report_type === reportType && 
            r.report_date === reportDate && 
            r.user_id === userId
          );
        }
        
        reports = reports.sort((a: any, b: any) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
        return { rows: reports, rowCount: reports.length };
      }

      // SELECT COUNT FROM users for report compilation
      if (normalized.includes('select id from users where role = \'agent\'') || normalized.includes('select id from users where role = \'admin\'') || normalized.includes('select id from users')) {
        let users = mockDb.users;
        if (normalized.includes("where role = 'agent'")) {
          users = users.filter((u: any) => u.role === 'agent');
        }
        return { rows: users.map((u: any) => ({ id: u.id })), rowCount: users.length };
      }

      // Default response for mock
      return {
        rows: [],
        rowCount: 0
      };
    }

    // Try real database if mock is disabled
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    console.log('[DB Query]', { text, params, duration: `${duration}ms` });
    return result;
  } catch (error) {
    console.error('Database query error:', { text, params, error });
    throw error;
  }
};

export const getClient = async () => {
  if (useMockDb) {
    return {
      query,
      release: () => {}
    };
  }
  return await getPool().connect();
};

export default getPool;
