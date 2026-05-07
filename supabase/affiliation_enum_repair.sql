-- Repair affiliation enum drift across environments.

ALTER TYPE affiliation_enum ADD VALUE IF NOT EXISTS 'Student';
ALTER TYPE affiliation_enum ADD VALUE IF NOT EXISTS 'Professor';
ALTER TYPE affiliation_enum ADD VALUE IF NOT EXISTS 'Staff';
ALTER TYPE affiliation_enum ADD VALUE IF NOT EXISTS 'Alumni';
ALTER TYPE affiliation_enum ADD VALUE IF NOT EXISTS 'Graduate Student';
ALTER TYPE affiliation_enum ADD VALUE IF NOT EXISTS 'Other';

