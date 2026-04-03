-- ============================================
-- BinNight Database Setup
-- ============================================

-- 1. Councils table
CREATE TABLE councils (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  website_url text,
  scraper_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Users table
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address text NOT NULL,
  council_id uuid REFERENCES councils(id),
  collection_zone text,
  push_token text,
  notify_time time DEFAULT '18:00:00',
  created_at timestamptz DEFAULT now()
);

-- 3. Collection schedule table
CREATE TABLE collection_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  council_id uuid REFERENCES councils(id) NOT NULL,
  zone text,
  date date NOT NULL,
  bins text[] NOT NULL,
  is_holiday boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create an index for fast schedule lookups by date
CREATE INDEX idx_schedule_date ON collection_schedule(date);
CREATE INDEX idx_schedule_council ON collection_schedule(council_id);

-- ============================================
-- Seed data: Merri-bek council
-- ============================================
INSERT INTO councils (name, state, website_url, scraper_id)
VALUES (
  'Merri-bek City Council',
  'VIC',
  'https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/waste-calendar26/',
  'merri-bek'
);
