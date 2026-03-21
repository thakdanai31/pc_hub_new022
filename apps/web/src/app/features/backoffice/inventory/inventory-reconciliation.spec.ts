import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BoInventoryReconciliationPage } from './inventory-reconciliation';

const MOCK_ROW = {
  orderId: 501,
  orderNumber: 'ORD-20260319-0001',
  status: 'CANCELLED' as const,
  paymentMethod: 'COD' as const,
  createdAt: '2026-03-10T00:00:00.000Z',
  reconciliationState: 'COMMITTED_CANCELLED' as const,
  commitEvidence: ['Order entered PROCESSING before cancellation'],
  expectedSaleQuantity: 2,
  actualSaleQuantity: 0,
  expectedReturnQuantity: 2,
  actualReturnQuantity: 0,
  expectedNetMovement: 0,
  actualNetMovement: 0,
  netMovementGap: 0,
  issues: [
    {
      code: 'MISSING_SALE_HISTORY' as const,
      message: 'Missing SALE inventory history.',
      autoFixable: true,
    },
    {
      code: 'MISSING_RETURN_HISTORY' as const,
      message: 'Missing RETURN_IN inventory history.',
      autoFixable: true,
    },
  ],
  suggestedActions: [
    'BACKFILL_SALE_HISTORY' as const,
    'BACKFILL_RETURN_HISTORY' as const,
  ],
  autoFixable: true,
  manualReviewRequired: false,
  stockReviewRecommended: false,
};

function flushReport(
  httpTesting: HttpTestingController,
  rows = [MOCK_ROW],
) {
  const req = httpTesting.expectOne(
    (r) =>
      r.url.includes('/backoffice/inventory/reconciliation') &&
      r.method === 'GET',
  );
  req.flush({
    success: true,
    message: 'OK',
    data: {
      rows,
      pagination: { page: 1, limit: 20, total: rows.length, totalPages: rows.length ? 1 : 0 },
      summary: {
        scannedOrders: 10,
        ordersWithIssues: rows.length,
        autoFixableOrders: rows.filter((row) => row.autoFixable).length,
        manualReviewOrders: rows.filter((row) => row.manualReviewRequired).length,
        issueCounts: {
          MISSING_SALE_HISTORY: rows.length,
        },
      },
    },
  });
}

describe('BoInventoryReconciliationPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoInventoryReconciliationPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads and renders reconciliation findings', () => {
    const fixture = TestBed.createComponent(BoInventoryReconciliationPage);
    fixture.detectChanges();

    flushReport(httpTesting);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Inventory Reconciliation');
    expect(el.textContent).toContain('ORD-20260319-0001');
    expect(el.textContent).toContain('Missing SALE inventory history.');
    expect(el.textContent).toContain('Auto-Fixable');
  });

  it('sends supported filters and posts a dry-run backfill for the selected orders', () => {
    const fixture = TestBed.createComponent(BoInventoryReconciliationPage);
    fixture.detectChanges();

    flushReport(httpTesting, []);

    fixture.componentInstance['orderIdFilter'] = 501 as never;
    fixture.componentInstance['statusFilter'] = 'CANCELLED';
    fixture.componentInstance['dateFrom'] = '2026-03-01';
    fixture.componentInstance['dateTo'] = '2026-03-19';

    expect(() => fixture.componentInstance['onFilterChange']()).not.toThrow();

    const filteredReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/reconciliation') &&
        r.method === 'GET' &&
        r.params.get('orderId') === '501' &&
        r.params.get('status') === 'CANCELLED' &&
        r.params.get('dateFrom') === '2026-03-01' &&
        r.params.get('dateTo') === '2026-03-19',
    );
    filteredReq.flush({
      success: true,
      message: 'OK',
      data: {
        rows: [MOCK_ROW],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        summary: {
          scannedOrders: 1,
          ordersWithIssues: 1,
          autoFixableOrders: 1,
          manualReviewOrders: 0,
          issueCounts: {
            MISSING_SALE_HISTORY: 1,
            MISSING_RETURN_HISTORY: 1,
          },
        },
      },
    });

    fixture.componentInstance['toggleSelection'](501, true);
    fixture.componentInstance['runDryRun']();

    const dryRunReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/reconciliation/backfill') &&
        r.method === 'POST',
    );
    expect(dryRunReq.request.body).toEqual({
      orderIds: [501],
      dryRun: true,
    });
    dryRunReq.flush({
      success: true,
      message: 'OK',
      data: {
        dryRun: true,
        results: [
          {
            orderId: 501,
            orderNumber: 'ORD-20260319-0001',
            status: 'planned',
            plannedActions: ['BACKFILL_SALE_HISTORY', 'BACKFILL_RETURN_HISTORY'],
            appliedActions: [],
            issues: MOCK_ROW.issues,
            manualReviewRequired: false,
          },
        ],
        summary: {
          requestedOrders: 1,
          plannedOrders: 1,
          appliedOrders: 0,
          skippedOrders: 0,
          failedOrders: 0,
        },
      },
    });

    expect(fixture.componentInstance['canApplyReviewed']()).toBe(true);
  });

  it('applies a reviewed backfill and refreshes the report', () => {
    const fixture = TestBed.createComponent(BoInventoryReconciliationPage);
    fixture.detectChanges();

    flushReport(httpTesting);

    fixture.componentInstance['toggleSelection'](501, true);
    fixture.componentInstance['runDryRun']();

    const dryRunReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/reconciliation/backfill') &&
        r.method === 'POST',
    );
    dryRunReq.flush({
      success: true,
      message: 'OK',
      data: {
        dryRun: true,
        results: [
          {
            orderId: 501,
            orderNumber: 'ORD-20260319-0001',
            status: 'planned',
            plannedActions: ['BACKFILL_SALE_HISTORY', 'BACKFILL_RETURN_HISTORY'],
            appliedActions: [],
            issues: MOCK_ROW.issues,
            manualReviewRequired: false,
          },
        ],
        summary: {
          requestedOrders: 1,
          plannedOrders: 1,
          appliedOrders: 0,
          skippedOrders: 0,
          failedOrders: 0,
        },
      },
    });

    expect(fixture.componentInstance['canApplyReviewed']()).toBe(true);

    fixture.componentInstance['onApplyConfirmed']();

    const applyReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/reconciliation/backfill') &&
        r.method === 'POST',
    );
    expect(applyReq.request.body).toEqual({
      orderIds: [501],
      dryRun: false,
    });
    applyReq.flush({
      success: true,
      message: 'OK',
      data: {
        dryRun: false,
        results: [
          {
            orderId: 501,
            orderNumber: 'ORD-20260319-0001',
            status: 'applied',
            plannedActions: [],
            appliedActions: ['BACKFILL_SALE_HISTORY', 'BACKFILL_RETURN_HISTORY'],
            issues: [],
            manualReviewRequired: false,
          },
        ],
        summary: {
          requestedOrders: 1,
          plannedOrders: 0,
          appliedOrders: 1,
          skippedOrders: 0,
          failedOrders: 0,
        },
      },
    });

    flushReport(httpTesting, []);

    expect(fixture.componentInstance['selectedOrderIds']()).toEqual([]);
    expect(fixture.componentInstance['canApplyReviewed']()).toBe(false);
  });
});
