-- BARK database schema (PostgreSQL / Supabase)
-- Safe to re-run: enums/tables/indexes use duplicate-safe patterns (existing objects are left as-is).

-- Enums (skip if already created — avoids ERROR: type "…" already exists)
DO $$ BEGIN
  CREATE TYPE affiliation_enum AS ENUM (
    'Student', 'Professor', 'Staff', 'Alumni', 'Graduate Student', 'Other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE category_enum AS ENUM (
    'Dining_Hall', 'Cafe', 'Restaurant', 'Convenience'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE day_of_week_enum AS ENUM (
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status_enum AS ENUM (
    'Pending', 'Reviewed', 'Dismissed', 'Removed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tables (lowercase names; diagram uses uppercase for display)
CREATE TABLE IF NOT EXISTS users (
  user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255),
  avatar_url      TEXT,
  avatar_path     TEXT,
  avatar_bucket   TEXT,
  affiliation     affiliation_enum NOT NULL,
  is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS establishments (
  establishment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  logo_path       VARCHAR(512),
  header_image_path VARCHAR(512),
  category        category_enum NOT NULL,
  building_name   VARCHAR(255),
  latitude        DECIMAL(10, 7) NOT NULL,
  longitude       DECIMAL(11, 8) NOT NULL,
  address         VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hours (
  hours_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments (establishment_id) ON DELETE CASCADE,
  day_of_week     day_of_week_enum NOT NULL,
  open_time       TIME NOT NULL,
  close_time      TIME NOT NULL,
  is_open         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (establishment_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments (establishment_id) ON DELETE CASCADE,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body            TEXT,
  helpful_count   INTEGER NOT NULL DEFAULT 0,
  is_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_images (
  image_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES reviews (review_id) ON DELETE CASCADE,
  storage_url     VARCHAR(512) NOT NULL,
  display_order   INTEGER NOT NULL CHECK (display_order >= 1 AND display_order <= 3),
  file_size_bytes BIGINT NOT NULL,
  mime_type       VARCHAR(64) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most 3 images per review (enforced by app or trigger)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_images_per_review
  ON review_images (review_id, display_order);

CREATE TABLE IF NOT EXISTS review_tags (
  tag_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES reviews (review_id) ON DELETE CASCADE,
  tag             VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS helpful_votes (
  vote_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES reviews (review_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  voted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES reviews (review_id) ON DELETE CASCADE,
  reporter_id     UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  reason          VARCHAR(512) NOT NULL,
  status          report_status_enum NOT NULL DEFAULT 'Pending',
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
-- CREATE INDEX idx_reviews_establishment ON reviews (establishment_id);
-- CREATE INDEX idx_reviews_user ON reviews (user_id);
-- CREATE INDEX idx_review_images_review ON review_images (review_id);
-- CREATE INDEX idx_review_tags_review ON review_tags (review_id);
-- CREATE INDEX idx_helpful_votes_review ON helpful_votes (review_id);
-- CREATE INDEX idx_reports_review ON reports (review_id);
-- CREATE INDEX idx_hours_establishment ON hours (establishment_id);

-- Optional: drop all (run if reset is needed)
-- DROP TABLE IF EXISTS reports, helpful_votes, review_tags, review_images, reviews, hours, establishments, users;
-- DROP TYPE IF EXISTS report_status_enum, day_of_week_enum, category_enum, affiliation_enum;
