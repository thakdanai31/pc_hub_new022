import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { addressRouter } from './modules/addresses/address.routes.js';
import { categoryRouter } from './modules/categories/category.routes.js';
import { brandRouter } from './modules/brands/brand.routes.js';
import { productRouter } from './modules/products/product.routes.js';
import { backofficeRouter } from './modules/backoffice/backoffice.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { checkoutRouter } from './modules/checkout/checkout.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Body parsing with size limit
app.use(express.json({ limit: '10kb' }));

// Cookie parsing
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Routes
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/account/addresses', addressRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/brands', brandRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/backoffice', backofficeRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/account/orders', orderRouter);
app.use('/api/v1/account/profile', profileRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export { app };
