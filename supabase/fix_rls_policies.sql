-- ============================================================
-- FIX: RLS Policy Infinite Recursion
-- Run this in Supabase SQL Editor to fix the policies
-- ============================================================

-- First, drop all existing policies that cause recursion
DROP POLICY IF EXISTS "owner_all_rooms" ON rooms;
DROP POLICY IF EXISTS "tenant_read_own_room" ON rooms;
DROP POLICY IF EXISTS "owner_all_leases" ON leases;
DROP POLICY IF EXISTS "owner_all_readings" ON electricity_readings;
DROP POLICY IF EXISTS "tenant_read_own_readings" ON electricity_readings;
DROP POLICY IF EXISTS "owner_all_bills" ON bills;
DROP POLICY IF EXISTS "owner_all_payments" ON payments;
DROP POLICY IF EXISTS "owner_all_vacate" ON vacate_requests;

-- Recreate ROOMS policies without recursion
CREATE POLICY "owner_all_rooms" ON rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p 
      WHERE p.id = rooms.property_id 
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "tenant_read_own_room" ON rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = auth.uid() AND t.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM leases l
      WHERE l.room_id = rooms.id 
      AND l.tenant_id = auth.uid() 
      AND l.status = 'active'
    )
  );

-- Recreate LEASES policies
CREATE POLICY "owner_all_leases" ON leases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE r.id = leases.room_id
      AND p.owner_id = auth.uid()
    )
  );

-- Recreate ELECTRICITY_READINGS policies
CREATE POLICY "owner_all_readings" ON electricity_readings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE r.id = electricity_readings.room_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "tenant_read_own_readings" ON electricity_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = auth.uid() AND t.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM leases l
      WHERE l.room_id = electricity_readings.room_id
      AND l.tenant_id = auth.uid()
      AND l.status = 'active'
    )
  );

-- Recreate BILLS policies
CREATE POLICY "owner_all_bills" ON bills
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE r.id = bills.room_id
      AND p.owner_id = auth.uid()
    )
  );

-- Recreate PAYMENTS policies
CREATE POLICY "owner_all_payments" ON payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN rooms r ON r.id = b.room_id
      JOIN properties p ON p.id = r.property_id
      WHERE b.id = payments.bill_id
      AND p.owner_id = auth.uid()
    )
  );

-- Recreate VACATE_REQUESTS policies
CREATE POLICY "owner_all_vacate" ON vacate_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms r
      JOIN properties p ON p.id = r.property_id
      WHERE r.id = vacate_requests.room_id
      AND p.owner_id = auth.uid()
    )
  );
