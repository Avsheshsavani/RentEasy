import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Plus, DoorOpen, User, Edit, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Room, Property } from '@/types/database';

interface RoomWithTenant extends Room {
  tenant_name: string | null;
  tenant_phone: string | null;
}

export function RoomsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<RoomWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [formData, setFormData] = useState({
    room_number: '',
    floor: '',
    rent_type: 'monthly',
    monthly_rent: '',
    lease_duration_months: '',
    deposit_amount: '',
    meter_number: '',
    electricity_rate: '8.00',
  });

  useEffect(() => {
    if (propertyId) {
      fetchPropertyAndRooms();
    }
  }, [propertyId]);

  const fetchPropertyAndRooms = async () => {
    try {
      const [{ data: propertyData }, { data: roomsData }] = await Promise.all([
        supabase.from('properties').select('*').eq('id', propertyId).single(),
        supabase
          .from('rooms')
          .select(`
            *,
            leases!left(tenant_id, status, tenants(name, phone))
          `)
          .eq('property_id', propertyId)
          .order('room_number'),
      ]);

      setProperty(propertyData);

      const roomsWithTenant = roomsData?.map((room) => {
        const activeLease = room.leases?.find((l: any) => l.status === 'active');
        return {
          ...room,
          tenant_name: activeLease?.tenants?.name || null,
          tenant_phone: activeLease?.tenants?.phone || null,
        };
      }) || [];

      setRooms(roomsWithTenant);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('rooms').insert({
        property_id: propertyId,
        room_number: formData.room_number,
        floor: formData.floor || null,
        rent_type: formData.rent_type as 'monthly' | 'lease',
        monthly_rent: parseFloat(formData.monthly_rent),
        lease_duration_months: formData.rent_type === 'lease' ? parseInt(formData.lease_duration_months) : null,
        deposit_amount: parseFloat(formData.deposit_amount) || 0,
        meter_number: formData.meter_number || null,
        electricity_rate: parseFloat(formData.electricity_rate),
      });

      if (error) throw error;

      toast.success('Room added successfully');
      setShowAddModal(false);
      resetForm();
      fetchPropertyAndRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to add room');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          room_number: formData.room_number,
          floor: formData.floor || null,
          rent_type: formData.rent_type as 'monthly' | 'lease',
          monthly_rent: parseFloat(formData.monthly_rent),
          lease_duration_months: formData.rent_type === 'lease' ? parseInt(formData.lease_duration_months) : null,
          deposit_amount: parseFloat(formData.deposit_amount) || 0,
          meter_number: formData.meter_number || null,
          electricity_rate: parseFloat(formData.electricity_rate),
        })
        .eq('id', selectedRoom.id);

      if (error) throw error;

      toast.success('Room updated successfully');
      setShowEditModal(false);
      setSelectedRoom(null);
      fetchPropertyAndRooms();
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room');
    }
  };

  const handleToggleActive = async (room: Room) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: !room.is_active })
        .eq('id', room.id);

      if (error) throw error;

      toast.success(room.is_active ? 'Room deactivated' : 'Room activated');
      fetchPropertyAndRooms();
    } catch (error) {
      console.error('Error toggling room:', error);
      toast.error('Failed to update room');
    }
  };

  const resetForm = () => {
    setFormData({
      room_number: '',
      floor: '',
      rent_type: 'monthly',
      monthly_rent: '',
      lease_duration_months: '',
      deposit_amount: '',
      meter_number: '',
      electricity_rate: '8.00',
    });
  };

  const openEditModal = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      room_number: room.room_number,
      floor: room.floor || '',
      rent_type: room.rent_type,
      monthly_rent: room.monthly_rent.toString(),
      lease_duration_months: room.lease_duration_months?.toString() || '',
      deposit_amount: room.deposit_amount.toString(),
      meter_number: room.meter_number || '',
      electricity_rate: room.electricity_rate.toString(),
    });
    setShowEditModal(true);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/owner/properties" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h2 className="font-semibold text-gray-900">{property?.name}</h2>
          <p className="text-sm text-gray-500">{rooms.length} rooms</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="ml-auto" size="sm">
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-12 w-12" />}
          title="No rooms yet"
          description="Add rooms to this property to start assigning tenants"
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add Room
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className={`p-3 ${!room.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{room.room_number}</span>
                  {room.floor && (
                    <span className="text-xs text-gray-400">{room.floor}</span>
                  )}
                </div>
                <button
                  onClick={() => handleToggleActive(room)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {room.is_active ? (
                    <ToggleRight className="h-5 w-5 text-success-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Rent</span>
                  <span className="font-medium">{formatCurrency(room.monthly_rent)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Rate</span>
                  <span className="text-xs">₹{room.electricity_rate}/unit</span>
                </div>
              </div>

              {room.is_occupied ? (
                <div className="flex items-center gap-2 p-2 bg-success-50 rounded-lg">
                  <User className="h-4 w-4 text-success-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-success-700 truncate">
                      {room.tenant_name}
                    </p>
                    <p className="text-xs text-success-600">{room.tenant_phone}</p>
                  </div>
                </div>
              ) : (
                <Badge variant="warning" className="w-full justify-center">
                  Vacant
                </Badge>
              )}

              <button
                onClick={() => openEditModal(room)}
                className="mt-2 w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Edit
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Room" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Room Number"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder="101"
              required
            />
            <Input
              label="Floor"
              value={formData.floor}
              onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
              placeholder="Ground"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Rent Type"
              value={formData.rent_type}
              onChange={(e) => setFormData({ ...formData, rent_type: e.target.value })}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'lease', label: 'Lease (Fixed Term)' },
              ]}
            />
            {formData.rent_type === 'lease' && (
              <Input
                label="Lease Duration (months)"
                type="number"
                value={formData.lease_duration_months}
                onChange={(e) => setFormData({ ...formData, lease_duration_months: e.target.value })}
                placeholder="12"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Rent (₹)"
              type="number"
              value={formData.monthly_rent}
              onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
              placeholder="5000"
              required
            />
            <Input
              label="Deposit Amount (₹)"
              type="number"
              value={formData.deposit_amount}
              onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
              placeholder="10000"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Meter Number"
              value={formData.meter_number}
              onChange={(e) => setFormData({ ...formData, meter_number: e.target.value })}
              placeholder="MTR-001"
            />
            <Input
              label="Electricity Rate (₹/unit)"
              type="number"
              step="0.01"
              value={formData.electricity_rate}
              onChange={(e) => setFormData({ ...formData, electricity_rate: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Room Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Room" size="lg">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Room Number"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              required
            />
            <Input
              label="Floor"
              value={formData.floor}
              onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Rent Type"
              value={formData.rent_type}
              onChange={(e) => setFormData({ ...formData, rent_type: e.target.value })}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'lease', label: 'Lease (Fixed Term)' },
              ]}
            />
            {formData.rent_type === 'lease' && (
              <Input
                label="Lease Duration (months)"
                type="number"
                value={formData.lease_duration_months}
                onChange={(e) => setFormData({ ...formData, lease_duration_months: e.target.value })}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Rent (₹)"
              type="number"
              value={formData.monthly_rent}
              onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
              required
            />
            <Input
              label="Deposit Amount (₹)"
              type="number"
              value={formData.deposit_amount}
              onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Meter Number"
              value={formData.meter_number}
              onChange={(e) => setFormData({ ...formData, meter_number: e.target.value })}
            />
            <Input
              label="Electricity Rate (₹/unit)"
              type="number"
              step="0.01"
              value={formData.electricity_rate}
              onChange={(e) => setFormData({ ...formData, electricity_rate: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
