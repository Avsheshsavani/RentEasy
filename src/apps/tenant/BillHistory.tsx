import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth, formatDate } from '@/lib/utils';
import { FileText, Check } from 'lucide-react';
import type { Tenant, Bill } from '@/types/database';

interface BillWithRoom extends Bill {
  room_number: string;
  property_name: string;
  bill_id?: string;
  previous_units?: number | null;
  current_units?: number | null;
  units_consumed?: number | null;
}

export function BillHistoryPage() {
  const { profile } = useAuthStore();
  const tenant = profile as Tenant;
  const [bills, setBills] = useState<BillWithRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      fetchBills();
    }
  }, [tenant?.id]);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('v_tenant_bill_history')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('bill_month', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  if (bills.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="No bill history"
        description="Your bills will appear here"
      />
    );
  }

  const billPk = (b: BillWithRoom) => b.id || b.bill_id || `${b.bill_month}-${b.room_number}`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        To pay an outstanding amount, open <strong>Pay</strong> in the bottom nav, or tap <strong>Pay this bill</strong> on a row below.
      </p>
      {bills.map((bill) => (
        <Card key={billPk(bill)} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">
                  {formatMonth(bill.bill_month)}
                </span>
                <Badge status={bill.status}>{bill.status}</Badge>
                {bill.is_advance_covered && (
                  <Badge variant="info">Advance</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Room {bill.room_number} • {bill.property_name}
              </p>
              
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Rent</span>
                  <span>{formatCurrency(bill.rent_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Electricity</span>
                  <span>{formatCurrency(bill.electricity_amount)}</span>
                </div>
                {bill.units_consumed != null && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Units consumed (owner reading)</span>
                    <span>{Number(bill.units_consumed).toFixed(1)}</span>
                  </div>
                )}
                {bill.previous_dues > 0 && (
                  <div className="flex justify-between text-danger-600">
                    <span>Previous Dues</span>
                    <span>{formatCurrency(bill.previous_dues)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right shrink-0 flex flex-col items-end gap-2">
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(bill.total_amount)}
                </p>
                {bill.status === 'paid' && bill.paid_at && (
                  <div className="flex items-center gap-1 text-xs text-success-600 mt-1 justify-end">
                    <Check className="h-3 w-3" />
                    Paid {formatDate(bill.paid_at, 'dd MMM')}
                  </div>
                )}
                {bill.balance_due > 0 && bill.status !== 'paid' && (
                  <p className="text-sm text-danger-600 mt-1">
                    Due: {formatCurrency(bill.balance_due)}
                  </p>
                )}
              </div>
              {bill.balance_due > 0 && bill.status !== 'paid' && (bill.id || bill.bill_id) && (
                <Link to={`/tenant/pay?billId=${bill.id || bill.bill_id}`}>
                  <Button size="sm">Pay this bill</Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
