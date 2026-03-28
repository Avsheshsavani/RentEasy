import { useEffect, useState } from 'react';
import { Card, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import type { Tenant, ElectricityReading } from '@/types/database';

export function MeterReadingsPage() {
  const { profile } = useAuthStore();
  const tenant = profile as Tenant;
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      fetchReadings();
    }
  }, [tenant?.id]);

  const fetchReadings = async () => {
    try {
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .select('room_id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .maybeSingle();

      if (leaseError || !lease) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('electricity_readings')
        .select('*')
        .eq('room_id', lease.room_id)
        .order('reading_month', { ascending: false })
        .limit(12);

      if (error) throw error;
      setReadings(data || []);
    } catch (error) {
      console.error('Error fetching readings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  if (readings.length === 0) {
    return (
      <EmptyState
        icon={<Zap className="h-12 w-12" />}
        title="No meter readings"
        description="Your owner records the meter each month (previous & current units). After they save a reading, it shows here and is used on your bill."
      />
    );
  }

  const avgConsumption = readings.reduce((sum, r) => sum + Number(r.units_consumed), 0) / readings.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg. Monthly Consumption</p>
            <p className="text-xl font-bold text-gray-900">
              {avgConsumption.toFixed(1)} units
            </p>
          </div>
        </div>
      </Card>

      {/* Readings List */}
      <div className="space-y-3">
        {readings.map((reading, index) => {
          const prevReading = readings[index + 1];
          const trend = prevReading
            ? reading.units_consumed > prevReading.units_consumed
              ? 'up'
              : reading.units_consumed < prevReading.units_consumed
              ? 'down'
              : 'same'
            : null;

          return (
            <Card key={reading.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {formatMonth(reading.reading_month)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Previous</span>
                      <span>{reading.previous_units}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current</span>
                      <span>{reading.current_units}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Consumed</span>
                      <span className="font-medium">{reading.units_consumed} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rate</span>
                      <span>₹{reading.rate_per_unit}/unit</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(reading.total_amount)}
                  </p>
                  {trend && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${
                      trend === 'up' ? 'text-danger-600' : trend === 'down' ? 'text-success-600' : 'text-gray-500'
                    }`}>
                      {trend === 'up' ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : trend === 'down' ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {trend === 'up' ? 'Higher' : trend === 'down' ? 'Lower' : 'Same'} than last month
                    </div>
                  )}
                </div>
              </div>

              {reading.meter_photo_url && (
                <div className="mt-3">
                  <img
                    src={reading.meter_photo_url}
                    alt="Meter reading"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
