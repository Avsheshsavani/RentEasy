-- ============================================================
-- FIX V2: RLS Policy Infinite Recursion - Complete Rewrite
-- Run this ENTIRE script in Supabase SQL Editor
-- This completely removes and recreates all RLS policies
-- ============================================================

-- ============================================================
-- STEP 1: Disable RLS temporarily and drop ALL policies
-- ============================================================

-- Disable RLS on all tables first
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE leases DISABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE vacate_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE owners DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on each table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ============================================================
-- STEP 2: Create helper functions to avoid recursion
-- These functions check ownership without triggering RLS
-- ============================================================

-- Function to check if user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is an owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM owners WHERE id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a tenant
CREATE OR REPLACE FUNCTION is_tenant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenants WHERE id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if owner owns a property (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION owner_owns_property(prop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM properties WHERE id = prop_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if owner owns a room via property
CREATE OR REPLACE FUNCTION owner_owns_room(r_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rooms r
    INNER JOIN properties p ON p.id = r.property_id
    WHERE r.id = r_id AND p.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if tenant has access to a room
CREATE OR REPLACE FUNCTION tenant_has_room_access(r_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leases l
    WHERE l.room_id = r_id 
    AND l.tenant_id = auth.uid() 
    AND l.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if owner owns a lease via room->property
CREATE OR REPLACE FUNCTION owner_owns_lease(l_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leases l
    INNER JOIN rooms r ON r.id = l.room_id
    INNER JOIN properties p ON p.id = r.property_id
    WHERE l.id = l_id AND p.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if owner owns a bill via room->property
CREATE OR REPLACE FUNCTION owner_owns_bill(b_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bills b
    INNER JOIN rooms r ON r.id = b.room_id
    INNER JOIN properties p ON p.id = r.property_id
    WHERE b.id = b_id AND p.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 3: Re-enable RLS on all tables
-- ============================================================

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Create new policies using helper functions
-- ============================================================

-- SUPER_ADMINS: Only super admins can see their own record
CREATE POLICY "super_admin_self" ON super_admins
  FOR ALL USING (id = auth.uid());

-- OWNERS: Super admins can manage all, owners see themselves
CREATE POLICY "super_admin_manage_owners" ON owners
  FOR ALL USING (is_super_admin());

CREATE POLICY "owner_self" ON owners
  FOR SELECT USING (id = auth.uid());

-- PROPERTIES: Super admins see all, owners see their own
CREATE POLICY "super_admin_view_properties" ON properties
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_properties" ON properties
  FOR ALL USING (owner_id = auth.uid());

-- ROOMS: Use helper function to avoid recursion
CREATE POLICY "super_admin_view_rooms" ON rooms
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_rooms" ON rooms
  FOR ALL USING (owner_owns_property(property_id));

CREATE POLICY "tenant_view_own_room" ON rooms
  FOR SELECT USING (tenant_has_room_access(id));

-- TENANTS: Owners manage tenants they created, tenants see themselves
CREATE POLICY "super_admin_view_tenants" ON tenants
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_tenants" ON tenants
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "tenant_self" ON tenants
  FOR SELECT USING (id = auth.uid());

-- LEASES: Use helper functions
CREATE POLICY "super_admin_view_leases" ON leases
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_leases" ON leases
  FOR ALL USING (owner_owns_room(room_id));

CREATE POLICY "tenant_view_own_lease" ON leases
  FOR SELECT USING (tenant_id = auth.uid());

-- ELECTRICITY_READINGS: Use helper functions
CREATE POLICY "super_admin_view_readings" ON electricity_readings
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_readings" ON electricity_readings
  FOR ALL USING (owner_owns_room(room_id));

CREATE POLICY "tenant_view_own_readings" ON electricity_readings
  FOR SELECT USING (tenant_has_room_access(room_id));

-- BILLS: Use helper functions
CREATE POLICY "super_admin_view_bills" ON bills
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_bills" ON bills
  FOR ALL USING (owner_owns_room(room_id));

CREATE POLICY "tenant_view_own_bills" ON bills
  FOR SELECT USING (tenant_has_room_access(room_id));

-- PAYMENTS: Use helper functions
CREATE POLICY "super_admin_view_payments" ON payments
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_payments" ON payments
  FOR ALL USING (owner_owns_bill(bill_id));

CREATE POLICY "tenant_manage_own_payments" ON payments
  FOR ALL USING (tenant_id = auth.uid());

-- VACATE_REQUESTS: Use helper functions
CREATE POLICY "super_admin_view_vacate" ON vacate_requests
  FOR SELECT USING (is_super_admin());

CREATE POLICY "owner_manage_vacate" ON vacate_requests
  FOR ALL USING (owner_owns_room(room_id));

CREATE POLICY "tenant_manage_own_vacate" ON vacate_requests
  FOR ALL USING (tenant_id = auth.uid());

-- NOTIFICATIONS: recipient_id is the auth user (owner/tenant/super_admin id)
CREATE POLICY "read_own_notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "mark_own_notifications_read" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid());

-- ============================================================
-- STEP 5: Grant execute permissions on helper functions
-- ============================================================

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION is_tenant() TO authenticated;
GRANT EXECUTE ON FUNCTION owner_owns_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION owner_owns_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION tenant_has_room_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION owner_owns_lease(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION owner_owns_bill(UUID) TO authenticated;

-- ============================================================
-- Done! The RLS policies should now work without recursion
-- ============================================================
