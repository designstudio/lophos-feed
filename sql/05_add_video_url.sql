-- Migration: Add video_url column to raw_items and articles tables
-- Date: 2026-03-25

-- Add video_url to raw_items table
ALTER TABLE raw_items
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add video_url to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS articles_video_url_idx ON articles(video_url);
