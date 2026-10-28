export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  organizationId?: string | null;
}

export interface LoginResponse {
  token: string;
  user: User;
  message: string;
}