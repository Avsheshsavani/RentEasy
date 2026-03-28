  import { useEffect, useState } from 'react';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Plus, Search, User, Phone, DoorOpen, Ban, Check, Calendar, IndianRupee, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Tenant, Owner, Room, Lease } from '@/types/database';

interface TenantWithLease extends Tenant {
  lease?: Lease & { room: Room };
}

interface VacantRoom {
  id: string;
  room_number: string;
  property_name: string;
  monthly_rent: number;
  deposit_amount: number;
}

export function TenantsPage() {
  const { profile } = useAuthStore();
  const owner = profile as Owner;
  const [tenants, setTenants] = useState<TenantWithLease[]>([]);
  const [vacantRooms, setVacantRooms] = useState<VacantRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithLease | null>(null);
  const [loginTenant, setLoginTenant] = useState<TenantWithLease | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    emergency_contact: '',
  });

  const [assignData, setAssignData] = useState({
    room_id: '',
    start_date: new Date().toISOString().split('T')[0],
    rent_cycle: 'monthly',
    deposit_paid: true,
    advance_months_paid: '0',
  });

  useEffect(() => {
    if (owner?.id) {
      fetchTenants();
      fetchVacantRooms();
    }
  }, [owner?.id]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          leases!left(*, rooms(*))
        `)
        .eq('owner_id', owner.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tenantsWithLease = data?.map((tenant) => ({
        ...tenant,
        lease: tenant.leases?.find((l: Lease) => l.status === 'active'),
      })) || [];

      setTenants(tenantsWithLease);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchVacantRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_number, monthly_rent, deposit_amount, properties(name)')
        .eq('is_occupied', false)
        .eq('is_active', true)
        .eq('properties.owner_id', owner.id);

      if (error) throw error;

      const rooms = data?.map((room) => ({
        id: room.id,
        room_number: room.room_number,
        property_name:
          (room.properties as unknown as { name?: string } | null | undefined)?.name ?? '',
        monthly_rent: room.monthly_rent,
        deposit_amount: room.deposit_amount,
      })) || [];

      setVacantRooms(rooms);
    } catch (error) {
      console.error('Error fetching vacant rooms:', error);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailTrim = formData.email.trim();
    const hasEmailLogin = emailTrim.length > 0 || formData.password.length > 0;
    if (hasEmailLogin) {
      if (!emailTrim) {
        toast.error('Email is required when you set a login password');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: {
          name: formData.name,
          phone: formData.phone,
          email: emailTrim || null,
          password: formData.password || null,
          emergency_contact: formData.emergency_contact || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        hasEmailLogin
          ? 'Tenant created — they can sign in with Email + password on the login page'
          : 'Tenant created — they sign in with Phone → OTP (needs SMS enabled in Supabase)'
      );
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', password: '', emergency_contact: '' });
      fetchTenants();
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tenant');
    }
  };

  const handleAssignRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    const selectedRoom = vacantRooms.find(r => r.id === assignData.room_id);
    if (!selectedRoom) return;

    try {
      const { error } = await supabase.from('leases').insert({
        room_id: assignData.room_id,
        tenant_id: selectedTenant.id,
        start_date: assignData.start_date,
        monthly_rent_snapshot: selectedRoom.monthly_rent,
        rent_cycle: assignData.rent_cycle,
        deposit_amount: selectedRoom.deposit_amount,
        deposit_paid: assignData.deposit_paid,
        advance_months_paid: parseInt(assignData.advance_months_paid),
        advance_balance_months: parseInt(assignData.advance_months_paid),
      });

      if (error) throw error;

      toast.success('Room assigned successfully');
      setShowAssignModal(false);
      setSelectedTenant(null);
      fetchTenants();
      fetchVacantRooms();
    } catch (error) {
      console.error('Error assigning room:', error);
      toast.error('Failed to assign room');
    }
  };

  const handleToggleTenant = async (tenant: Tenant) => {
    try {
      const { error } = await supabase.functions.invoke('toggle-tenant', {
        body: {
          tenant_id: tenant.id,
          is_active: !tenant.is_active,
        },
      });

      if (error) throw error;

      toast.success(tenant.is_active ? 'Tenant disabled' : 'Tenant enabled');
      fetchTenants();
    } catch (error) {
      console.error('Error toggling tenant:', error);
      toast.error('Failed to update tenant');
    }
  };

  const openLoginModal = (tenant: TenantWithLease) => {
    setLoginTenant(tenant);
    setLoginForm({
      email: tenant.email?.trim() ?? '',
      password: '',
    });
    setShowLoginModal(true);
  };

  const handleSetTenantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginTenant) return;

    const emailTrim = loginForm.email.trim();
    if (!emailTrim) {
      toast.error('Email is required');
      return;
    }
    if (loginForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please sign in again');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-tenant-login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            tenant_id: loginTenant.id,
            email: emailTrim,
            password: loginForm.password,
          }),
        }
      );

      let payload: { error?: string; success?: boolean } = {};
      try {
        payload = (await res.json()) as { error?: string; success?: boolean };
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      if (payload.error) throw new Error(payload.error);

      toast.success('Tenant can sign in with Email + this password');
      setShowLoginModal(false);
      setLoginTenant(null);
      setLoginForm({ email: '', password: '' });
      fetchTenants();
    } catch (error) {
      console.error('Error setting tenant login:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update login');
    }
  };

  const openAssignModal = (tenant: TenantWithLease) => {
    setSelectedTenant(tenant);
    setAssignData({
      room_id: '',
      start_date: new Date().toISOString().split('T')[0],
      rent_cycle: 'monthly',
      deposit_paid: true,
      advance_months_paid: '0',
    });
    setShowAssignModal(true);
  };

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.phone.includes(searchQuery)
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tenants..."
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

      {filteredTenants.length === 0 ? (
        <EmptyState
          icon={<User className="h-12 w-12" />}
          title="No tenants found"
          description="Add tenants and assign them to vacant rooms"
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => (
            <Card key={tenant.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                    <Badge status={tenant.is_active ? 'active' : 'ended'}>
                      {tenant.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                    <Phone className="h-3 w-3" />
                    {tenant.phone}
                  </div>

                  {tenant.lease ? (
                    <div className="p-2 bg-gray-50 rounded-lg space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <DoorOpen className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">Room {tenant.lease.room?.room_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>Since {formatDate(tenant.lease.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <IndianRupee className="h-3 w-3" />
                        <span>{formatCurrency(tenant.lease.monthly_rent_snapshot)}/month</span>
                        {tenant.lease.advance_balance_months > 0 && (
                          <Badge variant="info" className="ml-2">
                            {tenant.lease.advance_balance_months} months advance
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">No room assigned</Badge>
                      {vacantRooms.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openAssignModal(tenant)}
                        >
                          Assign Room
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="Set email & password for login"
                    onClick={() => openLoginModal(tenant)}
                    className="p-2 rounded-lg text-primary-600 hover:bg-primary-50"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTenant(tenant)}
                    className={`p-2 rounded-lg ${
                      tenant.is_active
                        ? 'text-danger-600 hover:bg-danger-50'
                        : 'text-success-600 hover:bg-success-50'
                    }`}
                  >
                    {tenant.is_active ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Tenant Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Tenant">
        <form onSubmit={handleCreateTenant} className="space-y-4">
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
            label="Email (for login)"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="tenant@example.com"
            helperText="With password below: tenant uses the Email tab on the login screen. Leave both empty to use phone OTP only (SMS must work in Supabase)."
          />
          <Input
            label="Login password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 6 characters if using email login"
            autoComplete="new-password"
          />
          <Input
            label="Emergency Contact"
            value={formData.emergency_contact}
            onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
            placeholder="Name: Ramesh, Phone: 9876543210"
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Tenant
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setLoginTenant(null);
        }}
        title="Tenant email login"
      >
        <form onSubmit={handleSetTenantLogin} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{loginTenant?.name}</p>
            <p className="text-sm text-gray-500">{loginTenant?.phone}</p>
          </div>
          <Input
            label="Email"
            type="email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            placeholder="tenant@example.com"
            required
            helperText="Tenant uses the Email tab on the login page with this address."
          />
          <Input
            label="New password"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            placeholder="Min 6 characters"
            autoComplete="new-password"
            required
            helperText="Share this with the tenant once. You can open this dialog again to reset it."
          />
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowLoginModal(false);
                setLoginTenant(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save login
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Room Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Room">
        <form onSubmit={handleAssignRoom} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{selectedTenant?.name}</p>
            <p className="text-sm text-gray-500">{selectedTenant?.phone}</p>
          </div>

          <Select
            label="Select Room"
            value={assignData.room_id}
            onChange={(e) => setAssignData({ ...assignData, room_id: e.target.value })}
            options={[
              { value: '', label: 'Choose a room...' },
              ...vacantRooms.map((room) => ({
                value: room.id,
                label: `${room.property_name} - Room ${room.room_number} (${formatCurrency(room.monthly_rent)}/mo)`,
              })),
            ]}
            required
          />

          <Input
            label="Start Date"
            type="date"
            value={assignData.start_date}
            onChange={(e) => setAssignData({ ...assignData, start_date: e.target.value })}
            required
          />

          <Select
            label="Rent Cycle"
            value={assignData.rent_cycle}
            onChange={(e) => setAssignData({ ...assignData, rent_cycle: e.target.value })}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />

          <Input
            label="Advance Months Paid"
            type="number"
            min="0"
            value={assignData.advance_months_paid}
            onChange={(e) => setAssignData({ ...assignData, advance_months_paid: e.target.value })}
            helperText="Number of months paid in advance"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={assignData.deposit_paid}
              onChange={(e) => setAssignData({ ...assignData, deposit_paid: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Deposit paid</span>
          </label>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAssignModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Assign Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
