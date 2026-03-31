# ✅ VERIFICAÇÃO COMPLETA DE AJUSTES: process-news.mjs vs process-horror.mjs

**Status:** Ambos arquivos agora estão SINCRONIZADOS ✅

---

## 1️⃣ CLUSTERING PROMPT (Regra de Ouro)

### process-horror.mjs (REFERÊNCIA)
```javascript
// Linhas 85-108
const clusterPrompt = `
🚨 CLUSTERING RÍGIDO (QUALIDADE MÁXIMA):
Agrupe APENAS notícias que tratam do EXATO mesmo assunto/evento/franquia.

🏆 REGRA DE OURO DO LOPHOS:
Agrupe por ENTIDADE/ASSUNTO, não por domínio da fonte.

REGRAS:
1. **MESMO ASSUNTO = AGRUPA**: Dread Central + Nightmare Magazine sobre "Fall 2 Trailer" = [[1,2]]
2. **ASSUNTOS DIFERENTES = SEPARA**: Dread Central sobre "Fall 2" + Nightmare sobre "Terrifier 3" = [[1], [2]]
3. **Franquias Completamente Diferentes = NUNCA**: Super Mario ≠ Cape Fear = [[1], [2]]
4. **Na Dúvida, AGRUPE por Assunto**: Se 2+ fontes falam do mesmo filme/diretor/evento = 1 cluster

EXEMPLO ERRADO ❌: [[1,2,3]] onde 1=Fall 2, 2=Terrifier 3, 3=Another Movie (3 filmes!)
EXEMPLO CORRETO ✅: [[1,2], [3], [4]] onde 1,2=Fall 2 (AGRUPA), 3=Terrifier 3, 4=outro filme
```

### process-news.mjs (AGORA CORRIGIDO)
```javascript
// Linhas 88-111
const clusterPrompt = `
🚨 CLUSTERING RÍGIDO (QUALIDADE MÁXIMA):
Agrupe APENAS notícias que tratam do EXATO mesmo assunto/evento/franquia.

🏆 REGRA DE OURO DO LOPHOS:
Agrupe por ENTIDADE/ASSUNTO, não por domínio da fonte.

REGRAS:
1. **MESMO ASSUNTO = AGRUPA**: Múltiplas fontes sobre o mesmo produto/filme/evento = [[1,2,3]]
2. **ASSUNTOS DIFERENTES = SEPARA**: Fonte A sobre "iPhone 16" + Fonte B sobre "Galaxy S25" = [[1], [2]]
3. **Franquias Completamente Diferentes = NUNCA**: Super Mario ≠ Cape Fear = [[1], [2]]
4. **Na Dúvida, AGRUPE por Assunto**: Se 2+ fontes falam do mesmo filme/diretor/produto/evento = 1 cluster

EXEMPLO ERRADO ❌: [[1,2,3]] onde 1=iPhone 16, 2=Galaxy S25, 3=Pixel 9 (3 marcas/produtos!)
EXEMPLO CORRETO ✅: [[1,2], [3], [4]] onde 1,2=iPhone 16 (AGRUPA), 3=Galaxy S25, 4=outro
```

✅ **STATUS:** IDÊNTICO (com exemplos adaptados para news)

---

## 2️⃣ SOURCES ARRAY BUILDING (Buscar por UUID via rawItemsMap)

### process-horror.mjs (Linhas 379-393)
```javascript
const sources = articleSourceIds
  .map(uuid => {
    const rawItem = rawItemsMap.get(uuid)
    if (!rawItem?.url) {
      console.warn(`[${topic}] ⚠️  UUID ${uuid.substring(0, 8)}... sem URL no raw_items`)
      return null
    }
    return {
      name: new URL(rawItem.url).hostname.replace('www.', ''),
      url: rawItem.url,
      favicon: `https://www.google.com/s2/favicons?domain=${rawItem.url}&sz=32`,
    }
  })
  .filter(Boolean)
```

### process-news.mjs (Linhas 383-396)
```javascript
const sources = articleSourceIds
  .map(uuid => {
    const rawItem = rawItemsMap.get(uuid)
    if (!rawItem?.url) {
      console.warn(`[${topic}] ⚠️  UUID ${uuid.substring(0, 8)}... sem URL no raw_items`)
      return null
    }
    return {
      name: new URL(rawItem.url).hostname.replace('www.', ''),
      url: rawItem.url,
      favicon: `https://www.google.com/s2/favicons?domain=${rawItem.url}&sz=32`,
    }
  })
  .filter(Boolean)
