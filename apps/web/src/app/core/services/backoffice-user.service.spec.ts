import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BackofficeUserService } from './backoffice-user.service';

const MOCK_USER = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phoneNumber: '0812345678',
  role: 'STAFF',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('BackofficeUserService', () => {
  let service: BackofficeUserService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BackofficeUserService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists users with query params', () => {
    service.listUsers({ page: 1, limit: 20, search: 'john', role: 'STAFF' }).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/users')
      && r.params.get('page') === '1'
      && r.params.get('search') === 'john'
      && r.params.get('role') === 'STAFF',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [MOCK_USER], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  });

  it('creates a staff user', () => {
    const body = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phoneNumber: '0898765432', password: 'password123' };
    service.createUser('staff', body).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/users/staff') && r.method === 'POST',
    );
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, data: { ...MOCK_USER, ...body } });
  });

  it('creates an admin user', () => {
    const body = { firstName: 'Admin', lastName: 'User', email: 'admin@example.com', phoneNumber: '0812345678', password: 'password123' };
    service.createUser('admin', body).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/users/admin') && r.method === 'POST',
    );
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, data: { ...MOCK_USER, ...body, role: 'ADMIN' } });
  });

  it('updates a user', () => {
    service.updateUser(1, { firstName: 'Updated' }).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/users/1') && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({ firstName: 'Updated' });
    req.flush({ success: true, data: { ...MOCK_USER, firstName: 'Updated' } });
  });

  it('disables a user', () => {
    service.disableUser(1).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/users/1/disable') && r.method === 'POST',
    );
    req.flush({ success: true, data: { ...MOCK_USER, isActive: false } });
  });
});
