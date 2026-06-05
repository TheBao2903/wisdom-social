import React, { createContext, useContext, useState, useEffect } from "react";
import { getUser, getToken, clearStorage, saveUser } from "@/utils/storage";
import {
  loginWithPhone,
  logoutApi,
  getCurrentUser,
} from "@/services/authService";
import type { ApiAuthUser } from "@/services/authService";

interface AuthContextType {
  user: ApiAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    phone: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (userData: ApiAuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<ApiAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (token) {
        const userData = await getUser<ApiAuthUser>();
        setUser(userData);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, password: string) => {
    try {
      const result = await loginWithPhone({ phone, password });
      if (result.success && result.user) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const userData = await getUser<ApiAuthUser>();
        setUser(userData);
      }
      return result;
    } catch (error) {
      return { success: false, message: "Đăng nhập thất bại" };
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
      setUser(null);
    } catch (error) {
      setUser(null);
    }
  };

  const updateUser = async (userData: ApiAuthUser) => {
    setUser(userData);
    await saveUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuth,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
