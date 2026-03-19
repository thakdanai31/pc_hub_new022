import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

function getDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required for seeding",
    );
  }
  return url;
}

function parseConnectionUrl(url: string): {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    port: parsed.port ? Number(parsed.port) : 3306,
  };
}

const dbConfig = parseConnectionUrl(getDatabaseUrl());

const adapter = new PrismaMariaDb({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function seed(): Promise<void> {
  console.log("Seeding database...");

  // --- Users ---
  const adminHash = await hashPassword("Admin@1234");
  const staffHash = await hashPassword("Staff@1234");
  const customerHash = await hashPassword("Customer@1234");

  await prisma.user.upsert({
    where: { email: "admin@pchub.com" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "User",
      email: "admin@pchub.com",
      phoneNumber: "0800000001",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  console.log("  ✓ Admin user");

  await prisma.user.upsert({
    where: { email: "staff@pchub.com" },
    update: {},
    create: {
      firstName: "Staff",
      lastName: "User",
      email: "staff@pchub.com",
      phoneNumber: "0800000002",
      passwordHash: staffHash,
      role: "STAFF",
    },
  });
  console.log("  ✓ Staff user");

  await prisma.user.upsert({
    where: { email: "customer@pchub.com" },
    update: {},
    create: {
      firstName: "Customer",
      lastName: "User",
      email: "customer@pchub.com",
      phoneNumber: "0800000003",
      passwordHash: customerHash,
      role: "CUSTOMER",
    },
  });
  console.log("  ✓ Customer user");

  // --- Customer Address (for checkout flow) ---
  const customer = await prisma.user.findUnique({
    where: { email: "customer@pchub.com" },
  });
  if (customer) {
    const existingAddr = await prisma.address.findFirst({
      where: { userId: customer.id },
    });
    if (!existingAddr) {
      await prisma.address.create({
        data: {
          userId: customer.id,
          label: "Home",
          recipientName: "Customer User",
          phoneNumber: "0800000003",
          line1: "123 Sukhumvit Road",
          district: "Watthana",
          subdistrict: "Khlong Toei Nuea",
          province: "Bangkok",
          postalCode: "10110",
          isDefault: true,
        },
      });
    }
    console.log("  ✓ Customer address");
  }

  // --- Categories ---
  const categoryData = [
    { name: "CPU", slug: "cpu", description: "Central Processing Units" },
    { name: "GPU", slug: "gpu", description: "Graphics Processing Units" },
    { name: "RAM", slug: "ram", description: "Memory Modules" },
    { name: "Motherboard", slug: "motherboard", description: "Motherboards" },
    { name: "Storage", slug: "storage", description: "SSDs and Hard Drives" },
    { name: "PSU", slug: "psu", description: "Power Supply Units" },
  ] as const;

  const categories: Record<string, { id: number }> = {};
  for (const cat of categoryData) {
    categories[cat.slug] = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log("  ✓ 6 categories");

  // --- Brands ---
  const brandData = [
    { name: "AMD", slug: "amd" },
    { name: "Intel", slug: "intel" },
    { name: "NVIDIA", slug: "nvidia" },
    { name: "Corsair", slug: "corsair" },
    { name: "Samsung", slug: "samsung" },
    { name: "Seasonic", slug: "seasonic" },
  ] as const;

  const brands: Record<string, { id: number }> = {};
  for (const brand of brandData) {
    brands[brand.slug] = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: brand,
    });
  }
  console.log("  ✓ 6 brands");

  // --- Products ---
  const productData = [
    {
      name: "AMD Ryzen 9 7950X",
      slug: "amd-ryzen-9-7950x",
      sku: "CPU-AMD-7950X",
      description:
        "16-core, 32-thread desktop processor with Zen 4 architecture",
      price: 18900,
      stock: 25,
      warrantyMonths: 36,
      categorySlug: "cpu",
      brandSlug: "amd",
    },
    {
      name: "Intel Core i9-14900K",
      slug: "intel-core-i9-14900k",
      sku: "CPU-INTEL-14900K",
      description:
        "24-core, 32-thread desktop processor with hybrid architecture",
      price: 19500,
      stock: 20,
      warrantyMonths: 36,
      categorySlug: "cpu",
      brandSlug: "intel",
    },
    {
      name: "NVIDIA GeForce RTX 4090",
      slug: "nvidia-rtx-4090",
      sku: "GPU-NV-4090",
      description:
        "Flagship graphics card with 24GB GDDR6X and Ada Lovelace architecture",
      price: 62900,
      stock: 10,
      warrantyMonths: 36,
      categorySlug: "gpu",
      brandSlug: "nvidia",
    },
    {
      name: "AMD Radeon RX 7900 XTX",
      slug: "amd-rx-7900-xtx",
      sku: "GPU-AMD-7900XTX",
      description:
        "High-end graphics card with 24GB GDDR6 and RDNA 3 architecture",
      price: 35900,
      stock: 15,
      warrantyMonths: 36,
      categorySlug: "gpu",
      brandSlug: "amd",
    },
    {
      name: "Corsair Vengeance DDR5-6000 32GB",
      slug: "corsair-vengeance-ddr5-6000-32gb",
      sku: "RAM-COR-V32-6000",
      description:
        "32GB (2x16GB) DDR5 kit at 6000MHz with Intel XMP 3.0 support",
      price: 4290,
      stock: 50,
      warrantyMonths: 120,
      categorySlug: "ram",
      brandSlug: "corsair",
    },
    {
      name: "Corsair Dominator DDR5-6400 64GB",
      slug: "corsair-dominator-ddr5-6400-64gb",
      sku: "RAM-COR-D64-6400",
      description: "64GB (2x32GB) DDR5 kit at 6400MHz with DHX cooling",
      price: 9490,
      stock: 30,
      warrantyMonths: 120,
      categorySlug: "ram",
      brandSlug: "corsair",
    },
    {
      name: "AMD B650E AORUS Master",
      slug: "amd-b650e-aorus-master",
      sku: "MB-AMD-B650E-AM",
      description: "AM5 ATX motherboard with DDR5 support and PCIe 5.0",
      price: 9990,
      stock: 20,
      warrantyMonths: 36,
      categorySlug: "motherboard",
      brandSlug: "amd",
    },
    {
      name: "Intel Z790 AORUS Elite AX",
      slug: "intel-z790-aorus-elite-ax",
      sku: "MB-INTEL-Z790-AEA",
      description: "LGA1700 ATX motherboard with DDR5, Wi-Fi 6E, and 2.5GbE",
      price: 8990,
      stock: 25,
      warrantyMonths: 36,
      categorySlug: "motherboard",
      brandSlug: "intel",
    },
    {
      name: "Samsung 990 PRO 2TB NVMe SSD",
      slug: "samsung-990-pro-2tb",
      sku: "SSD-SAM-990P-2T",
      description: "2TB PCIe 4.0 NVMe M.2 SSD with up to 7,450 MB/s read speed",
      price: 6490,
      stock: 40,
      warrantyMonths: 60,
      categorySlug: "storage",
      brandSlug: "samsung",
    },
    {
      name: "Samsung 870 EVO 4TB SATA SSD",
      slug: "samsung-870-evo-4tb",
      sku: "SSD-SAM-870E-4T",
      description: "4TB 2.5-inch SATA III SSD with V-NAND technology",
      price: 9990,
      stock: 35,
      warrantyMonths: 60,
      categorySlug: "storage",
      brandSlug: "samsung",
    },
    {
      name: "Seasonic PRIME TX-1000",
      slug: "seasonic-prime-tx-1000",
      sku: "PSU-SEA-PTX-1000",
      description: "1000W 80+ Titanium fully modular power supply",
      price: 9990,
      stock: 15,
      warrantyMonths: 144,
      categorySlug: "psu",
      brandSlug: "seasonic",
    },
    {
      name: "Seasonic FOCUS GX-850",
      slug: "seasonic-focus-gx-850",
      sku: "PSU-SEA-FGX-850",
      description: "850W 80+ Gold fully modular power supply",
      price: 4990,
      stock: 30,
      warrantyMonths: 120,
      categorySlug: "psu",
      brandSlug: "seasonic",
    },
  ];

  for (const product of productData) {
    const categoryId = categories[product.categorySlug]?.id;
    const brandId = brands[product.brandSlug]?.id;
    if (categoryId === undefined || brandId === undefined) {
      throw new Error(`Missing category or brand for product: ${product.name}`);
    }

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        price: product.price,
        stock: product.stock,
        warrantyMonths: product.warrantyMonths,
        categoryId,
        brandId,
      },
    });
  }
  console.log("  ✓ 12 products");

  console.log("Seeding complete.");
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
