# Plano de execução: pré-processamento antes do Gemini

## O que já foi encaminhado

- Centralizei regras básicas de limpeza e preparo em `src/lib/news-preprocessing.ts`.
- A ingestão RSS passou a usar os helpers compartilhados.
- O fluxo administrativo de conversão de itens brutos para artigos também passou a usar a mesma base.

## O que isso significa

- As regras de preparação ficam mais consistentes.
- A base fica pronta para receber uma etapa separada de pré-processamento na VPS.
- O Gemini continua existindo, mas a ideia é ir deixando ele só para síntese final.

## O que você precisa fazer agora

1. **Publicar esta versão**
   - Se seu deploy principal for Vercel, faça o deploy normal.
   - Se o deploy for pela Contabo/Coolify, faça um redeploy da aplicação.

2. **Conferir as variáveis de ambiente**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RSS_INGEST_SECRET`
   - `CRON_SECRET`
   - `GEMINI_API_KEY`

3. **Verificar as tabelas no Supabase**
   - `rss_feeds`
   - `raw_items`
   - `articles`
   - `topic_fetches`

4. **Rodar um teste simples**
   - Acionar a ingestão RSS.
   - Confirmar que os itens continuam entrando.
   - Confirmar que os artigos continuam aparecendo.

5. **Depois disso, fazer a próxima etapa**
   - Criar um worker dedicado na VPS para limpar e agrupar os itens antes do Gemini.
   - Só então mandar para o Gemini a versão já filtrada e agrupada.

## Como saber se está certo

- Os feeds continuam carregando.
- Os artigos continuam sendo publicados.
- O número de duplicatas óbvias tende a cair.
- Os filtros de conteúdo ruim continuam funcionando.

## Próximo passo recomendado

- Eu seguiria com a criação do worker na Contabo e a separação formal em etapas:
  - ingestão
  - limpeza
  - deduplicação
  - agrupamento
  - síntese com Gemini
