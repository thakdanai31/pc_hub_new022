import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors.js';
import { buildPaginationMeta } from '../../common/pagination.js';
import type { BrandListQuery } from './brand.schema.js';
import type { Prisma } from '../../generated/prisma/client.js';

export async function listBrands(query: BrandListQuery) {
  const where: Prisma.BrandWhereInput = { isActive: true };

  if (query.search) {
    where.name = { contains: query.search };
  }

  const [data, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
      },
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

export async function getBrandById(brandId: number) {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  });

  if (!brand) {
    throw new NotFoundError('Brand not found');
  }

  return brand;
}
