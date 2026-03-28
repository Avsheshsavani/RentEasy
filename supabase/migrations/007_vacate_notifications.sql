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
