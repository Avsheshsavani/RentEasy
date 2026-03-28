import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TenantDashboard } from './Dashboard';
import { PayBillPage } from './PayBill';
import { BillHistoryPage } from './BillHistory';
import { MeterReadingsPage } from './MeterReadings';
import { ProfilePage } from './Profile';
import { LayoutDashboard, IndianRupee, FileText, Zap, User } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/tenant', icon: LayoutDashboard },
  { label: 'Pay', href: '/tenant/pay', icon: IndianRupee },
  { label: 'History', href: '/tenant/history', icon: FileText },
  { label: 'Readings', href: '/tenant/readings', icon: Zap },
  { label: 'Profile', href: '/tenant/profile', icon: User },
];

export function TenantApp() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout title="Home" navItems={navItems}>
            <TenantDashboard />
          </AppLayout>
        }
      />
      <Route
        path="/pay"
        element={
          <AppLayout title="Pay Bill" navItems={navItems}>
            <PayBillPage />
          </AppLayout>
        }
      />
      <Route
        path="/history"
        element={
          <AppLayout title="Bill History" navItems={navItems}>
            <BillHistoryPage />
          </AppLayout>
        }
      />
      <Route
        path="/readings"
        element={
          <AppLayout title="Meter Readings" navItems={navItems}>
            <MeterReadingsPage />
          </AppLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <AppLayout title="Profile" navItems={navItems}>
            <ProfilePage />
          </AppLayout>
        }
      />
      <Route path="*" element={<Navigate to="/tenant" replace />} />
    </Routes>
  );
}
