export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  isActive: boolean;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
  };
}

export interface MeResponse {
  success: boolean;
  data: User;
}
