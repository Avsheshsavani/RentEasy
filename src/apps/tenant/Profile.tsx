import { useState } from 'react';
import { Card, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { User, Shield, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Tenant } from '@/types/database';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuthStore();
  const tenant = profile as Tenant;

  const [formData, setFormData] = useState({
    emergency_contact: tenant?.emergency_contact || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          emergency_contact: formData.emergency_contact || null,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Name</span>
            <span className="font-medium">{tenant?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Phone</span>
            <span className="font-medium">{tenant?.phone}</span>
          </div>
          {tenant?.email && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Email</span>
              <span className="font-medium">{tenant.email}</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Emergency Contact"
            value={formData.emergency_contact}
            onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
            placeholder="Name: Ramesh, Phone: 9876543210"
            helperText="Contact person in case of emergency"
          />
          <Button type="submit" isLoading={saving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </form>
      </Card>
    </div>
  );
}
