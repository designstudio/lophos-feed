# 🚨 Clustering Rescue Guide — Resgate de UUIDs Queimados

## O Problema
O Lophos estava agrupando notícias não relacionadas:
- Super Mario com Cape Fear com Fall 2
- Destruindo a credibilidade do portal

## Solução Aplicada (Commit c12ee8c)

### 1. ✅ Clustering Rígido
- **Antes**: "Agrupe agressivamente"
- **Depois**: "Nomes Próprios Idênticos" obrigatórios
- **Regra**: Na dúvida, NÃO agrupe

### 2. ✅ Lógica de Imagem (Diagnóstico)
- Detecta imagens reutilizadas entre artigos
- Console logs qual domínio forneceu cada imagem

### 3. ✅ Rejeição Interna
- Se cluster contém Mario + Cape Fear → retorna []
- Qualidade > volume

### 4. ✅ Resgate de UUIDs (Scripts)

## 📋 Passos para Resgate

### A. Identificar Artigos Problemáticos

```bash
node scripts/diagnose-bad-clusters.mjs
```

Vai retornar:
```
⚠️  PROBLEMA DETECTADO:
   Título: "Super Mario e Cape Fear Lançados"
   source_ids: ["uuid1", "uuid2", "uuid3"]
```

### B. Resetar UUIDs Queimados

**Opção 1: Individual**
```bash
node scripts/reset-burned-ids.mjs uuid1 uuid2 uuid3
```

**Opção 2: SQL Manual (Supabase Console)**
```sql
UPDATE raw_items
SET processed = false
WHERE id IN (
  'uuid1'::uuid,
  'uuid2'::uuid,
  'uuid3'::uuid
);
```

### C. Reprocessar com Script Novo

```bash
node scripts/process-news.mjs
```

Agora com clustering rígido, evita os mishmashes.

## 🔍 Como Verificar se Funcionou

1. **Antes (Errado)**:
   - Artigos com 3+ universos distintos
   - Mesmo title/summary em múltiplos artigos
   - Imagens todas iguais

2. **Depois (Correto)**:
   - Super Mario = 1 artigo (ou 0 se cluster inválido)
   - Cape Fear = 1 artigo isolado
   - Fall 2 = 1 artigo isolado
   - Imagens de domínios diferentes (com logs)

## 📊 Métricas de Sucesso

- ✅ Clustering aceita APENAS 80%+ similares
- ✅ Rejeita mishmashes automaticamente
- ✅ Volta source_ids para processed=false
- ✅ 100 artigos corretos > 10 agrupamentos errados

## ⚠️ Considerações

1. **Não é Retroativo**: Artigos já salvos com erros permanecem até você deletá-los
2. **Verificar Manualmente**: Alguns falsos positivos podem ser aceitáveis (ex: crossovers legítimos)
3. **Threshold**: Está em 80% similaridade (ajustável se necessário)

---

**Próximo passo**: Execute `diagnose-bad-clusters.mjs` para encontrar problemas reais.
