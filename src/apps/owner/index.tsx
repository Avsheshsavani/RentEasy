import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OwnerDashboard } from './Dashboard';
import { PropertiesPage } from './Properties';
import { RoomsPage } from './Rooms';
import { TenantsPage } from './Tenants';
import { ElectricityPage } from './Electricity';
import { BillingPage } from './Billing';
import { PaymentsPage } from './Payments';
import { LayoutDashboard, Building2, Users, FileText, IndianRupee } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/owner', icon: LayoutDashboard },
  { label: 'Properties', href: '/owner/properties', icon: Building2 },
  { label: 'Tenants', href: '/owner/tenants', icon: Users },
  { label: 'Bills', href: '/owner/billing', icon: FileText },
  { label: 'Payments', href: '/owner/payments', icon: IndianRupee },
];

export function OwnerApp() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout title="Dashboard" navItems={navItems}>
            <OwnerDashboard />
          </AppLayout>
        }
      />
      <Route
        path="/properties"
        element={
          <AppLayout title="Properties" subtitle="Manage your properties" navItems={navItems}>
            <PropertiesPage />
          </AppLayout>
        }
      />
      <Route
        path="/properties/:propertyId/rooms"
        element={
          <AppLayout title="Rooms" navItems={navItems}>
            <RoomsPage />
          </AppLayout>
        }
      />
      <Route
        path="/tenants"
        element={
          <AppLayout title="Tenants" subtitle="Manage tenants" navItems={navItems}>
            <TenantsPage />
          </AppLayout>
        }
      />
      <Route
        path="/electricity"
        element={
          <AppLayout title="Electricity" subtitle="Enter meter readings" navItems={navItems}>
            <ElectricityPage />
          </AppLayout>
        }
      />
      <Route
        path="/billing"
        element={
          <AppLayout title="Bills" subtitle="Monthly billing" navItems={navItems}>
            <BillingPage />
          </AppLayout>
        }
      />
      <Route
        path="/payments"
        element={
          <AppLayout title="Payments" subtitle="Confirm payments" navItems={navItems}>
            <PaymentsPage />
          </AppLayout>
        }
      />
      <Route path="*" element={<Navigate to="/owner" replace />} />
    </Routes>
  );
}
