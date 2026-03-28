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
