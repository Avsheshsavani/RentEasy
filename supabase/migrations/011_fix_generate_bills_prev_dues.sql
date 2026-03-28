-- Re-apply bill generator fix (010 may already have run before 010 was patched in repo).
-- Also COALESCE(v_prev_dues, 0) on INSERT so previous_dues is never NULL.

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
