import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BoClaimDetailPage } from './claim-detail';

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

describe('BoClaimDetailPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoClaimDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'claimId' ? '12' : null),
              },
            },
          },
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads and renders claim details', () => {
    const fixture = TestBed.createComponent(BoClaimDetailPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/claims/12') && r.method === 'GET',
    );
    req.flush({ success: true, message: 'OK', data: MOCK_CLAIM });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Claim');
    expect(el.textContent).toContain('GPU fan rattles after one week of use.');
    expect(el.textContent).toContain('RTX 5070');
  });

  it('updates claim status through the dedicated status endpoint', () => {
    const fixture = TestBed.createComponent(BoClaimDetailPage);
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/claims/12') && r.method === 'GET',
    );
    loadReq.flush({ success: true, message: 'OK', data: MOCK_CLAIM });

    fixture.componentInstance['statusDraft'] = 'IN_REVIEW';
    fixture.componentInstance['onUpdateStatus']();

    const statusReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/claims/12/status') &&
        r.method === 'PATCH',
    );
    expect(statusReq.request.body).toEqual({ status: 'IN_REVIEW' });
    statusReq.flush({
      success: true,
      message: 'OK',
      data: { ...MOCK_CLAIM, status: 'IN_REVIEW', updatedAt: '2026-03-20T00:00:00.000Z' },
    });
  });

  it('updates admin note through the dedicated admin-note endpoint', () => {
    const fixture = TestBed.createComponent(BoClaimDetailPage);
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/claims/12') && r.method === 'GET',
    );
    loadReq.flush({ success: true, message: 'OK', data: MOCK_CLAIM });

    fixture.componentInstance['adminNoteDraft'] = 'Checked serial and prepared RMA.';
    fixture.componentInstance['onUpdateAdminNote']();

    const noteReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/claims/12/admin-note') &&
        r.method === 'PATCH',
    );
    expect(noteReq.request.body).toEqual({
      adminNote: 'Checked serial and prepared RMA.',
    });
    noteReq.flush({
      success: true,
      message: 'OK',
      data: {
        ...MOCK_CLAIM,
        adminNote: 'Checked serial and prepared RMA.',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    });
  });
});
