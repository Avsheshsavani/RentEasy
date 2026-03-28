import { useEffect, useState } from 'react';
import { Card, Button, Input, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, Users, Building2, MoreVertical, Phone, Mail, Edit, Ban, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Owner } from '@/types/database';

interface OwnerWithStats extends Owner {
  properties_count: number;
  tenants_count: number;
}

export function OwnersPage() {
  useAuthStore();
  const [owners, setOwners] = useState<OwnerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    upi_id: '',
    password: '',
  });

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      const { data, error } = await supabase
        .from('owners')
        .select(`
          *,
          properties:properties(count),
          tenants:tenants(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ownersWithStats = data?.map((owner) => ({
        ...owner,
        properties_count: owner.properties?.[0]?.count || 0,
        tenants_count: owner.tenants?.[0]?.count || 0,
      })) || [];

      setOwners(ownersWithStats);
    } catch (error) {
      console.error('Error fetching owners:', error);
      toast.error('Failed to load owners');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get current session to verify we're logged in
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session?.user?.email, 'Token exists:', !!session?.access_token);
      
      if (!session) {
        toast.error('Please login first');
        return;
      }

      console.log('Creating owner with data:', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
      });
      
      // Try direct fetch to see exact error
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-owner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            upi_id: formData.upi_id || null,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('Owner created successfully');
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', upi_id: '', password: '' });
      fetchOwners();
    } catch (error) {
      console.error('Error creating owner:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create owner');
    }
  };

  const handleUpdateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;

    try {
      const { error } = await supabase
        .from('owners')
        .update({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          upi_id: formData.upi_id || null,
        })
        .eq('id', selectedOwner.id);

      if (error) throw error;

      toast.success('Owner updated successfully');
      setShowEditModal(false);
      setSelectedOwner(null);
      fetchOwners();
    } catch (error) {
      console.error('Error updating owner:', error);
      toast.error('Failed to update owner');
    }
  };

  const handleToggleActive = async (owner: Owner) => {
    try {
      const { error } = await supabase.functions.invoke('toggle-owner', {
        body: {
          owner_id: owner.id,
          is_active: !owner.is_active,
        },
      });

      if (error) throw error;

      toast.success(owner.is_active ? 'Owner disabled' : 'Owner enabled');
      fetchOwners();
    } catch (error) {
      console.error('Error toggling owner:', error);
      toast.error('Failed to update owner status');
    }
  };

  const openEditModal = (owner: Owner) => {
    setSelectedOwner(owner);
    setFormData({
      name: owner.name,
      phone: owner.phone,
      email: owner.email || '',
      upi_id: owner.upi_id || '',
      password: '',
    });
    setShowEditModal(true);
    setShowMenu(null);
  };

  const filteredOwners = owners.filter(
    (owner) =>
      owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner.phone.includes(searchQuery) ||
      owner.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search owners..."
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

      {filteredOwners.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No owners found"
          description={searchQuery ? 'Try a different search' : 'Add your first owner to get started'}
          action={
            !searchQuery && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4" />
                Add Owner
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredOwners.map((owner) => (
            <Card key={owner.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{owner.name}</h3>
                    <Badge status={owner.is_active ? 'active' : 'ended'}>
                      {owner.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {owner.phone}
                    </span>
                    {owner.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {owner.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {owner.properties_count} properties
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {owner.tenants_count} tenants
                    </span>
                    <span>Joined {formatDate(owner.created_at)}</span>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(showMenu === owner.id ? null : owner.id)}
                    className="p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-400" />
                  </button>
                  {showMenu === owner.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                        <button
                          onClick={() => openEditModal(owner)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            handleToggleActive(owner);
                            setShowMenu(null);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                            owner.is_active
                              ? 'text-danger-600 hover:bg-danger-50'
                              : 'text-success-600 hover:bg-success-50'
                          }`}
                        >
                          {owner.is_active ? (
                            <>
                              <Ban className="h-4 w-4" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Enable
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Owner Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Owner">
        <form onSubmit={handleCreateOwner} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="9876543210"
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 6 characters"
            required
          />
          <Input
            label="UPI ID (Optional)"
            value={formData.upi_id}
            onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
            placeholder="owner@okaxis"
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Owner
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Owner Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Owner">
        <form onSubmit={handleUpdateOwner} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="UPI ID"
            value={formData.upi_id}
            onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
            placeholder="owner@okaxis"
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
