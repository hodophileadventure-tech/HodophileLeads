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
    leadOutcome: row.leadOutcome || row.lead_outcome || null,
    pipelineStage:
      row.pipelineStage ||
      row.pipeline_stage ||
      (row.leadOutcome === 'confirmed' || row.lead_outcome === 'confirmed' || row.status === 'booked'
        ? 'confirmed'
        : row.status === 'completed'
          ? 'completed'
          : undefined)
  };
};

export const leadsModel = {
  async findAll(agentId?: string | null, limit = 50, offset = 0) {
    let sql = 'SELECT * FROM leads';
    const params: any[] = [];

    if (agentId) {
      sql += ' WHERE agent_id = $1';
      params.push(agentId);
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows.map(mapLeadRow);
  },

  async findById(id: string) {
    const result = await query('SELECT * FROM leads WHERE id = $1', [id]);
    return mapLeadRow(result.rows[0]);
  },

  async findByPhone(phone: string, agentId?: string | null) {
    let sql = 'SELECT * FROM leads WHERE phone = $1';
    const params: any[] = [phone];

    if (agentId) {
      sql += ' AND agent_id = $2';
      params.push(agentId);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
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
          client_name, email, phone, destination, destinations, source, temperature, status, budget, travel_dates, hotel_info, hotel_options, agent_id, created_at, updated_at, profile_id, address, gender, age, agent_remarks, remarks, potential, lead_outcome
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
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

    const createdAt = (data as any).createdAt || (data as any).created_at || new Date().toISOString();
    const updatedAt = createdAt;
    const params = [
      data.clientName || (data as any).name || null,
      data.email || null,
      data.phone,
      data.destination || destinations[0] || null,
      destinations.length > 0 ? JSON.stringify(destinations) : null,
      data.source || 'direct',
      temperature,
      'new',
      data.budget ?? 0,
      data.travelDates ? JSON.stringify(data.travelDates) : null,
      data.hotelInfo ? JSON.stringify(data.hotelInfo) : null,
      hotelOptions.length > 0 ? JSON.stringify(hotelOptions) : null,
      data.agentId || (data as any).agent_id || null,
      createdAt,
      updatedAt,
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
        params[16] = params[16] || existingProfile.address || params[16];
        params[17] = params[17] || existingProfile.gender || params[17];
        params[18] = params[18] || existingProfile.age || params[18];
      } else {
        const created = await profileModel.create({
          phone: (data as any).phone,
          name: params[0],
          email: params[1],
          address: params[16],
          gender: params[17],
          age: params[18]
        });
        profileId = created.id;
      }
    }

    // place profileId into params (position 16 since array is 0-based and corresponds to $16 in SQL)
    params[15] = profileId;

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
      'created_at',
      'lead_outcome',
      'special_requests',
      'transport_preference',
      'hotel_preference',
      'canceled_reason',
      'canceled_by',
      'canceled_at',
      'pipeline_stage'
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
      } else if (key === 'pipelineStage') {
        if (value === 'confirmed') {
          fields.push(`lead_outcome = $${paramCount}`);
          params.push('confirmed');
          paramCount++;

          fields.push(`status = $${paramCount}`);
          params.push('booked');
        } else if (value === 'completed') {
          fields.push(`status = $${paramCount}`);
          params.push('completed');
        } else if (value === 'new_lead') {
          fields.push(`status = $${paramCount}`);
          params.push('new');
        } else if (value === 'availability_check') {
          fields.push(`status = $${paramCount}`);
          params.push('contacted');
        } else if (value === 'quoted') {
          fields.push(`status = $${paramCount}`);
          params.push('interested');
        } else if (value === 'payment_pending') {
          fields.push(`status = $${paramCount}`);
          params.push('negotiation');
        } else if (value === 'on_trip') {
          fields.push(`status = $${paramCount}`);
          params.push('booked');
        } else {
          return;
        }
      } else if (key === 'createdAt') {
        fields.push(`created_at = $${paramCount}`);
        params.push(value);
      } else if (key !== 'id') {
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
