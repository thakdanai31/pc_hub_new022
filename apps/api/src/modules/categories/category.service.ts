import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors.js';
import { buildPaginationMeta } from '../../common/pagination.js';
import type { CategoryListQuery } from './category.schema.js';
import type { Prisma } from '../../generated/prisma/client.js';

export async function listCategories(query: CategoryListQuery) {
  const where: Prisma.CategoryWhereInput = { isActive: true };

  if (query.search) {
    where.name = { contains: query.search };
  }

  const [data, total] = await Promise.all([
    prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.category.count({ where }),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getCategoryById(categoryId: number) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
    },
  });

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  return category;
}
