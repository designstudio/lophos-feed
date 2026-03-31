# 🎬 Horror Test Suite — Teste Isolado de Clustering

## O que é?
Um script **isolado** para testar apenas notícias de **horror** e validar se o clustering rígido está funcionando:
- ✅ Super Mario ≠ Horror (não agrupa)
- ✅ Dread Central + Nightmare Magazine = OK (mesmo tema)
- ✅ Detecta mishmashes em tempo real

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

**Esperado:**
```
🎬 HORROR TEST SUITE — Teste Isolado de Clustering
Mode: 🟡 DRY RUN (simula)
Batch: 10 items | Topic: horror | Delay: 500ms

[horror] ✓ Clustering: 8 itens → 5 clusters
[horror] Cluster 1/5: Processando 2 fontes relacionadas...
  ✓ "Dread Central Lança Série" → 1 artigo ✅
  ✓ "Nightmare Magazine Resenha" → 1 artigo ✅

[horror] 📦 2 artigos novos para salvar:
  1. "Dread Central Lança Série" (2 fontes, image: https://...)
  2. "Nightmare Magazine Resenha" (1 fonte, image: https://...)

[horror] 🟡 DRY RUN: SIM marcaria 3 IDs como processed=true
```

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

### ✅ Clustering está RÍGIDO (correto):
- [ ] Dread Central artigos agrupam juntos
- [ ] Nightmare Magazine artigos agrupam juntos
- [ ] MAS Dread Central ≠ Nightmare Magazine (articleseparados)
- [ ] Nenhum horror agrupado com non-horror (sci-fi, gaming, etc)

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
