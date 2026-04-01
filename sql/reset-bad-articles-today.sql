-- 🗑️ Reset: Deletar artigos ruins de hoje (exceto horror) e resetar raw_items

-- Data de hoje (ajuste se necessário)
-- SELECT CURRENT_DATE; -- Use isso pra verificar a data

-- 1️⃣ VISUALIZAR: Quais artigos vão ser deletados?
SELECT
  a.id,
  a.topic,
  a.title,
  DATE(a.published_at) as data,
  array_length(a.source_ids, 1) as qtd_fontes
FROM articles a
WHERE DATE(a.published_at) = CURRENT_DATE
  AND a.topic != 'horror'  -- ✅ EXCEÇÃO: Manter horror intacto
ORDER BY a.topic, a.published_at DESC;

-- 2️⃣ COLETAR: IDs dos raw_items que estão nesses artigos ruins
-- (Executar depois de confirmar os artigos acima)
WITH bad_articles AS (
  SELECT UNNEST(a.source_ids) as raw_item_id
  FROM articles a
  WHERE DATE(a.published_at) = CURRENT_DATE
    AND a.topic != 'horror'
)
SELECT DISTINCT raw_item_id
FROM bad_articles;

-- 3️⃣ DELETAR: Artigos ruins de hoje (exceto horror)
DELETE FROM articles
WHERE DATE(published_at) = CURRENT_DATE
  AND topic != 'horror'
RETURNING id, topic, title, published_at;

-- 4️⃣ RESETAR: raw_items desses artigos para reprocessar
UPDATE raw_items
SET processed = false
WHERE id IN (
  -- Subquery: raw_item IDs que foram em artigos deletados
  SELECT UNNEST(source_ids)
  FROM articles
  WHERE DATE(published_at) = CURRENT_DATE
    AND topic != 'horror'
)
RETURNING id, title, topic, processed;

-- 5️⃣ VERIFICAR: Quantos raw_items foram resetados por tópico?
SELECT
  topic,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed = false) as nao_processados
FROM raw_items
WHERE topic != 'horror'
GROUP BY topic
ORDER BY topic;

-- 6️⃣ VERIFICAR: Artigos restantes (horror intacto)
SELECT
  topic,
  COUNT(*) as total_artigos,
  MAX(published_at) as artigo_mais_recente
FROM articles
WHERE DATE(published_at) = CURRENT_DATE
GROUP BY topic
ORDER BY topic;
