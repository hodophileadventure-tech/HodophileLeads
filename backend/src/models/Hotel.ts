import { query } from '../utils/database';

export interface Hotel {
  id: string;
  name: string;
  city: string;
  location?: string;
  contact_phone?: string;
  contact_email?: string;
  description?: string;
  rating?: number;
  amenities?: string[];
  image_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoomType {
  id: string;
  hotel_id: string;
  name: string;
  description?: string;
  capacity: number;
  amenities?: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoomPricing {
  id: string;
  room_type_id: string;
  occupancy_type?: string;
  season_name?: string;
  season_start_date?: string;
  season_end_date?: string;
  price_pkr?: number;
  price_range_min?: number;
  price_range_max?: number;
  extra_services?: Record<string, number>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface HotelWithRooms extends Hotel {
  room_types: RoomTypeWithPricing[];
}

export interface RoomTypeWithPricing extends RoomType {
  pricing: RoomPricing[];
}

export const hotelModel = {
  async getAllHotels(active_only = true) {
    const sql = `
      SELECT * FROM hotels
      ${active_only ? 'WHERE is_active = true' : ''}
      ORDER BY city, name
    `;
    const result = await query(sql);
    return result.rows;
  },

  async getHotelsByCity(city: string) {
    const sql = `
      SELECT * FROM hotels
      WHERE city = $1 AND is_active = true
      ORDER BY name
    `;
    const result = await query(sql, [city]);
    return result.rows;
  },

  async getHotelWithDetails(hotelId: string) {
    const hotelSql = `
      SELECT * FROM hotels WHERE id = $1
    `;
    const hotelResult = await query(hotelSql, [hotelId]);
    if (hotelResult.rows.length === 0) return null;

    const hotel = hotelResult.rows[0];

    const roomsSql = `
      SELECT rt.*, json_agg(json_build_object(
        'id', rp.id,
        'occupancy_type', rp.occupancy_type,
        'season_name', rp.season_name,
        'season_start_date', rp.season_start_date,
        'season_end_date', rp.season_end_date,
        'price_pkr', rp.price_pkr,
        'price_range_min', rp.price_range_min,
        'price_range_max', rp.price_range_max,
        'extra_services', rp.extra_services,
        'is_active', rp.is_active
      ) ORDER BY rp.season_name, rp.occupancy_type) as pricing
      FROM room_types rt
      LEFT JOIN room_pricing rp ON rt.id = rp.room_type_id AND rp.is_active = true
      WHERE rt.hotel_id = $1 AND rt.is_active = true
      GROUP BY rt.id
      ORDER BY rt.name
    `;

    const roomsResult = await query(roomsSql, [hotelId]);
    return { ...hotel, room_types: roomsResult.rows };
  },

  async createHotel(data: Partial<Hotel>) {
    const sql = `
      INSERT INTO hotels (name, city, location, contact_phone, contact_email, description, rating, amenities, image_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await query(sql, [
      data.name,
      data.city,
      data.location || null,
      data.contact_phone || null,
      data.contact_email || null,
      data.description || null,
      data.rating || null,
      data.amenities || null,
      data.image_url || null,
      data.is_active !== false
    ]);
    return result.rows[0];
  },

  async createRoomType(hotelId: string, data: Partial<RoomType>) {
    const sql = `
      INSERT INTO room_types (hotel_id, name, description, capacity, amenities, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(sql, [
      hotelId,
      data.name,
      data.description || null,
      data.capacity || 2,
      data.amenities || null,
      data.is_active !== false
    ]);
    return result.rows[0];
  },

  async createRoomPricing(roomTypeId: string, data: Partial<RoomPricing>) {
    const sql = `
      INSERT INTO room_pricing (
        room_type_id, occupancy_type, season_name, season_start_date, season_end_date,
        price_pkr, price_range_min, price_range_max, extra_services, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await query(sql, [
      roomTypeId,
      data.occupancy_type || null,
      data.season_name || null,
      data.season_start_date || null,
      data.season_end_date || null,
      data.price_pkr || null,
      data.price_range_min || null,
      data.price_range_max || null,
      data.extra_services ? JSON.stringify(data.extra_services) : null,
      data.is_active !== false
    ]);
    return result.rows[0];
  },

  async getCities() {
    const sql = `
      SELECT DISTINCT city FROM hotels WHERE is_active = true ORDER BY city
    `;
    const result = await query(sql);
    return result.rows.map(r => r.city);
  },

  async getHotelsWithRoomsPaginated(city?: string, limit = 50, offset = 0) {
    let sql = `
      SELECT h.*, COUNT(rt.id) as room_type_count
      FROM hotels h
      LEFT JOIN room_types rt ON h.id = rt.hotel_id AND rt.is_active = true
      WHERE h.is_active = true
    `;
    const params: any[] = [];

    if (city) {
      sql += ` AND h.city = $1`;
      params.push(city);
    }

    sql += ` GROUP BY h.id ORDER BY h.city, h.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  },

  async getHotelStats() {
    const sql = `
      SELECT
        COUNT(DISTINCT h.id) as total_hotels,
        COUNT(DISTINCT h.city) as total_cities,
        COUNT(DISTINCT rt.id) as total_room_types,
        json_object_agg(h.city, COUNT(h.id)) as hotels_by_city
      FROM hotels h
      LEFT JOIN room_types rt ON h.id = rt.hotel_id AND rt.is_active = true
      WHERE h.is_active = true
    `;
    const result = await query(sql);
    return result.rows[0];
  }
};
