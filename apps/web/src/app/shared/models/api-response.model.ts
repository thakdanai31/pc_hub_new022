export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
}
