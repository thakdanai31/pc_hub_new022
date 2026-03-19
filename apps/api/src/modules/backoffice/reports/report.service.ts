import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../../config/database.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { OrderStatus } from '../../../generated/prisma/client.js';

// Bangkok is UTC+7
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const BANGKOK_TIMEZONE = 'Asia/Bangkok';
const THAI_LOCALE = 'th-TH-u-ca-gregory';
const REPORTS_DIR = path.dirname(fileURLToPath(import.meta.url));

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  AWAITING_PAYMENT: 'รอชำระเงิน',
  PAYMENT_REVIEW: 'รอตรวจสอบสลิป',
  APPROVED: 'อนุมัติแล้ว',
  PROCESSING: 'กำลังเตรียมสินค้า',
  SHIPPED: 'จัดส่งแล้ว',
  DELIVERED: 'จัดส่งสำเร็จ',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: 'เก็บเงินปลายทาง',
  PROMPTPAY_QR: 'PromptPay QR',
};

let cachedThaiFontPaths: { regular: string; bold: string } | null = null;

/**
 * Returns UTC Date boundaries for a Bangkok-local date string.
 * e.g. "2026-03-15" → startUTC = 2026-03-14T17:00:00Z, endUTC = 2026-03-15T17:00:00Z
 */
