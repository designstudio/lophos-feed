-- 🗑️ Reset: Delete articles with empty sources + reset their raw_items

-- 1️⃣ VISUALIZAR: Quais raw_items estão nesses artigos?
SELECT
  a.id as article_id,
  a.title,
  a.source_ids,
  UNNEST(a.source_ids) as raw_item_id
FROM articles a
WHERE a.id IN (
  'a28758b5-455c-4e20-bce9-1839cc73e557',
  'e7d7524f-6aaf-49db-87be-8813a1e4be06',
  '71790981-ef35-470f-aa43-52f60a67af18',
  'd8675283-8ae8-4987-b9e7-0616afadf28a',
  '0fb9544d-e6d9-4150-91ea-e0ca45a10eca'
);

-- 2️⃣ DELETAR: Os 5 artigos sem fonte
DELETE FROM articles
WHERE id IN (
  'a28758b5-455c-4e20-bce9-1839cc73e557',
  'e7d7524f-6aaf-49db-87be-8813a1e4be06',
  '71790981-ef35-470f-aa43-52f60a67af18',
  'd8675283-8ae8-4987-b9e7-0616afadf28a',
  '0fb9544d-e6d9-4150-91ea-e0ca45a10eca'
)
RETURNING id, title;

-- 3️⃣ RESETAR: raw_items desses artigos para reprocessar
UPDATE raw_items
SET processed = false
WHERE id IN (
  SELECT UNNEST(source_ids)
  FROM articles
  WHERE id IN (
    'a28758b5-455c-4e20-bce9-1839cc73e557',
    'e7d7524f-6aaf-49db-87be-8813a1e4be06',
    '71790981-ef35-470f-aa43-52f60a67af18',
    'd8675283-8ae8-4987-b9e7-0616afadf28a',
    '0fb9544d-e6d9-4150-91ea-e0ca45a10eca'
  )
)
RETURNING id, title, topic;

-- 4️⃣ VERIFICAR: raw_items agora prontos para reprocessar
SELECT
  COUNT(*) as total_para_reprocessar,
  topic,
  COUNT(*) FILTER (WHERE processed = false) as nao_processados
FROM raw_items
WHERE topic IN ('horror', 'gaming', 'cinema')  -- ajuste conforme necessário
GROUP BY topic;