```

✅ **STATUS:** IDÊNTICO

---

## 3️⃣ IMAGE EXTRACTION PER-SOURCE (Variáveis locais no loop)

### process-horror.mjs (Linhas 355-377)
```javascript
// ✅ EXTRAÇÃO DE IMAGEM PER-SOURCE: Buscar de cada fonte específica
let imageUrl = null           // VARIÁVEL DENTRO DO LOOP
let imageSource = null
let imageSourceDomain = null

for (const idx of sourceIndexes) {
  if (idx < 0 || idx >= clusterItems.length) continue
  const candidate = clusterItems[idx]?.image
  if (candidate && !isLazyLoadImage(candidate)) {
    imageUrl = candidate
    imageSource = clusterItems[idx].url
    imageSourceDomain = new URL(imageSource).hostname.replace('www.', '')
    break
  }
}

if (!imageUrl) {
  imageUrl = `https://via.placeholder.com/1200x630?text=${encodeURIComponent(item.title?.slice(0, 30) || 'Lophos News')}`
  console.warn(`[${topic}] 📸 Placeholder — ${item.title?.slice(0, 50)}`)
}
```

### process-news.mjs (Linhas 358-380)
```javascript
// ✅ EXTRAÇÃO DE IMAGEM PER-SOURCE: Buscar de cada fonte específica
let imageUrl = null           // VARIÁVEL DENTRO DO LOOP
let imageSource = null
let imageSourceDomain = null

for (const idx of sourceIndexes) {
  if (idx < 0 || idx >= clusterItems.length) continue
  const candidate = clusterItems[idx]?.image
  if (candidate && !isLazyLoadImage(candidate)) {
    imageUrl = candidate
    imageSource = clusterItems[idx].url
    imageSourceDomain = new URL(imageSource).hostname.replace('www.', '')
    break
  }
}

if (!imageUrl) {
  imageUrl = `https://via.placeholder.com/1200x630?text=${encodeURIComponent(item.title?.slice(0, 30) || 'Lophos News')}`
  console.warn(`[${topic}] 📸 Placeholder — ${item.title?.slice(0, 50)}`)
}
```

✅ **STATUS:** IDÊNTICO

---

## 4️⃣ SOURCEINDEXES ROBUST MAPPING (com fallback inteligente)

### process-horror.mjs (Linhas 315-353)
```javascript
// ✅ ISOLAMENTO DE LOOP: Variáveis locais resetadas a cada iteração
const sourceIndexes = item.sourceIndexes.map(n => n - 1) // Converter 1-base → 0-based

// 🔧 LÓGICA ROBUSTA: Mapeamento com fallback inteligente
let articleSourceIds = []

if (clusterSourceIds.length === 1) {
  // ✅ SINGLE SOURCE: Força usar esse UUID, ignora índice da IA
  articleSourceIds = [clusterSourceIds[0]]
  console.log(`[${topic}] 🔗 Single source: forçando ${clusterSourceIds[0]}`)
} else {
  // ✅ MULTI-SOURCE: Valida índices e mapeia corretamente
  articleSourceIds = sourceIndexes
    .filter(idx => idx >= 0 && idx < clusterSourceIds.length)
    .map(idx => clusterSourceIds[idx])
    .filter(Boolean)

  // 🐛 DEBUG LOG: Mostrar mismatch se houver
  if (articleSourceIds.length !== sourceIndexes.length) {
    const iaRetornou = item.sourceIndexes.join(', ')
    const clusterUUIDs = clusterSourceIds.map(id => id.substring(0, 8)).join(', ')
    console.warn(`[${topic}] 🔍 DEBUG INDEX MISMATCH:`)
    console.warn(`   IA retornou sourceIndexes: [${iaRetornou}]`)
    console.warn(`   Cluster tem ${clusterSourceIds.length} fontes (UUIDs: ${clusterUUIDs}...)`)
    console.warn(`   Artigo: "${item.title?.slice(0, 50)}"`)
    console.warn(`   Mapeados: ${articleSourceIds.length}/${sourceIndexes.length} indices válidos`)
  }
}

