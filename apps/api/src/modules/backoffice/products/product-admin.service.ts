import { prisma } from '../../../config/database.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { NotFoundError, ConflictError } from '../../../common/errors.js';
import { buildPaginationMeta } from '../../../common/pagination.js';
import {
  uploadImage,
  deleteImage,
  ensureCloudinaryConfigured,
} from '../../../config/cloudinary.js';
import { logAction } from '../../audit/audit.service.js';
import type {
  ProductAdminListQuery,
  CreateProductBody,
  UpdateProductBody,
  ImageUploadBody,
} from './product-admin.schema.js';

const sortMap = {
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  name_asc: { name: 'asc' },
  name_desc: { name: 'desc' },
} as const;

const listSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  price: true,
  stock: true,
  warrantyMonths: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: {
    select: { imageUrl: true },
    orderBy: { sortOrder: 'asc' } satisfies Prisma.ProductImageOrderByWithRelationInput,
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  price: true,
  stock: true,
  warrantyMonths: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: {
    select: {
      id: true,
      imageUrl: true,
      imagePublicId: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' } satisfies Prisma.ProductImageOrderByWithRelationInput,
  },
} satisfies Prisma.ProductSelect;

export async function getProduct(productId: number) {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: detailSelect,
  });
  if (!row) {
    throw new NotFoundError('Product not found');
  }
  return { ...row, price: Number(row.price) };
}

export async function listProducts(query: ProductAdminListQuery) {
  const where: Prisma.ProductWhereInput = {};

  if (query.search) {
    where.name = { contains: query.search };
  }
  if (query.categoryId !== undefined) {
    where.categoryId = query.categoryId;
  }
  if (query.brandId !== undefined) {
    where.brandId = query.brandId;
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const orderBy = sortMap[query.sort];

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: listSelect,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.product.count({ where }),
  ]);

  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    price: Number(row.price),
    stock: row.stock,
    warrantyMonths: row.warrantyMonths,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: row.category,
    brand: row.brand,
    image: row.images[0]?.imageUrl ?? null,
  }));

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

async function validateForeignKeys(
  categoryId: number | undefined,
  brandId: number | undefined,
): Promise<void> {
  if (categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundError('Category not found');
    }
  }
  if (brandId !== undefined) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }
  }
}

export async function createProduct(body: CreateProductBody, actorUserId: number) {
  await validateForeignKeys(body.categoryId, body.brandId);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.product.create({
        data: {
          categoryId: body.categoryId,
          brandId: body.brandId,
          name: body.name,
          slug: body.slug,
          sku: body.sku,
          description: body.description,
          price: body.price,
          stock: body.stock,
          warrantyMonths: body.warrantyMonths,
          isActive: body.isActive,
        },
        select: detailSelect,
      });

      await logAction(tx, {
        actorUserId,
        action: 'PRODUCT_CREATE',
        entityType: 'Product',
        entityId: row.id,
        metadata: { name: body.name, sku: body.sku },
      });

      return { ...row, price: Number(row.price) };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const metaStr = JSON.stringify(error.meta);
      if (metaStr.includes('sku')) {
        throw new ConflictError('Product with this SKU already exists');
      }
      throw new ConflictError('Product with this slug already exists');
    }
    throw error;
  }
}

export async function updateProduct(productId: number, body: UpdateProductBody, actorUserId: number) {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  await validateForeignKeys(body.categoryId, body.brandId);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.product.update({
        where: { id: productId },
        data: body,
        select: detailSelect,
      });

      await logAction(tx, {
        actorUserId,
        action: 'PRODUCT_UPDATE',
        entityType: 'Product',
        entityId: productId,
      });

      return { ...row, price: Number(row.price) };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const metaStr = JSON.stringify(error.meta);
      if (metaStr.includes('sku')) {
        throw new ConflictError('Product with this SKU already exists');
      }
      throw new ConflictError('Product with this slug already exists');
    }
    throw error;
  }
}

export async function deleteProduct(productId: number, actorUserId: number) {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      images: { select: { id: true, imagePublicId: true } },
    },
  });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  // Delete images from Cloudinary (best-effort), then delete product + images in a transaction
  for (const image of existing.images) {
    await deleteImage(image.imagePublicId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });

    await logAction(tx, {
      actorUserId,
      action: 'PRODUCT_DELETE',
      entityType: 'Product',
      entityId: productId,
      metadata: { name: existing.name },
    });
  });
}

export async function toggleActive(productId: number, actorUserId: number) {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  const newActive = !existing.isActive;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: { isActive: newActive },
      select: { id: true, isActive: true },
    });

    await logAction(tx, {
      actorUserId,
      action: 'PRODUCT_TOGGLE_ACTIVE',
      entityType: 'Product',
      entityId: productId,
      metadata: { isActive: newActive },
    });

    return updated;
  });
}

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export async function uploadProductImage(
  productId: number,
  file: UploadedFile,
  body: ImageUploadBody,
  actorUserId: number,
) {
  ensureCloudinaryConfigured();

  const existing = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  const { imageUrl, imagePublicId } = await uploadImage(
    file.buffer,
    'pc-hub/products',
  );

  return await prisma.$transaction(async (tx) => {
    const productImage = await tx.productImage.create({
      data: {
        productId,
        imageUrl,
        imagePublicId,
        altText: body.altText,
        sortOrder: body.sortOrder,
      },
      select: {
        id: true,
        imageUrl: true,
        imagePublicId: true,
        altText: true,
        sortOrder: true,
      },
    });

    await logAction(tx, {
      actorUserId,
      action: 'PRODUCT_IMAGE_UPLOAD',
      entityType: 'ProductImage',
      entityId: productImage.id,
      metadata: { productId },
    });

    return productImage;
  });
}

export async function deleteProductImage(productId: number, imageId: number, actorUserId: number) {
  ensureCloudinaryConfigured();

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  await deleteImage(image.imagePublicId);

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });

    await logAction(tx, {
      actorUserId,
      action: 'PRODUCT_IMAGE_DELETE',
      entityType: 'ProductImage',
      entityId: imageId,
      metadata: { productId },
    });
  });
}
