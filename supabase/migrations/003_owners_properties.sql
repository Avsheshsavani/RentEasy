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