if (articleSourceIds.length === 0) {
  const iaRetornou = item.sourceIndexes.join(', ')
  const clusterUUIDs = clusterSourceIds.map(id => id.substring(0, 8)).join(', ')
  console.error(`[${topic}] ❌ ERRO: Nenhum source_id válido mapeado!`)
  console.error(`   Artigo: "${item.title?.slice(0, 50)}"`)
  console.error(`   IA retornou sourceIndexes: [${iaRetornou}]`)
  console.error(`   Cluster tem ${clusterSourceIds.length} fontes: [${clusterUUIDs}...]`)
  console.error(`   Causa provável: índices fora do range ou mismatch`)
  continue
}
```

### process-news.mjs (Linhas 318-356)
```javascript
// ✅ ISOLAMENTO DE LOOP: Variáveis locais resetadas a cada iteração
const sourceIndexes = item.sourceIndexes.map(n => n - 1) // Converter 1-base → 0-based

// 🔧 LÓGICA ROBUSTA: Mapeamento com fallback inteligente
let articleSourceIds = []

if (clusterSourceIds.length === 1) {
  // ✅ SINGLE SOURCE: Força usar esse UUID, ignora índice da IA
  articleSourceIds = [clusterSourceIds[0]]
  console.log(`[${topic}] 🔗 Single source: forçando ${clusterSourceIds[0]}`)
} else {
  // ✅ MULTI-SOURCE: Valida índices e mapeia corretamente
  articleSourceIds = sourceIndexes
    .filter(idx => idx >= 0 && idx < clusterSourceIds.length)
    .map(idx => clusterSourceIds[idx])
    .filter(Boolean)

  // 🐛 DEBUG LOG: Mostrar mismatch se houver
  if (articleSourceIds.length !== sourceIndexes.length) {
    const iaRetornou = item.sourceIndexes.join(', ')
    const clusterUUIDs = clusterSourceIds.map(id => id.substring(0, 8)).join(', ')
    console.warn(`[${topic}] 🔍 DEBUG INDEX MISMATCH:`)
    console.warn(`   IA retornou sourceIndexes: [${iaRetornou}]`)
    console.warn(`   Cluster tem ${clusterSourceIds.length} fontes (UUIDs: ${clusterUUIDs}...)`)
    console.warn(`   Artigo: "${item.title?.slice(0, 50)}"`)
    console.warn(`   Mapeados: ${articleSourceIds.length}/${sourceIndexes.length} indices válidos`)
  }
}

if (articleSourceIds.length === 0) {
  const iaRetornou = item.sourceIndexes.join(', ')
  const clusterUUIDs = clusterSourceIds.map(id => id.substring(0, 8)).join(', ')
  console.error(`[${topic}] ❌ ERRO: Nenhum source_id válido mapeado!`)
  console.error(`   Artigo: "${item.title?.slice(0, 50)}"`)
  console.error(`   IA retornou sourceIndexes: [${iaRetornou}]`)
  console.error(`   Cluster tem ${clusterSourceIds.length} fontes: [${clusterUUIDs}...]`)
  console.error(`   Causa provável: índices fora do range ou mismatch`)
  continue
}
```

✅ **STATUS:** IDÊNTICO

---

## 5️⃣ FAILSAFE VALIDATION (Rejeita artigos com zero fontes)

### process-horror.mjs (Linhas 593-658)
```javascript
// ✅ INJEÇÃO OBRIGATÓRIA + FAILSAFE: Validar antes de salvar
const validArticles = []
const invalidArticles = []

for (const item of dedupedItems) {
  // FAILSAFE: Artigo DEVE ter fontes
  if (!Array.isArray(item.source_ids) || item.source_ids.length === 0) {
    console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com ZERO fontes! "${item.title?.slice(0, 50)}"`)
    console.error(`   source_ids: ${item.source_ids}`)
    console.error(`   sources: ${item.sources?.length || 0} fontes`)
    invalidArticles.push(item)
    continue
  }

  if (!Array.isArray(item.sources) || item.sources.length === 0) {
    console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com array sources vazio! "${item.title?.slice(0, 50)}"`)
    console.error(`   source_ids: ${item.source_ids.join(', ')}`)
    invalidArticles.push(item)
    continue
  }

  // ✅ PASSOU: Artigo tem fontes
  validArticles.push(item)
}

