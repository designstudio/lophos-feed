# News Clustering V2 (experimental)

This experiment is intentionally disconnected from `news:process`, `news:cluster`, and `news:cron`.
It never writes to Supabase and does not change `raw_items.processed`.

## Commands

- `npm run news:cluster-v2-synthetic`: precision-oriented multilingual synthetic suite.
- `npm run news:cluster-v2-test -- --hours=12`: read-only V1 versus V2 benchmark on recent `raw_items`.
- `npm run news:cluster-v2-eval`: regression metrics on the manually labeled real-data fixture.
- Optional benchmark flags: `--hours`, `--limit`, `--threshold`, `--max-pair-hours`, `--top-k`,
  `--near-miss-limit`, `--singleton-limit`, and `--focus=term1,term2`.

The manual retroactive article dedupe now reuses the calibrated V2 embeddings, pair protections,
source-role classification, and complete-link grouping. It remains outside the automatic news
pipeline and adds stricter destructive gates: title semantic score >= 0.93, at least two shared
title anchors, and lexical score >= 0.12. Reviews, analysis, and roundups are not semantically
deleted; exact normalized-title duplicates remain eligible. Run `npm run news:dedupe` for a dry run
and add `-- --apply` only after reviewing the reported evidence.

The real-data benchmark queries `raw_items` directly instead of consuming the latest
`news_preflight_runs` payload. This avoids inheriting its per-topic limits and semantic exclusions.
Both V1 and V2 receive the exact same locally accepted set after the existing deterministic policy
filters are reapplied.

## V2 algorithm

1. Compose one representation per item from `title + summary`.
2. Generate one normalized, quantized local embedding per item with
   `Xenova/multilingual-e5-small` (overridable through `EMBEDDING_MODEL`).
3. Compare only pairs inside a configurable publication-time window and retain each item's top-k
   semantic candidates. Topic is recorded for audit but is never a comparison barrier.
4. Accept an edge only when semantic similarity is supported by rare shared tokens and lexical or
   event-type confirmation. Conflicting event types (for example trailer versus box office),
   conflicting years, and same-publisher pairs are blocked.
5. Build clusters with complete-link agglomeration: every cross-pair must pass before two groups can
   merge. This limits transitive chaining and prioritizes precision.

## Primary and supporting source roles

The experimental role-aware pass runs after embeddings and pair decisions are cached. It does not
replace or connect to the automated ingest/cluster/process commands; the manual dedupe only reuses
its classifier as an additional deletion safeguard.

1. Titles with structured roundup/liveblog/recap framing, multi-announcement event framing, review
   framing, or explicit analysis/opinion framing are marked as supporting candidates. A lone word
   such as `everything` is not sufficient.
2. Only `PRIMARY_EVENT_SOURCE` items enter top-k selection and complete-link clustering.
3. A `SUPPORTING_SOURCE` is evaluated only after a primary cluster already contains at least two
   sources. It must pass the time/same-source/year/event protections, share at least two central
   title anchors, and have qualified semantic plus factual evidence.
4. A supporting item may be attached to more than one already-established event, as a conference
   roundup naturally can be. It never creates an event, joins two events, participates in
   complete-link, or acts as a transitive edge. A rejected source-event relation is `UNRELATED`.

The global semantic thresholds remain 0.86 and 0.93. The attachment stage has a separate 0.84
containment floor, but that path also requires at least three central anchors and lexical overlap;
it cannot create a primary cluster. A narrow summary-noise rescue was added for primary pairs: when
combined title/summary event types conflict but at least one headline has no conflicting type, the
pair may pass only at event score >= 0.90, two rare shared tokens, and lexical score >= 0.12. Explicit
headline conflicts such as trailer versus box office remain blocked.

### Role-aware real-data snapshot (2026-08-15, fixed 12-hour window)

