-- ============================================================
-- 001_extensions.sql
-- Enable required PostgreSQL extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "citext";
-- ============================================================
-- 002_super_admins.sql
-- Super admin table for platform management
-- ============================================================

CREATE TABLE super_admins (
  id             UUID PRIMARY KEY,  -- = auth.uid()
  name           TEXT        NOT NULL,
  email          CITEXT      NOT NULL UNIQUE,
  phone          TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE super_admins IS 'Platform super administrators who manage owners';

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_super_admins_updated_at
  BEFORE UPDATE ON super_admins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ============================================================
-- 003_owners_properties.sql
-- Owners and properties tables
-- ============================================================

CREATE TABLE owners (
  id                  UUID        PRIMARY KEY,  -- = auth.uid()
  name                TEXT        NOT NULL,
  phone               CITEXT      NOT NULL UNIQUE,
  email               CITEXT,
  upi_id              TEXT,
  razorpay_account_id TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by          UUID        REFERENCES super_admins(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  owners          IS 'Property owners who manage rooms and tenants';
COMMENT ON COLUMN owners.upi_id   IS 'Personal UPI id shown as QR on bills';
COMMENT ON COLUMN owners.created_by IS 'Super admin who created this owner';

CREATE INDEX idx_owners_created_by ON owners(created_by);

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Properties
CREATE TABLE properties (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  address     TEXT        NOT NULL,
  city        TEXT        NOT NULL DEFAULT 'Surat',
  state       TEXT        NOT NULL DEFAULT 'Gujarat',
  pincode     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_owner ON properties(owner_id);

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rooms
CREATE TYPE rent_type_enum AS ENUM ('monthly', 'lease');

CREATE TABLE rooms (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_number           TEXT         NOT NULL,
  floor                 TEXT,
  rent_type             rent_type_enum NOT NULL DEFAULT 'monthly',
  monthly_rent          NUMERIC(10,2)  NOT NULL CHECK (monthly_rent > 0),
  lease_duration_months INT,
  deposit_amount        NUMERIC(10,2)  NOT NULL DEFAULT 0,
  meter_number          TEXT,
  electricity_rate      NUMERIC(6,2)   NOT NULL DEFAULT 8.00,
  is_occupied           BOOLEAN        NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, room_number)
);

CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_rooms_occupied ON rooms(property_id, is_occupied) WHERE is_active = TRUE;

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ============================================================
-- 004_tenants_leases.sql
-- Tenants and lease agreements
-- ============================================================

CREATE TABLE tenants (
  id                  UUID        PRIMARY KEY,  -- = auth.uid()
  owner_id            UUID        NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  name                TEXT        NOT NULL,
  phone               CITEXT      NOT NULL,
  email               CITEXT,
  emergency_contact   TEXT,
  profile_photo_url   TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_owner ON tenants(owner_id);
CREATE INDEX idx_tenants_phone ON tenants(phone);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Leases
CREATE TYPE lease_status_enum AS ENUM ('active', 'ended');
CREATE TYPE rent_cycle_enum   AS ENUM ('monthly', 'yearly');

CREATE TABLE leases (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id                  UUID          NOT NULL REFERENCES rooms(id)   ON DELETE RESTRICT,
  tenant_id                UUID          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  start_date               DATE          NOT NULL,
  end_date                 DATE,
  monthly_rent_snapshot    NUMERIC(10,2) NOT NULL,
  rent_cycle               rent_cycle_enum NOT NULL DEFAULT 'monthly',
  deposit_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_paid             BOOLEAN       NOT NULL DEFAULT FALSE,
  deposit_returned         BOOLEAN       NOT NULL DEFAULT FALSE,
  deposit_deduction        NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_deduction_reason TEXT,
  advance_months_paid      INT           NOT NULL DEFAULT 0,
  advance_balance_months   INT           NOT NULL DEFAULT 0,
  status                   lease_status_enum NOT NULL DEFAULT 'active',
  vacated_at               TIMESTAMPTZ,
  final_settlement_amount  NUMERIC(10,2),
  settlement_notes         TEXT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_one_active_lease_per_room
    EXCLUDE USING btree (room_id WITH =) WHERE (status = 'active'),
  CONSTRAINT uq_one_active_lease_per_tenant
    EXCLUDE USING btree (tenant_id WITH =) WHERE (status = 'active')
);

CREATE INDEX idx_leases_room   ON leases(room_id);
CREATE INDEX idx_leases_tenant ON leases(tenant_id);
CREATE INDEX idx_leases_active ON leases(status) WHERE status = 'active';

CREATE TRIGGER trg_leases_updated_at
  BEFORE UPDATE ON leases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sync room occupancy on lease changes
CREATE OR REPLACE FUNCTION sync_room_occupancy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE rooms SET is_occupied = TRUE WHERE id = NEW.room_id;
  ELSIF NEW.status = 'ended' THEN
    UPDATE rooms SET is_occupied = FALSE WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lease_occupancy
  AFTER INSERT OR UPDATE OF status ON leases
  FOR EACH ROW EXECUTE FUNCTION sync_room_occupancy();
-- ============================================================
-- 005_billing.sql
-- Electricity readings and bills
-- ============================================================

CREATE TABLE electricity_readings (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id          UUID          NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  reading_month    TEXT          NOT NULL,
  previous_units   NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_units    NUMERIC(10,2) NOT NULL CHECK (current_units >= previous_units),
  units_consumed   NUMERIC(10,2) GENERATED ALWAYS AS (current_units - previous_units) STORED,
  rate_per_unit    NUMERIC(6,2)  NOT NULL,
  total_amount     NUMERIC(10,2) GENERATED ALWAYS AS (ROUND((current_units - previous_units) * rate_per_unit, 2)) STORED,
  meter_photo_url  TEXT,
  recorded_by      UUID          NOT NULL REFERENCES owners(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, reading_month)
);

CREATE INDEX idx_readings_room ON electricity_readings(room_id, reading_month DESC);

CREATE TRIGGER trg_readings_updated_at
  BEFORE UPDATE ON electricity_readings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bills
CREATE TYPE bill_status_enum AS ENUM ('unpaid', 'partial', 'paid', 'waived');

CREATE TABLE bills (
  id                     UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id               UUID           NOT NULL REFERENCES leases(id)  ON DELETE RESTRICT,
  room_id                UUID           NOT NULL REFERENCES rooms(id)   ON DELETE RESTRICT,
  tenant_id              UUID           NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  bill_month             TEXT           NOT NULL,
  rent_amount            NUMERIC(10,2)  NOT NULL DEFAULT 0,
  electricity_amount     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  previous_dues          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total_amount           NUMERIC(10,2)  NOT NULL,
  amount_paid            NUMERIC(10,2)  NOT NULL DEFAULT 0,
  balance_due            NUMERIC(10,2)  GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  due_date               DATE           NOT NULL,
  generated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  paid_at                TIMESTAMPTZ,
  is_advance_covered     BOOLEAN        NOT NULL DEFAULT FALSE,
  electricity_reading_id UUID           REFERENCES electricity_readings(id),
  status                 bill_status_enum NOT NULL DEFAULT 'unpaid',
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (lease_id, bill_month)
);

CREATE INDEX idx_bills_tenant   ON bills(tenant_id, bill_month DESC);
CREATE INDEX idx_bills_lease    ON bills(lease_id, bill_month DESC);
CREATE INDEX idx_bills_status   ON bills(status) WHERE status IN ('unpaid', 'partial');
CREATE INDEX idx_bills_due_date ON bills(due_date) WHERE status IN ('unpaid', 'partial');

CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recalculate bill status after payment changes
CREATE OR REPLACE FUNCTION recalculate_bill_status(p_bill_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_total      NUMERIC(10,2);
  v_paid       NUMERIC(10,2);
  v_new_status bill_status_enum;
  v_now        TIMESTAMPTZ := NOW();
BEGIN
  SELECT total_amount INTO v_total FROM bills WHERE id = p_bill_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM payments
  WHERE bill_id = p_bill_id AND status = 'confirmed';

  IF    v_paid = 0        THEN v_new_status := 'unpaid';
  ELSIF v_paid >= v_total THEN v_new_status := 'paid';
  ELSE                         v_new_status := 'partial';
  END IF;

  UPDATE bills SET
    amount_paid = v_paid,
    status      = v_new_status,
    paid_at     = CASE WHEN v_new_status = 'paid' THEN v_now ELSE NULL END,
    updated_at  = v_now
  WHERE id = p_bill_id;
END;
$$;
-- ============================================================
-- 006_payments.sql
-- Payment records
-- ============================================================

CREATE TYPE payment_method_enum AS ENUM (
  'razorpay',
  'upi_screenshot',
  'cash',
  'deposit_adjustment'
);

CREATE TYPE payment_status_enum AS ENUM (
  'pending',
  'confirmed',
  'rejected'
);

CREATE TABLE payments (
  id               UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id          UUID                  NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  tenant_id        UUID                  NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  amount           NUMERIC(10,2)         NOT NULL CHECK (amount > 0),
  method           payment_method_enum   NOT NULL,
  upi_ref          TEXT,
  razorpay_id      TEXT,
  razorpay_order_id TEXT,
  screenshot_url   TEXT,
  status           payment_status_enum   NOT NULL DEFAULT 'pending',
  confirmed_by     UUID                  REFERENCES owners(id),
  confirmed_at     TIMESTAMPTZ,
  reject_reason    TEXT,
  payment_note     TEXT,
  paid_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_bill     ON payments(bill_id);
CREATE INDEX idx_payments_tenant   ON payments(tenant_id, paid_at DESC);
CREATE INDEX idx_payments_pending  ON payments(status) WHERE status = 'pending';
CREATE INDEX idx_payments_razorpay ON payments(razorpay_id) WHERE razorpay_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recalculate bill when payment status changes
CREATE OR REPLACE FUNCTION on_payment_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM recalculate_bill_status(NEW.bill_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_bill_sync
  AFTER UPDATE OF status ON payments
  FOR EACH ROW EXECUTE FUNCTION on_payment_status_change();

CREATE OR REPLACE FUNCTION on_payment_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    PERFORM recalculate_bill_status(NEW.bill_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_insert_sync
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION on_payment_insert();
-- ============================================================
-- 007_vacate_notifications.sql
-- Vacancy workflow and notifications
-- ============================================================

CREATE TYPE vacate_status_enum AS ENUM ('pending', 'settled', 'cancelled');

CREATE TABLE vacate_requests (
  id                       UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id                 UUID               NOT NULL REFERENCES leases(id) ON DELETE RESTRICT,
  tenant_id                UUID               NOT NULL REFERENCES tenants(id),
  room_id                  UUID               NOT NULL REFERENCES rooms(id),
  requested_vacate_date    DATE               NOT NULL,
  actual_vacate_date       DATE,
  outstanding_dues         NUMERIC(10,2)      NOT NULL DEFAULT 0,
  deposit_amount           NUMERIC(10,2)      NOT NULL DEFAULT 0,
  deposit_deduction        NUMERIC(10,2)      NOT NULL DEFAULT 0,
  deposit_deduction_reason TEXT,
  net_settlement           NUMERIC(10,2)      GENERATED ALWAYS AS (outstanding_dues - deposit_amount + deposit_deduction) STORED,
  status                   vacate_status_enum NOT NULL DEFAULT 'pending',
  settled_at               TIMESTAMPTZ,
  settled_by               UUID               REFERENCES owners(id),
  notes                    TEXT,
  created_at               TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vacate_lease  ON vacate_requests(lease_id);
CREATE INDEX idx_vacate_tenant ON vacate_requests(tenant_id);

CREATE TRIGGER trg_vacate_updated_at
  BEFORE UPDATE ON vacate_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- End lease and disable tenant when vacate is settled
CREATE OR REPLACE FUNCTION on_vacate_settled()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    UPDATE leases SET
      status                   = 'ended',
      vacated_at               = NOW(),
      final_settlement_amount  = NEW.net_settlement,
      deposit_deduction        = NEW.deposit_deduction,
      deposit_deduction_reason = NEW.deposit_deduction_reason,
      updated_at               = NOW()
    WHERE id = NEW.lease_id;

    UPDATE tenants SET is_active = FALSE WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vacate_settle
  AFTER UPDATE OF status ON vacate_requests
  FOR EACH ROW EXECUTE FUNCTION on_vacate_settled();

-- Notifications
CREATE TYPE notification_type_enum AS ENUM (
  'bill_generated',
  'payment_received',
  'payment_confirmed',
  'payment_rejected',
  'due_reminder',
  'overdue_alert',
  'advance_low',
  'lease_expiring',
  'vacate_initiated',
  'settlement_ready'
);

CREATE TYPE recipient_type_enum AS ENUM ('owner', 'tenant');

CREATE TABLE notifications (
  id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id     UUID                     NOT NULL,
  recipient_type   recipient_type_enum      NOT NULL,
  type             notification_type_enum   NOT NULL,
  title            TEXT                     NOT NULL,
  body             TEXT                     NOT NULL,
  ref_id           UUID,
  ref_type         TEXT,
  is_read          BOOLEAN                  NOT NULL DEFAULT FALSE,
  push_sent        BOOLEAN                  NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notif_unread    ON notifications(recipient_id) WHERE is_read = FALSE;
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
  p.name                AS property_name
FROM bills b
JOIN leases l ON l.id = b.lease_id
JOIN rooms r ON r.id = l.room_id
JOIN properties p ON p.id = r.property_id
ORDER BY b.bill_month DESC;
-- ============================================================
-- 010_bill_generation.sql
-- Monthly bill generation function
-- ============================================================

CREATE OR REPLACE FUNCTION generate_bills_for_month(p_month TEXT)
RETURNS TABLE (
  lease_id       UUID,
  tenant_id      UUID,
  room_number    TEXT,
  bill_id        UUID,
  total_amount   NUMERIC,
  skipped_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r              RECORD;
  v_prev_dues    NUMERIC(10,2) := 0;
  v_elec_amount  NUMERIC(10,2) := 0;
  v_rent_amount  NUMERIC(10,2) := 0;
  v_due_date     DATE;
  v_bill_id      UUID;
  v_reading_id   UUID;
BEGIN
  v_due_date := (p_month || '-10')::DATE;

  FOR r IN
    SELECT
      l.id            AS lease_id,
      l.tenant_id,
      l.room_id,
      l.monthly_rent_snapshot,
      l.rent_cycle,
      l.advance_balance_months,
      rm.room_number,
      rm.electricity_rate
    FROM leases l
    JOIN rooms rm ON rm.id = l.room_id
    WHERE l.status = 'active'
    ORDER BY l.id
  LOOP
    IF EXISTS (
      SELECT 1 FROM bills
      WHERE bills.lease_id = r.lease_id AND bill_month = p_month
    ) THEN
      lease_id       := r.lease_id;
      tenant_id      := r.tenant_id;
      room_number    := r.room_number;
      bill_id        := NULL;
      total_amount   := 0;
      skipped_reason := 'already_exists';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF r.rent_cycle = 'yearly' THEN
      IF RIGHT(p_month, 2) = '01' THEN
        v_rent_amount := r.monthly_rent_snapshot * 12;
      ELSE
        v_rent_amount := 0;
      END IF;
    ELSE
      v_rent_amount := r.monthly_rent_snapshot;
    END IF;

    SELECT id, er.total_amount INTO v_reading_id, v_elec_amount
    FROM electricity_readings er
    WHERE er.room_id = r.room_id AND reading_month = p_month;

    IF NOT FOUND THEN
      v_elec_amount := 0;
      v_reading_id  := NULL;
    END IF;

    SELECT COALESCE(
      (
        SELECT balance_due
        FROM bills
        WHERE bills.lease_id = r.lease_id
        ORDER BY bill_month DESC
        LIMIT 1
      ),
      0
    ) INTO v_prev_dues;

    v_prev_dues := COALESCE(v_prev_dues, 0);

    IF r.advance_balance_months > 0 THEN
      INSERT INTO bills (
        lease_id, room_id, tenant_id, bill_month,
        rent_amount, electricity_amount, previous_dues,
        total_amount, due_date,
        is_advance_covered, electricity_reading_id,
        status, amount_paid
      ) VALUES (
        r.lease_id, r.room_id, r.tenant_id, p_month,
        v_rent_amount, v_elec_amount, 0,
        v_elec_amount, v_due_date,
        TRUE, v_reading_id,
        CASE WHEN v_elec_amount = 0 THEN 'paid' ELSE 'unpaid' END,
        0
      )
      RETURNING id INTO v_bill_id;

      UPDATE leases
      SET advance_balance_months = advance_balance_months - 1
      WHERE id = r.lease_id;

      INSERT INTO notifications (recipient_id, recipient_type, type, title, body, ref_id, ref_type)
      VALUES (
        r.tenant_id, 'tenant', 'bill_generated',
        'Bill for ' || p_month,
        'Rent covered by advance. Electricity: ₹' || v_elec_amount::TEXT,
        v_bill_id, 'bill'
      );
    ELSE
      INSERT INTO bills (
        lease_id, room_id, tenant_id, bill_month,
        rent_amount, electricity_amount, previous_dues,
        total_amount, due_date,
        is_advance_covered, electricity_reading_id,
        status, amount_paid
      ) VALUES (
        r.lease_id, r.room_id, r.tenant_id, p_month,
        v_rent_amount, v_elec_amount, v_prev_dues,
        v_rent_amount + v_elec_amount + v_prev_dues, v_due_date,
        FALSE, v_reading_id,
        'unpaid', 0
      )
      RETURNING id INTO v_bill_id;

      INSERT INTO notifications (recipient_id, recipient_type, type, title, body, ref_id, ref_type)
      VALUES (
        r.tenant_id, 'tenant', 'bill_generated',
        'New bill for ' || p_month,
        'Total due: ₹' || (v_rent_amount + v_elec_amount + v_prev_dues)::TEXT ||
        CASE WHEN v_prev_dues > 0 THEN ' (includes ₹' || v_prev_dues::TEXT || ' previous dues)' ELSE '' END,
        v_bill_id, 'bill'
      );
    END IF;

    lease_id       := r.lease_id;
    tenant_id      := r.tenant_id;
    room_number    := r.room_number;
    bill_id        := v_bill_id;
    total_amount   := v_rent_amount + v_elec_amount + v_prev_dues;
    skipped_reason := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Attach electricity reading to bill
CREATE OR REPLACE FUNCTION attach_electricity_to_bill(
  p_room_id    UUID,
  p_bill_month TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reading RECORD;
  v_bill_id UUID;
BEGIN
  SELECT id, total_amount INTO v_reading
  FROM electricity_readings
  WHERE room_id = p_room_id AND reading_month = p_bill_month;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT id INTO v_bill_id
  FROM bills
  WHERE room_id = p_room_id AND bill_month = p_bill_month;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE bills SET
    electricity_amount     = v_reading.total_amount,
    electricity_reading_id = v_reading.id,
    total_amount           = rent_amount + v_reading.total_amount + previous_dues,
    updated_at             = NOW()
  WHERE id = v_bill_id;

  PERFORM recalculate_bill_status(v_bill_id);
END;
$$;

-- Trigger to sync reading to bill
CREATE OR REPLACE FUNCTION on_reading_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM attach_electricity_to_bill(NEW.room_id, NEW.reading_month);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reading_bill_sync
  AFTER INSERT OR UPDATE ON electricity_readings
  FOR EACH ROW EXECUTE FUNCTION on_reading_change();
