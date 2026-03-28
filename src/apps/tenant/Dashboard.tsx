import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth, formatDate } from '@/lib/utils';
import { FileText, IndianRupee, DoorOpen, Calendar, ChevronRight, AlertCircle, Building2 } from 'lucide-react';
import type { Tenant, TenantBill, Lease } from '@/types/database';

type LeaseWithRoom = Lease & {
  rooms: {
    room_number: string;
    monthly_rent: number;
    properties: { name: string; address: string } | null;
  } | null;
};

export function TenantDashboard() {
  const { profile } = useAuthStore();
  const tenant = profile as Tenant;
  const [currentBill, setCurrentBill] = useState<TenantBill | null>(null);
  const [roomInfo, setRoomInfo] = useState<LeaseWithRoom | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      fetchData();
    }
  }, [tenant?.id]);

  const fetchData = async () => {
    try {
      const [{ data: billData }, { data: leaseData }] = await Promise.all([
        supabase.from('v_tenant_current_bill').select('*').eq('tenant_id', tenant.id).maybeSingle(),
        supabase
          .from('leases')
          .select(`
            *,
            rooms(room_number, monthly_rent, properties(name, address))
          `)
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      setCurrentBill(billData);
      setRoomInfo(leaseData as LeaseWithRoom | null);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  const isOverdue = currentBill && new Date(currentBill.due_date) < new Date() && currentBill.status !== 'paid';
  const payBillId =
    currentBill &&
    (currentBill.id || (currentBill as TenantBill & { bill_id?: string }).bill_id);

  return (
    <div className="space-y-6">
      {/* Room Info */}
      {roomInfo && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                Room {roomInfo.rooms?.room_number}
              </h3>
              <p className="text-sm text-gray-500">{roomInfo.rooms?.properties?.name}</p>
              <p className="text-xs text-gray-400">{roomInfo.rooms?.properties?.address}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(roomInfo.monthly_rent_snapshot)}/mo
              </p>
              {roomInfo.advance_balance_months > 0 && (
                <Badge variant="info" className="mt-1">
                  {roomInfo.advance_balance_months} months advance
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Current Bill */}
      {currentBill ? (
        <Card className="overflow-hidden">
          <div className={`p-4 ${isOverdue ? 'bg-danger-50' : 'bg-primary-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                {formatMonth(currentBill.bill_month)} Bill
              </span>
              <Badge status={currentBill.status}>{currentBill.status}</Badge>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(currentBill.balance_due)}
                </p>
                <p className="text-sm text-gray-500">Balance Due</p>
              </div>
              {isOverdue && (
                <Badge variant="danger">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rent</span>
              <span className="font-medium">{formatCurrency(currentBill.rent_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Electricity
                {currentBill.units_consumed != null
                  ? ` (${Number(currentBill.units_consumed).toFixed(1)} units)`
                  : ' (units after owner enters reading)'}
              </span>
              <span className="font-medium">{formatCurrency(currentBill.electricity_amount)}</span>
            </div>
            {currentBill.previous_dues > 0 && (
              <div className="flex justify-between text-sm text-danger-600">
                <span>Previous Dues</span>
                <span className="font-medium">{formatCurrency(currentBill.previous_dues)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Total</span>
                <span className="font-bold text-gray-900">{formatCurrency(currentBill.total_amount)}</span>
              </div>
              {currentBill.amount_paid > 0 && (
                <div className="flex justify-between text-sm text-success-600 mt-1">
                  <span>Paid</span>
                  <span>-{formatCurrency(currentBill.amount_paid)}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Due: {formatDate(currentBill.due_date)}
              </div>
            </div>

            {currentBill.status !== 'paid' && (
              <Link to={payBillId ? `/tenant/pay?billId=${payBillId}` : '/tenant/pay'}>
                <Button className="w-full mt-2">
                  <IndianRupee className="h-4 w-4" />
                  Pay now
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No bill for current month</p>
        </Card>
      )}

      {/* Quick Links */}
      <Card padding="none">
        <Link
          to="/tenant/history"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-900">Bill History</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        <div className="border-t border-gray-100" />
        <Link
          to="/tenant/readings"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <DoorOpen className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-900">Meter readings (units)</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
      </Card>

      {/* Owner Contact */}
      {currentBill?.owner_name && (
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Property Owner</h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{currentBill.owner_name}</p>
              <p className="text-sm text-gray-500">{currentBill.owner_phone}</p>
            </div>
            <a
              href={`tel:${currentBill.owner_phone}`}
              className="p-2 bg-primary-50 rounded-lg text-primary-600 hover:bg-primary-100"
            >
              Call
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
