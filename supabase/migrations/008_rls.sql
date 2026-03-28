-- ============================================================
-- 008_rls.sql
-- Row Level Security policies
-- ============================================================

ALTER TABLE super_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacate_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins
    WHERE id = auth.uid() AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_active_owner()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM owners
    WHERE id = auth.uid() AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_active_tenant()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants
    WHERE id = auth.uid() AND is_active = TRUE
  );
$$;

-- SUPER ADMINS
CREATE POLICY "super_admin_read_own" ON super_admins
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "super_admin_update_own" ON super_admins
  FOR UPDATE USING (id = auth.uid());

-- OWNERS
CREATE POLICY "super_admin_all_owners" ON owners
  FOR ALL USING (is_super_admin());
CREATE POLICY "owner_read_own" ON owners
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "owner_update_own" ON owners
  FOR UPDATE USING (id = auth.uid());

-- PROPERTIES
CREATE POLICY "super_admin_all_properties" ON properties
  FOR SELECT USING (is_super_admin());
CREATE POLICY "owner_all_properties" ON properties
  FOR ALL USING (owner_id = auth.uid());

-- ROOMS
CREATE POLICY "super_admin_all_rooms" ON rooms
  FOR SELECT USING (is_super_admin());
CREATE POLICY "owner_all_rooms" ON rooms
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );
CREATE POLICY "tenant_read_own_room" ON rooms
  FOR SELECT USING (
    is_active_tenant() AND id IN (
      SELECT room_id FROM leases
      WHERE tenant_id = auth.uid() AND status = 'active'
    )
  );

-- TENANTS
CREATE POLICY "super_admin_all_tenants" ON tenants
  FOR SELECT USING (is_super_admin());
CREATE POLICY "owner_all_tenants" ON tenants
  FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "tenant_read_own_profile" ON tenants
  FOR SELECT USING (id = auth.uid() AND is_active_tenant());
CREATE POLICY "tenant_update_own_profile" ON tenants
  FOR UPDATE USING (id = auth.uid() AND is_active_tenant());

-- LEASES
CREATE POLICY "owner_all_leases" ON leases
  FOR ALL USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE p.owner_id = auth.uid()
    )
  );
CREATE POLICY "tenant_read_own_lease" ON leases
  FOR SELECT USING (tenant_id = auth.uid() AND is_active_tenant());

-- ELECTRICITY READINGS
CREATE POLICY "owner_all_readings" ON electricity_readings
  FOR ALL USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE p.owner_id = auth.uid()
    )
  );
CREATE POLICY "tenant_read_own_readings" ON electricity_readings
  FOR SELECT USING (
    is_active_tenant() AND room_id IN (
      SELECT room_id FROM leases
      WHERE tenant_id = auth.uid() AND status = 'active'
    )
  );

-- BILLS
CREATE POLICY "owner_all_bills" ON bills
  FOR ALL USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN rooms r ON r.id = l.room_id
      JOIN properties p ON p.id = r.property_id
      WHERE p.owner_id = auth.uid()
    )
  );
CREATE POLICY "tenant_read_own_bills" ON bills
  FOR SELECT USING (tenant_id = auth.uid() AND is_active_tenant());

-- PAYMENTS
CREATE POLICY "owner_all_payments" ON payments
  FOR ALL USING (
    bill_id IN (
      SELECT b.id FROM bills b
      JOIN leases l ON l.id = b.lease_id
      JOIN rooms r ON r.id = l.room_id
      JOIN properties p ON p.id = r.property_id
      WHERE p.owner_id = auth.uid()
    )
  );
CREATE POLICY "tenant_insert_payment" ON payments
  FOR INSERT WITH CHECK (
    tenant_id = auth.uid() AND is_active_tenant() AND
    bill_id IN (SELECT id FROM bills WHERE tenant_id = auth.uid())
  );
CREATE POLICY "tenant_read_own_payments" ON payments
  FOR SELECT USING (tenant_id = auth.uid() AND is_active_tenant());

-- VACATE REQUESTS
CREATE POLICY "owner_all_vacate" ON vacate_requests
  FOR ALL USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE p.owner_id = auth.uid()
    )
  );
CREATE POLICY "tenant_read_own_vacate" ON vacate_requests
  FOR SELECT USING (tenant_id = auth.uid() AND is_active_tenant());

-- NOTIFICATIONS
CREATE POLICY "read_own_notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "mark_own_notifications_read" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid());
