-- NIGERIA DIASPORA RADIO - MASTER SUPABASE SETUP (v2.1)
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Ensure 'station_state' exists and has all columns
CREATE TABLE IF NOT EXISTS station_state (
    id INT PRIMARY KEY DEFAULT 1,
    is_playing BOOLEAN DEFAULT FALSE,
    current_track_name TEXT DEFAULT 'Station Standby'
);

-- Safely add newer columns if they are missing
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS is_tv_active BOOLEAN DEFAULT FALSE;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_track_id TEXT;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_track_url TEXT;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_video_id TEXT;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT 0;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS last_updated BIGINT DEFAULT 0;

-- Ensure single-row constraint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'single_row') THEN
        ALTER TABLE station_state ADD CONSTRAINT single_row CHECK (id = 1);
    END IF;
END $$;

-- 2. Ensure 'media_files' exists
CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    likes BIGINT DEFAULT 0
);

-- 3. Ensure 'news_items' exists
CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    timestamp BIGINT,
    location TEXT,
    sources TEXT[],
    "isVerified" BOOLEAN DEFAULT FALSE,
    priority INT,
    summary TEXT,
    source TEXT,
    synced_at BIGINT
);

-- 4. Ensure 'admin_messages' exists
CREATE TABLE IF NOT EXISTS admin_messages (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp BIGINT NOT NULL
);

-- 5. Ensure 'listener_reports' exists
CREATE TABLE IF NOT EXISTS listener_reports (
    id TEXT PRIMARY KEY,
    "reporterName" TEXT,
    location TEXT,
    content TEXT,
    timestamp BIGINT NOT NULL
);

-- 6. Initialize or Update Station State
INSERT INTO station_state (id, is_playing, is_tv_active, current_track_name)
VALUES (1, false, false, 'Station Standby')
ON CONFLICT (id) DO UPDATE 
SET is_tv_active = EXCLUDED.is_tv_active,
    current_track_name = EXCLUDED.current_track_name;

-- STORAGE SETUP REMINDER (Bucket 'media' must be Public)
