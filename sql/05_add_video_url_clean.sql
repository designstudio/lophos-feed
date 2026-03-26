ALTER TABLE raw_items ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_url TEXT;

CREATE INDEX IF NOT EXISTS articles_video_url_idx ON articles(video_url);
