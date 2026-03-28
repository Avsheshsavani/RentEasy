import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth, getCurrentMonth } from '@/lib/utils';
import { Building2, DoorOpen, Users, IndianRupee, AlertCircle, ChevronRight, Clock } from 'lucide-react';
import type { Owner } from '@/types/database';

interface DashboardData {
  totalProperties: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  totalTenants: number;
  currentMonthCollection: number;
  currentMonthDue: number;
  pendingPayments: number;
  overdueCount: number;
}

export function OwnerDashboard() {
  const { profile } = useAuthStore();
  const owner = profile as Owner;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (owner?.id) {
      fetchDashboardData();
    }
  }, [owner?.id]);

  const fetchDashboardData = async () => {
    try {
      const currentMonth = getCurrentMonth();

      const [
        { count: totalProperties },
        { data: rooms },
        { count: totalTenants },
        { data: bills },
        { count: pendingPayments },
      ] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('owner_id', owner.id),
        supabase.from('rooms').select('id, is_occupied, is_active, property_id, properties!inner(owner_id)').eq('properties.owner_id', owner.id),
        supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('owner_id', owner.id).eq('is_active', true),
        supabase.from('bills').select('total_amount, amount_paid, balance_due, status, due_date, bill_month, lease_id, leases!inner(room_id, rooms!inner(property_id, properties!inner(owner_id)))').eq('leases.rooms.properties.owner_id', owner.id).eq('bill_month', currentMonth),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const totalRooms = rooms?.length || 0;
      const occupiedRooms = rooms?.filter(r => r.is_occupied)?.length || 0;
      const vacantRooms = rooms?.filter(r => !r.is_occupied && r.is_active)?.length || 0;

      const currentMonthCollection = bills?.reduce((sum, b) => sum + Number(b.amount_paid), 0) || 0;
      const currentMonthDue = bills?.reduce((sum, b) => sum + Number(b.balance_due), 0) || 0;
      const overdueCount = bills?.filter(b => b.status !== 'paid' && new Date(b.due_date) < new Date())?.length || 0;

      setData({
        totalProperties: totalProperties || 0,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        totalTenants: totalTenants || 0,
        currentMonthCollection,
        currentMonthDue,
        pendingPayments: pendingPayments || 0,
        overdueCount,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data?.totalProperties}</p>
              <p className="text-xs text-gray-500">Properties</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DoorOpen className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data?.occupiedRooms}/{data?.totalRooms}
              </p>
              <p className="text-xs text-gray-500">Occupied Rooms</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data?.totalTenants}</p>
              <p className="text-xs text-gray-500">Active Tenants</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data?.pendingPayments}</p>
              <p className="text-xs text-gray-500">Pending Payments</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Current Month Collection */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{formatMonth(getCurrentMonth())} Collection</h3>
          {data?.overdueCount && data.overdueCount > 0 && (
            <Badge variant="danger">
              <AlertCircle className="h-3 w-3 mr-1" />
              {data.overdueCount} overdue
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Collected</p>
            <p className="text-xl font-bold text-success-600">
              {formatCurrency(data?.currentMonthCollection || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Pending</p>
            <p className="text-xl font-bold text-danger-600">
              {formatCurrency(data?.currentMonthDue || 0)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-success-500 rounded-full transition-all"
              style={{
                width: `${
                  data?.currentMonthCollection && (data.currentMonthCollection + data.currentMonthDue) > 0
                    ? (data.currentMonthCollection / (data.currentMonthCollection + data.currentMonthDue)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card padding="none">
        <Link
          to="/owner/properties"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-900">Manage Properties</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        <div className="border-t border-gray-100" />
        <Link
          to="/owner/tenants"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-900">Manage Tenants</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        <div className="border-t border-gray-100" />
        <Link
          to="/owner/payments"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <IndianRupee className="h-5 w-5 text-gray-400" />
            <div>
              <span className="font-medium text-gray-900">Confirm Payments</span>
              {data?.pendingPayments && data.pendingPayments > 0 && (
                <Badge variant="warning" className="ml-2">{data.pendingPayments}</Badge>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
      </Card>
    </div>
  );
}
