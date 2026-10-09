export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  title?: string;
  organization?: string;
  provider: 'email' | 'github' | 'google' | 'guest';
  createdAt: number;
  lastLoginAt: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  rememberMe?: boolean;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password?: string;
  rememberMe?: boolean;
}
