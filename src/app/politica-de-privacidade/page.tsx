import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Política de Privacidade - Lophos',
  description: 'Política de Privacidade da plataforma Lophos.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="7 de abril de 2026">
      <section>
        <p>
          Esta Política de Privacidade descreve como o Lophos trata dados pessoais relacionados ao uso da plataforma.
          O texto foi preparado considerando o funcionamento atual do produto, incluindo autenticação, personalização do
          feed, favoritos, reações, preferências locais e threads de conversa com apoio de inteligência artificial.
        </p>
      </section>

      <section>
        <h2>1. Dados que podemos tratar</h2>
        <h3>1.1 Dados de conta e autenticação</h3>
        <ul>
          <li>Nome, sobrenome, e-mail e identificadores vinculados à sua conta.</li>
          <li>Imagem de perfil, quando disponibilizada pelo seu provedor de autenticação.</li>
        </ul>

        <h3>1.2 Dados de uso dentro do produto</h3>
        <ul>
          <li>Tópicos de interesse e tópicos excluídos informados por você.</li>
          <li>Artigos favoritados e reações registradas na plataforma.</li>
          <li>Threads, mensagens e sugestões de acompanhamento geradas no chat.</li>
          <li>Preferências visuais e operacionais armazenadas localmente, como tema, cor de destaque, widgets e estado da sidebar.</li>
        </ul>

        <h3>1.3 Dados técnicos e operacionais</h3>
        <ul>
          <li>Metadados necessários para autenticação, segurança, manutenção do serviço e prevenção de abuso.</li>
          <li>Registros de erro, eventos de atualização de conteúdo e informações técnicas indispensáveis ao funcionamento da plataforma.</li>
        </ul>
      </section>

      <section>
        <h2>2. Como usamos esses dados</h2>
        <ul>
          <li>Autenticar usuários e manter a sessão da conta.</li>
          <li>Personalizar o feed de notícias com base em interesses, exclusões, favoritos e interações.</li>
          <li>Salvar histórico de threads e permitir continuidade das conversas.</li>
          <li>Gerar respostas, resumos e sugestões com suporte de provedores de inteligência artificial.</li>
          <li>Melhorar estabilidade, segurança, curadoria, deduplicação e experiência de uso do produto.</li>
          <li>Cumprir obrigações legais, regulatórias e responder a solicitações legítimas de autoridades competentes.</li>
        </ul>
      </section>

      <section>
        <h2>3. Bases legais</h2>
        <p>
          O tratamento de dados pode se apoiar, conforme o caso, em bases legais como execução de contrato ou de procedimentos
          preliminares relacionados à sua conta, legítimo interesse para operação e segurança da plataforma, cumprimento de
          obrigação legal ou regulatória e consentimento, quando aplicável.
        </p>
      </section>

      <section>
        <h2>4. Compartilhamento com terceiros</h2>
        <p>O Lophos pode utilizar fornecedores e parceiros tecnológicos para operar o serviço.</p>
        <ul>
          <li>Serviços de autenticação para login e gestão de conta.</li>
          <li>Serviços de banco de dados e infraestrutura para armazenar preferências, threads, mensagens e interações.</li>
          <li>Provedores de inteligência artificial para processar prompts e gerar respostas dentro das threads.</li>
          <li>Serviços e sites de terceiros acessados por links, imagens e fontes editoriais exibidas no feed.</li>
        </ul>
        <p>
          O compartilhamento ocorre apenas na medida necessária para viabilizar o funcionamento, a segurança e a evolução do produto.
        </p>
      </section>

      <section>
        <h2>5. Transferências internacionais</h2>
        <p>
          Alguns fornecedores de autenticação, infraestrutura e IA podem processar dados fora do Brasil. Nesses casos,
          buscamos adotar medidas compatíveis com a legislação aplicável para proteger os dados pessoais envolvidos.
        </p>
      </section>

      <section>
        <h2>6. Armazenamento e retenção</h2>
        <p>
          Mantemos dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, preservar a
          funcionalidade do serviço, atender obrigações legais, resolver disputas e exercer direitos em processos administrativos
          ou judiciais.
        </p>
        <p>
          Algumas preferências do produto podem ficar salvas diretamente no seu navegador por meio de armazenamento local,
          até que sejam alteradas ou removidas por você.
        </p>
      </section>

      <section>
        <h2>7. Direitos do titular</h2>
        <p>
          Nos termos da LGPD, você pode solicitar, quando aplicável, confirmação da existência de tratamento, acesso, correção,
          anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamento e revisão de decisões tomadas com
          base em tratamento automatizado, além de revogar consentimento quando essa for a base legal utilizada.
        </p>
      </section>

      <section>
        <h2>8. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados tratados no contexto do Lophos. Ainda assim,
          nenhum sistema é totalmente imune a falhas, acessos indevidos ou incidentes de segurança.
        </p>
      </section>

      <section>
        <h2>9. Conteúdo de terceiros e links externos</h2>
        <p>
          O Lophos referencia notícias, imagens, páginas e plataformas externas. Esta política não se aplica às práticas de
          privacidade de sites de terceiros acessados por links exibidos no serviço.
        </p>
      </section>

      <section>
        <h2>10. Atualizações desta política</h2>
        <p>
          Esta política pode ser alterada periodicamente para refletir mudanças no produto, nos provedores utilizados,
          em requisitos legais ou em ajustes operacionais da plataforma. A versão mais recente publicada no Lophos será a vigente.
        </p>
      </section>
    </LegalPage>
  )
}