// Salvar APENAS artigos válidos
if (validArticles.length > 0) {
  // 📋 LOG DE AUDITORIA: Mostra IDs ANTES de salvar
  console.log(`[${topic}] 📦 Gravando no BD: ${validArticles.length} artigos`)
  validArticles.forEach((item, i) => {
    const sourceIdStr = item.source_ids.map(id => id.substring(0, 8)).join(', ')
    console.log(`   ${i + 1}. "${item.title?.slice(0, 60)}" | Fontes: [${sourceIdStr}...]`)
  })

  let saveError = null
  if (!DRY_RUN) {
    const result = await db.from('articles').upsert(
      validArticles,
      { onConflict: 'id' }
    )
    saveError = result.error
  }

  if (saveError) {
    console.error(`[${topic}] ⚠️  Save error: ${saveError.message}. ${validArticles.length} items não marcados como processados.`)
  } else {
    // ... marca como processado
  }
}
```

### process-news.mjs (Linhas 585-644)
```javascript
// ✅ INJEÇÃO OBRIGATÓRIA + FAILSAFE: Validar antes de salvar
const validArticles = []
const invalidArticles = []

for (const item of dedupedItems) {
  // FAILSAFE: Artigo DEVE ter fontes
  if (!Array.isArray(item.source_ids) || item.source_ids.length === 0) {
    console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com ZERO fontes! "${item.title?.slice(0, 50)}"`)
    console.error(`   source_ids: ${item.source_ids}`)
    console.error(`   sources: ${item.sources?.length || 0} fontes`)
    invalidArticles.push(item)
    continue
  }

  if (!Array.isArray(item.sources) || item.sources.length === 0) {
    console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com array sources vazio! "${item.title?.slice(0, 50)}"`)
    console.error(`   source_ids: ${item.source_ids.join(', ')}`)
    invalidArticles.push(item)
    continue
  }

  // ✅ PASSOU: Artigo tem fontes
  validArticles.push(item)
}

// Salvar APENAS artigos válidos
if (validArticles.length > 0) {
  // 📋 LOG DE AUDITORIA: Mostra IDs ANTES de salvar
  console.log(`[${topic}] 📦 Gravando no BD: ${validArticles.length} artigos`)
  validArticles.forEach((item, i) => {
    const sourceIdStr = item.source_ids.map(id => id.substring(0, 8)).join(', ')
    console.log(`   ${i + 1}. "${item.title?.slice(0, 60)}" | Fontes: [${sourceIdStr}...]`)
  })

  const { error: saveError } = await db.from('articles').upsert(
    validArticles,
    { onConflict: 'id' }
  )

  if (saveError) {
    console.error(`[${topic}] ⚠️  Save error: ${saveError.message}. ${validArticles.length} items não serão marcados como processados.`)
  } else {
    // ... marca como processado
  }
}
```

✅ **STATUS:** IDÊNTICO (news não usa DRY_RUN, mas lógica é igual)

---

## 📊 RESUMO FINAL

| Ajuste | process-horror.mjs | process-news.mjs | Status |
|--------|-------------------|------------------|--------|
| Clustering Prompt (Regra de Ouro) | ✅ | ✅ | SINCRONIZADO |
| Sources Array Building | ✅ | ✅ | SINCRONIZADO |
| Image Extraction (variáveis locais) | ✅ | ✅ | SINCRONIZADO |
| SourceIndexes Robust Mapping | ✅ | ✅ | SINCRONIZADO |
| Failsafe Validation | ✅ | ✅ | SINCRONIZADO |

---

## 🎯 PRÓXIMO PASSO

Pronto! Ambos arquivos estão agora **completamente sincronizados** com todos os ajustes críticos:

1. ✅ **Clustering por ENTIDADE/ASSUNTO** (não por domínio)
2. ✅ **Sources construídos a partir de articleSourceIds** (via rawItemsMap)
3. ✅ **Image diversity** (variáveis resetadas per-loop)
4. ✅ **Robust index mapping** (com debug logs)
5. ✅ **Failsafe validation** (rejeita zero-fontes)

Você pode disparar o workflow de **Process News** com confiança! 🚀

---

*Gerado em: 2026-03-31*
