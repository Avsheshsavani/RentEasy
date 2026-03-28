import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Badge, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth, generateUPILink } from '@/lib/utils';
import { IndianRupee, QrCode, Camera, Check, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Tenant, TenantBill } from '@/types/database';

type PaymentMethod = 'upi_qr' | 'upi_screenshot' | 'cash';

export function PayBillPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const billIdFromUrl = searchParams.get('billId');
  const { profile } = useAuthStore();
  const tenant = profile as Tenant;
  const [bill, setBill] = useState<TenantBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (tenant?.id) {
      fetchBillForPay();
    }
  }, [tenant?.id, billIdFromUrl]);

  const fetchBillForPay = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_tenant_bill_for_pay', {
        p_bill_id: billIdFromUrl || null,
      });

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const b = row as TenantBill | undefined;
      setBill(b ?? null);
      setAmount(b?.balance_due != null ? String(b.balance_due) : '');
    } catch (error) {
      console.error('Error fetching bill:', error);
      setBill(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!bill || !method || !amount) return;

    const billPk = bill.id || (bill as TenantBill & { bill_id?: string }).bill_id;
    if (!billPk) {
      toast.error('Bill reference missing — run database migration 012 or contact support');
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (method === 'upi_screenshot' && !upiRef) {
      toast.error('Enter UPI reference number');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('payments').insert({
        bill_id: billPk,
        tenant_id: tenant.id,
        amount: paymentAmount,
        method: method === 'upi_qr' ? 'upi_screenshot' : method,
        upi_ref: upiRef || null,
        payment_note: note || null,
        status: 'pending',
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Payment submitted for confirmation');
      navigate('/tenant');
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!bill || bill.status === 'paid') {
    return (
      <div className="text-center py-12 px-4">
        <Check className="h-16 w-16 text-success-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {billIdFromUrl ? 'Nothing to pay here' : 'All paid up'}
        </h2>
        <p className="text-gray-500 mb-2 max-w-sm mx-auto">
          {billIdFromUrl
            ? 'This bill is already settled, or it is not linked to your account.'
            : 'There is no unpaid balance for the current month. Older dues are listed in History — open a bill there and tap Pay.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Button variant="secondary" onClick={() => navigate('/tenant/history')}>
            Bill history
          </Button>
          <Button onClick={() => navigate('/tenant')}>
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
        </div>
      </div>
    );
  }

  const upiLink = bill.owner_upi_id
    ? generateUPILink(bill.owner_upi_id, parseFloat(amount) || bill.balance_due, `Rent ${bill.room_number} ${formatMonth(bill.bill_month)}`)
    : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Pay balance via UPI (owner&apos;s UPI when set), then submit the reference so the owner can confirm. You can also record cash paid to the owner.
      </p>
      {/* Bill Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">{formatMonth(bill.bill_month)} Bill</span>
          <Badge status={bill.status}>{bill.status}</Badge>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-gray-500">Balance Due</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(bill.balance_due)}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Room {bill.room_number}</p>
            <p>{bill.property_name}</p>
          </div>
        </div>
      </Card>

      {/* Amount */}
      <Card className="p-4">
        <Input
          label="Payment Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          helperText="You can pay partial amount"
        />
      </Card>

      {/* Payment Methods */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Select Payment Method</h3>
        
        {/* UPI QR */}
        {bill.owner_upi_id && (
          <Card
            className={`p-4 cursor-pointer transition-all ${
              method === 'upi_qr' ? 'ring-2 ring-primary-500' : ''
            }`}
            onClick={() => setMethod('upi_qr')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <QrCode className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Pay via UPI</p>
                <p className="text-sm text-gray-500">Scan QR or use UPI ID</p>
              </div>
              {method === 'upi_qr' && <Check className="h-5 w-5 text-primary-600" />}
            </div>
          </Card>
        )}

        {/* UPI Screenshot */}
        <Card
          className={`p-4 cursor-pointer transition-all ${
            method === 'upi_screenshot' ? 'ring-2 ring-primary-500' : ''
          }`}
          onClick={() => setMethod('upi_screenshot')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Camera className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Already Paid via UPI?</p>
              <p className="text-sm text-gray-500">Enter transaction reference</p>
            </div>
            {method === 'upi_screenshot' && <Check className="h-5 w-5 text-primary-600" />}
          </div>
        </Card>

        {/* Cash */}
        <Card
          className={`p-4 cursor-pointer transition-all ${
            method === 'cash' ? 'ring-2 ring-primary-500' : ''
          }`}
          onClick={() => setMethod('cash')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <IndianRupee className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Paid by Cash</p>
              <p className="text-sm text-gray-500">Owner will confirm receipt</p>
            </div>
            {method === 'cash' && <Check className="h-5 w-5 text-primary-600" />}
          </div>
        </Card>
      </div>

      {/* UPI QR Code */}
      {method === 'upi_qr' && bill.owner_upi_id && (
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-3">Scan to pay or tap to open UPI app</p>
            <a
              href={upiLink || '#'}
              className="block p-4 bg-gray-50 rounded-xl mb-3"
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink || '')}`}
                alt="UPI QR Code"
                className="mx-auto"
              />
            </a>
            <p className="text-sm font-medium text-gray-900">{bill.owner_upi_id}</p>
            <p className="text-xs text-gray-500 mt-2">
              After payment, enter the UPI reference number below
            </p>
          </div>
          <Input
            label="UPI Reference Number"
            value={upiRef}
            onChange={(e) => setUpiRef(e.target.value)}
            placeholder="Enter 12-digit UPI ref"
            className="mt-4"
          />
        </Card>
      )}

      {/* UPI Screenshot Details */}
      {method === 'upi_screenshot' && (
        <Card className="p-4">
          <Input
            label="UPI Reference Number"
            value={upiRef}
            onChange={(e) => setUpiRef(e.target.value)}
            placeholder="Enter 12-digit UPI ref"
            required
          />
        </Card>
      )}

      {/* Note */}
      {method && (
        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note (Optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={2}
            placeholder="e.g., Paid rent only, electricity next week"
          />
        </Card>
      )}

      {/* Submit */}
      {method && (
        <Button
          onClick={handleSubmitPayment}
          isLoading={submitting}
          className="w-full"
          size="lg"
        >
          Submit Payment
        </Button>
      )}
    </div>
  );
}