function buildBangkokDayRange(dateStr: string): { gte: Date; lt: Date } {
  // Parse as midnight Bangkok local, then convert to UTC by subtracting offset
  const [year, month, day] = dateStr.split('-').map(Number);
  // Midnight Bangkok = midnight UTC minus 7 hours → previous day 17:00 UTC
  const startUtc = new Date(Date.UTC(year!, month! - 1, day!) - BANGKOK_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { gte: startUtc, lt: endUtc };
}

/** Returns today's date string in Bangkok timezone (YYYY-MM-DD) */
function todayBangkok(): string {
  const now = new Date();
  const bangkokTime = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return bangkokTime.toISOString().slice(0, 10);
}

function formatCustomerName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function formatCurrency(amount: number): string {
  return `฿${new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatReportDate(dateStr: string): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: BANGKOK_TIMEZONE,
  }).format(new Date(`${dateStr}T00:00:00+07:00`));
}

function formatBangkokDateTime(date: Date): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BANGKOK_TIMEZONE,
  }).format(date);
}

function formatBangkokTime(date: Date): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BANGKOK_TIMEZONE,
  }).format(date);
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function getPaymentMethodLabel(paymentMethod: string): string {
  return PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod;
}

function resolveReportAssetPath(fileName: string): string {
  const candidates = [
    path.join(REPORTS_DIR, 'fonts', fileName),
    path.resolve(process.cwd(), 'src/modules/backoffice/reports/fonts', fileName),
    path.resolve(process.cwd(), 'apps/api/src/modules/backoffice/reports/fonts', fileName),
    path.resolve(process.cwd(), 'dist/modules/backoffice/reports/fonts', fileName),
    path.resolve(process.cwd(), 'apps/api/dist/modules/backoffice/reports/fonts', fileName),
  ];

  const foundPath = candidates.find((candidate) => existsSync(candidate));
  if (!foundPath) {
    throw new Error(`Required report asset was not found: ${fileName}`);
  }

  return foundPath;
}

function getThaiFontPaths(): { regular: string; bold: string } {
  if (cachedThaiFontPaths) {
    return cachedThaiFontPaths;
  }

  cachedThaiFontPaths = {
    regular: resolveReportAssetPath('Sarabun-Regular.ttf'),
    bold: resolveReportAssetPath('Sarabun-Bold.ttf'),
  };

  return cachedThaiFontPaths;
}

interface StatusCount {
  status: string;
  count: number;
}

interface PaymentMethodCount {
  paymentMethod: string;
  count: number;
}

interface DailySalesItem {
  orderId: number;
  orderNumber: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
}

interface DailySalesResult {
  date: string;
  totalOrders: number;
  completedRevenue: number;
  pendingRevenue: number;
  ordersByStatus: StatusCount[];
  ordersByPaymentMethod: PaymentMethodCount[];
  items: DailySalesItem[];
}

export async function getDailySales(dateParam?: string): Promise<DailySalesResult> {
  const date = dateParam ?? todayBangkok();
  const range = buildBangkokDayRange(date);
  const where = { createdAt: range };

  const [totalOrders, completedAgg, pendingAgg, statusGroups, methodGroups, orders] =
    await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where: { ...where, status: 'DELIVERED' as OrderStatus },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          ...where,
          status: { notIn: ['REJECTED', 'CANCELLED'] as OrderStatus[] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          paymentMethod: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  return {
    date,
    totalOrders,
    completedRevenue: Number(completedAgg._sum.totalAmount ?? 0),
    pendingRevenue: Number(pendingAgg._sum.totalAmount ?? 0),
    ordersByStatus: statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    ordersByPaymentMethod: methodGroups.map((g) => ({
      paymentMethod: g.paymentMethod,
      count: g._count._all,
    })),
    items: orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: formatCustomerName(o.user.firstName, o.user.lastName),
      paymentMethod: o.paymentMethod,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
    })),
  };
}

export async function generateDailySalesExcel(dateParam?: string): Promise<Buffer> {
  const sales = await getDailySales(dateParam);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PC Hub';
  workbook.lastModifiedBy = 'PC Hub';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('รายงานยอดขาย', {
    properties: { defaultRowHeight: 22 },
    views: [{ showGridLines: false }],
  });

  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
  };
  sheet.headerFooter.oddFooter = '&LPC Hub&RPage &P of &N';

  sheet.columns = [
    { key: 'orderNumber', width: 20 },
    { key: 'customerName', width: 28 },
    { key: 'paymentMethod', width: 20 },
    { key: 'status', width: 22 },
    { key: 'totalAmount', width: 16 },
    { key: 'createdAt', width: 24 },
  ];

  const applyThinBorder = (cell: ExcelJS.Cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  };

  sheet.mergeCells('A1:F1');
  sheet.mergeCells('A2:F2');
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 22;

  const titleCell = sheet.getCell('A1');
  titleCell.value = 'รายงานยอดขายประจำวัน (Daily Sales Report)';
  titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `ประจำวันที่ ${formatReportDate(sales.date)} • อัปเดต ${formatBangkokDateTime(new Date())}`;
  subtitleCell.font = { size: 11, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  const summaryCards = [
    {
      labelRange: 'A4:B4',
      valueRange: 'A5:B5',
      label: 'จำนวนคำสั่งซื้อ',
      value: sales.totalOrders.toLocaleString('th-TH'),
      labelColor: 'FF1D4ED8',
      valueColor: 'FFDBEAFE',
      valueFontColor: 'FF1E3A8A',
    },
    {
      labelRange: 'C4:D4',
      valueRange: 'C5:D5',
      label: 'รายได้รอรับรู้',
      value: formatCurrency(sales.pendingRevenue),
      labelColor: 'FFD97706',
      valueColor: 'FFFEF3C7',
      valueFontColor: 'FF92400E',
    },
    {
      labelRange: 'E4:F4',
      valueRange: 'E5:F5',
      label: 'รายได้สำเร็จ',
      value: formatCurrency(sales.completedRevenue),
      labelColor: 'FF059669',
      valueColor: 'FFD1FAE5',
      valueFontColor: 'FF065F46',
    },
  ];

  for (const card of summaryCards) {
    sheet.mergeCells(card.labelRange);
    sheet.mergeCells(card.valueRange);

    const labelCell = sheet.getCell(card.labelRange.split(':')[0]!);
    labelCell.value = card.label;
    labelCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.labelColor } };

    const valueCell = sheet.getCell(card.valueRange.split(':')[0]!);
    valueCell.value = card.value;
    valueCell.font = { bold: true, size: 16, color: { argb: card.valueFontColor } };
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.valueColor } };
  }

  sheet.mergeCells('A7:B7');
  sheet.mergeCells('D7:E7');

  const statusHeadingCell = sheet.getCell('A7');
  statusHeadingCell.value = 'สรุปตามสถานะคำสั่งซื้อ';
  statusHeadingCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  statusHeadingCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statusHeadingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

  const paymentHeadingCell = sheet.getCell('D7');
  paymentHeadingCell.value = 'สรุปตามช่องทางชำระเงิน';
  paymentHeadingCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  paymentHeadingCell.alignment = { horizontal: 'center', vertical: 'middle' };
  paymentHeadingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

  const statusRows = sales.ordersByStatus.length > 0
    ? sales.ordersByStatus.map((item) => ({
        label: getStatusLabel(item.status),
        count: item.count,
      }))
    : [{ label: 'ไม่มีข้อมูล', count: 0 }];

  const paymentRows = sales.ordersByPaymentMethod.length > 0
    ? sales.ordersByPaymentMethod.map((item) => ({
        label: getPaymentMethodLabel(item.paymentMethod),
        count: item.count,
      }))
    : [{ label: 'ไม่มีข้อมูล', count: 0 }];

  const breakdownRowCount = Math.max(statusRows.length, paymentRows.length);
  const breakdownStartRow = 8;

  for (let index = 0; index < breakdownRowCount; index += 1) {
    const rowNumber = breakdownStartRow + index;
    const zebraFill = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    const statusItem = statusRows[index];
    const paymentItem = paymentRows[index];

    sheet.getCell(`A${rowNumber}`).value = statusItem?.label ?? '';
    sheet.getCell(`B${rowNumber}`).value = statusItem?.count ?? '';
    sheet.getCell(`D${rowNumber}`).value = paymentItem?.label ?? '';
    sheet.getCell(`E${rowNumber}`).value = paymentItem?.count ?? '';

    for (const address of [`A${rowNumber}`, `B${rowNumber}`, `D${rowNumber}`, `E${rowNumber}`]) {
      const cell = sheet.getCell(address);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: address.startsWith('B') || address.startsWith('E') ? 'right' : 'left',
      };
      applyThinBorder(cell);
    }
  }

  const detailHeaderRow = breakdownStartRow + breakdownRowCount + 3;
  const detailHeaderValues = [
    'เลขที่คำสั่งซื้อ',
    'ลูกค้า',
    'ช่องทางชำระเงิน',
    'สถานะ',
    'ยอดรวม (บาท)',
    'วันที่และเวลา',
  ];

  const detailHeader = sheet.getRow(detailHeaderRow);
  detailHeader.values = detailHeaderValues;
  detailHeader.height = 24;
  detailHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };

  for (let columnIndex = 1; columnIndex <= detailHeaderValues.length; columnIndex += 1) {
    const cell = sheet.getCell(detailHeaderRow, columnIndex);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: columnIndex >= 5 ? 'center' : 'left',
    };
    applyThinBorder(cell);
  }

  sheet.autoFilter = {
    from: { row: detailHeaderRow, column: 1 },
    to: { row: detailHeaderRow, column: 6 },
  };
  sheet.views = [{ state: 'frozen', ySplit: detailHeaderRow, showGridLines: false }];
  sheet.getColumn(5).numFmt = '฿#,##0.00';

  let currentRowNumber = detailHeaderRow + 1;

  if (sales.items.length === 0) {
    sheet.mergeCells(`A${currentRowNumber}:F${currentRowNumber}`);
    const emptyCell = sheet.getCell(`A${currentRowNumber}`);
    emptyCell.value = 'ไม่มีคำสั่งซื้อในวันที่เลือก';
    emptyCell.font = { italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    applyThinBorder(emptyCell);
    currentRowNumber += 2;
  } else {
    for (const [index, item] of sales.items.entries()) {
      const row = sheet.getRow(currentRowNumber);
      row.values = [
        item.orderNumber,
        item.customerName,
        getPaymentMethodLabel(item.paymentMethod),
        getStatusLabel(item.status),
        item.totalAmount,
        formatBangkokDateTime(item.createdAt),
      ];
      row.height = 22;

      for (let columnIndex = 1; columnIndex <= 6; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.alignment = {
          vertical: 'middle',
          wrapText: columnIndex >= 2 && columnIndex <= 4,
          horizontal: columnIndex === 5 ? 'right' : columnIndex === 6 ? 'center' : 'left',
        };
        applyThinBorder(cell);
      }

      currentRowNumber += 1;
    }

    currentRowNumber += 1;
  }

  const footerRows = [
    { label: 'รายได้รอรับรู้รวม', value: sales.pendingRevenue },
    { label: 'รายได้สำเร็จรวม', value: sales.completedRevenue },
  ];

  for (const [index, footer] of footerRows.entries()) {
    const rowNumber = currentRowNumber + index;
    sheet.mergeCells(`A${rowNumber}:D${rowNumber}`);
    const labelCell = sheet.getCell(`A${rowNumber}`);
    labelCell.value = footer.label;
    labelCell.font = { bold: true, color: { argb: 'FF0F172A' } };
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    applyThinBorder(labelCell);

    const valueCell = sheet.getCell(`E${rowNumber}`);
    valueCell.value = footer.value;
    valueCell.numFmt = '฿#,##0.00';
    valueCell.font = { bold: true, color: { argb: 'FF0F172A' } };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    applyThinBorder(valueCell);

    const spacerCell = sheet.getCell(`F${rowNumber}`);
    spacerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    applyThinBorder(spacerCell);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateDailySalesPdf(dateParam?: string): Promise<Buffer> {
  const sales = await getDailySales(dateParam);
  const generatedAt = new Date();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 36,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Daily Sales Report ${sales.date}`,
        Author: 'PC Hub',
        Subject: 'Daily Sales Report',
      },
    });
    const chunks: Buffer[] = [];
    const { regular, bold } = getThaiFontPaths();

    doc.registerFont('ThaiRegular', regular);
    doc.registerFont('ThaiBold', bold);
    doc.lineGap(2);

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const margin = 36;
    const contentWidth = doc.page.width - margin * 2;
    const bottomLimit = () => doc.page.height - margin - 24;

    const summaryCards = [
      {
        label: 'จำนวนคำสั่งซื้อ',
        value: sales.totalOrders.toLocaleString('th-TH'),
        fill: '#DBEAFE',
        accent: '#2563EB',
        text: '#1E3A8A',
      },
      {
        label: 'รายได้รอรับรู้',
        value: formatCurrency(sales.pendingRevenue),
        fill: '#FEF3C7',
        accent: '#D97706',
        text: '#92400E',
      },
      {
        label: 'รายได้สำเร็จ',
        value: formatCurrency(sales.completedRevenue),
        fill: '#D1FAE5',
        accent: '#059669',
        text: '#065F46',
      },
    ];

    const drawHeader = () => {
      const headerHeight = 94;
      doc.save();
      doc.roundedRect(margin, margin, contentWidth, headerHeight, 18).fill('#0F172A');
      doc.restore();

      doc.font('ThaiBold').fontSize(11).fillColor('#93C5FD').text(
        'PC Hub • Backoffice Report',
        margin + 24,
        margin + 16,
        { width: contentWidth - 48 },
      );
      doc.font('ThaiBold').fontSize(20).fillColor('#FFFFFF').text(
        'รายงานยอดขายประจำวัน',
        margin + 24,
        margin + 34,
        { width: contentWidth - 48 },
      );
      doc.font('ThaiRegular').fontSize(10).fillColor('#CBD5E1').text(
        `ประจำวันที่ ${formatReportDate(sales.date)} • สร้างเมื่อ ${formatBangkokDateTime(generatedAt)}`,
        margin + 24,
        margin + 64,
        { width: contentWidth - 48 },
      );

      return margin + headerHeight + 18;
    };

    const drawSummaryCards = (startY: number) => {
      const gap = 12;
      const cardWidth = (contentWidth - gap * 2) / 3;
      const cardHeight = 78;

      summaryCards.forEach((card, index) => {
        const x = margin + index * (cardWidth + gap);

        doc.save();
        doc.roundedRect(x, startY, cardWidth, cardHeight, 16).fill(card.fill);
        doc.roundedRect(x, startY, 8, cardHeight, 16).fill(card.accent);
        doc.restore();

        doc.font('ThaiBold').fontSize(10).fillColor(card.text).text(card.label, x + 20, startY + 18, {
          width: cardWidth - 32,
        });
        doc.font('ThaiBold').fontSize(17).fillColor('#0F172A').text(card.value, x + 20, startY + 38, {
          width: cardWidth - 32,
        });
      });

      return startY + cardHeight + 18;
    };

    const drawBreakdownCard = (
      x: number,
      y: number,
      width: number,
      title: string,
      accent: string,
      rows: Array<{ label: string; value: string }>,
    ) => {
      const displayRows = rows.length > 0 ? rows : [{ label: 'ไม่มีข้อมูล', value: '0' }];
      const cardHeight = Math.max(112, 52 + displayRows.length * 22);

      doc.save();
      doc.roundedRect(x, y, width, cardHeight, 16).fill('#F8FAFC');
      doc.restore();
      doc.save();
      doc.roundedRect(x, y, width, 12, 16).fill(accent);
      doc.restore();

      doc.font('ThaiBold').fontSize(11).fillColor('#0F172A').text(title, x + 18, y + 20, {
        width: width - 36,
      });

      let rowY = y + 48;
      for (const row of displayRows) {
        doc.save();
        doc.circle(x + 24, rowY + 6, 3).fill(accent);
        doc.restore();
        doc.font('ThaiRegular').fontSize(9.5).fillColor('#334155').text(row.label, x + 34, rowY, {
          width: width - 94,
        });
        doc.font('ThaiBold').fontSize(9.5).fillColor('#0F172A').text(row.value, x + width - 52, rowY, {
          width: 28,
          align: 'right',
        });
        rowY += 22;
      }

      return cardHeight;
    };

    const tableColumns = [
      {
        label: 'คำสั่งซื้อ',
        width: 98,
        align: 'left' as const,
        value: (item: DailySalesItem) => `${item.orderNumber}\n${formatBangkokTime(item.createdAt)} น.`,
      },
      {
        label: 'ลูกค้า',
        width: 156,
        align: 'left' as const,
        value: (item: DailySalesItem) => item.customerName,
      },
      {
        label: 'ชำระเงิน',
        width: 88,
        align: 'left' as const,
        value: (item: DailySalesItem) => getPaymentMethodLabel(item.paymentMethod),
      },
      {
        label: 'สถานะ',
        width: 94,
        align: 'left' as const,
        value: (item: DailySalesItem) => getStatusLabel(item.status),
      },
      {
        label: 'ยอดรวม',
        width: 87,
        align: 'right' as const,
        value: (item: DailySalesItem) => formatCurrency(item.totalAmount),
      },
    ];

    const tableCellPaddingX = 8;
    const tableCellPaddingY = 8;
    const tableHeaderHeight = 28;

    const drawTableHeader = (y: number) => {
      doc.save();
      doc.roundedRect(margin, y, contentWidth, tableHeaderHeight, 10).fill('#0F172A');
      doc.restore();

      let x = margin;
      for (const column of tableColumns) {
        doc.font('ThaiBold').fontSize(9.5).fillColor('#FFFFFF').text(
          column.label,
          x + tableCellPaddingX,
          y + 8,
          {
            width: column.width - tableCellPaddingX * 2,
            align: column.align,
          },
        );
        x += column.width;
      }

      return y + tableHeaderHeight + 8;
    };

    const drawSectionTitle = (title: string, subtitle: string, y: number) => {
      doc.font('ThaiBold').fontSize(13).fillColor('#0F172A').text(title, margin, y, { width: contentWidth });
      doc.font('ThaiRegular').fontSize(9.5).fillColor('#64748B').text(subtitle, margin, y + 18, {
        width: contentWidth,
      });
      return y + 42;
    };

    let currentY = drawHeader();
    currentY = drawSummaryCards(currentY);

    const statusBreakdown = sales.ordersByStatus.map((item) => ({
      label: getStatusLabel(item.status),
      value: item.count.toLocaleString('th-TH'),
    }));
    const paymentBreakdown = sales.ordersByPaymentMethod.map((item) => ({
      label: getPaymentMethodLabel(item.paymentMethod),
      value: item.count.toLocaleString('th-TH'),
    }));

    const breakdownTitleY = drawSectionTitle(
      'ภาพรวมประจำวัน',
      'สรุปสถานะคำสั่งซื้อและช่องทางชำระเงินของวันที่เลือก',
      currentY,
    );
    const breakdownGap = 16;
    const breakdownWidth = (contentWidth - breakdownGap) / 2;
    const leftCardHeight = drawBreakdownCard(
      margin,
      breakdownTitleY,
      breakdownWidth,
      'สถานะคำสั่งซื้อ',
      '#2563EB',
      statusBreakdown,
    );
    const rightCardHeight = drawBreakdownCard(
      margin + breakdownWidth + breakdownGap,
      breakdownTitleY,
      breakdownWidth,
      'ช่องทางชำระเงิน',
      '#7C3AED',
      paymentBreakdown,
    );

    currentY = breakdownTitleY + Math.max(leftCardHeight, rightCardHeight) + 18;
    currentY = drawSectionTitle(
      'รายการคำสั่งซื้อ',
      `${sales.items.length.toLocaleString('th-TH')} รายการ`,
      currentY,
    );
    currentY = drawTableHeader(currentY);

    if (sales.items.length === 0) {
      doc.save();
      doc.roundedRect(margin, currentY, contentWidth, 60, 14).fill('#F8FAFC');
      doc.restore();
      doc.font('ThaiRegular').fontSize(10).fillColor('#64748B').text(
        'ไม่มีคำสั่งซื้อในวันที่เลือก',
        margin,
        currentY + 22,
        {
          width: contentWidth,
          align: 'center',
        },
      );
    } else {
      const redrawTableHeaderForNewPage = () => {
        currentY = margin;
        currentY = drawSectionTitle(
          'รายการคำสั่งซื้อ',
          `ต่อเนื่องจากรายงานวันที่ ${formatReportDate(sales.date)}`,
          currentY,
        );
        currentY = drawTableHeader(currentY);
      };

      sales.items.forEach((item, index) => {
        doc.font('ThaiRegular').fontSize(9.5);
        const rowHeight = Math.max(
          ...tableColumns.map((column) =>
            doc.heightOfString(column.value(item), {
              width: column.width - tableCellPaddingX * 2,
              align: column.align,
            }),
          ),
        ) + tableCellPaddingY * 2;

        if (currentY + rowHeight > bottomLimit()) {
          doc.addPage();
          redrawTableHeaderForNewPage();
        }

        doc.save();
        doc.roundedRect(margin, currentY, contentWidth, rowHeight, 10).fill(
          index % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
        );
        doc.restore();

        let x = margin;
        for (const column of tableColumns) {
          doc.font('ThaiRegular').fontSize(9.5).fillColor('#0F172A').text(
            column.value(item),
            x + tableCellPaddingX,
            currentY + tableCellPaddingY,
            {
              width: column.width - tableCellPaddingX * 2,
              align: column.align,
            },
          );
          x += column.width;
        }

        doc.save();
        doc.moveTo(margin, currentY + rowHeight).lineTo(margin + contentWidth, currentY + rowHeight).stroke('#E2E8F0');
        doc.restore();

        currentY += rowHeight + 6;
      });
    }

    const pageRange = doc.bufferedPageRange();
    for (let index = 0; index < pageRange.count; index += 1) {
      doc.switchToPage(index);
      doc.font('ThaiRegular').fontSize(8.5).fillColor('#64748B').text(
        `PC Hub • หน้า ${index + 1} / ${pageRange.count}`,
        margin,
        doc.page.height - 26,
        {
          width: contentWidth,
          align: 'right',
        },
      );
    }

    doc.end();
  });
}
