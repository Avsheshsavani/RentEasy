import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, Building2, DoorOpen, MapPin, Edit, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Property, Owner } from '@/types/database';

interface PropertyWithRooms extends Property {
  rooms_count: number;
  occupied_count: number;
}

type RoomOccupancyRow = { id: string; is_occupied: boolean };

export function PropertiesPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const owner = profile as Owner;
  const [properties, setProperties] = useState<PropertyWithRooms[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '',
  });

  useEffect(() => {
    if (owner?.id) {
      fetchProperties();
    }
  }, [owner?.id]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          rooms:rooms(id, is_occupied)
        `)
        .eq('owner_id', owner.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const propertiesWithRooms =
        data?.map((prop) => {
          const { rooms: roomRows, ...rest } = prop as Property & {
            rooms: RoomOccupancyRow[] | null;
          };
          const list: RoomOccupancyRow[] = roomRows ?? [];
          return {
            ...rest,
            rooms_count: list.length,
            occupied_count: list.filter((r) => r.is_occupied).length,
          };
        }) ?? [];

      setProperties(propertiesWithRooms);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('properties').insert({
        owner_id: owner.id,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode || null,
      });

      if (error) throw error;

      toast.success('Property added successfully');
      setShowAddModal(false);
      setFormData({ name: '', address: '', city: 'Surat', state: 'Gujarat', pincode: '' });
      fetchProperties();
    } catch (error) {
      console.error('Error creating property:', error);
      toast.error('Failed to add property');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          name: formData.name,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode || null,
        })
        .eq('id', selectedProperty.id);

      if (error) throw error;

      toast.success('Property updated successfully');
      setShowEditModal(false);
      setSelectedProperty(null);
      fetchProperties();
    } catch (error) {
      console.error('Error updating property:', error);
      toast.error('Failed to update property');
    }
  };

  const openEditModal = (property: Property) => {
    setSelectedProperty(property);
    setFormData({
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      pincode: property.pincode || '',
    });
    setShowEditModal(true);
  };

  const filteredProperties = properties.filter(
    (prop) =>
      prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prop.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {filteredProperties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No properties found"
          description="Add your first property to start managing rooms and tenants"
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredProperties.map((property) => (
            <Card
              key={property.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/owner/properties/${property.id}/rooms`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{property.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {property.address}, {property.city}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="info">
                      <DoorOpen className="h-3 w-3 mr-1" />
                      {property.rooms_count} rooms
                    </Badge>
                    <Badge variant="success">
                      {property.occupied_count} occupied
                    </Badge>
                    {property.rooms_count - property.occupied_count > 0 && (
                      <Badge variant="warning">
                        {property.rooms_count - property.occupied_count} vacant
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(property);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="h-4 w-4 text-gray-400" />
                  </button>
                  <ChevronRight className="h-5 w-5 text-gray-300" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Property Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Property">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Property Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Shiv Residency"
            required
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Plot 12, Main Road"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
          </div>
          <Input
            label="Pincode"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="395007"
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Property
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Property Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Property">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Property Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
          </div>
          <Input
            label="Pincode"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
          />
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
