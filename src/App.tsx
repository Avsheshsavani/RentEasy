import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/components/auth/LoginPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SuperAdminApp } from '@/apps/super-admin';
import { OwnerApp } from '@/apps/owner';
import { TenantApp } from '@/apps/tenant';
import { PageLoader } from '@/components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { initialize, isInitialized, isLoading, user, role } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized || isLoading) {
    return <PageLoader />;
  }

  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (role) {
      case 'super_admin':
        return '/admin';
      case 'owner':
        return '/owner';
      case 'tenant':
        return '/tenant';
      default:
        return '/login';
    }
  };

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getDefaultRoute()} replace /> : <LoginPage />} />
      
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminApp />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/owner/*"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <OwnerApp />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/tenant/*"
        element={
          <ProtectedRoute allowedRoles={['tenant']}>
            <TenantApp />
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#fff',
              borderRadius: '12px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
