import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BoUserListPage } from './user-list';

function mockAuthService() {
  return {
    user: () => ({
      id: 1,
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    }),
    isAuthenticated: () => true,
    getAccessToken: () => 'token',
    logout: () => ({ subscribe: () => { /* noop */ } }),
  };
}

const ACTIVE_CUSTOMER = {
  id: 7,
  firstName: 'Casey',
  lastName: 'Customer',
  email: 'casey@example.com',
  phoneNumber: '0811111111',
  role: 'CUSTOMER' as const,
  isActive: true,
  bannedUntil: null,
  banReason: null,
  bannedAt: null,
  bannedByUserId: null,
  createdAt: '2026-03-20T00:00:00.000Z',
};

describe('BoUserListPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoUserListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService() },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders temporary ban metadata and the new ban actions', () => {
    const fixture = TestBed.createComponent(BoUserListPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/users') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [
        ACTIVE_CUSTOMER,
        {
          ...ACTIVE_CUSTOMER,
          id: 8,
          email: 'disabled@example.com',
          isActive: false,
          bannedUntil: '2026-03-21T10:00:00.000Z',
          banReason: 'Chargeback review',
          bannedAt: '2026-03-20T10:00:00.000Z',
          bannedByUserId: 1,
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ban Permanently');
    expect(el.textContent).toContain('Ban Until...');
    expect(el.textContent).toContain('Temporarily Banned');
    expect(el.textContent).toContain('Chargeback review');
  });

  it('sends the CUSTOMER role filter to the API', () => {
    const fixture = TestBed.createComponent(BoUserListPage);
    fixture.detectChanges();

    httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/users') && r.method === 'GET',
    ).flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    fixture.componentInstance['roleFilter'] = 'CUSTOMER';
    fixture.componentInstance['onFilterChange']();

    const filteredReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/users') &&
        r.method === 'GET' &&
        r.params.get('role') === 'CUSTOMER',
    );
    filteredReq.flush({
      success: true,
      message: 'OK',
      data: [ACTIVE_CUSTOMER],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('submits a permanent ban without bannedUntil', () => {
    const fixture = TestBed.createComponent(BoUserListPage);
    fixture.detectChanges();

    httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/users') && r.method === 'GET',
    ).flush({
      success: true,
      message: 'OK',
      data: [ACTIVE_CUSTOMER],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    fixture.componentInstance['startBan'](ACTIVE_CUSTOMER, 'permanent');
    fixture.componentInstance['banForm'].banReason = 'Fraud investigation';
    fixture.componentInstance['submitBan']();

    const disableReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/users/7/disable') &&
        r.method === 'POST',
    );
    expect(disableReq.request.body).toEqual({
      banReason: 'Fraud investigation',
    });
    disableReq.flush({
      success: true,
      message: 'OK',
      data: {
        ...ACTIVE_CUSTOMER,
        isActive: false,
        bannedUntil: null,
        banReason: 'Fraud investigation',
        bannedAt: '2026-03-20T10:00:00.000Z',
        bannedByUserId: 1,
      },
    });
  });

  it('submits a temporary ban with bannedUntil and can unban afterwards', () => {
    const fixture = TestBed.createComponent(BoUserListPage);
    fixture.detectChanges();
    const temporaryBanLocalValue = '2026-03-21T17:30';
    const temporaryBanIsoValue = new Date(temporaryBanLocalValue).toISOString();

    httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/users') && r.method === 'GET',
    ).flush({
      success: true,
      message: 'OK',
      data: [ACTIVE_CUSTOMER],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    fixture.componentInstance['startBan'](ACTIVE_CUSTOMER, 'temporary');
    fixture.componentInstance['banForm'].bannedUntil = temporaryBanLocalValue;
    fixture.componentInstance['banForm'].banReason = 'Cooling-off review';
    fixture.componentInstance['submitBan']();

    const tempBanReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/users/7/disable') &&
        r.method === 'POST',
    );
    expect(tempBanReq.request.body).toEqual({
      bannedUntil: temporaryBanIsoValue,
      banReason: 'Cooling-off review',
    });
    tempBanReq.flush({
      success: true,
      message: 'OK',
      data: {
        ...ACTIVE_CUSTOMER,
        isActive: false,
        bannedUntil: temporaryBanIsoValue,
        banReason: 'Cooling-off review',
        bannedAt: '2026-03-20T10:00:00.000Z',
        bannedByUserId: 1,
      },
    });
    fixture.detectChanges();

    fixture.componentInstance['confirmUnban'](fixture.componentInstance['users']()[0]);
    fixture.componentInstance['onStatusChangeConfirmed']();

    const enableReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/users/7/enable') &&
        r.method === 'POST',
    );
    enableReq.flush({
      success: true,
      message: 'OK',
      data: ACTIVE_CUSTOMER,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance['users']()[0].isActive).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'User unbanned',
    );
  });
});
