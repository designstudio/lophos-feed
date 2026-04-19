# Plano de execucao: pre-processamento antes do Mistral

## O que ja foi encaminhado

- Centralizei regras basicas de limpeza e preparo em `src/lib/news-preprocessing.ts`.
- A ingestao RSS passou a usar os helpers compartilhados.
- O fluxo administrativo de conversao de itens brutos para artigos tambem passou a usar a mesma base.
- Criei um preflight deterministico em `scripts/news-preflight.mjs` para rodar antes do Mistral.

## O que isso significa

- As regras de preparacao ficam mais consistentes.
- A base fica pronta para receber uma etapa separada de pre-processamento na VPS.
- O Mistral continua existindo, mas a ideia e deixar ele so para sintese final.

## O que voce precisa fazer agora

1. **Publicar esta versao**
   - Se seu deploy principal for Vercel, faca o deploy normal.
   - Se o deploy for pela Contabo/Coolify, faca um redeploy da aplicacao.

2. **Conferir as variaveis de ambiente**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RSS_INGEST_SECRET`
   - `CRON_SECRET`
   - `MISTRAL_API_KEY`

3. **Verificar as tabelas no Supabase**
   - `rss_feeds`
   - `raw_items`
   - `articles`
   - `topic_fetches`

4. **Rodar os testes simples**
   - Acionar a ingestao RSS.
   - Rodar `npm run news:preflight`.
   - Confirmar que os itens continuam entrando.
   - Confirmar que os artigos continuam aparecendo depois do Process News.

5. **Depois disso, fazer a proxima etapa**
   - Criar um worker dedicado na VPS para limpar e agrupar os itens antes do Mistral.
   - So entao mandar para o Mistral a versao ja filtrada e agrupada.

## Como saber se esta certo

- Os feeds continuam carregando.
- Os artigos continuam sendo publicados.
- O numero de duplicatas obvias tende a cair.
- Os filtros de conteudo ruim continuam funcionando.
- O preflight mostra exatamente o lote pronto para o Mistral.

## Proximo passo recomendado

- Eu seguiria com a criacao do worker na Contabo e a separacao formal em etapas:
  - ingestao
  - limpeza
  - deduplicacao
  - agrupamento
  - sintese com Mistral
