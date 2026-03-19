import { prisma } from '../../../config/database.js';
import type { OrderStatus } from '../../../generated/prisma/client.js';

// Bangkok is UTC+7
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

interface StatusCount {
  status: string;
  count: number;
}

interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  pendingReviewCount: number;
  ordersByStatus: StatusCount[];
  totalCustomers: number;
  totalProducts: number;
}

interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

interface TopProduct {
  productId: number;
  productName: string;
  sku: string;
  totalQuantitySold: number;
  totalRevenue: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  price: number;
  categoryName: string;
  imageUrl: string | null;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: Date;
  customerName: string;
}

export async function getSummary(): Promise<AnalyticsSummary> {
  const [revenueAgg, totalOrders, pendingReviewCount, statusGroups, totalCustomers, totalProducts] =
    await Promise.all([
      prisma.order.aggregate({
        where: { status: 'DELIVERED' as OrderStatus },
        _sum: { totalAmount: true },
      }),
      prisma.order.count(),
      prisma.order.count({
        where: {
          status: { in: ['PENDING', 'PAYMENT_REVIEW'] as OrderStatus[] },
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.user.count({
        where: { role: 'CUSTOMER' },
      }),
      prisma.product.count({
        where: { isActive: true },
      }),
    ]);

  return {
    totalRevenue: Number(revenueAgg._sum.totalAmount ?? 0),
    totalOrders,
    pendingReviewCount,
    ordersByStatus: statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    totalCustomers,
    totalProducts,
  };
}

export async function getRevenueTrend(period: '7d' | '30d' | '90d'): Promise<RevenueTrendPoint[]> {
  const daysBack = period === '7d' ? 7 : period === '90d' ? 90 : 30;

  // Calculate start date in Bangkok local time, then convert to UTC
  const nowUtc = new Date();
  const bangkokNow = new Date(nowUtc.getTime() + BANGKOK_OFFSET_MS);
  // Start of today in Bangkok
  const bangkokStartOfToday = new Date(
    Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate()),
  );
  // Go back N days in Bangkok local, then convert to UTC
  const startBangkok = new Date(bangkokStartOfToday.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startUtc = new Date(startBangkok.getTime() - BANGKOK_OFFSET_MS);

  // Use raw SQL for date-based grouping — Prisma cannot express CONVERT_TZ + DATE grouping
  const rows = await prisma.$queryRaw<
    Array<{ date: string; revenue: string; orderCount: bigint }>
  >`
    SELECT
      DATE(CONVERT_TZ(updatedAt, '+00:00', '+07:00')) AS date,
      COALESCE(SUM(totalAmount), 0) AS revenue,
      COUNT(*) AS orderCount
    FROM \`Order\`
    WHERE status = 'DELIVERED'
      AND updatedAt >= ${startUtc}
    GROUP BY DATE(CONVERT_TZ(updatedAt, '+00:00', '+07:00'))
    ORDER BY date ASC
  `;

  // Build a map from raw results
  const resultMap = new Map<string, { revenue: number; orderCount: number }>();
  for (const row of rows) {
    const rawDate = row.date as Date | string;
    const dateStr = typeof rawDate === 'string' ? rawDate : rawDate.toISOString().slice(0, 10);
    resultMap.set(dateStr, {
      revenue: Number(row.revenue),
      orderCount: Number(row.orderCount),
    });
  }

  // Fill missing dates with zeros
  const result: RevenueTrendPoint[] = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(bangkokStartOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
    const entry = resultMap.get(dateStr);
    result.push({
      date: dateStr,
      revenue: entry?.revenue ?? 0,
      orderCount: entry?.orderCount ?? 0,
    });
  }

  return result;
}

export async function getTopProducts(limit: number): Promise<TopProduct[]> {
  // Use raw SQL for cross-table aggregation with groupBy
  const rows = await prisma.$queryRaw<
    Array<{
      productId: number;
      productName: string;
      sku: string;
      totalQuantitySold: string;
      totalRevenue: string;
    }>
  >`
    SELECT
      oi.productId AS productId,
      p.name AS productName,
      p.sku AS sku,
      SUM(oi.quantity) AS totalQuantitySold,
      SUM(oi.lineTotal) AS totalRevenue
    FROM OrderItem oi
    JOIN \`Order\` o ON oi.orderId = o.id
    JOIN Product p ON oi.productId = p.id
    WHERE o.status NOT IN ('REJECTED', 'CANCELLED')
    GROUP BY oi.productId, p.name, p.sku
    ORDER BY totalQuantitySold DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    sku: row.sku,
    totalQuantitySold: Number(row.totalQuantitySold),
    totalRevenue: Number(row.totalRevenue),
  }));
}

export async function getLowStockProducts(threshold: number, limit: number): Promise<LowStockProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stock: { lte: threshold },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      price: true,
      category: { select: { name: true } },
      images: {
        select: { imageUrl: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
      },
    },
    orderBy: { stock: 'asc' },
    take: limit,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    price: Number(p.price),
    categoryName: p.category.name,
    imageUrl: p.images[0]?.imageUrl ?? null,
  }));
}

export async function getRecentOrders(limit: number): Promise<RecentOrder[]> {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      _count: { select: { items: true } },
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    itemCount: o._count.items,
    createdAt: o.createdAt,
    customerName: `${o.user.firstName} ${o.user.lastName}`,
  }));
}
