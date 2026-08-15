# News Clustering V2 (experimental)

This experiment is intentionally disconnected from `news:process`, `news:cluster`, and `news:cron`.
It never writes to Supabase and does not change `raw_items.processed`.

## Commands

- `npm run news:cluster-v2-synthetic`: precision-oriented multilingual synthetic suite.
- `npm run news:cluster-v2-test -- --hours=12`: read-only V1 versus V2 benchmark on recent `raw_items`.
- `npm run news:cluster-v2-eval`: regression metrics on the manually labeled real-data fixture.
- Optional benchmark flags: `--hours`, `--limit`, `--threshold`, `--max-pair-hours`, and `--top-k`.

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
- an event-type conflict found in combined text can be rescued only when headline event types do not
  conflict, event score >= 0.88, four rare tokens and lexical score >= 0.12 agree.

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
