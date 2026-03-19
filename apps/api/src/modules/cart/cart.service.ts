import { prisma } from '../../config/database.js';
import { AppError, NotFoundError } from '../../common/errors.js';
import type { AddCartItemBody, UpdateCartItemBody } from './cart.schema.js';

const cartItemSelect = {
  id: true,
  quantity: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      price: true,
      stock: true,
      isActive: true,
      images: {
        select: { imageUrl: true },
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
      },
      category: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
      brand: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
    },
  },
};

async function getOrCreateCart(userId: number) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

export async function getCart(userId: number) {
  const cart = await getOrCreateCart(userId);

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: cartItemSelect,
    orderBy: { createdAt: 'asc' },
  });

  return {
    id: cart.id,
    items: items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        price: Number(item.product.price),
        stock: item.product.stock,
        isActive: item.product.isActive,
        image: item.product.images[0]?.imageUrl ?? null,
        category: {
          id: item.product.category.id,
          name: item.product.category.name,
          slug: item.product.category.slug,
          isActive: item.product.category.isActive,
        },
        brand: {
          id: item.product.brand.id,
          name: item.product.brand.name,
          slug: item.product.brand.slug,
          isActive: item.product.brand.isActive,
        },
      },
    })),
  };
}

export async function addItem(userId: number, body: AddCartItemBody) {
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: {
      id: true,
      stock: true,
      isActive: true,
      category: { select: { isActive: true } },
      brand: { select: { isActive: true } },
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

  const cart = await getOrCreateCart(userId);

  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: body.productId } },
  });

  const newQuantity = (existingItem?.quantity ?? 0) + body.quantity;

  if (newQuantity > product.stock) {
    throw new AppError(
      `Insufficient stock. Available: ${String(product.stock)}`,
      400,
      'INSUFFICIENT_STOCK',
    );
  }

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: body.productId,
        quantity: body.quantity,
      },
    });
  }

  return getCart(userId);
}

export async function updateItem(
  userId: number,
  cartItemId: number,
  body: UpdateCartItemBody,
) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    throw new NotFoundError('Cart item not found');
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
    select: {
      id: true,
      product: { select: { stock: true } },
    },
  });

  if (!item) {
    throw new NotFoundError('Cart item not found');
  }

  if (body.quantity > item.product.stock) {
    throw new AppError(
      `Insufficient stock. Available: ${String(item.product.stock)}`,
      400,
      'INSUFFICIENT_STOCK',
    );
  }

  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: body.quantity },
  });

  return getCart(userId);
}

export async function removeItem(userId: number, cartItemId: number) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    throw new NotFoundError('Cart item not found');
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
  });

  if (!item) {
    throw new NotFoundError('Cart item not found');
  }

  await prisma.cartItem.delete({ where: { id: cartItemId } });

  return getCart(userId);
}

export async function clearCart(userId: number) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    return { id: 0, items: [] };
  }

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return { id: cart.id, items: [] };
}
