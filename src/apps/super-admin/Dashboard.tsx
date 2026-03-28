import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, Badge, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Users, Building2, DoorOpen, TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardStats {
  totalOwners: number;
  activeOwners: number;
  totalProperties: number;
  totalRooms: number;
  occupiedRooms: number;
  totalTenants: number;
  totalRevenue: number;
  pendingPayments: number;
}

export function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [
        { count: totalOwners },
        { count: activeOwners },
        { count: totalProperties },
        { count: totalRooms },
        { count: occupiedRooms },
        { count: totalTenants },
        { data: payments },
      ] = await Promise.all([
        supabase.from('owners').select('*', { count: 'exact', head: true }),
        supabase.from('owners').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('is_occupied', true),
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('amount, status'),
      ]);

      const totalRevenue = payments?.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const pendingPayments = payments?.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalOwners: totalOwners || 0,
        activeOwners: activeOwners || 0,
        totalProperties: totalProperties || 0,
        totalRooms: totalRooms || 0,
        occupiedRooms: occupiedRooms || 0,
        totalTenants: totalTenants || 0,
        totalRevenue,
        pendingPayments,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  const statCards = [
    {
      label: 'Total Owners',
      value: stats?.totalOwners || 0,
      subValue: `${stats?.activeOwners || 0} active`,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: 'Properties',
      value: stats?.totalProperties || 0,
      icon: Building2,
      color: 'bg-purple-500',
    },
    {
      label: 'Total Rooms',
      value: stats?.totalRooms || 0,
      subValue: `${stats?.occupiedRooms || 0} occupied`,
      icon: DoorOpen,
      color: 'bg-green-500',
    },
    {
      label: 'Total Tenants',
      value: stats?.totalTenants || 0,
      icon: Users,
      color: 'bg-orange-500',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      label: 'Pending Payments',
      value: formatCurrency(stats?.pendingPayments || 0),
      icon: TrendingDown,
      color: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                {stat.subValue && (
                  <p className="text-xs text-gray-400 mt-0.5">{stat.subValue}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Overview</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Occupancy Rate</span>
            <Badge variant="success">
              {stats?.totalRooms ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0}%
            </Badge>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Avg. Rooms per Property</span>
            <span className="text-sm font-medium">
              {stats?.totalProperties ? (stats.totalRooms / stats.totalProperties).toFixed(1) : 0}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-600">Avg. Tenants per Owner</span>
            <span className="text-sm font-medium">
              {stats?.totalOwners ? (stats.totalTenants / stats.totalOwners).toFixed(1) : 0}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
