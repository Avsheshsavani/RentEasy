-- Tenant bill for payment: SECURITY DEFINER so owner/property joins work without extra RLS on properties/owners.
-- p_bill_id NULL = current calendar month (Asia/Kolkata); non-null = that bill if it belongs to the tenant.

CREATE OR REPLACE FUNCTION get_tenant_bill_for_pay(p_bill_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  bill_month TEXT,
  rent_amount NUMERIC,
  electricity_amount NUMERIC,
  previous_dues NUMERIC,
  total_amount NUMERIC,
  amount_paid NUMERIC,
  balance_due NUMERIC,
  due_date DATE,
  status bill_status_enum,
  is_advance_covered BOOLEAN,
  tenant_id UUID,
  room_number TEXT,
  property_name TEXT,
  property_address TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  owner_upi_id TEXT,
  previous_units NUMERIC,
  current_units NUMERIC,
  units_consumed NUMERIC,
  rate_per_unit NUMERIC,
  meter_photo_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.bill_month,
    b.rent_amount,
    b.electricity_amount,
    b.previous_dues,
    b.total_amount,
    b.amount_paid,
    b.balance_due,
    b.due_date,
    b.status,
    b.is_advance_covered,
    b.tenant_id,
    r.room_number,
    p.name::TEXT,
    p.address::TEXT,
    o.name::TEXT,
    o.phone::TEXT,
    o.upi_id::TEXT,
    er.previous_units,
    er.current_units,
    er.units_consumed,
    er.rate_per_unit,
    er.meter_photo_url
  FROM bills b
  JOIN leases l ON l.id = b.lease_id
  JOIN rooms r ON r.id = l.room_id
  JOIN properties p ON p.id = r.property_id
  JOIN owners o ON o.id = p.owner_id
  LEFT JOIN electricity_readings er ON er.id = b.electricity_reading_id
  WHERE b.tenant_id = auth.uid()
    AND b.status IN ('unpaid', 'partial')
    AND b.balance_due > 0
    AND (
      (p_bill_id IS NOT NULL AND b.id = p_bill_id)
      OR (
        p_bill_id IS NULL
        AND b.bill_month = to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM')
      )
    )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_bill_for_pay(UUID) TO authenticated;

-- PostgreSQL does not allow CREATE OR REPLACE VIEW to rename an existing first column
-- (e.g. bill_id -> id). Drop and recreate instead.
DROP VIEW IF EXISTS v_tenant_bill_history CASCADE;
DROP VIEW IF EXISTS v_tenant_current_bill CASCADE;

-- Views: expose id (app expects bill.id); keep bill_id alias
CREATE VIEW v_tenant_current_bill AS
SELECT
  b.id                  AS id,
  b.id                  AS bill_id,
  b.bill_month,
  b.rent_amount,
  b.electricity_amount,
  b.previous_dues,
  b.total_amount,
  b.amount_paid,
  b.balance_due,
  b.due_date,
  b.status,
  b.is_advance_covered,
  b.tenant_id,
  r.room_number,
  p.name                AS property_name,
  p.address             AS property_address,
  o.name                AS owner_name,
  o.phone               AS owner_phone,
  o.upi_id              AS owner_upi_id,
  er.previous_units,
  er.current_units,
  er.units_consumed,
  er.rate_per_unit,
  er.meter_photo_url
FROM bills b
JOIN leases l ON l.id = b.lease_id
JOIN rooms r ON r.id = l.room_id
JOIN properties p ON p.id = r.property_id
JOIN owners o ON o.id = p.owner_id
LEFT JOIN electricity_readings er ON er.id = b.electricity_reading_id
WHERE b.bill_month = to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');

CREATE VIEW v_tenant_bill_history AS
SELECT
  b.id                  AS id,
  b.id                  AS bill_id,
  b.bill_month,
  b.rent_amount,
  b.electricity_amount,
  b.previous_dues,
  b.total_amount,
  b.amount_paid,
  b.balance_due,
  b.due_date,
  b.status,
  b.is_advance_covered,
  b.paid_at,
  b.tenant_id,
  r.room_number,
  p.name                AS property_name,
  er.previous_units,
  er.current_units,
  er.units_consumed
FROM bills b
JOIN leases l ON l.id = b.lease_id
JOIN rooms r ON r.id = l.room_id
JOIN properties p ON p.id = r.property_id
LEFT JOIN electricity_readings er ON er.id = b.electricity_reading_id;
