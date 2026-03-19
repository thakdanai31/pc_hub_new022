import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as userAdminController from './user-admin.controller.js';

export const userAdminRouter = Router();

userAdminRouter.use(requireRole('ADMIN'));

userAdminRouter.get('/', userAdminController.listUsers);
userAdminRouter.post('/staff', userAdminController.createStaff);
userAdminRouter.post('/admin', userAdminController.createAdmin);
userAdminRouter.patch('/:userId', userAdminController.updateUser);
userAdminRouter.post('/:userId/disable', userAdminController.disableUser);
