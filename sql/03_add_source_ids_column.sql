-- Add source_ids column to articles table
-- Stores UUID array of raw_items that were merged into this article
-- Used for atomic closing of the processing cycle: mark raw_items as processed

-- Define source_ids as TEXT[] to store UUID strings
alter table articles add column if not exists source_ids text[] default '{}';
-- Example: ["e4462cf9-1234-5678-90ab-cdef12345678", "f5573dga-2345-6789-01bc-def123456789"]

-- Create index for fast filtering by source_id membership
create index if not exists articles_source_ids_idx on articles using gin(source_ids);

-- Backfill existing articles (those without source_ids) with empty array for safety
update articles set source_ids = '{}' where source_ids is null;
