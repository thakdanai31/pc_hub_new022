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
  BrandAdminListQuery,
  CreateBrandBody,
  UpdateBrandBody,
} from './brand-admin.schema.js';

const selectFields = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  logoPublicId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.BrandSelect;

export async function listBrands(query: BrandAdminListQuery) {
  const where: Prisma.BrandWhereInput = {};

  if (query.search) {
    where.name = { contains: query.search };
  }

  const [data, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      select: selectFields,
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.brand.count({ where }),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createBrand(body: CreateBrandBody, actorUserId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: {
          name: body.name,
          slug: body.slug,
          isActive: body.isActive,
        },
        select: selectFields,
      });

      await logAction(tx, {
        actorUserId,
        action: 'BRAND_CREATE',
        entityType: 'Brand',
        entityId: brand.id,
        metadata: { name: body.name, slug: body.slug },
      });

      return brand;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Brand with this slug already exists');
    }
    throw error;
  }
}

export async function updateBrand(brandId: number, body: UpdateBrandBody, actorUserId: number) {
  const existing = await prisma.brand.findUnique({
    where: { id: brandId },
  });
  if (!existing) {
    throw new NotFoundError('Brand not found');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.update({
        where: { id: brandId },
        data: body,
        select: selectFields,
      });

      await logAction(tx, {
        actorUserId,
        action: 'BRAND_UPDATE',
        entityType: 'Brand',
        entityId: brandId,
      });

      return brand;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Brand with this slug already exists');
    }
    throw error;
  }
}

export async function deleteBrand(brandId: number, actorUserId: number) {
  const existing = await prisma.brand.findUnique({
    where: { id: brandId },
  });
  if (!existing) {
    throw new NotFoundError('Brand not found');
  }

  const productCount = await prisma.product.count({ where: { brandId } });
  if (productCount > 0) {
    throw new ConflictError('Cannot delete brand with existing products');
  }

  await prisma.$transaction(async (tx) => {
    await tx.brand.delete({ where: { id: brandId } });

    await logAction(tx, {
      actorUserId,
      action: 'BRAND_DELETE',
      entityType: 'Brand',
      entityId: brandId,
      metadata: { name: existing.name },
    });
  });
}

export async function toggleActive(brandId: number, actorUserId: number) {
  const existing = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    throw new NotFoundError('Brand not found');
  }

  const newActive = !existing.isActive;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.brand.update({
      where: { id: brandId },
      data: { isActive: newActive },
      select: { id: true, isActive: true },
    });

    await logAction(tx, {
      actorUserId,
      action: 'BRAND_TOGGLE_ACTIVE',
      entityType: 'Brand',
      entityId: brandId,
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

export async function uploadBrandLogo(
  brandId: number,
  file: UploadedFile,
  actorUserId: number,
) {
  ensureCloudinaryConfigured();

  const existing = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, logoPublicId: true },
  });
  if (!existing) {
    throw new NotFoundError('Brand not found');
  }

  const { imageUrl, imagePublicId } = await uploadImage(
    file.buffer,
    'pc-hub/brands',
  );

  // Delete old logo from Cloudinary if exists
  if (existing.logoPublicId) {
    await deleteImage(existing.logoPublicId);
  }

  return await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.update({
      where: { id: brandId },
      data: {
        logoUrl: imageUrl,
        logoPublicId: imagePublicId,
      },
      select: selectFields,
    });

    await logAction(tx, {
      actorUserId,
      action: 'BRAND_LOGO_UPLOAD',
      entityType: 'Brand',
      entityId: brandId,
    });

    return brand;
  });
}
