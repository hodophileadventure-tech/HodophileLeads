import { Router } from 'express';
import { hotelController } from '../controllers/hotel-controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes (visible to all authenticated users)
router.get('/hotels', authenticate, hotelController.getAllHotels);
router.get('/hotels/stats', authenticate, hotelController.getHotelStats);
router.get('/hotels/cities', authenticate, hotelController.getCities);
router.get('/hotels/paginated', authenticate, hotelController.getHotelsWithRoomsPaginated);
router.get('/hotels/city/:city', authenticate, hotelController.getHotelsByCity);
router.get('/hotels/:hotelId', authenticate, hotelController.getHotelDetails);

// Admin/Manager only routes
router.post('/hotels', authenticate, authorize(['admin', 'manager']), hotelController.createHotel);
router.post('/hotels/:hotelId/rooms', authenticate, authorize(['admin', 'manager']), hotelController.createRoomType);
router.post('/hotels/rooms/:roomTypeId/pricing', authenticate, authorize(['admin', 'manager']), hotelController.createRoomPricing);

export default router;