- Input: 181 raw/accepted items.
- V1: 175 clusters, 170 singletons, 4 pairs, 1 cluster with 3+ sources.
- Binary V2 audit baseline: 177 clusters, 173 singletons, 4 pairs.
- Role-aware V2: 175 primary candidates and 6 supporting candidates; 3 primary events with two
  sources; 4 supporting attachments; 172 standalone sources/candidates.
- Correct primary events found: X-Men casting, Frozen III footage, and Star Wars: Starfighter first
  footage/look.
- X-Men support: the D23 roundup and IGN opinion/analysis were attached only after the two primary
  reports formed the event.
- Starfighter support: the Ahsoka/Starfighter multi-event story and the general D23 roundup were
  attached after the IGN/TheWrap primary pair formed.
- Avengers: Doomsday remained a primary singleton. The roundup did not create a two-source event.
- No new primary or supporting false positive was observed in manual review of this focused batch.
  Confirmed false negatives remain among additional X-Men hard-news sources (G1 and Dread Central),
  so rollout is still not recommended.

Measured on the Windows development host for this fixed batch: 7.78-8.44 s total, 0.80-0.82 s
model load, 5.22-5.84 s embeddings, 1.74-1.79 s clustering, 61.96-69.40 vectors/s, and approximately
778 MB final RSS (+698 MB). The role pass reuses all vectors and pair decisions; its incremental CPU
and memory cost is included in the clustering figure and is small relative to embedding inference.

For a few hundred items the implementation deliberately computes the pairwise cosine matrix in
memory. At 418 items this was 87,153 pair checks and 5,893 retained candidate pairs. This is simple
and currently fast enough, but the measured resident-memory increase (~712 MB on the development
machine) should be verified on the CPU-only VPS before any rollout.

## Calibration snapshot (2026-08-14, 12-hour window)

- Input: 418 raw items; 418 accepted by local deterministic filters.
- V1: 385 clusters; 374 singletons; 5 pairs; 6 clusters with 3+ sources.
- V2: 405 clusters; 393 singletons; 11 pairs; 1 cluster with 3 sources.
- V2 timing: ~15.6 s total; ~8.6 s embeddings; ~6.2 s clustering.
- Embedding throughput: ~48.7 items/s.
- Model: `Xenova/multilingual-e5-small`, quantized.

An earlier permissive V2 calibration produced obvious false positives in the same real batch. The
current rules removed those observed errors, including unrelated Apple/AI stories, unrelated crimes,
different games, and same-publisher D23 headlines. This remains experimental: the much higher V2
singleton count than the product target shows that precision protection is now stronger than recall.
No production rollout is recommended until more real batches are manually labeled and evaluated.

## Recall calibration round 2

The benchmark now prints `NEAR MISSES` in four score bands. Every pair includes event and title
embedding scores, lexical score, rare/title tokens, detected event types, all blocking gates, and the
final cluster-level rejection (`top-k-rejection` or `complete-link-rejection` when the pair decision
itself passed).

The local fixture at `fixtures/news-cluster-v2-real-eval.json` contains 126 minimized real items and
152 manually reviewed pairs: 52 `SAME_EVENT` and 100 `DIFFERENT_EVENT`. It contains no Supabase IDs,
URLs, article bodies, or model vectors. The main false-negative causes were:

- a historical year in title/summary being treated as the event year;
- event types inferred from summary noise instead of the headline;
- high-quality title agreement hidden by weak or repetitive summaries;
- short/cross-language headlines with names but little lexical overlap;
- complete-link rejecting a valid pair because another member did not pass every cross-pair gate.

The accepted recall additions are deliberately narrow:

- a second, cached title-only embedding can confirm a pair only with event score >= 0.90, title score
  >= 0.93, and at least three shared title anchors;
- a year conflict found in the combined text can be rescued only when headline years do not conflict,
  event score >= 0.90, four rare tokens and lexical score >= 0.12 agree;
