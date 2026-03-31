-- 🗑️ Cleanup: Delete buggy articles (variable scope bug)
-- Execute no Supabase Console > SQL Editor

-- 1️⃣ VISUALIZAR ARTIGOS COM IMAGEM REUTILIZADA (DRY RUN)
SELECT
  image_url,
  COUNT(*) as quantidade,
  STRING_AGG(id::text, ', ') as article_ids,
  STRING_AGG(title, ' | ') as titles
FROM articles
WHERE image_url IS NOT NULL
  AND image_url NOT LIKE '%placeholder%'
GROUP BY image_url
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2️⃣ DELETAR ARTIGOS COM IMAGEM REUTILIZADA
-- ⚠️  CUIDADO: Isso DELETA dados permanentemente!
-- Só execute se tiver verificado o resultado acima

DELETE FROM articles
WHERE id IN (
  SELECT id FROM articles a
  WHERE EXISTS (
    SELECT 1 FROM articles b
    WHERE a.image_url = b.image_url
      AND a.id != b.id
      AND a.image_url NOT LIKE '%placeholder%'
  )
)
RETURNING id, title, image_url;

-- 3️⃣ ALTERNATIVA: DELETAR POR ID ESPECÍFICO
-- Se souber exatamente quais deletar:
DELETE FROM articles
WHERE id IN (
  'uuid-1-aqui',
  'uuid-2-aqui',
  'uuid-3-aqui'
)
RETURNING id, title;

-- 4️⃣ VERIFICAR RESULTADO (após delete)
SELECT
  COUNT(*) as total_artigos,
  COUNT(DISTINCT image_url) as imagens_unicas,
  COUNT(*) FILTER (WHERE image_url LIKE '%placeholder%') as placeholders
FROM articles;
