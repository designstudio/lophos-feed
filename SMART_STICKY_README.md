# Smart Sticky Sidebar Implementation

## Overview

Implementação de comportamento "Medium smart sticky" para a sidebar direita sem scroll interno. A sidebar fica presa ao viewport quando necessário, respeitando os limites do container.

## Como Funciona

### Hook `useSmartStickySidebar`

O hook controla a posição da sidebar através de `transform: translateY()` em vez de `position: sticky`, permitindo um controle mais preciso sobre o comportamento de sticky.

**Parâmetros:**
- `scrollerRef`: Referência ao elemento com scroll (`.flex-1.overflow-y-auto`)
- `sidebarRef`: Referência à sidebar (`.sidebar-sticky`)
- `containerRef`: Referência ao container da sidebar (`.sidebar-right`)
- `topOffset`: Offset do header (56px por padrão)

**Comportamento:**
1. **Ao rolar para baixo**: Sidebar fica presa no topo do viewport (respeitando o `topOffset`)
2. **Ao rolar para cima**: Sidebar fica presa no bottom do viewport quando necessário
3. **Limites**: Nunca ultrapassa o topo nem o fim do container

### Performance

- Usa `requestAnimationFrame` para otimizar o scroll handler
- `ResizeObserver` para recalcular alturas quando widgets carregam
- Scroll listener com `passive: true` para melhor performance

## Arquivos Modificados

### 1. `/src/hooks/useSmartStickySidebar.ts`
- Hook personalizado para controle do smart sticky
- Lógica de cálculo de `translateY` baseada em scroll position
- ResizeObserver para recalcular dimensões

### 2. `/src/components/RightSidebar.tsx`
- Import e uso do hook `useSmartStickySidebar`
- Refs para scroller, sidebar e container
- Remoção do ResizeObserver antigo

### 3. `/src/app/globals.css`
- Removido `position: sticky` da classe `.sidebar-sticky`
- Adicionado `will-change: transform` para otimização

## Como Testar

1. **Iniciar servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

2. **Acessar a página do feed:**
   - Navegar para `/feed`
   - Garantir que está em desktop (viewport >= 1024px)

3. **Testar cenários:**

   **Cenário 1 - Sidebar menor que viewport:**
   - A sidebar deve ficar presa no topo ao rolar para baixo
   - A sidebar deve ficar visível sempre que possível

   **Cenário 2 - Sidebar maior que viewport:**
   - Ao rolar para baixo, a sidebar deve começar a aparecer
   - Ao rolar para cima, o final da sidebar deve ficar visível
   - Nunca deve ultrapassar os limites do container

   **Cenário 3 - Carregamento de widgets:**
   - Quando widgets carregam (skeleton → conteúdo), a posição deve ser recalculada
   - ResizeObserver deve detectar mudanças de altura

4. **Verificar performance:**
   - Scroll deve ser suave (60fps)
   - Sem jank ou travamentos
   - Console sem erros

## Debug

### Logs Úteis

Adicione estes logs temporários para debug:

```typescript
// Em useSmartStickySidebar.ts, na função calculateTranslateY
console.log('Debug:', {
  scrollTop,
  sidebarHeight: sidebar,
  containerHeight: container,
  viewportHeight: viewport,
  translateY
})
```

### Problemas Comuns

1. **Sidebar não aparece:**
   - Verificar se `scrollerRef` está encontrando o elemento correto
   - Confirmar que `containerRef` é o `.sidebar-right`

2. **Sidebar salta:**
   - Verificar se `ResizeObserver` está funcionando
   - Confirmar que alturas estão sendo calculadas corretamente

3. **Performance ruim:**
   - Verificar se `requestAnimationFrame` está sendo usado
   - Confirmar scroll listener com `passive: true`

## Melhorias Futuras

- Adicionar suporte para mobile
- Implementar animações suaves
- Adicionar opções de configuração
- Suporte para múltiplas sidebars
