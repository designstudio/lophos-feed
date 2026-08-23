import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

const RELEASES = [
  {
    date: '22 ago 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'O catálogo de listas agora permite curtir, descurtir ou indicar que um conteúdo não interessa tanto na visualização em mosaico quanto na visualização em lista.',
          'As reações salvas das listas já chegam preenchidas na primeira exibição da página, sem atraso visual após o carregamento.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Simplificamos o autocomplete de tópicos para priorizar termos abrangentes e manter sugestões compostas relevantes, funcionando de forma consistente para qualquer tema pesquisado.',
          'Reservamos o espaço das imagens antes do carregamento para reduzir saltos de conteúdo em artigos e listas editoriais.',
          'A sidebar de criação de listas agora usa um fade discreto para indicar quando ainda existe conteúdo acima ou abaixo da área visível.',
          'Refinamos o feedback de pressão dos botões de configurações, preservando as reações que já usavam uma animação mais intensa.',
          'Ajustamos quebras de texto no mosaico e a geometria de cantos aninhados em menus e seletores para deixar a leitura e o acabamento mais consistentes.',
        ],
      },
    ],
  },
  {
    date: '21 ago 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'A página inicial agora abre diretamente o feed público, permitindo acompanhar todas as notícias e listas editoriais mesmo sem uma conta ou personalização ativa.',
          'Visitantes podem explorar o conteúdo livremente e recebem um convite de login ou cadastro apenas ao tentar curtir ou personalizar o feed.',
          'O editor de listas ganhou mais opções de formatação, incluindo sublinhado, tachado, listas com marcadores, listas numeradas e citações.',
          'A edição de links agora acontece na sidebar do editor, com validação do endereço, inclusão automática de HTTPS e ações para atualizar ou remover o link.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Redesenhamos as experiências de login e cadastro com textos consistentes, formulário responsivo, campo de e-mail com efeito líquido, autenticação pelo Google e mensagens de erro no padrão de notificações do Lophos.',
          'A navegação para visitantes agora apresenta os atalhos institucionais e a ação de login, oculta áreas exclusivas da conta e usa um ícone de usuário consistente quando não há perfil identificado.',
          'Reorganizamos a barra de formatação com ícones mais claros, grupos de ações, controles circulares e o mesmo acabamento visual usado no restante do Lophos.',
          'A barra de formatação permanece acessível durante a rolagem e usa uma transição discreta ao fixar ou retornar à posição original, respeitando a preferência por movimento reduzido.',
          'Simplificamos o cabeçalho do editor para manter o fundo branco e preservar uma leitura mais limpa, sem efeitos visuais sobre o conteúdo.',
        ],
      },
    ],
  },
  {
    date: '20 ago 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Lançamos as listas editoriais, com catálogo próprio, páginas públicas e uma experiência de leitura consistente com os artigos do Lophos.',
          'O novo editor de listas permite criar, pré-visualizar, salvar rascunhos e publicar conteúdos com imagens, créditos, texto alternativo, tópicos e informações de SEO.',
          'As listas agora podem aparecer em destaque entre as notícias do feed quando combinam com os interesses do usuário, usando um carrossel de imagens e identificação editorial própria.',
          'Listas curtidas também passam a aparecer nos favoritos, junto aos artigos salvos.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Refinamos o painel administrativo de listas com carregamento unificado, títulos dinâmicos, filtros, ícones de categoria, notificações e exclusão permanente com confirmação.',
          'Padronizamos tipografia, espaçamentos, ações, créditos de imagens, zoom e compartilhamento das listas com a experiência já usada nas páginas de artigos.',
          'O endereço de uma lista agora se torna permanente após a primeira publicação, preservando links compartilhados e o histórico de indexação mesmo quando o título é alterado.',
          'Corrigimos o carregamento contínuo do feed quando o cache local atinge seu limite, evitando espaços vazios e indicadores de carregamento que não terminavam em produção.',
          'Revisamos as transições do feed, das listas, dos tooltips, dos avisos e dos painéis para limitar atrasos, tornar entradas e saídas mais naturais e respeitar a preferência por movimento reduzido.',
          'O agrupamento de notícias v2 passou a ser o padrão do preflight, clustering e processamento, com fluxo manual pelo Gemma e suporte à exclusão de tópicos.',
          'A distribuição das listas no feed prioriza conteúdos recentes e relevantes, mantendo intervalos entre artigos e permitindo que uma lista volte a aparecer quando continuar alinhada aos interesses do usuário.',
        ],
      },
    ],
  },
  {
    date: '19 ago 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Agora é possível reportar informações incorretas, problemas em títulos, fontes, mídias ou matérias duplicadas diretamente pela página da notícia; o relato chega por e-mail à equipe editorial.',
          'Esports agora aparece entre os tópicos sugeridos, com ícone próprio e suporte às notícias dos novos feeds especializados.',
          'Adicionamos um diagnóstico de saúde dos feeds para identificar fontes inativas, erros de leitura, itens pendentes e a contribuição mais recente de cada publicação.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Corrigimos a abertura de matérias com novas tentativas em falhas temporárias e feedback visual imediato durante a navegação.',
          'Eliminamos trocas entre skeletons de lista e mosaico no carregamento do feed, bloqueamos interações com cards invisíveis e ajustamos tooltips que permaneciam abertos após trocar de aba.',
          'A visualização em mosaico agora recupera o ponto de leitura ao voltar de uma matéria, mantendo sua posição separada da visualização em lista.',
          'Reforçamos a deduplicação retroativa com proteções semânticas e editoriais para revisar artigos repetidos sem remover análises, críticas ou compilações legítimas.',
          'O processamento manual de notícias agora pode ser limitado a uma única fonte, facilitando testes, correções e reprocessamentos pontuais.',
          'Reforçamos a leitura de RSS com novas tentativas automáticas e cabeçalhos mais compatíveis para fontes que bloqueiam acessos de forma intermitente.',
          'Atualizamos o feed de ciência do G1, ampliamos a cobertura de esports e removemos fontes que deixaram de contribuir com notícias.',
        ],
      },
    ],
  },
  {
    date: '18 ago 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'O feed ganhou modos de visualização em lista e mosaico, permitindo escolher como acompanhar as notícias sem perder a personalização.',
          'Adicionamos paginação contínua e um aviso de novas publicações, deixando a atualização do feed mais previsível sem interromper a leitura.',
          'Os tópicos ganharam ícones próprios para franquias, premiações e jogos — como Oscar, Harry Potter, Valorant, League of Legends, Counter-Strike, Fortnite e outros — facilitando a identificação visual no feed.',
          'As configurações agora oferecem tópicos sugeridos com ícones e autocomplete para adicionar interesses ou exclusões com mais segurança.',
          'Evoluímos a curadoria editorial com novas etapas de preflight, agrupamento e revisão assistida por IA para produzir artigos mais consistentes e reunir melhor as fontes relacionadas.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Refinamos cards, sidebars, menus, tópicos, widgets e navegação mobile para melhorar hierarquia visual, responsividade e estabilidade durante o uso.',
          'As páginas de feed, favoritos, artigos, configurações e threads agora apresentam estados de carregamento mais consistentes e transições mais suaves.',
          'Padronizamos a aparência dos campos, a capitalização dos tópicos e os textos das ações de curtir em todo o produto.',
          'Curtir e descurtir dentro de uma notícia agora responde imediatamente, mantendo a sincronização em segundo plano sem bloquear os botões.',
          'Ajustamos a personalização para que categorias padrão consultem o tópico editorial e interesses personalizados consultem os tópicos relacionados de cada artigo.',
          'Melhoramos a restauração do cache e o carregamento incremental do feed, reduzindo telas vazias, saltos de conteúdo e trabalho desnecessário no servidor.',
          'Reforçamos a deduplicação e o processamento em lotes para evitar falhas quando o volume de notícias ou de fontes cresce.',
        ],
      },
      {
        title: 'Confiabilidade',
        items: [
          'Criamos uma política de retenção que compacta itens processados após 15 dias e remove dados antigos após 60 dias, preservando o histórico necessário para evitar reingestões.',
          'Otimizamos a imagem de produção e o processo de deploy para reduzir operações pesadas e tornar futuras publicações mais rápidas e estáveis.',
        ],
      },
    ],
  },
  {
    date: '20 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'A sidebar ganhou um ajuste fino no bloco de Histórico, ocupando melhor o espaço disponível sem mexer no restante da navegação.',
          'O feed passou a aprender sinais negativos a partir das reações, ajudando a reduzir repetições e a refinar as recomendações relacionadas.',
          'A ingestão e o image proxy de RSS ficaram mais rígidos, reduzindo ruído e bloqueando imagens problemáticas com mais consistência.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Removemos o Gemini do pipeline de notícias e consolidamos a operação em Mistral, com scripts e cron mais previsíveis dentro do container.',
          'Corrigimos o mapeamento de tópicos do Game Rant para preservar a classificação correta das matérias.',
          'Ajustamos o comportamento da sidebar ao alternar o menu para evitar efeitos colaterais visuais.',
        ],
      },
    ],
  },
  {
    date: '14 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Reestruturamos o pipeline de notícias para rodar na VPS com cron a cada 6 horas, separando ingestão, preflight, clustering e o passo com IA em comandos explícitos.',
          'Passamos a persistir execuções de preflight e cluster no Supabase, com detecção semântica de duplicatas e reaproveitamento de fontes relacionadas no artigo final.',
          'Criamos ferramentas de limpeza retroativa para duplicatas gerais e para casos específicos, como franquias de cinema e games que vinham escapando da deduplicação.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Corrigimos o middleware do Clerk para cobrir as rotas de API e destravar o feed, os tópicos, as reações e as threads sem erros 500.',
          'Ajustamos a hidratação do app shell e o estado de carregamento do feed para evitar travamentos visuais e banners presos na tela.',
          'Removemos os fluxos legados do GitHub Actions e consolidamos o processamento em scripts claros para operação manual e agendamento externo.',
        ],
      },
    ],
  },
  {
    date: '9 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Preparamos o projeto para rodar com mais conforto em Docker e Coolify, com suporte melhor a dependências opcionais e imagem de produção mais enxuta.',
          'Organizamos o processamento de notícias em etapas mais previsíveis para facilitar execução local e futura automação na VPS.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Corrigimos o build em ambientes que precisavam instalar dependências opcionais do frontend, como a sidebar fixa.',
          'Reduzimos custo e latência do feed com cache melhor ajustado e limites de duração mais seguros para rotas mais pesadas.',
          'Removemos caminhos legados de processamento que já não faziam parte do fluxo ativo.',
        ],
      },
    ],
  },
  {
    date: '8 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Refinamos a experiência mobile e PWA com ajustes de navegação, padding, scroll e layout para o feed, artigos e menus laterais.',
          'Melhoramos a apresentação dos cards de notícia, dos badges de portal e dos widgets laterais para ficar mais estável em telas menores.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Ajustamos o comportamento do header, da sidebar e das áreas fixas para preservar alinhamento e evitar saltos visuais.',
          'Corrigimos títulos dinâmicos, contrastes, ícones e pequenos problemas de layout que afetavam a navegação entre feed e artigos.',
          'Adicionamos cache de CDN para o image proxy, reduzindo uso de CPU no servidor.',
        ],
      },
    ],
  },
  {
    date: '7 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Adicionamos páginas institucionais de Política de Privacidade e Termos de Uso, com navegação própria e rodapé dedicado.',
          'Criamos metadados completos de compartilhamento para artigos, incluindo título, resumo, imagem e previews para Open Graph e Twitter.',
          'As threads agora têm ações direto no header para renomear ou excluir a conversa sem depender só da sidebar.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Corrigimos títulos dinâmicos das páginas de artigos e threads para melhorar contexto no navegador e compartilhamento.',
          'Ajustamos o contraste do logo do Lophos no tema escuro.',
          'Adicionamos loading e skeleton nas threads e refinamos a navegação para evitar glitches visuais.',
          'Melhoramos a renderização de listas nas respostas das threads e endurecemos a validação de perguntas sugeridas.',
          'Reforçamos o merge de notícias equivalentes com novos sinônimos editoriais.',
          'Padronizamos os badges de times nos widgets de Valorant e League of Legends para tamanho fixo e aparência circular.',
        ],
      },
    ],
  },
  {
    date: '6 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'O histórico de threads ganhou loading skeleton, renomeação inline e um menu de ações mais sólido.',
          'A sidebar colapsada passou a exibir histórico e interações com melhor contexto visual.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Substituímos vários ícones antigos por Untitled UI para deixar o sistema mais consistente.',
          'Revisamos estilos do menu do usuário, configurações, chips de tópicos e branding da sidebar.',
          'Eliminamos recarregamentos desnecessários do histórico durante navegação.',
          'Ajustamos o comportamento de scroll sobre a sidebar direita sticky para ficar mais natural.',
        ],
      },
    ],
  },
  {
    date: '5 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Lançamos o chat contextual nos artigos com threads persistentes e histórico lateral.',
          'As páginas de thread ganharam layout próprio, composição fixa e navegação integrada ao artigo de origem.',
          'Adicionamos ações de renomear e excluir diretamente no histórico de threads.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Refinamos espaçamentos, cores e comportamento do composer no chat embutido e em tela cheia.',
          'Corrigimos duplicação de mensagens, divisórias e sugestões em fluxos de conversa.',
          'Padronizamos o layout de mídia e cabeçalho nas páginas de artigo e thread.',
        ],
      },
    ],
  },
  {
    date: '4 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Adicionamos o widget de tópicos de interesse na sidebar direita e nas configurações.',
          'As notícias passaram a exibir horário de publicação com mais contexto no feed.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Bloqueamos melhor conteúdo de apostas, cupons e itens de baixa relevância na ingestão.',
          'Melhoramos o preenchimento de imagens a partir dos raw items e do RSS.',
          'Artigos marcados como sem interesse deixaram de aparecer em busca e notícias relacionadas.',
        ],
      },
    ],
  },
  {
    date: '1-3 abr 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Evoluímos a arquitetura de sticky da sidebar direita até chegar numa navegação mais estável em scroll longo.',
          'Introduzimos aliases de tópicos e normalização para melhorar como o feed entende temas parecidos.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Corrigimos vários casos de jitter, reposicionamento incorreto e desalinhamento da sidebar sticky.',
          'Melhoramos a extração de imagens em fontes com figure, picture, RSS media e anexos.',
          'Resolvemos falhas de normalização que estavam bagunçando tópicos e resultados personalizados.',
        ],
      },
    ],
  },
  {
    date: '30-31 mar 2026',
    sections: [
      {
        title: 'Novidades',
        items: [
          'Lançamos o sistema de chat do Lophos com contexto do artigo, respostas assistidas por IA e sugestões de continuidade.',
          'A curadoria de notícias ganhou clustering mais inteligente, separação por evento e rastreamento robusto de fontes.',
        ],
      },
      {
        title: 'Melhorias e correções',
        items: [
          'Reforçamos integridade transacional no processamento de notícias para evitar perda de dados.',
          'Melhoramos os prompts editoriais para reduzir respostas genéricas e misturas indevidas de assuntos.',
          'Tratamos limites de taxa, validação de sourceIndexes, batches maiores e fluxos de recuperação para pipelines com muito volume.',
        ],
      },
    ],
  },
  {
    date: '19-29 mar 2026',
    sections: [
      {
        title: 'Lançamento inicial',
        items: [
          'Nasceu o feed personalizado do Lophos com autenticação, onboarding, tópicos de interesse e curadoria de notícias.',
          'Entraram no produto os widgets da sidebar direita, incluindo clima, séries e partidas de e-sports.',
          'O app ganhou tema claro e escuro, cor de destaque personalizável, favoritos, likes e experiência SPA entre feed e artigos.',
          'Também estruturamos ingestão de notícias, deduplicação, cache, resumo editorial e melhorias progressivas de performance.',
        ],
      },
    ],
  },
] as const

export const metadata: Metadata = {
  title: 'Notas de versão - Lophos',
  description: 'Últimas atualizações, melhorias e correções do Lophos.',
}

export default function ReleaseNotesPage() {
  return (
    <LegalPage
      title="Notas de versão"
      subtitle="Últimas atualizações do Lophos"
      intro={
        <p>
          Aqui você encontra um resumo editorial das principais entregas do produto, com foco em recursos novos,
          melhorias relevantes de experiência e correções que impactam o uso do feed, dos artigos e das threads.
        </p>
      }
      currentPath="/notas-de-versao"
      unstyledContent
      contentClassName="divide-y divide-border"
    >
      {RELEASES.map((release) => (
        <section
          key={release.date}
          className="grid gap-8 py-8 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-12 md:py-10"
        >
          <div className="pt-1 text-sm font-medium text-ink-tertiary">{release.date}</div>

          <div className="space-y-8">
            {release.sections.map((section) => (
              <div key={section.title}>
                <h2 className="mb-4 font-display text-2xl text-ink-primary">{section.title}</h2>
                <ul className="list-disc space-y-3 pl-5 text-body leading-relaxed text-ink-secondary marker:text-border-strong">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </LegalPage>
  )
}
