import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BoClaimListPage } from './claim-list';

const MOCK_CLAIM = {
  id: 12,
  userId: 7,
  orderId: 33,
  productId: 44,
  issueDescription: 'GPU fan rattles after one week of use.',
  status: 'PENDING' as const,
  adminNote: null,
  createdAt: '2026-03-19T00:00:00.000Z',
  updatedAt: '2026-03-19T00:00:00.000Z',
  user: {
    id: 7,
    firstName: 'Nina',
    lastName: 'Lee',
    email: 'nina@example.com',
    phoneNumber: '0812345678',
  },
  order: {
    id: 33,
    orderNumber: 'PCH-20260319-ABCD',
    status: 'DELIVERED',
    createdAt: '2026-03-10T00:00:00.000Z',
  },
  product: {
    id: 44,
    name: 'RTX 5070',
    slug: 'rtx-5070',
    sku: 'GPU-5070',
  },
};

describe('BoClaimListPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoClaimListPage],
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

  it('loads and renders claims', () => {
    const fixture = TestBed.createComponent(BoClaimListPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/claims') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [MOCK_CLAIM],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Claims');
    expect(el.textContent).toContain('PCH-20260319-ABCD');
    expect(el.textContent).toContain('RTX 5070');
  });

  it('sends the selected status filter to the API', () => {
    const fixture = TestBed.createComponent(BoClaimListPage);
    fixture.detectChanges();

    const initialReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/claims') && r.method === 'GET',
    );
    initialReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    fixture.componentInstance['onStatusTab']('IN_REVIEW');

    const filteredReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/claims') &&
        r.method === 'GET' &&
        r.params.get('status') === 'IN_REVIEW',
    );
    filteredReq.flush({
      success: true,
      message: 'OK',
      data: [{ ...MOCK_CLAIM, status: 'IN_REVIEW' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});
