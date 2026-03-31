# 🎬 Horror Test Suite — Teste Isolado de Clustering

## O que é?
Um script **isolado** para testar apenas notícias de **horror** e validar se o clustering **SMART** está funcionando:

**A Regra de Ouro do Lophos:**
- ✅ **AGRUPA**: Dread Central + Nightmare Magazine sobre "Fall 2 Trailer" = 1 artigo (MESMO EVENTO/FILME)
- ✅ **AGRUPA**: Múltiplas fontes falando do mesmo diretor, ator, franquia
- ❌ **NÃO AGRUPA**: Dread Central sobre "Fall 2" + Nightmare sobre "Terrifier 3" (ASSUNTOS DIFERENTES)
- ❌ **NÃO AGRUPA**: Super Mario + Cape Fear (franquias completamente diferentes)

**Princípio**: Lophos é AGREGADOR (mesma entidade/assunto = 1 artigo rico), não repetidor

## Como Executar

### 1️⃣ Simulação (DRY RUN — sem salvar)
```bash
DRY_RUN=true node scripts/process-horror.mjs
```

**O que vai fazer:**
- Processa apenas `topic="horror"`
- Mostra o que SERIA feito (sem salvar no BD)
- Logs detalhados de cada etapa
- Ideal para validar clustering antes de live

**Esperado (Exemplo CORRETO):**
```
🎬 HORROR TEST SUITE — Teste Isolado de Clustering
Mode: 🟡 DRY RUN (simula)
Batch: 10 items | Topic: horror | Delay: 500ms

[horror] ✓ Clustering: 8 itens → 3 clusters
[horror] Cluster 1/3: Processando 2 fontes relacionadas (MESMO FILME)...
  ✓ "Fall 2 Trailer Lançado" (Dread Central + Nightmare Magazine) → 1 artigo ✅

[horror] Cluster 2/3: Processando 1 fonte (FILME DIFERENTE)...
  ✓ "Terrifier 3 Review" (Nightmare Magazine isolada) → 1 artigo ✅

[horror] Cluster 3/3: Processando 1 fonte (ASSUNTO DIFERENTE)...
  ✓ "New Horror Director Announcement" (Dread Central) → 1 artigo ✅

[horror] 📦 3 artigos novos para salvar:
  1. "Fall 2 Trailer Lançado" (2 fontes, image: https://...)
  2. "Terrifier 3 Review" (1 fonte, image: https://...)
  3. "New Horror Director Announcement" (1 fonte, image: https://...)

[horror] 🟡 DRY RUN: SIM marcaria 4 IDs como processed=true
```

**A diferença**:
- ❌ ERRADO: 8 itens → 5-8 clusters (cada fonte isolada)
- ✅ CORRETO: 8 itens → 2-3 clusters (mesmos assuntos agrupados)

### 2️⃣ Live (Salva no BD)
```bash
node scripts/process-horror.mjs
```

**O que vai fazer:**
- Processa apenas `topic="horror"`
- **SALVA artigos novos** no `articles` table
- **MARCA raw_items como processados** (processed=true)
- Merges com artigos existentes se houver duplicatas

## Validação de Sucesso

### ✅ Clustering está SMART (correto):
- [ ] **Dread Central + Nightmare Magazine sobre "Fall 2"** = 1 artigo (MESMO FILME)
- [ ] **Dread Central sobre "Fall 2" + Nightmare sobre "Terrifier 3"** = 2 artigos (FILMES DIFERENTES)
- [ ] **Super Mario + Cape Fear** = NUNCA agrupa (franquias completamente distintas)
- [ ] Nenhum horror agrupado com non-horror (sci-fi, gaming, etc)
- [ ] A entidade/assunto é identificada corretamente (o filme, o diretor, a franquia)

### ✅ Imagens estão INDIVIDUAIS:
- [ ] Cada artigo tem imagem diferente (não reutilizada)
- [ ] Console mostra qual domínio forneceu cada imagem
- [ ] Se faltar, usa placeholder (não descarta artigo)

### ✅ Source IDs estão CAPTURADOS:
- [ ] Cada artigo tem `source_ids` com UUIDs reais
- [ ] Log mostra "✓ N items marcados como processados"
- [ ] Nenhum "source_ids inválido" warning

## Configurações Teste

No script `process-horror.mjs`:
```javascript
const BATCH_SIZE = 10           // 🧪 Pequeno para teste
const TEST_TOPIC = 'horror'     // 🎬 Filtro: apenas horror
const DRY_RUN = false           // 🟡 Mude para true para simular
```

## Próximos Passos Após Validação

### ✅ Se tudo passou:
```bash
# Processa todos os tópicos com novo clustering
node scripts/process-news.mjs
```

### ❌ Se encontrou problemas:
1. Verificar logs detalhados no DRY_RUN
2. Usar `diagnose-bad-clusters.mjs` para encontrar mishmashes
3. Usar `reset-burned-ids.mjs` para resetar IDs queimados

## Dicas

- **Primeiro sempre rode DRY_RUN**: `DRY_RUN=true node scripts/process-horror.mjs`
- **Verifique o Supabase**: Após live, veja a tabela `articles` se novos registros apareceram
- **Check logs**: Se houver erro na IA, verá "⚠️ Erro na IA" nos logs
- **Timeout**: Se demorar muito, verifique rate limit do Gemini (4K RPM)

---

**Objetivo**: Validar que qualidade > volume. 100 artigos horror corretos > 10 agrupamentos errados!
