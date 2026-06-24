import { Request, Response } from 'express';
import { hotelModel } from '../models/Hotel';

export const hotelController = {
  async getAllHotels(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const hotels = await hotelModel.getAllHotels(activeOnly);
      res.json({
        success: true,
        data: hotels
      });
    } catch (error) {
      console.error('Error fetching hotels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotels'
      });
    }
  },

  async getHotelsByCity(req: Request, res: Response) {
    try {
      const { city } = req.params;
      const hotels = await hotelModel.getHotelsByCity(city);
      res.json({
        success: true,
        data: hotels
      });
    } catch (error) {
      console.error('Error fetching hotels by city:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotels'
      });
    }
  },

  async getHotelDetails(req: Request, res: Response) {
    try {
      const { hotelId } = req.params;
      const hotel = await hotelModel.getHotelWithDetails(hotelId);

      if (!hotel) {
        return res.status(404).json({
          success: false,
          error: 'Hotel not found'
        });
      }

      res.json({
        success: true,
        data: hotel
      });
    } catch (error) {
      console.error('Error fetching hotel details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotel details'
      });
    }
  },

  async getCities(req: Request, res: Response) {
    try {
      const cities = await hotelModel.getCities();
      res.json({
        success: true,
        data: cities
      });
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cities'
      });
    }
  },

  async getHotelsWithRoomsPaginated(req: Request, res: Response) {
    try {
      const city = req.query.city as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const hotels = await hotelModel.getHotelsWithRoomsPaginated(city, limit, offset);

      res.json({
        success: true,
        data: hotels,
        pagination: {
          limit,
          offset,
          count: hotels.length
        }
      });
    } catch (error) {
      console.error('Error fetching hotels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotels'
      });
    }
  },

  async getHotelStats(req: Request, res: Response) {
    try {
      const stats = await hotelModel.getHotelStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching hotel stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotel statistics'
      });
    }
  },

  async createHotel(req: Request, res: Response) {
    try {
      const { name, city, location, contact_phone, contact_email, description, rating, amenities } = req.body;

      if (!name || !city) {
        return res.status(400).json({
          success: false,
          error: 'Hotel name and city are required'
        });
      }

      const hotel = await hotelModel.createHotel({
        name,
        city,
        location,
        contact_phone,
        contact_email,
        description,
        rating,
        amenities
      });

      res.status(201).json({
        success: true,
        data: hotel
      });
    } catch (error) {
      console.error('Error creating hotel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create hotel'
      });
    }
  },

  async createRoomType(req: Request, res: Response) {
    try {
      const { hotelId } = req.params;
      const { name, description, capacity, amenities } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Room type name is required'
        });
      }

      const roomType = await hotelModel.createRoomType(hotelId, {
        name,
        description,
        capacity,
        amenities
      });

      res.status(201).json({
        success: true,
        data: roomType
      });
    } catch (error) {
      console.error('Error creating room type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create room type'
      });
    }
  },

  async createRoomPricing(req: Request, res: Response) {
    try {
      const { roomTypeId } = req.params;
      const {
        occupancy_type,
        season_name,
        season_start_date,
        season_end_date,
        price_pkr,
        price_range_min,
        price_range_max,
        extra_services
      } = req.body;

      if (!price_pkr && !price_range_min) {
        return res.status(400).json({
          success: false,
          error: 'Price information is required'
        });
      }

      const pricing = await hotelModel.createRoomPricing(roomTypeId, {
        occupancy_type,
        season_name,
        season_start_date,
        season_end_date,
        price_pkr,
        price_range_min,
        price_range_max,
        extra_services
      });

      res.status(201).json({
        success: true,
        data: pricing
      });
    } catch (error) {
      console.error('Error creating room pricing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create room pricing'
      });
    }
  }
};
