import { Router } from 'express';
import { hotelController } from '../controllers/hotel-controller';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (visible to all authenticated users)
router.get('/hotels', authMiddleware, hotelController.getAllHotels);
router.get('/hotels/stats', authMiddleware, hotelController.getHotelStats);
router.get('/hotels/cities', authMiddleware, hotelController.getCities);
router.get('/hotels/paginated', authMiddleware, hotelController.getHotelsWithRoomsPaginated);
router.get('/hotels/city/:city', authMiddleware, hotelController.getHotelsByCity);
router.get('/hotels/:hotelId', authMiddleware, hotelController.getHotelDetails);

// Admin/Manager only routes
router.post('/hotels', authMiddleware, roleMiddleware(['admin', 'manager']), hotelController.createHotel);
router.post('/hotels/:hotelId/rooms', authMiddleware, roleMiddleware(['admin', 'manager']), hotelController.createRoomType);
router.post('/hotels/rooms/:roomTypeId/pricing', authMiddleware, roleMiddleware(['admin', 'manager']), hotelController.createRoomPricing);

export default router;
