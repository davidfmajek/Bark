-- Enforce minimum review length at DB level.

CREATE OR REPLACE FUNCTION public.enforce_review_min_body_chars()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF char_length(btrim(COALESCE(NEW.body, ''))) < 50 THEN
    RAISE EXCEPTION 'Review body must be at least 50 characters.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_min_body_chars ON public.reviews;

CREATE TRIGGER trg_reviews_min_body_chars
  BEFORE INSERT OR UPDATE OF body ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_review_min_body_chars();
