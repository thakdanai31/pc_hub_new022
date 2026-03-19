import { Router } from 'express';
import * as productController from './product.controller.js';

export const productRouter = Router();

productRouter.get('/', productController.list);
productRouter.get('/slug/:slug', productController.getBySlug);
productRouter.get('/:productId', productController.getById);
