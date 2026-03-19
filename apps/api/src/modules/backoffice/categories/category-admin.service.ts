import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { NotFoundError, ConflictError } from "../../../common/errors.js";
import { buildPaginationMeta } from "../../../common/pagination.js";
import { logAction } from "../../audit/audit.service.js";
import type {
  CategoryAdminListQuery,
  CreateCategoryBody,
  UpdateCategoryBody,
} from "./category-admin.schema.js";

const selectFields = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export async function listCategories(query: CategoryAdminListQuery) {
  const where: Prisma.CategoryWhereInput = {};

  if (query.search) {
    where.name = { contains: query.search };
  }

  const [data, total] = await Promise.all([
    prisma.category.findMany({
      where,
      select: {
        ...selectFields,
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
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

export async function createCategory(
  body: CreateCategoryBody,
  actorUserId: number,
) {
  if (body.parentId !== undefined) {
    const parent = await prisma.category.findUnique({
      where: { id: body.parentId },
    });
    if (!parent) {
      throw new NotFoundError("Parent category not found");
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description,
          parentId: body.parentId,
          isActive: body.isActive,
        },
        select: selectFields,
      });

      await logAction(tx, {
        actorUserId,
        action: "CATEGORY_CREATE",
        entityType: "Category",
        entityId: category.id,
        metadata: { name: body.name, slug: body.slug },
      });

      return category;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Category with this slug already exists");
    }
    throw error;
  }
}

export async function updateCategory(
  categoryId: number,
  body: UpdateCategoryBody,
  actorUserId: number,
) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === categoryId) {
      throw new ConflictError("Category cannot be its own parent");
    }
    const parent = await prisma.category.findUnique({
      where: { id: body.parentId },
    });
    if (!parent) {
      throw new NotFoundError("Parent category not found");
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id: categoryId },
        data: body,
        select: selectFields,
      });

      await logAction(tx, {
        actorUserId,
        action: "CATEGORY_UPDATE",
        entityType: "Category",
        entityId: categoryId,
      });

      return category;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Category with this slug already exists");
    }
    throw error;
  }
}

export async function deleteCategory(categoryId: number, actorUserId: number) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  const [productCount, childCount] = await Promise.all([
    prisma.product.count({ where: { categoryId } }),
    prisma.category.count({ where: { parentId: categoryId } }),
  ]);

  if (productCount > 0) {
    throw new ConflictError("Cannot delete category with existing products");
  }
  if (childCount > 0) {
    throw new ConflictError("Cannot delete category with child categories");
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id: categoryId } });

    await logAction(tx, {
      actorUserId,
      action: "CATEGORY_DELETE",
      entityType: "Category",
      entityId: categoryId,
      metadata: { name: existing.name },
    });
  });
}

export async function toggleActive(categoryId: number, actorUserId: number) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  const newActive = !existing.isActive;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id: categoryId },
      data: { isActive: newActive },
      select: { id: true, isActive: true },
    });

    await logAction(tx, {
      actorUserId,
      action: "CATEGORY_TOGGLE_ACTIVE",
      entityType: "Category",
      entityId: categoryId,
      metadata: { isActive: newActive },
    });

    return updated;
  });
}
