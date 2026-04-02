export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'CUSTOMER';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}
