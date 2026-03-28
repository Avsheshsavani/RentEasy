import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SuperAdminDashboard } from './Dashboard';
import { OwnersPage } from './Owners';
import { AllPropertiesPage } from './AllProperties';
import { SettingsPage } from './Settings';
import { LayoutDashboard, Users, Building2, Settings } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Owners', href: '/admin/owners', icon: Users },
  { label: 'Properties', href: '/admin/properties', icon: Building2 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export function SuperAdminApp() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout title="Dashboard" subtitle="Super Admin" navItems={navItems}>
            <SuperAdminDashboard />
          </AppLayout>
        }
      />
      <Route
        path="/owners"
        element={
          <AppLayout title="Owners" subtitle="Manage property owners" navItems={navItems}>
            <OwnersPage />
          </AppLayout>
        }
      />
      <Route
        path="/properties"
        element={
          <AppLayout title="All Properties" subtitle="View all properties" navItems={navItems}>
            <AllPropertiesPage />
          </AppLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <AppLayout title="Settings" subtitle="Account settings" navItems={navItems}>
            <SettingsPage />
          </AppLayout>
        }
      />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
