import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, formatStr: string = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return format(date, 'MMMM yyyy');
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    paid: 'bg-success-50 text-success-600',
    unpaid: 'bg-danger-50 text-danger-600',
    partial: 'bg-warning-50 text-warning-600',
    waived: 'bg-gray-100 text-gray-600',
    active: 'bg-success-50 text-success-600',
    ended: 'bg-gray-100 text-gray-600',
    pending: 'bg-warning-50 text-warning-600',
    confirmed: 'bg-success-50 text-success-600',
    rejected: 'bg-danger-50 text-danger-600',
    settled: 'bg-success-50 text-success-600',
    cancelled: 'bg-gray-100 text-gray-600',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
}

export function generateUPILink(upiId: string, amount: number, note: string): string {
  const encodedNote = encodeURIComponent(note);
  return `upi://pay?pa=${upiId}&pn=RentEase&am=${amount}&cu=INR&tn=${encodedNote}`;
}
