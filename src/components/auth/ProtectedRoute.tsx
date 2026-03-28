import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui';
import type { UserRole } from '@/types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading, isInitialized } = useAuthStore();

  if (!isInitialized || isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const redirectPath = role === 'super_admin' ? '/admin' : role === 'owner' ? '/owner' : '/tenant';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
