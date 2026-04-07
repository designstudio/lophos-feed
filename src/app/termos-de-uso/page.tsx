import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Termos de Uso - Lophos',
  description: 'Termos de Uso da plataforma Lophos.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="7 de abril de 2026" currentPath="/termos-de-uso">
      <section>
        <p>
          Estes Termos de Uso regulam o acesso e o uso do Lophos, plataforma de feed personalizado de notícias,
          resumos editoriais assistidos por inteligência artificial e threads de conversa sobre artigos publicados.
          Ao criar conta, acessar ou utilizar o serviço, você concorda com estes termos.
        </p>
      </section>

      <section>
        <h2>1. O que é o Lophos</h2>
        <p>
          O Lophos organiza notícias de fontes públicas, agrupa assuntos relacionados, gera resumos editoriais,
          permite personalização por temas de interesse e oferece uma experiência de conversa contextual sobre os artigos.
        </p>
        <p>
          O serviço pode utilizar modelos de inteligência artificial para síntese, organização, sugestões de perguntas
          e apoio à navegação editorial. Embora busquemos qualidade e consistência, respostas e resumos automatizados
          podem conter limitações, simplificações ou imprecisões.
        </p>
      </section>

      <section>
        <h2>2. Conta e acesso</h2>
        <ul>
          <li>Para usar recursos personalizados, você precisa manter uma conta válida e informações de acesso corretas.</li>
          <li>Você é responsável por proteger suas credenciais e pelo uso realizado a partir da sua conta.</li>
          <li>Podemos restringir, suspender ou encerrar acesso em caso de uso abusivo, fraudulento ou contrário a estes termos.</li>
        </ul>
      </section>

      <section>
        <h2>3. Uso permitido</h2>
        <p>Você concorda em utilizar o Lophos de forma lícita e compatível com a finalidade da plataforma.</p>
        <ul>
          <li>Tentar violar segurança, disponibilidade ou integridade do serviço.</li>
          <li>Automatizar acessos de maneira abusiva ou usar o serviço para scraping não autorizado.</li>
          <li>Inserir conteúdo ilegal, ofensivo, fraudulento ou que viole direitos de terceiros nas interações com o sistema.</li>
          <li>Usar o Lophos para produzir ou disseminar spam, malware ou engenharia social.</li>
        </ul>
      </section>

      <section>
        <h2>4. Conteúdo, fontes e propriedade intelectual</h2>
        <p>
          O Lophos exibe e referencia conteúdos jornalísticos e páginas de terceiros por meio de links, títulos, imagens,
          resumos e metadados. Os direitos sobre o conteúdo original permanecem com seus respectivos titulares.
        </p>
        <p>
          O design da plataforma, a curadoria, a organização do feed, os textos institucionais e os elementos próprios do
          Lophos são protegidos pela legislação aplicável. Você não adquire qualquer direito de propriedade sobre o serviço
          além do direito limitado de uso pessoal conforme estes termos.
        </p>
      </section>

      <section>
        <h2>5. Respostas em threads e limitações</h2>
        <p>
          As threads podem combinar o conteúdo editorial do artigo com conhecimento geral fornecido por modelos de IA.
          Essas respostas têm caráter informativo e não substituem consulta profissional, jurídica, médica, financeira
          ou técnica especializada.
        </p>
        <p>O usuário é responsável por avaliar criticamente qualquer resposta antes de tomar decisões com base nela.</p>
      </section>

      <section>
        <h2>6. Disponibilidade e mudanças</h2>
        <p>
          O Lophos pode alterar funcionalidades, layout, integrações, critérios de recomendação, regras de agrupamento,
          recursos de IA e fluxos de autenticação a qualquer momento, com ou sem aviso prévio, para evolução do produto,
          segurança, conformidade ou manutenção operacional.
        </p>
        <p>Não garantimos disponibilidade ininterrupta, ausência de erros ou manutenção de funcionalidades específicas.</p>
      </section>

      <section>
        <h2>7. Suspensão, encerramento e remoção</h2>
        <p>
          Podemos suspender ou encerrar contas, remover conteúdo gerado dentro da plataforma ou limitar funcionalidades
          quando necessário para cumprir a lei, proteger a plataforma, prevenir abuso ou fazer valer estes termos.
        </p>
      </section>

      <section>
        <h2>8. Limitação de responsabilidade</h2>
        <p>
          Na máxima extensão permitida pela legislação aplicável, o Lophos não se responsabiliza por perdas indiretas,
          lucros cessantes, indisponibilidade temporária, decisões tomadas com base em conteúdo automatizado ou por
          conteúdos, políticas e práticas de sites de terceiros acessados por links exibidos na plataforma.
        </p>
      </section>

      <section>
        <h2>9. Privacidade e tratamento de dados</h2>
        <p>
          O tratamento de dados pessoais relacionado ao uso da plataforma é descrito na nossa Política de Privacidade,
          que integra estes Termos de Uso para fins de interpretação e aplicação.
        </p>
      </section>

      <section>
        <h2>10. Atualizações destes termos</h2>
        <p>
          Estes termos podem ser revisados periodicamente para refletir mudanças no serviço, na operação ou nas exigências
          legais. A versão mais recente publicada no Lophos será a versão aplicável a partir da data de atualização.
        </p>
      </section>
    </LegalPage>
  )
}
