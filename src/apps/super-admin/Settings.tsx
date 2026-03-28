import { useState } from 'react';
import { Card, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { User, Shield, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SuperAdmin } from '@/types/database';

export function SettingsPage() {
  const { profile, refreshProfile } = useAuthStore();
  const superAdmin = profile as SuperAdmin;

  const [formData, setFormData] = useState({
    name: superAdmin?.name || '',
    email: superAdmin?.email || '',
    phone: superAdmin?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('super_admins')
        .update({
          name: formData.name,
          phone: formData.phone,
        })
        .eq('id', superAdmin.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
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
            Profile Settings
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            disabled
            helperText="Email cannot be changed"
          />
          <Input
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="9876543210"
          />
          <Button type="submit" isLoading={saving}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Role</span>
            <span className="text-sm font-medium text-primary-600">Super Admin</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Account Status</span>
            <span className="text-sm font-medium text-success-600">Active</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">User ID</span>
            <span className="text-xs font-mono text-gray-400">{superAdmin?.id?.slice(0, 8)}...</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
