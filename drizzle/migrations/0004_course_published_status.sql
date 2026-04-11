-- Add draft/publish status and creator tracking to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_by uuid;

-- Mark existing active courses as published so they remain visible to learners
UPDATE courses SET is_published = true WHERE active = true;
