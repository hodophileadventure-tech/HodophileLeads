import { query } from '../utils/database';
import { calculateLeadTemperature } from '../services/lead-service';
import type { Lead } from '../types';
import { profileModel } from './Profile';

const mapLeadRow = (row: any) => {
  if (!row) return row;

  let hotelInfo = row.hotel_info ?? row.hotelInfo ?? null;
  let hotelOptions = row.hotel_options ?? row.hotelOptions ?? null;
  let destinations = row.destinations ?? null;
  if (typeof hotelInfo === 'string') {
    try {
      hotelInfo = JSON.parse(hotelInfo);
    } catch {
      hotelInfo = null;
    }
  }
  if (typeof hotelOptions === 'string') {
    try {
      hotelOptions = JSON.parse(hotelOptions);
    } catch {
      hotelOptions = null;
    }
  }
  if (typeof destinations === 'string') {
    try {
      destinations = JSON.parse(destinations);
    } catch {
      destinations = null;
    }
  }

  return {
    ...row,
    clientName: row.clientName || row.client_name || row.name,
    profileId: row.profile_id || null,
    address: row.address || null,
    gender: row.gender || null,
    age: row.age || null,
    agentRemarks: row.agent_remarks || row.agentRemarks || null,
    remarks: row.remarks || null,
    potential: typeof row.potential === 'boolean' ? row.potential : (row.potential === 't' || row.potential === 'true'),
    travelDates: row.travelDates || row.travel_dates || (row.travel_date ? { from: row.travel_date, to: row.travel_date } : undefined),
    hotelInfo,
    hotelOptions,
    destinations,
    agentId: row.agentId || row.agent_id,
    specialRequests: row.specialRequests || row.special_requests,
    transportPreference: row.transportPreference || row.transport_preference,
    hotelPreference: row.hotelPreference || row.hotel_preference,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
    canceledReason: row.canceledReason || row.canceled_reason || null,
    canceledBy: row.canceledBy || row.canceled_by || null,
    canceledAt: row.canceledAt || row.canceled_at || null,
    leadOutcome: row.leadOutcome || row.lead_outcome || null
  };
};

export const leadsModel = {
  async findAll(_agentId?: string, limit = 50, offset = 0) {
    const sql = 'SELECT * FROM leads ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const params: any[] = [limit, offset];
    const result = await query(sql, params);
    return result.rows.map(mapLeadRow);
  },

  async findById(id: string) {
    const result = await query('SELECT * FROM leads WHERE id = $1', [id]);
    return mapLeadRow(result.rows[0]);
  },

  async findByPhone(phone: string) {
    const result = await query('SELECT * FROM leads WHERE phone = $1 ORDER BY created_at DESC', [phone]);
    return result.rows.map(mapLeadRow);
  },

  async create(data: Partial<Lead>) {
    const temperature = calculateLeadTemperature({
      sourceType: data.source,
      followUpCount: 0,
      daysInPipeline: 0
    });

    const sql = `
      INSERT INTO leads (
          client_name, email, phone, destination, destinations, source, temperature, status, budget, travel_dates, hotel_info, hotel_options, agent_id, profile_id, address, gender, age, agent_remarks, remarks, potential, lead_outcome
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `;

    const destinations = Array.isArray((data as any).destinations)
      ? (data as any).destinations.filter(Boolean)
      : data.destination
        ? [data.destination]
        : [];

    const hotelOptions = Array.isArray((data as any).hotelOptions)
      ? (data as any).hotelOptions.filter(Boolean)
      : data.hotelInfo
        ? [data.hotelInfo]
        : [];

    const params = [
      data.clientName || (data as any).name,
      data.email,
      data.phone,
      data.destination || destinations[0] || '',
      destinations.length > 0 ? JSON.stringify(destinations) : null,
      data.source || 'direct',
      temperature,
      'new',
      data.budget ?? 0,
      data.travelDates ? JSON.stringify(data.travelDates) : null,
      data.hotelInfo ? JSON.stringify(data.hotelInfo) : null,
      hotelOptions.length > 0 ? JSON.stringify(hotelOptions) : null,
      data.agentId || (data as any).agent_id || null,
      null, // profile_id placeholder - will set below
      (data as any).address || null,
      (data as any).gender || null,
      (data as any).age || null,
      (data as any).agentRemarks || (data as any).agent_remarks || null,
      (data as any).remarks || null,
      (data as any).potential ? true : false,
      (data as any).leadOutcome || (data as any).lead_outcome || null
    ];

    // handle profile by phone
    let profileId = null;
    if ((data as any).phone) {
      const existingProfile = await profileModel.findByPhone((data as any).phone);
      if (existingProfile) {
        profileId = existingProfile.id;
        // prefill missing personal details from profile
        params[0] = params[0] || existingProfile.name || params[0];
        params[1] = params[1] || existingProfile.email || params[1];
        params[14] = params[14] || existingProfile.address || params[14];
        params[15] = params[15] || existingProfile.gender || params[15];
        params[16] = params[16] || existingProfile.age || params[16];
      } else {
        const created = await profileModel.create({
          phone: (data as any).phone,
          name: params[0],
          email: params[1],
          address: params[14],
          gender: params[15],
          age: params[16]
        });
        profileId = created.id;
      }
    }

    // place profileId into params (position 14 since array is 0-based and corresponds to $14 in SQL)
    params[13] = profileId;

    const result = await query(sql, params);
    return mapLeadRow(result.rows[0]);
  },

  async update(id: string, data: Partial<Lead>) {
    const fields: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    const allowedColumns = new Set([
      'client_name',
      'email',
      'phone',
      'destination',
      'source',
      'temperature',
      'status',
      'budget',
      'travel_dates',
      'hotel_info',
      'destinations',
      'hotel_options',
      'notes',
      'address',
      'gender',
      'age',
      'agent_remarks',
      'remarks',
      'potential',
      'lead_outcome',
      'special_requests',
      'transport_preference',
      'hotel_preference',
      'canceled_reason',
      'canceled_by',
      'canceled_at'
    ]);

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'travelDates') {
        fields.push(`travel_dates = $${paramCount}`);
        let dateVal: any = value;
        if (value && typeof value === 'object') {
          const v: any = value;
          dateVal = JSON.stringify({ from: v.from || '', to: v.to || '' });
        }
        params.push(dateVal);
      } else if (key === 'hotelInfo') {
        fields.push(`hotel_info = $${paramCount}`);
        params.push(typeof value === 'string' ? value : JSON.stringify(value));
      } else if (key === 'hotelOptions') {
        fields.push(`hotel_options = $${paramCount}`);
        params.push(typeof value === 'string' ? value : JSON.stringify(value));
      } else if (key === 'destinations') {
        fields.push(`destinations = $${paramCount}`);
        params.push(typeof value === 'string' ? value : JSON.stringify(value));
      } else if (key !== 'id' && key !== 'createdAt') {
        let dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (key === 'clientName' || key === 'name') dbKey = 'client_name';
        if (key === 'destination') dbKey = 'destination';
        if (key === 'leadOutcome') dbKey = 'lead_outcome';
        if (!allowedColumns.has(dbKey)) return;
        fields.push(`${dbKey} = $${paramCount}`);
        params.push(value);
      }
      paramCount++;
    });

    params.push(id);

    const sql = `UPDATE leads SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    const result = await query(sql, params);
    return mapLeadRow(result.rows[0]);
  },

  async delete(id: string) {
    await query('DELETE FROM leads WHERE id = $1', [id]);
  }
};
