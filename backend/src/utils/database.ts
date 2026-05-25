import { Pool, PoolClient } from 'pg';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

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
} = {
  users: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'admin@tripnexus.com',
      name: 'Admin User',
      password: '', // Will be hashed below
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      email: 'agent@tripnexus.com',
      name: 'Agent User',
      password: '', // Will be hashed below
      role: 'agent',
      created_at: new Date(),
      updated_at: new Date()
    },
  ],
  leads: [],
  followUps: [],
  itineraries: [],
  payments: [],
  availability: [],
  clientProfiles: [],
  auditLogs: []
};

// Initialize mock database with hashed passwords
async function initializeMockDb() {
  mockDb.users[0].password = await bcryptjs.hash('Admin@123', 10);
  mockDb.users[1].password = await bcryptjs.hash('Agent@123', 10);
}

initializeMockDb().catch(err => console.error('Failed to initialize mock DB:', err));

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
  } catch (err: any) {
    console.error('[DB INIT] Failed to connect to Postgres, continuing in mock mode.', err?.message || err);
    useMockDb = true;
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
      if (normalized === 'select id, email, name, role from users' || normalized === 'select id, email, name, role from users order by created_at desc') {
        const rows = mockDb.users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at }));
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
          const email = params?.[0] ?? mockDb.users[userIndex].email;
          const name = params?.[1] ?? mockDb.users[userIndex].name;
          mockDb.users[userIndex] = { ...mockDb.users[userIndex], email, name, updated_at: new Date() };
          const updated = mockDb.users[userIndex];
          return { rows: [{ id: updated.id, email: updated.email, name: updated.name, role: updated.role }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
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
          adults: 1,
          kids: 0,
          seniors: 0,
          temperature: temperature || 'cold',
          status: status || 'new',
          pipelineStage: 'new_lead',
          agentId: agentId || '',
          specialRequests: specialRequests || '',
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
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // Lead update
      if (normalized.includes('update leads set') && normalized.includes('where id = $') && normalized.includes('returning *')) {
        const id = params?.[params.length - 1];
        const index = mockDb.leads.findIndex((lead: any) => lead.id === id);
        if (index < 0) {
          return { rows: [], rowCount: 0 };
        }

        const setStart = text.toLowerCase().indexOf('set') + 3;
        const setEnd = text.toLowerCase().lastIndexOf(', updated_at = now()');
        const setClause = text.slice(setStart, setEnd).trim();
        const assignments = setClause.split(',').map((item) => item.trim());

        const updatedLead = { ...mockDb.leads[index] };
        for (const assignment of assignments) {
          const match = assignment.match(/^([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/);
          if (!match) continue;

          const dbKey = match[1];
          const paramIndex = Number(match[2]) - 1;
          const rawValue = params?.[paramIndex];
          const value = dbKey === 'travel_dates' && typeof rawValue === 'string'
            ? JSON.parse(rawValue)
            : (dbKey === 'hotel_info' || dbKey === 'hotel_options' || dbKey === 'destinations') && typeof rawValue === 'string'
              ? JSON.parse(rawValue)
              : rawValue;

          updatedLead[dbKey] = value;
          const camelKey = dbKey.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
          updatedLead[camelKey] = value;
        }

        const now = new Date().toISOString();
        updatedLead.updated_at = now;
        updatedLead.updatedAt = now;

        mockDb.leads[index] = updatedLead;
        return { rows: [updatedLead], rowCount: 1 };
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
        const [
          leadId,
          assignedTo,
          taskType,
          dueDate,
          status,
          notes,
          priority,
          reminderType,
          whatsappNumber,
          whatsappLink
        ] = params || [];

        const now = new Date().toISOString();
        const item = {
          id: Math.random().toString(36).slice(2, 11),
          lead_id: leadId,
          assigned_to: assignedTo,
          task_type: taskType,
          due_date: dueDate,
          status: status || 'upcoming',
          notes: notes || '',
          priority: priority || 'medium',
          reminder_type: reminderType || 'client_requested',
          whatsapp_number: whatsappNumber || '',
          whatsapp_link: whatsappLink || '',
          created_at: now,
          updated_at: now
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
    // Stay in mock mode on error
    useMockDb = true;
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
