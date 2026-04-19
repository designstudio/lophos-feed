-- Add keywords column to articles table (if not exists)
-- matched_topics should already exist

alter table articles add column if not exists keywords text[] default '{}';
-- Array of searchable keywords extracted by Mistral (e.g., ["valorant", "vct 2026", "riot games"])

-- Ensure indexes exist for fast filtering
create index if not exists articles_keywords_idx on articles using gin(keywords);
