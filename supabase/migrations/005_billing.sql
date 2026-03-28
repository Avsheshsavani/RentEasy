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
