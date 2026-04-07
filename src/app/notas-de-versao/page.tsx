import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

const RELEASES = [
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
