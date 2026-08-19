import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Termos de Uso - Lophos',
  description: 'Termos de Uso da plataforma Lophos.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="18 de agosto de 2026" currentPath="/termos-de-uso">
      <section>
        <p>
          Estes Termos de Uso explicam as regras para acessar e utilizar o Lophos, uma plataforma de notícias
          personalizadas, resumos editoriais assistidos por inteligência artificial e conversas relacionadas aos artigos.
          Ao criar uma conta ou utilizar o serviço, você declara que leu e concorda com estes termos. Se não concordar,
          não utilize o Lophos.
        </p>
      </section>

      <section>
        <h2>1. O que é o Lophos</h2>
        <p>
          O Lophos reúne notícias de fontes públicas, agrupa assuntos relacionados, produz resumos editoriais, permite
          personalizar o feed por interesses e exclusões e oferece conversas contextuais sobre os artigos.
        </p>
        <p>
          O serviço não substitui as publicações originais. Sempre que possível, disponibilizamos links para que você
          consulte as fontes e obtenha o contexto completo da informação.
        </p>
      </section>

      <section>
        <h2>2. Conta e acesso</h2>
        <ul>
          <li>Alguns recursos exigem uma conta válida e informações corretas e atualizadas.</li>
          <li>Sua conta é pessoal. Não compartilhe credenciais nem permita o uso por terceiros.</li>
          <li>Você é responsável por manter suas credenciais seguras e por nos informar caso suspeite de acesso indevido.</li>
          <li>Você pode deixar de usar o serviço ou solicitar a exclusão da conta nas configurações da plataforma.</li>
        </ul>
      </section>

      <section>
        <h2>3. Regras de uso e condutas proibidas</h2>
        <p>
          Você deve utilizar o Lophos de forma lícita, respeitosa e compatível com a finalidade da plataforma.
          Ao utilizar o serviço, você não pode:
        </p>
        <ul>
          <li>Tentar violar segurança, disponibilidade ou integridade do serviço.</li>
          <li>Contornar limites técnicos, controles de acesso ou mecanismos de proteção da plataforma.</li>
          <li>Automatizar acessos de forma abusiva ou coletar dados por scraping sem autorização.</li>
          <li>Enviar conteúdo ilegal, fraudulento, ameaçador ou que viole privacidade, propriedade intelectual ou outros direitos de terceiros.</li>
          <li>Usar o Lophos para criar ou disseminar spam, malware, phishing, fraude ou engenharia social.</li>
          <li>Fingir ser outra pessoa, interferir no uso de outros usuários ou utilizar o serviço para finalidade ilícita.</li>
        </ul>
      </section>

      <section>
        <h2>4. Notícias, fontes e conteúdo de terceiros</h2>
        <p>
          O Lophos referencia conteúdos jornalísticos e páginas de terceiros por meio de links, títulos, imagens, trechos,
          resumos e metadados. Os direitos sobre as publicações originais permanecem com seus respectivos titulares.
        </p>
        <p>
          Sites externos possuem seus próprios termos, políticas e práticas. A exibição de uma fonte ou de um link não
          significa que o Lophos endossa todas as informações, opiniões, produtos ou práticas daquele terceiro.
        </p>
      </section>

      <section>
        <h2>5. Conteúdo enviado por você</h2>
        <p>
          Você continua responsável pelas mensagens, perguntas e demais informações que enviar ao Lophos. Ao enviar esse
          conteúdo, você autoriza seu processamento e armazenamento somente na medida necessária para operar, proteger e
          melhorar os recursos utilizados, conforme a Política de Privacidade.
        </p>
        <p>
          Não envie informações confidenciais, dados pessoais de terceiros sem autorização ou conteúdo que você não tenha
          o direito de utilizar. Podemos remover conteúdo ou limitar interações que violem estes termos ou a legislação aplicável.
        </p>
      </section>

      <section>
        <h2>6. Inteligência artificial e caráter informativo</h2>
        <p>
          O Lophos pode utilizar inteligência artificial para síntese, organização, personalização, sugestões e respostas
          em conversas. Esses resultados podem conter erros, simplificações, informações desatualizadas ou interpretações
          incompletas, mesmo quando apresentados de forma convincente.
        </p>
        <p>
          O conteúdo tem finalidade informativa e não substitui orientação profissional jurídica, médica, financeira ou
          técnica. Verifique informações importantes nas fontes originais e com profissionais qualificados antes de tomar decisões.
        </p>
      </section>

      <section>
        <h2>7. Propriedade intelectual do Lophos</h2>
        <p>
          A marca, o design, o software, a curadoria, a organização do feed, os textos institucionais e os demais elementos
          próprios do Lophos são protegidos pela legislação aplicável. Estes termos concedem apenas uma licença limitada,
          pessoal, não exclusiva e revogável para utilizar a plataforma conforme suas funcionalidades.
        </p>
      </section>

      <section>
        <h2>8. Privacidade e dados pessoais</h2>
        <p>
          O tratamento de dados pessoais relacionado ao serviço está descrito na nossa{' '}
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>, que complementa estes termos. Nela você
          encontra informações sobre dados tratados, finalidades, fornecedores, retenção, segurança e direitos dos titulares.
        </p>
      </section>

      <section>
        <h2>9. Disponibilidade e mudanças no serviço</h2>
        <p>
          Podemos corrigir, atualizar, substituir ou descontinuar funcionalidades para evoluir o produto, manter a segurança,
          cumprir obrigações legais ou preservar a operação. O serviço também pode ficar temporariamente indisponível por
          manutenção, falhas técnicas ou eventos fora do nosso controle.
        </p>
        <p>Não garantimos funcionamento ininterrupto, ausência total de erros ou permanência indefinida de uma funcionalidade específica.</p>
      </section>

      <section>
        <h2>10. Suspensão e encerramento</h2>
        <p>
          Podemos restringir funcionalidades, remover conteúdo, suspender ou encerrar uma conta quando houver violação destes
          termos, risco à segurança, fraude, abuso, obrigação legal ou necessidade de proteger usuários e terceiros. Sempre que
          a situação permitir, consideraremos a gravidade e a possibilidade de correção antes de adotar uma medida definitiva.
        </p>
      </section>

      <section>
        <h2>11. Responsabilidade</h2>
        <p>
          Dentro dos limites permitidos pela legislação, o Lophos não responde por informações incorretas ou incompletas
          provenientes de terceiros, por decisões tomadas exclusivamente com base em conteúdo automatizado nem por serviços,
          políticas ou práticas de sites externos acessados por links da plataforma.
        </p>
        <p>
          Nada nestes termos exclui ou limita responsabilidades e direitos que não possam ser afastados pela legislação aplicável,
          inclusive os direitos assegurados ao consumidor quando houver relação de consumo.
        </p>
      </section>

      <section>
        <h2>12. Atualizações destes termos</h2>
        <p>
          Podemos atualizar estes termos para refletir mudanças no serviço, na operação ou na legislação. A data da revisão
          ficará indicada no início da página e, quando uma alteração for relevante, buscaremos comunicá-la de forma compatível
          com seu impacto. O uso do serviço após a entrada em vigor da nova versão representa concordância com o texto atualizado,
          nos limites permitidos pela legislação.
        </p>
      </section>

      <section>
        <h2>13. Legislação aplicável</h2>
        <p>
          Estes termos são regidos pela legislação brasileira. Eventuais conflitos serão tratados pelo foro competente definido
          pela legislação aplicável, sem prejuízo dos direitos do consumidor e de outras normas obrigatórias.
        </p>
        <p>
          Se alguma disposição for considerada inválida ou inexequível, as demais continuarão em vigor na maior extensão possível.
        </p>
      </section>
    </LegalPage>
  )
}
