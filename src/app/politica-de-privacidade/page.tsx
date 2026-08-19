import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Política de Privacidade - Lophos',
  description: 'Política de Privacidade da plataforma Lophos.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="18 de agosto de 2026" currentPath="/politica-de-privacidade">
      <section>
        <p>
          Esta Política de Privacidade explica quais dados pessoais o Lophos pode tratar, por que os utiliza, com quem pode
          compartilhá-los e quais direitos você pode exercer. Ela se aplica à criação e gestão da conta, à personalização do
          feed, às interações com notícias e aos demais recursos disponibilizados na plataforma.
        </p>
      </section>

      <section>
        <h2>1. Quais dados podemos tratar</h2>
        <h3>1.1 Dados de conta e autenticação</h3>
        <ul>
          <li>Nome, sobrenome, endereço de e-mail e identificadores vinculados à conta.</li>
          <li>Imagem de perfil e informações necessárias para autenticação e segurança da sessão.</li>
        </ul>

        <h3>1.2 Preferências e interações</h3>
        <ul>
          <li>Tópicos de interesse e tópicos excluídos informados por você.</li>
          <li>Notícias curtidas, reações negativas e outros sinais usados para personalizar o feed.</li>
          <li>Buscas, histórico de navegação dentro do produto e preferências de visualização armazenadas no navegador.</li>
          <li>Conversas, mensagens e contexto de artigos quando recursos de chat estiverem disponíveis e forem utilizados.</li>
        </ul>

        <h3>1.3 Dados técnicos e operacionais</h3>
        <ul>
          <li>Endereço IP, tipo de dispositivo e navegador, data e horário de acesso e identificadores de sessão, quando registrados pelos serviços utilizados.</li>
          <li>Logs de erro, eventos de segurança e informações técnicas necessárias para manter e proteger a plataforma.</li>
        </ul>
      </section>

      <section>
        <h2>2. Como os dados são obtidos</h2>
        <p>Os dados podem ser fornecidos diretamente por você, gerados durante o uso da plataforma ou recebidos dos serviços de autenticação utilizados no acesso à conta.</p>
        <p>
          Algumas preferências ficam apenas no seu navegador. Outras informações são armazenadas nos sistemas do Lophos
          para permitir que sua experiência continue disponível entre dispositivos e sessões.
        </p>
      </section>

      <section>
        <h2>3. Para que utilizamos os dados</h2>
        <ul>
          <li>Autenticar usuários e manter a sessão da conta.</li>
          <li>Personalizar o feed com base em interesses, exclusões e interações.</li>
          <li>Salvar preferências e permitir continuidade de recursos iniciados por você.</li>
          <li>Processar perguntas e gerar respostas quando você utilizar funcionalidades com inteligência artificial.</li>
          <li>Prevenir fraude, abuso, acessos indevidos e incidentes de segurança.</li>
          <li>Diagnosticar erros e melhorar estabilidade, desempenho e experiência de uso.</li>
          <li>Cumprir obrigações legais ou regulatórias e responder a solicitações válidas de autoridades.</li>
        </ul>
      </section>

      <section>
        <h2>4. Bases legais</h2>
        <p>
          Conforme a finalidade e o contexto, o tratamento pode se apoiar na execução destes Termos de Uso e de procedimentos
          relacionados à sua conta, no legítimo interesse para operar, proteger e melhorar a plataforma, no cumprimento de
          obrigação legal ou regulatória, no exercício regular de direitos ou no consentimento, quando essa for a base adequada.
        </p>
      </section>

      <section>
        <h2>5. Compartilhamento e operadores</h2>
        <p>Podemos compartilhar dados com fornecedores tecnológicos somente na medida necessária para disponibilizar e proteger o serviço, incluindo:</p>
        <ul>
          <li>Provedores de autenticação e gestão de identidade.</li>
          <li>Provedores de hospedagem, banco de dados, armazenamento e infraestrutura.</li>
          <li>Provedores de inteligência artificial, quando você utilizar um recurso que dependa desse processamento.</li>
          <li>Prestadores de segurança, monitoramento técnico e comunicação, quando necessários à operação.</li>
        </ul>
        <p>
          Também poderemos compartilhar informações quando houver obrigação legal, ordem válida de autoridade competente ou
          necessidade de exercer direitos e proteger usuários, terceiros ou a plataforma. O Lophos não vende dados pessoais.
        </p>
      </section>

      <section>
        <h2>6. Transferências internacionais</h2>
        <p>
          Alguns fornecedores podem armazenar ou processar dados fora do Brasil. Quando houver transferência internacional,
          buscaremos utilizar fornecedores e mecanismos compatíveis com a legislação aplicável e com medidas adequadas de proteção.
        </p>
      </section>

      <section>
        <h2>7. Cookies e armazenamento no navegador</h2>
        <p>
          O Lophos e seu provedor de autenticação podem utilizar cookies e tecnologias semelhantes necessários para login,
          segurança e funcionamento da sessão. Também utilizamos armazenamento local ou de sessão para recursos como tema,
          modo de visualização, histórico de busca, cache temporário do feed e continuidade da navegação.
        </p>
        <p>Você pode apagar esses dados pelas configurações do navegador, mas alguns recursos podem perder preferências ou exigir novo login.</p>
      </section>

      <section>
        <h2>8. Armazenamento e retenção</h2>
        <p>
          Mantemos dados pessoais pelo período necessário para fornecer o serviço, cumprir as finalidades descritas nesta política,
          atender obrigações legais, prevenir fraude, resolver disputas e exercer direitos. Os prazos podem variar conforme o tipo
          de dado, a finalidade e os requisitos legais aplicáveis.
        </p>
        <p>
          Ao excluir sua conta, os dados associados diretamente ao seu usuário são removidos dos sistemas ativos do Lophos,
          ressalvadas informações cuja conservação seja necessária ou permitida por lei, bem como cópias temporárias de segurança
          mantidas pelo prazo técnico necessário. Dados armazenados apenas no navegador podem precisar ser apagados por você.
        </p>
      </section>

      <section>
        <h2>9. Seus direitos</h2>
        <p>
          Nos termos da LGPD, você pode solicitar, quando aplicável, confirmação da existência de tratamento, acesso, correção,
          anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade, informações
          sobre compartilhamento, oposição e revisão de decisões tomadas unicamente com base em tratamento automatizado. Quando
          utilizarmos consentimento, você também poderá revogá-lo e receber informações sobre as consequências dessa decisão.
        </p>
        <p>Você pode excluir sua conta e os dados vinculados a ela diretamente nas configurações do Lophos.</p>
      </section>

      <section>
        <h2>10. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais compatíveis com os riscos para proteger dados pessoais contra acesso não
          autorizado, perda, alteração, divulgação ou tratamento inadequado. Nenhum sistema, porém, é totalmente imune a falhas
          ou incidentes. Você também deve proteger suas credenciais e comunicar qualquer suspeita de acesso indevido.
        </p>
      </section>

      <section>
        <h2>11. Conteúdo de terceiros e links externos</h2>
        <p>
          O Lophos referencia notícias, imagens, vídeos e páginas externas. Ao acessar um site ou conteúdo incorporado de terceiros,
          aplicam-se também as práticas e políticas desse terceiro. Esta política cobre apenas os tratamentos realizados pelo Lophos.
        </p>
      </section>

      <section>
        <h2>12. Controlador e contato</h2>
        <p>
          O Lophos é responsável pelas decisões sobre os tratamentos de dados pessoais realizados diretamente pela plataforma.
          Para dúvidas sobre esta política ou solicitações relacionadas aos seus dados, escreva para{' '}
          <a href="mailto:hello@mail.lophos.space">hello@mail.lophos.space</a>.
        </p>
      </section>

      <section>
        <h2>13. Atualizações desta política</h2>
        <p>
          Podemos atualizar esta política para refletir mudanças no produto, nos fornecedores, nas práticas de tratamento ou na
          legislação. A data da revisão ficará indicada no início da página e, quando uma alteração for relevante, buscaremos
          comunicá-la de forma compatível com seu impacto.
        </p>
        <p>
          Esta política deve ser lida em conjunto com os{' '}
          <Link href="/termos-de-uso">Termos de Uso</Link> do Lophos.
        </p>
      </section>
    </LegalPage>
  )
}