- an event-type conflict found in combined text can be rescued when headline event types do not
  conflict, event score >= 0.88, four rare tokens and lexical score >= 0.12 agree; the narrower
  summary-noise variant described above applies when one headline has no event type.

Complete-link and all same-publisher, time-window, explicit title-year, and title-event protections
remain enabled.

Fixture metrics:

- V1: precision 1.0000, recall 0.0962, F1 0.1754 (5 TP, 0 FP, 47 FN).
- V2 before recall signals: precision 1.0000, recall 0.7308, F1 0.8444 (38 TP, 0 FP, 14 FN).
- V2 after recall signals: precision 1.0000, recall 0.7692, F1 0.8696 (40 TP, 0 FP, 12 FN).

The gain is intentionally small because the fixture confirmed that raw title-only thresholds below
0.95 quickly introduce false positives. No global semantic threshold was lowered.

## CPU-only VPS performance command

The benchmark has a report-suppression mode which still performs the complete read-only V1/V2 run:

```sh
npm run news:cluster-v2-test -- --hours=12 --performance-only
```

On Linux, capture peak RSS and wall time independently from Node's before/after RSS readings:

```sh
/usr/bin/time -v npm run news:cluster-v2-test -- --hours=12 --performance-only
```

Inspect `Maximum resident set size`, `Elapsed (wall clock) time`, and the benchmark's model load,
embedding, clustering, total, throughput, pair-check, and RSS lines. This command performs Supabase
`SELECT` queries only. It does not update `raw_items`, create runs/articles, invoke external models,
or interact with cron, Docker, or Coolify.

Latest Windows development measurement for 410 items with event + title embeddings:

- total: 18.13 s;
- model load: 0.69 s;
- embeddings: 10.31 s;
- clustering: 7.13 s;
- throughput: 79.53 vectors/s (two vectors per item);
- RSS: 100.9 MB before, 897.0 MB after, +796.1 MB.

## Optional cron shadow mode

Set `NEWS_ENABLE_CLUSTER_V2_SHADOW=true` to run the role-aware V2 audit after `news:process` and
before the independently configured Mistral stage. Missing values, `false`, and every value other
than an explicit case-insensitive `true` leave the cron behavior unchanged.

The shadow subprocess only issues `SELECT` queries against recent `raw_items`. It does not consume
or write `news_cluster_runs`, update `raw_items.processed`, create articles, invoke an editorial
model, or change the V1 output. A non-zero shadow exit is logged by `news:cron` and deliberately does
not fail or stop the normal pipeline. `NEWS_ENABLE_MISTRAL=false` remains independent.

Every invocation appends exactly one compact JSON object followed by a newline to:

```text
/app/logs/news-cluster-v2-shadow.jsonl
```

Successful records contain the window and input counts, V1 and V2-primary distributions, primary
events, supporting attachments and reasons, both V1/V2 diff directions, primary-only near misses,
timings, embedding throughput, RSS, algorithm/schema versions, and effective thresholds. Audit
items contain title, source, topic, language when available, and publication date; summaries,
article bodies, URLs, and Supabase IDs are omitted. Failed invocations append a small `status=error`
record with the failed stage and sanitized error name/message before returning a non-zero status to
the isolating cron wrapper.

Manual read-only execution inside the container:

```sh
npm run news:cluster-v2-shadow -- --hours=12
tail -n 1 /app/logs/news-cluster-v2-shadow.jsonl
```

Optional controls are `NEWS_CLUSTER_V2_SHADOW_HOURS`, `NEWS_CLUSTER_V2_SHADOW_LIMIT`,
`NEWS_CLUSTER_V2_SHADOW_NEAR_MISS_LIMIT`, `NEWS_CLUSTER_V2_SHADOW_MAX_PAIR_HOURS`, and
`NEWS_CLUSTER_V2_SHADOW_TOP_K`, with equivalent CLI flags. These settings affect only the shadow
report.
