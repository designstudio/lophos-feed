-- Fix source_ids column type: bigint[] → text[]
-- The column was created with wrong type, causing "invalid input syntax for type bigint"

-- Drop the old index first
drop index if exists articles_source_ids_idx;

-- Drop the old column
alter table articles drop column if exists source_ids;

-- Create with correct type (TEXT[] for UUID strings)
alter table articles add column source_ids text[] default '{}';

-- Recreate the index
create index articles_source_ids_idx on articles using gin(source_ids);

-- Verify it's now TEXT[]
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'articles' AND column_name = 'source_ids';
