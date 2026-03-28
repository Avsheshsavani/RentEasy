export type UserRole = 'super_admin' | 'owner' | 'tenant';

export type RentType = 'monthly' | 'lease';
export type RentCycle = 'monthly' | 'yearly';
export type LeaseStatus = 'active' | 'ended';
export type BillStatus = 'unpaid' | 'partial' | 'paid' | 'waived';
export type PaymentMethod = 'razorpay' | 'upi_screenshot' | 'cash' | 'deposit_adjustment';
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';
export type VacateStatus = 'pending' | 'settled' | 'cancelled';
export type NotificationType = 
  | 'bill_generated' 
  | 'payment_received' 
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'due_reminder'
  | 'overdue_alert'
  | 'advance_low'
  | 'lease_expiring'
  | 'vacate_initiated'
  | 'settlement_ready';

export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  upi_id: string | null;
  razorpay_account_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  property_id: string;
  room_number: string;
  floor: string | null;
  rent_type: RentType;
  monthly_rent: number;
  lease_duration_months: number | null;
  deposit_amount: number;
  meter_number: string | null;
  electricity_rate: number;
  is_occupied: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  email: string | null;
  emergency_contact: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  monthly_rent_snapshot: number;
  rent_cycle: RentCycle;
  deposit_amount: number;
  deposit_paid: boolean;
  deposit_returned: boolean;
  deposit_deduction: number;
  deposit_deduction_reason: string | null;
  advance_months_paid: number;
  advance_balance_months: number;
  status: LeaseStatus;
  vacated_at: string | null;
  final_settlement_amount: number | null;
  settlement_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ElectricityReading {
  id: string;
  room_id: string;
  reading_month: string;
  previous_units: number;
  current_units: number;
  units_consumed: number;
  rate_per_unit: number;
  total_amount: number;
  meter_photo_url: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  lease_id: string;
  room_id: string;
  tenant_id: string;
  bill_month: string;
  rent_amount: number;
  electricity_amount: number;
  previous_dues: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  due_date: string;
  generated_at: string;
  paid_at: string | null;
  is_advance_covered: boolean;
  electricity_reading_id: string | null;
  status: BillStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  bill_id: string;
  tenant_id: string;
  amount: number;
  method: PaymentMethod;
  upi_ref: string | null;
  razorpay_id: string | null;
  razorpay_order_id: string | null;
  screenshot_url: string | null;
  status: PaymentStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  reject_reason: string | null;
  payment_note: string | null;
  paid_at: string;
  created_at: string;
  updated_at: string;
}

export interface VacateRequest {
  id: string;
  lease_id: string;
  tenant_id: string;
  room_id: string;
  requested_vacate_date: string;
  actual_vacate_date: string | null;
  outstanding_dues: number;
  deposit_amount: number;
  deposit_deduction: number;
  deposit_deduction_reason: string | null;
  net_settlement: number;
  status: VacateStatus;
  settled_at: string | null;
  settled_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  recipient_type: 'owner' | 'tenant';
  type: NotificationType;
  title: string;
  body: string;
  ref_id: string | null;
  ref_type: string | null;
  is_read: boolean;
  push_sent: boolean;
  created_at: string;
}

// View types
export interface RoomWithDetails extends Room {
  property_name: string;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  lease_id: string | null;
  start_date: string | null;
  advance_balance_months: number | null;
  rent_cycle: RentCycle | null;
  current_bill_id: string | null;
  current_bill_total: number | null;
  current_bill_due: number | null;
  current_bill_status: BillStatus | null;
}

export interface PendingPayment {
  payment_id: string;
  amount: number;
  method: PaymentMethod;
  upi_ref: string | null;
  screenshot_url: string | null;
  payment_note: string | null;
  paid_at: string;
  tenant_name: string;
  tenant_phone: string;
  room_number: string;
  property_name: string;
  bill_month: string;
  bill_total: number;
  bill_balance: number;
}

export interface TenantBill {
  id: string;
  bill_id: string;
  bill_month: string;
  rent_amount: number;
  electricity_amount: number;
  previous_dues: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  due_date: string;
  status: BillStatus;
  is_advance_covered: boolean;
  tenant_id: string;
  room_number: string;
  property_name: string;
  property_address: string;
  owner_name: string;
  owner_phone: string;
  owner_upi_id: string | null;
  previous_units: number | null;
  current_units: number | null;
  units_consumed: number | null;
  rate_per_unit: number | null;
  meter_photo_url: string | null;
}
