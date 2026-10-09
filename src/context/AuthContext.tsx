import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, SignupCredentials } from '../types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  loginWithOAuth: (provider: 'github' | 'google') => Promise<void>;
  loginAsGuest: () => void;
  quickLoginAsPersona: (persona: 'alex' | 'elena' | 'marcus') => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

const AUTH_STORAGE_KEY = 'blueprint_auth_user_v2';
const AUTH_SAVED_ACCOUNTS_KEY = 'blueprint_auth_accounts_v2';

export const DEMO_USERS: Record<'alex' | 'elena' | 'marcus', User> = {
  alex: {
    id: 'user_alex_01',
    name: 'Alex Rivera',
    email: 'alex.rivera@blueprint.dev',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    role: 'Principal Architect',
    title: 'Principal Systems Architect',
    organization: 'HyperScale Labs',
    provider: 'email',
    createdAt: 1704067200000,
    lastLoginAt: Date.now()
  },
  elena: {
    id: 'user_elena_02',
    name: 'Elena Rostova',
    email: 'elena@arch.studio',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=160&q=80',
    role: 'Staff Architect',
    title: 'Staff Software Engineer',
    organization: 'FinTech Core Systems',
    provider: 'github',
    createdAt: 1706745600000,
    lastLoginAt: Date.now()
  },
  marcus: {
    id: 'user_marcus_03',
    name: 'Marcus Vance',
    email: 'marcus@cloudscale.io',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    role: 'Platform Tech Lead',
    title: 'Distributed Systems Architect',
    organization: 'Aether Systems',
    provider: 'google',
    createdAt: 1709251200000,
    lastLoginAt: Date.now()
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readSavedUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return parsed as User;
    }
  } catch (e) {
    console.warn('Failed to parse saved auth session:', e);
  }
  return null;
}

function persistUser(user: User | null, rememberMe: boolean = true) {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    const serialized = JSON.stringify(user);
    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    // Also update saved accounts list for quick switching
    const savedListRaw = localStorage.getItem(AUTH_SAVED_ACCOUNTS_KEY);
    const existingList: User[] = savedListRaw ? JSON.parse(savedListRaw) : [];
    const filtered = existingList.filter(u => u.id !== user.id && u.email !== user.email);
    localStorage.setItem(AUTH_SAVED_ACCOUNTS_KEY, JSON.stringify([user, ...filtered].slice(0, 5)));
  } catch (e) {
    console.warn('Could not persist auth session:', e);
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(readSavedUser);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync state if storage changes elsewhere
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        setUser(readSavedUser());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async ({ email, rememberMe = true }: LoginCredentials) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 350));

    // Check if it's one of the demo users by email
    const trimmedEmail = email.trim().toLowerCase();
    const demoKey = Object.keys(DEMO_USERS).find(
      k => DEMO_USERS[k as keyof typeof DEMO_USERS].email.toLowerCase() === trimmedEmail
    ) as keyof typeof DEMO_USERS | undefined;

    let targetUser: User;

    if (demoKey) {
      targetUser = {
        ...DEMO_USERS[demoKey],
        lastLoginAt: Date.now()
      };
    } else {
      // Derive a nice readable name from the email (e.g. abel.smith@test.com -> Abel Smith)
      const namePart = trimmedEmail.split('@')[0] || 'Architect';
      const formattedName = namePart
        .split(/[._-]/)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

      targetUser = {
        id: 'usr_' + Date.now().toString(36),
        name: formattedName || 'System Architect',
        email: trimmedEmail,
        role: 'Software Architect',
        title: 'Lead Software Architect',
        organization: 'Independent Workspace',
        provider: 'email',
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      };
    }

    setUser(targetUser);
    persistUser(targetUser, rememberMe);
    setIsLoading(false);
  };

  const signup = async ({ name, email, rememberMe = true }: SignupCredentials) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    const newUser: User = {
      id: 'usr_' + Date.now().toString(36),
      name: name.trim() || 'New Architect',
      email: email.trim().toLowerCase(),
      role: 'System Architect',
      title: 'Principal Software Architect',
      organization: 'Personal Studio',
      provider: 'email',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    setUser(newUser);
    persistUser(newUser, rememberMe);
    setIsLoading(false);
  };

  const loginWithOAuth = async (provider: 'github' | 'google') => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 450));

    const isGithub = provider === 'github';
    const oauthUser: User = {
      id: `usr_${provider}_` + Date.now().toString(36),
      name: isGithub ? 'GitHub Developer' : 'Google Cloud Architect',
      email: isGithub ? 'developer@github.user' : 'architect@cloud.google',
      avatarUrl: isGithub
        ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=160&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
      role: isGithub ? 'Staff Systems Engineer' : 'Enterprise Architect',
      title: isGithub ? 'Open Source Contributor' : 'Cloud Solutions Architect',
      organization: isGithub ? 'GitHub Organization' : 'Google Workspace',
      provider,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    setUser(oauthUser);
    persistUser(oauthUser, true);
    setIsLoading(false);
  };

  const loginAsGuest = () => {
    const guestUser: User = {
      id: 'usr_guest_session',
      name: 'Guest Architect',
      email: 'guest@blueprint.local',
      role: 'Guest Architect',
      title: 'Local Sandbox Mode',
      organization: 'Local Device',
      provider: 'guest',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    setUser(guestUser);
    persistUser(guestUser, false);
  };

  const quickLoginAsPersona = async (persona: 'alex' | 'elena' | 'marcus') => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    const personaUser = {
      ...DEMO_USERS[persona],
      lastLoginAt: Date.now()
    };
    setUser(personaUser);
    persistUser(personaUser, true);
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    persistUser(null);
  };

  const updateProfile = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      persistUser(updated, true);
      return updated;
    });
  };

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        signup,
        loginWithOAuth,
        loginAsGuest,
        quickLoginAsPersona,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
