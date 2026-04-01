-- ============================================================
-- TESTE: Verificar se normalize_topic() está funcionando
-- ============================================================

-- Teste 1: Normalizar "mestres do universo" (deve retornar "masters of the universe")
SELECT normalize_topic('mestres do universo') as resultado;

-- Teste 2: Normalizar "he-man" (deve retornar "masters of the universe")
SELECT normalize_topic('he-man') as resultado;

-- Teste 3: Normalizar "Masters of the Universe" (deve retornar "masters of the universe")
SELECT normalize_topic('Masters of the Universe') as resultado;

-- Teste 4: Normalizar algo que não tem alias (deve retornar normalizado)
SELECT normalize_topic('xyz123') as resultado;

-- Teste 5: Ver todos os aliases cadastrados
SELECT canonical_topic, aliases FROM topic_aliases ORDER BY canonical_topic;

-- Teste 6: Verificar se artigos têm matched_topics correto
SELECT id, topic, matched_topics FROM articles WHERE topic = 'masters of the universe' LIMIT 5;
