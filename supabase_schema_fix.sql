-- NIGERIA DIASPORA RADIO - SCHEMA FIX (MISSING COLUMNS & STABILITY)
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Fix 'media_files' (Add missing 'category' column)
-- This is likely why recent uploads were not appearing
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Fix 'station_state' (Ensure all sync columns exist)
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS is_tv_active BOOLEAN DEFAULT FALSE;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_track_id TEXT;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_track_url TEXT;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_video_id TEXT;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS current_offset BIGINT DEFAULT 0;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT 0;
ALTER TABLE station_state ADD COLUMN IF NOT EXISTS last_updated BIGINT DEFAULT 0;

-- 3. Final Verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media_files';

SELECT * FROM station_state WHERE id = 1;
