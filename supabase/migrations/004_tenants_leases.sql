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
