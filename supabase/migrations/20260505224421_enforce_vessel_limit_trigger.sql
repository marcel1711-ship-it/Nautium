/*
  # Enforce vessel_limit on vessel inserts

  ## Summary
  Adds a server-side trigger that prevents inserting a new vessel when the company
  has already reached its vessel_limit. This is the authoritative enforcement layer —
  no client-side check can be bypassed because the database will always reject the INSERT.

  ## Changes
  1. New function `check_vessel_limit()` — counts existing vessels for the company and
     raises an exception if the limit is reached.
  2. Trigger `trg_enforce_vessel_limit` — fires BEFORE INSERT on vessels, calls the
     function above.

  ## Notes
  - The exception message is intentionally descriptive so the frontend can surface it.
  - master_admin inserts are also subject to this check (intentional — the limit should
    be changed on the company record first, then the vessel can be added).
*/

CREATE OR REPLACE FUNCTION check_vessel_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
  allowed_limit integer;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM vessels
  WHERE company_id = NEW.company_id;

  SELECT vessel_limit INTO allowed_limit
  FROM companies
  WHERE id = NEW.company_id;

  IF current_count >= allowed_limit THEN
    RAISE EXCEPTION 'VESSEL_LIMIT_REACHED: This company has reached its vessel limit of %. Please increase the limit before adding more vessels.', allowed_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vessel_limit ON vessels;

CREATE TRIGGER trg_enforce_vessel_limit
  BEFORE INSERT ON vessels
  FOR EACH ROW
  EXECUTE FUNCTION check_vessel_limit();
