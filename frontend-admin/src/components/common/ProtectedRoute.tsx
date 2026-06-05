import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    // Chưa đăng nhập hoặc tài khoản không thuộc nhóm ADMIN -> không cho vào trang quản trị.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
