-- ============================================================
-- 009_views.sql
-- App views for simpler queries
-- ============================================================

-- Pending payments view for owner
CREATE OR REPLACE VIEW v_pending_payments AS
SELECT
  pay.id                AS payment_id,
  pay.amount,
  pay.method,
  pay.upi_ref,
  pay.screenshot_url,
  pay.payment_note,
  pay.paid_at,
  t.name                AS tenant_name,
  t.phone               AS tenant_phone,
  r.room_number,
  p.name                AS property_name,
  b.bill_month,
  b.total_amount        AS bill_total,
  b.balance_due         AS bill_balance
FROM payments pay
JOIN bills b ON b.id = pay.bill_id
JOIN leases l ON l.id = b.lease_id
JOIN rooms r ON r.id = l.room_id
JOIN properties p ON p.id = r.property_id
JOIN tenants t ON t.id = pay.tenant_id
WHERE pay.status = 'pending'
ORDER BY pay.paid_at ASC;

-- Tenant current bill view
CREATE OR REPLACE VIEW v_tenant_current_bill AS
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
WHERE b.bill_month = to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM');

-- Tenant bill history view
CREATE OR REPLACE VIEW v_tenant_bill_history AS
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
