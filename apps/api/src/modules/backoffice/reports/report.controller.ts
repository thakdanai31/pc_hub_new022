import type { Request, Response } from 'express';
import { sendSuccess } from '../../../common/response.js';
import { dailySalesQuerySchema } from './report.schema.js';
import * as reportService from './report.service.js';
import { logActionBestEffort } from '../../audit/audit.service.js';
import { getAuthUser } from '../../../middleware/auth.js';

export async function getDailySales(req: Request, res: Response) {
  const { date } = dailySalesQuerySchema.parse(req.query);
  const result = await reportService.getDailySales(date);
  sendSuccess({ res, message: 'Daily sales retrieved', data: result });
}

export async function exportDailySalesExcel(req: Request, res: Response) {
  const { date } = dailySalesQuerySchema.parse(req.query);
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  const buffer = await reportService.generateDailySalesExcel(date);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="daily-sales-${dateStr}.xlsx"`,
  );
  res.send(buffer);

  void logActionBestEffort({
    actorUserId: getAuthUser(req).userId,
    action: 'REPORT_EXPORT_EXCEL',
    entityType: 'Report',
    entityId: null,
    metadata: { date: dateStr },
  });
}

export async function exportDailySalesPdf(req: Request, res: Response) {
  const { date } = dailySalesQuerySchema.parse(req.query);
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  const buffer = await reportService.generateDailySalesPdf(date);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="daily-sales-${dateStr}.pdf"`,
  );
  res.send(buffer);

  void logActionBestEffort({
    actorUserId: getAuthUser(req).userId,
    action: 'REPORT_EXPORT_PDF',
    entityType: 'Report',
    entityId: null,
    metadata: { date: dateStr },
  });
}
