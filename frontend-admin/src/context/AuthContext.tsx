import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import authService from '../services/authService';
import type { User } from '../types/models';
import { clearAuthStorage, getCookie } from '../utils/cookies';
import { setAuditActor } from '../services/auditLogService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  refreshMe: () => Promise<User | null>;
}

export function hasAdminRole(user: User | null): boolean {
  return !!user?.roles?.includes('ADMIN');
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Đồng bộ chủ thể thực hiện cho nhật ký hoạt động
  useEffect(() => {
    if (user) setAuditActor({ id: user.id, name: user.name || user.username || user.phone || 'Admin' });
    else setAuditActor(null);
  }, [user]);

  const refreshMe = async (): Promise<User | null> => {
    const token = getCookie('accessToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    const me = await authService.getMe();
    setUser(me);
    setLoading(false);
    return me;
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = (u: User) => setUser(u);

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      clearAuthStorage();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin: hasAdminRole(user), login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
