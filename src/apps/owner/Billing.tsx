import { useEffect, useState } from 'react';
import { Card, Button, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth, getCurrentMonth } from '@/lib/utils';
import { FileText, ChevronLeft, ChevronRight, RefreshCw, DoorOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Owner, Bill } from '@/types/database';

interface BillWithDetails extends Bill {
  tenant_name: string;
  room_number: string;
  property_name: string;
}

export function BillingPage() {
  const { profile } = useAuthStore();
  const owner = profile as Owner;
  const [bills, setBills] = useState<BillWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  useEffect(() => {
    if (owner?.id) {
      fetchBills();
    }
  }, [owner?.id, selectedMonth]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          tenants(name),
          rooms(room_number, properties(name))
        `)
        .eq('bill_month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const billsWithDetails = data?.map((bill) => ({
        ...bill,
        tenant_name: (bill.tenants as any)?.name || 'Unknown',
        room_number: (bill.rooms as any)?.room_number || '',
        property_name: (bill.rooms as any)?.properties?.name || '',
      })) || [];

      setBills(billsWithDetails);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const generateBills = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_bills_for_month', {
        p_month: selectedMonth,
      });

      if (error) throw error;

      const generated = data?.filter((d: any) => d.bill_id)?.length || 0;
      const skipped = data?.filter((d: any) => d.skipped_reason)?.length || 0;

      if (generated > 0) {
        toast.success(`Generated ${generated} bills`);
      }
      if (skipped > 0) {
        toast(`${skipped} bills already exist`, { icon: 'ℹ️' });
      }

      fetchBills();
    } catch (error) {
      console.error('Error generating bills:', error);
      toast.error('Failed to generate bills');
    } finally {
      setGenerating(false);
    }
  };

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const stats = {
    total: bills.length,
    paid: bills.filter(b => b.status === 'paid').length,
    partial: bills.filter(b => b.status === 'partial').length,
    unpaid: bills.filter(b => b.status === 'unpaid').length,
    totalAmount: bills.reduce((sum, b) => sum + Number(b.total_amount), 0),
    collected: bills.reduce((sum, b) => sum + Number(b.amount_paid), 0),
    pending: bills.reduce((sum, b) => sum + Number(b.balance_due), 0),
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900">{formatMonth(selectedMonth)}</span>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
          disabled={selectedMonth >= getCurrentMonth()}
        >
          <ChevronRight className={`h-5 w-5 ${selectedMonth >= getCurrentMonth() ? 'text-gray-300' : 'text-gray-600'}`} />
        </button>
      </div>

      {/* Stats */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Collection Summary</h3>
          <Button size="sm" onClick={generateBills} isLoading={generating}>
            <RefreshCw className="h-4 w-4" />
            Generate Bills
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-success-50 rounded-lg">
            <p className="text-lg font-bold text-success-600">{stats.paid}</p>
            <p className="text-xs text-gray-500">Paid</p>
          </div>
          <div className="text-center p-2 bg-warning-50 rounded-lg">
            <p className="text-lg font-bold text-warning-600">{stats.partial}</p>
            <p className="text-xs text-gray-500">Partial</p>
          </div>
          <div className="text-center p-2 bg-danger-50 rounded-lg">
            <p className="text-lg font-bold text-danger-600">{stats.unpaid}</p>
            <p className="text-xs text-gray-500">Unpaid</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Collected</p>
            <p className="text-lg font-bold text-success-600">{formatCurrency(stats.collected)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-bold text-danger-600">{formatCurrency(stats.pending)}</p>
          </div>
        </div>
      </Card>

      {/* Bills List */}
      {bills.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No bills for this month"
          description="Generate bills to start collecting rent"
          action={
            <Button onClick={generateBills} isLoading={generating}>
              <RefreshCw className="h-4 w-4" />
              Generate Bills
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <Card key={bill.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{bill.tenant_name}</h3>
                    <Badge status={bill.status}>{bill.status}</Badge>
                    {bill.is_advance_covered && (
                      <Badge variant="info">Advance</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <DoorOpen className="h-3 w-3" />
                      Room {bill.room_number}
                    </span>
                    <span>{bill.property_name}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rent</span>
                      <span>{formatCurrency(bill.rent_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Electricity</span>
                      <span>{formatCurrency(bill.electricity_amount)}</span>
                    </div>
                    {bill.previous_dues > 0 && (
                      <div className="flex justify-between text-danger-600">
                        <span>Previous Dues</span>
                        <span>{formatCurrency(bill.previous_dues)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(bill.total_amount)}
                  </p>
                  {bill.balance_due > 0 && bill.status !== 'paid' && (
                    <p className="text-sm text-danger-600">
                      Due: {formatCurrency(bill.balance_due)}
                    </p>
                  )}
                  {new Date(bill.due_date) < new Date() && bill.status !== 'paid' && (
                    <Badge variant="danger" className="mt-1">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
