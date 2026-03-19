import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { AppError, NotFoundError } from '../../common/errors.js';
import type { CartCheckoutBody, BuyNowCheckoutBody } from './checkout.schema.js';
import type { OrderStatus } from '../../generated/prisma/client.js';

export function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PCH-${datePart}-${randomPart}`;
}

const ORDER_NUMBER_MAX_RETRIES = 3;

function isUniqueConstraintError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  ) {
    return true;
  }
  return false;
}

function getInitialStatus(paymentMethod: 'COD' | 'PROMPTPAY_QR'): OrderStatus {
  return paymentMethod === 'COD' ? 'PENDING' : 'AWAITING_PAYMENT';
}

interface InvalidItem {
  cartItemId: number | null;
  productId: number;
  productName: string;
  reason: string;
}

async function validateAddress(addressId: number, userId: number) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  return {
    label: address.label,
    recipientName: address.recipientName,
    phoneNumber: address.phoneNumber,
    line1: address.line1,
    line2: address.line2,
    district: address.district,
    subdistrict: address.subdistrict,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
  };
}

function buildProductSnapshot(product: {
  name: string;
  sku: string;
  warrantyMonths: number | null;
  category: { name: string };
  brand: { name: string };
  images: { imageUrl: string }[];
}) {
  return {
    name: product.name,
    sku: product.sku,
    warrantyMonths: product.warrantyMonths,
    categoryName: product.category.name,
    brandName: product.brand.name,
    image: product.images[0]?.imageUrl ?? null,
  };
}

export async function checkoutFromCart(userId: number, body: CartCheckoutBody) {
  const addressSnapshot = await validateAddress(body.addressId, userId);

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    throw new AppError('Cart is empty', 400, 'EMPTY_CART');
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: {
      id: true,
      quantity: true,
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stock: true,
          warrantyMonths: true,
          isActive: true,
          category: { select: { name: true, isActive: true } },
          brand: { select: { name: true, isActive: true } },
          images: {
            select: { imageUrl: true },
            orderBy: { sortOrder: 'asc' as const },
            take: 1,
          },
        },
      },
    },
  });

  if (cartItems.length === 0) {
    throw new AppError('Cart is empty', 400, 'EMPTY_CART');
  }

  const invalidItems: InvalidItem[] = [];

  for (const item of cartItems) {
    if (!item.product.isActive) {
      invalidItems.push({
        cartItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        reason: 'Product is no longer available',
      });
    } else if (!item.product.category.isActive) {
      invalidItems.push({
        cartItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        reason: 'Product category is currently unavailable',
      });
    } else if (!item.product.brand.isActive) {
      invalidItems.push({
        cartItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        reason: 'Product brand is currently unavailable',
      });
    } else if (item.quantity > item.product.stock) {
      invalidItems.push({
        cartItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        reason: `Insufficient stock. Available: ${String(item.product.stock)}`,
      });
    }
  }

  if (invalidItems.length > 0) {
    const error = new AppError(
      'Some items in your cart cannot be purchased',
      400,
      'CHECKOUT_VALIDATION_FAILED',
    );
    (error as AppError & { invalidItems: InvalidItem[] }).invalidItems = invalidItems;
    throw error;
  }

  const status = getInitialStatus(body.paymentMethod);

  for (let attempt = 0; attempt < ORDER_NUMBER_MAX_RETRIES; attempt++) {
    const orderNumber = generateOrderNumber();

    try {
      const order = await prisma.$transaction(async (tx) => {
        // Decrement stock for each item
        for (const item of cartItems) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity },
            },
            data: {
              stock: { decrement: item.quantity },
            },
          });

          if (updated.count === 0) {
            throw new AppError(
              `Stock changed for "${item.product.name}". Please try again.`,
              409,
              'STOCK_CHANGED',
            );
          }
        }

        // Calculate totals
        let subtotal = 0;
        const orderItemsData = cartItems.map((item) => {
          const unitPrice = Number(item.product.price);
          const lineTotal = unitPrice * item.quantity;
          subtotal += lineTotal;

          return {
            productId: item.productId,
            productSnapshot: buildProductSnapshot(item.product),
            quantity: item.quantity,
            unitPrice,
            lineTotal,
          };
        });

        const shippingAmount = 0;
        const totalAmount = subtotal + shippingAmount;

        // Create order
        const createdOrder = await tx.order.create({
          data: {
            userId,
            orderNumber,
            addressSnapshot: addressSnapshot,
            paymentMethod: body.paymentMethod,
            status,
            subtotalAmount: subtotal,
            shippingAmount,
            totalAmount,
            customerNote: body.customerNote ?? null,
            items: {
              create: orderItemsData,
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            subtotalAmount: true,
            shippingAmount: true,
            totalAmount: true,
            createdAt: true,
          },
        });

        // Create payment record
        await tx.payment.create({
          data: {
            orderId: createdOrder.id,
            paymentMethod: body.paymentMethod,
            status: 'UNPAID',
            amount: totalAmount,
          },
        });

        // Clear cart
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return createdOrder;
      });

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        subtotalAmount: Number(order.subtotalAmount),
        shippingAmount: Number(order.shippingAmount),
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
      };
    } catch (error: unknown) {
      if (isUniqueConstraintError(error) && attempt < ORDER_NUMBER_MAX_RETRIES - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError('Failed to generate unique order number', 500, 'ORDER_NUMBER_GENERATION_FAILED');
}

export async function buyNowCheckout(userId: number, body: BuyNowCheckoutBody) {
  const addressSnapshot = await validateAddress(body.addressId, userId);

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stock: true,
      warrantyMonths: true,
      isActive: true,
      category: { select: { name: true, isActive: true } },
      brand: { select: { name: true, isActive: true } },
      images: {
        select: { imageUrl: true },
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
      },
    },
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (!product.isActive) {
    throw new AppError('Product is not available', 400, 'PRODUCT_UNAVAILABLE');
  }

  if (!product.category.isActive) {
    throw new AppError('Product category is not available', 400, 'PRODUCT_UNAVAILABLE');
  }

  if (!product.brand.isActive) {
    throw new AppError('Product brand is not available', 400, 'PRODUCT_UNAVAILABLE');
  }

  if (body.quantity > product.stock) {
    throw new AppError(
      `Insufficient stock. Available: ${String(product.stock)}`,
      400,
      'INSUFFICIENT_STOCK',
    );
  }

  const status = getInitialStatus(body.paymentMethod);

  const unitPrice = Number(product.price);
  const lineTotal = unitPrice * body.quantity;
  const subtotal = lineTotal;
  const shippingAmount = 0;
  const totalAmount = subtotal + shippingAmount;

  for (let attempt = 0; attempt < ORDER_NUMBER_MAX_RETRIES; attempt++) {
    const orderNumber = generateOrderNumber();

    try {
      const order = await prisma.$transaction(async (tx) => {
        // Decrement stock
        const updated = await tx.product.updateMany({
          where: {
            id: body.productId,
            stock: { gte: body.quantity },
          },
          data: {
            stock: { decrement: body.quantity },
          },
        });

        if (updated.count === 0) {
          throw new AppError(
            'Stock changed. Please try again.',
            409,
            'STOCK_CHANGED',
          );
        }

        // Create order
        const createdOrder = await tx.order.create({
          data: {
            userId,
            orderNumber,
            addressSnapshot: addressSnapshot,
            paymentMethod: body.paymentMethod,
            status,
            subtotalAmount: subtotal,
            shippingAmount,
            totalAmount,
            customerNote: body.customerNote ?? null,
            items: {
              create: [
                {
                  productId: body.productId,
                  productSnapshot: buildProductSnapshot(product),
                  quantity: body.quantity,
                  unitPrice,
                  lineTotal,
                },
              ],
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            subtotalAmount: true,
            shippingAmount: true,
            totalAmount: true,
            createdAt: true,
          },
        });

        // Create payment record
        await tx.payment.create({
          data: {
            orderId: createdOrder.id,
            paymentMethod: body.paymentMethod,
            status: 'UNPAID',
            amount: totalAmount,
          },
        });

        return createdOrder;
      });

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        subtotalAmount: Number(order.subtotalAmount),
        shippingAmount: Number(order.shippingAmount),
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
      };
    } catch (error: unknown) {
      if (isUniqueConstraintError(error) && attempt < ORDER_NUMBER_MAX_RETRIES - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError('Failed to generate unique order number', 500, 'ORDER_NUMBER_GENERATION_FAILED');
}

export async function getConfirmation(orderNumber: string, userId: number) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      paymentMethod: true,
      totalAmount: true,
      createdAt: true,
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt,
  };
}
