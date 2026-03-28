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
