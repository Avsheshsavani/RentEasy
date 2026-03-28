import { useEffect, useState } from 'react';
import { Card, Button, Input, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatMonth, getCurrentMonth } from '@/lib/utils';
import { Zap, DoorOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Owner, ElectricityReading, Room } from '@/types/database';

interface RoomWithReading extends Room {
  property_name: string;
  reading?: ElectricityReading;
  last_reading?: number;
}

export function ElectricityPage() {
  const { profile } = useAuthStore();
  const owner = profile as Owner;
  const [rooms, setRooms] = useState<RoomWithReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithReading | null>(null);

  const [formData, setFormData] = useState({
    current_units: '',
  });

  useEffect(() => {
    if (owner?.id) {
      fetchRoomsWithReadings();
    }
  }, [owner?.id, selectedMonth]);

  const fetchRoomsWithReadings = async () => {
    setLoading(true);
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          properties!inner(name, owner_id)
        `)
        .eq('properties.owner_id', owner.id)
        .eq('is_occupied', true)
        .eq('is_active', true);

      if (roomsError) throw roomsError;

      const roomIds = roomsData?.map(r => r.id) || [];

      const { data: readings } = await supabase
        .from('electricity_readings')
        .select('*')
        .in('room_id', roomIds)
        .eq('reading_month', selectedMonth);

      const previousMonth = getPreviousMonth(selectedMonth);
      const { data: previousReadings } = await supabase
        .from('electricity_readings')
        .select('room_id, current_units')
        .in('room_id', roomIds)
        .eq('reading_month', previousMonth);

      const roomsWithReadings = roomsData?.map((room) => ({
        ...room,
        property_name: (room.properties as any)?.name || '',
        reading: readings?.find(r => r.room_id === room.id),
        last_reading: previousReadings?.find(r => r.room_id === room.id)?.current_units || 0,
      })) || [];

      setRooms(roomsWithReadings);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const getPreviousMonth = (month: string): string => {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(year, m - 2);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const openAddModal = (room: RoomWithReading) => {
    setSelectedRoom(room);
    setFormData({
      current_units: room.reading?.current_units?.toString() || '',
    });
    setShowAddModal(true);
  };

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    const currentUnits = parseFloat(formData.current_units);
    const previousUnits = selectedRoom.last_reading || 0;

    if (currentUnits < previousUnits) {
      toast.error('Current reading cannot be less than previous reading');
      return;
    }

    try {
      if (selectedRoom.reading) {
        const { error } = await supabase
          .from('electricity_readings')
          .update({
            current_units: currentUnits,
            previous_units: previousUnits,
          })
          .eq('id', selectedRoom.reading.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('electricity_readings')
          .insert({
            room_id: selectedRoom.id,
            reading_month: selectedMonth,
            previous_units: previousUnits,
            current_units: currentUnits,
            rate_per_unit: selectedRoom.electricity_rate,
            recorded_by: owner.id,
          });

        if (error) throw error;
      }

      toast.success('Reading saved successfully');
      setShowAddModal(false);
      setSelectedRoom(null);
      fetchRoomsWithReadings();
    } catch (error) {
      console.error('Error saving reading:', error);
      toast.error('Failed to save reading');
    }
  };

  const pendingRooms = rooms.filter(r => !r.reading);
  const completedRooms = rooms.filter(r => r.reading);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
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
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-50 rounded-lg">
              <Zap className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingRooms.length}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-50 rounded-lg">
              <Zap className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completedRooms.length}</p>
              <p className="text-xs text-gray-500">Recorded</p>
            </div>
          </div>
        </Card>
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-12 w-12" />}
          title="No occupied rooms"
          description="Electricity readings can only be entered for occupied rooms"
        />
      ) : (
        <>
          {/* Pending Readings */}
          {pendingRooms.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Pending Readings</h3>
              <div className="space-y-2">
                {pendingRooms.map((room) => (
                  <Card
                    key={room.id}
                    className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openAddModal(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning-50 rounded-lg">
                          <DoorOpen className="h-4 w-4 text-warning-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Room {room.room_number}</p>
                          <p className="text-xs text-gray-500">{room.property_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Last: {room.last_reading || 0} units</p>
                        <Badge variant="warning">Pending</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Completed Readings */}
          {completedRooms.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Recorded</h3>
              <div className="space-y-2">
                {completedRooms.map((room) => (
                  <Card
                    key={room.id}
                    className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openAddModal(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-success-50 rounded-lg">
                          <DoorOpen className="h-4 w-4 text-success-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Room {room.room_number}</p>
                          <p className="text-xs text-gray-500">{room.property_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {room.reading?.units_consumed} units
                        </p>
                        <p className="text-xs text-success-600">
                          {formatCurrency(room.reading?.total_amount || 0)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Reading Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={selectedRoom?.reading ? 'Edit Reading' : 'Enter Reading'}
      >
        <form onSubmit={handleSaveReading} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">Room {selectedRoom?.room_number}</p>
            <p className="text-sm text-gray-500">{selectedRoom?.property_name}</p>
            <p className="text-sm text-gray-500 mt-1">
              Rate: ₹{selectedRoom?.electricity_rate}/unit
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Previous Reading"
              value={selectedRoom?.last_reading?.toString() || '0'}
              disabled
            />
            <Input
              label="Current Reading"
              type="number"
              step="0.01"
              value={formData.current_units}
              onChange={(e) => setFormData({ ...formData, current_units: e.target.value })}
              placeholder="Enter current meter reading"
              required
            />
          </div>

          {formData.current_units && selectedRoom && (
            <div className="p-3 bg-primary-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Units Consumed</span>
                <span className="font-medium">
                  {(parseFloat(formData.current_units) - (selectedRoom.last_reading || 0)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Total Amount</span>
                <span className="font-semibold text-primary-700">
                  {formatCurrency(
                    (parseFloat(formData.current_units) - (selectedRoom.last_reading || 0)) *
                      selectedRoom.electricity_rate
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Reading
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
