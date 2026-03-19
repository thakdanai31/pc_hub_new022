import { Router } from 'express';
import * as brandController from './brand.controller.js';

export const brandRouter = Router();

brandRouter.get('/', brandController.list);
brandRouter.get('/:brandId', brandController.getById);
