import { useEffect, useState } from 'react';
import { Card, Button, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate, formatMonth } from '@/lib/utils';
import { IndianRupee, Check, X, Clock, User, DoorOpen, Image, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Owner, PendingPayment } from '@/types/database';

export function PaymentsPage() {
  const { profile } = useAuthStore();
  const owner = profile as Owner;
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (owner?.id) {
      fetchPendingPayments();
    }
  }, [owner?.id]);

  const fetchPendingPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('v_pending_payments')
        .select('*');

      if (error) throw error;

      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (paymentId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_by: owner.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast.success('Payment confirmed');
      setShowDetailModal(false);
      setSelectedPayment(null);
      fetchPendingPayments();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (paymentId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          reject_reason: rejectReason,
          confirmed_by: owner.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast.success('Payment rejected');
      setShowDetailModal(false);
      setSelectedPayment(null);
      setRejectReason('');
      fetchPendingPayments();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const openDetail = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setRejectReason('');
    setShowDetailModal(true);
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      razorpay: 'Razorpay',
      upi_screenshot: 'UPI Screenshot',
      cash: 'Cash',
      deposit_adjustment: 'Deposit',
    };
    return labels[method] || method;
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-warning-50 rounded-lg">
            <Clock className="h-5 w-5 text-warning-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
            <p className="text-sm text-gray-500">Pending Confirmations</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-lg font-semibold text-warning-600">
              {formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
            </p>
            <p className="text-xs text-gray-500">Total Amount</p>
          </div>
        </div>
      </Card>

      {payments.length === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-12 w-12" />}
          title="No pending payments"
          description="All payments have been confirmed"
        />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <Card
              key={payment.payment_id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail(payment)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{payment.tenant_name}</h3>
                    <Badge variant="warning">{getMethodLabel(payment.method)}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <DoorOpen className="h-3 w-3" />
                      Room {payment.room_number}
                    </span>
                    <span>{payment.property_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <span>{formatMonth(payment.bill_month)}</span>
                    <span>•</span>
                    <span>{formatDate(payment.paid_at, 'dd MMM, h:mm a')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(payment.amount)}
                  </p>
                  {payment.screenshot_url && (
                    <Badge variant="info" className="mt-1">
                      <Image className="h-3 w-3 mr-1" />
                      Screenshot
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Payment Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Payment Details"
        size="lg"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{selectedPayment.tenant_name}</span>
                </div>
                <span className="text-gray-500">{selectedPayment.tenant_phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-gray-400" />
                  <span>Room {selectedPayment.room_number}</span>
                </div>
                <span className="text-gray-500">{selectedPayment.property_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span>Bill: {formatMonth(selectedPayment.bill_month)}</span>
                </div>
                <span className="text-gray-500">
                  Total: {formatCurrency(selectedPayment.bill_total)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Payment Amount</p>
                <p className="text-2xl font-bold text-primary-700">
                  {formatCurrency(selectedPayment.amount)}
                </p>
              </div>
              <Badge variant="info" className="text-sm">
                {getMethodLabel(selectedPayment.method)}
              </Badge>
            </div>

            {selectedPayment.upi_ref && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">UPI Reference</p>
                <p className="font-mono text-sm">{selectedPayment.upi_ref}</p>
              </div>
            )}

            {selectedPayment.payment_note && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Note from Tenant</p>
                <p className="text-sm">{selectedPayment.payment_note}</p>
              </div>
            )}

            {selectedPayment.screenshot_url && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Payment Screenshot</p>
                <img
                  src={selectedPayment.screenshot_url}
                  alt="Payment screenshot"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Reject Reason (if rejecting)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={2}
                placeholder="e.g., Screenshot not clear, wrong amount..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="danger"
                onClick={() => handleReject(selectedPayment.payment_id)}
                disabled={processing}
                className="flex-1"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="success"
                onClick={() => handleConfirm(selectedPayment.payment_id)}
                disabled={processing}
                className="flex-1"
              >
                <Check className="h-4 w-4" />
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
