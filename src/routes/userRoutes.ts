import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { createDatabasePool } from '../config/database';
import { azureAuth } from '../middlewares/azureAuth';
import { cognitoAuthMiddleware } from '../middlewares/authMiddleware';
import { MySqlUserRepository, UserService } from '../services/userService';

export function createUserRoutes(service = new UserService(new MySqlUserRepository(createDatabasePool()))): Router {
	const router = Router();
	const controller = new UserController(service);
	const adminRoutes = Router();
	const guestRoutes = Router();

	adminRoutes.use(azureAuth);
	adminRoutes.get('/', controller.listAdmins);
	adminRoutes.get('/:id', controller.getAdmin);
	adminRoutes.post('/', controller.createAdmin);
	adminRoutes.patch('/:id', controller.updateAdmin);
	adminRoutes.delete('/:id', controller.deleteAdmin);

	guestRoutes.use(cognitoAuthMiddleware);
	guestRoutes.get('/', controller.listGuests);
	guestRoutes.get('/:id', controller.getGuest);
	guestRoutes.post('/', controller.createGuest);
	guestRoutes.patch('/:id', controller.updateGuest);
	guestRoutes.delete('/:id', controller.deleteGuest);

	router.use('/admin', adminRoutes);
	router.use('/guest', guestRoutes);
	return router;
}

export const userRoutes = createUserRoutes();