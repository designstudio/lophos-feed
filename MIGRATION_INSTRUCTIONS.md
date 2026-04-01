# Migration Instructions: Topic Aliases System

## 📋 Summary
The "mestres do universo" issue (only 1 article showing when there should be 4+) is caused by the topic aliases migration not being applied to the Supabase database yet.

## 🚀 How to Fix

### Step 1: Apply the Migration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `APPLY_TOPIC_ALIASES_MIGRATION.sql`
6. Paste it into the SQL editor
7. Click **Run**

This will:
- Create the `topic_aliases` table
- Create the `normalize_topic()` function
- Add `matched_topics` column to articles (if missing)
- Populate the aliases (including "mestres do universo" → "masters of the universe")

### Step 2: Verify the Migration Worked
Run these test queries in the Supabase SQL editor:

```sql
-- Test 1: Check if normalize_topic function works
SELECT normalize_topic('mestres do universo') as resultado;
-- Expected result: "masters of the universe"

-- Test 2: Check if aliases table has data
SELECT canonical_topic, ARRAY_LENGTH(aliases, 1) as alias_count
FROM topic_aliases
ORDER BY canonical_topic;
-- Expected: Should see "masters of the universe" with 4 aliases

-- Test 3: Check how many articles have "masters of the universe"
SELECT COUNT(*)
FROM articles
WHERE matched_topics && ARRAY['masters of the universe']::text[];
-- Expected: Should be 4 or more
```

### Step 3: Clear User Topics and Re-Register
After the migration is applied, the user should:
1. Go to Settings → Topics
2. Unselect all topics
3. Reselect "mestres do universo" (or use the exact text shown in the settings)
4. This will re-normalize and re-save the topics with the new function

### Step 4: Refresh the Feed
The feed should now show all articles for "mestres do universo".

## 🔍 Debugging

### Check Logs
The updated API routes now have enhanced logging:

**Topics API** (`/api/topics`):
- Shows what topics are received
- Shows what normalize_topic RPC returns
- Shows what gets saved to the database

**Feed API** (`/api/feed`):
- Shows what topics are retrieved from user_topics
- Shows what the get_personalized_feed RPC returns
- Shows article count and first article details

Look for these in your server logs:
```
[topics] POST: user=..., input topics=...
[topics] RPC success: "mestres do universo" -> "masters of the universe"
[topics] Success: saved X topics
```

```
[feed] Fetched X topics from user_topics for user ...
[feed] Calling get_personalized_feed with topics=...
[feed] RPC returned X articles
```

## 📝 What Changed

### Files Modified:
1. **src/app/api/topics/route.ts** - Added detailed logging
2. **src/app/api/feed/route.ts** - Added detailed logging
3. **APPLY_TOPIC_ALIASES_MIGRATION.sql** - New file with complete migration

### Previous Commits:
- `849e780` - Implemented topic aliases system
- `7e36ea7` - Added more topic aliases
- `83d0f07` - Added detailed logging
- `3e5b0af` - Fixed normalize_topic function (IMMUTABLE → STABLE)
- `cba8b1e` - Normalized case in feed filter

These commits added the code, but the database migration still needs to be applied.

## 🆘 If Issues Persist

### Problem: Still only 1 article showing
Check:
1. Is `topic_aliases` table created? → Query: `SELECT COUNT(*) FROM topic_aliases;`
2. Does it have the right aliases? → Query: `SELECT * FROM topic_aliases WHERE canonical_topic = 'masters of the universe';`
3. Did the user's topic get saved? → Check browser network tab in Settings page
4. Check server logs for normalization errors

### Problem: get_personalized_feed RPC error
Make sure:
1. The `normalize_topic()` function was created successfully
2. The `matched_topics` column exists on the articles table
3. The function has the STABLE keyword (not IMMUTABLE)

### Problem: Articles don't have matched_topics set
Run manual update (if needed):
```sql
-- This assumes articles.topic should be normalized and used as matched_topics
UPDATE articles
SET matched_topics = ARRAY[normalize_topic(topic)]
WHERE matched_topics IS NULL OR matched_topics = '{}';
```
