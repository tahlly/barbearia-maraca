export function renderPrivacidade(container: HTMLElement): () => void {
  container.innerHTML = `
    <section class="section">
      <div class="container" style="max-width: 760px;">
        <a href="#/" class="btn" style="margin-bottom: var(--space-5);">&larr; Voltar</a>
        <span class="section__eyebrow">Institucional</span>
        <h1 class="section__title">Política de Privacidade</h1>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-5);">
          Última atualização: <strong>legislação vigente</strong>.
        </p>

        <h2>1. Quem somos</h2>
        <p>
          A Barbearia Maracá valoriza a privacidade dos seus clientes. Esta política explica
          como tratamos as informações pessoais coletadas durante o uso do nosso site e dos
          nossos serviços de agendamento.
        </p>

        <h2>2. Dados que coletamos</h2>
        <p>Podemos coletar os seguintes dados pessoais com o seu consentimento:</p>
        <ul>
          <li>Nome e sobrenome;</li>
          <li>Endereço de e-mail;</li>
          <li>Telefone / WhatsApp;</li>
          <li>Histórico de agendamentos e preferências de atendimento.</li>
        </ul>

        <h2>3. Finalidade do tratamento</h2>
        <p>
          Utilizamos os dados coletados para confirmar e gerenciar agendamentos, manter o
          histórico de atendimento, comunicar-se sobre o seu horário e melhorar nossos
          serviços. Não vendemos seus dados pessoais a terceiros.
        </p>

        <h2>4. Armazenamento e segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais adequadas para proteger os dados contra
          acesso não autorizado, perda ou alteração.
        </p>

        <h2>5. Compartilhamento</h2>
        <p>
          Seus dados podem ser compartilhados somente com prestadores de serviço necessários
          à operação (por exemplo, serviços de agendamento e autenticação) e quando exigido
          por lei.
        </p>

        <h2>6. Seus direitos</h2>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais a qualquer
          momento, entrando em contato pelo e-mail
          <a href="mailto:contato@barbeariamaraca.com.br">contato@barbeariamaraca.com.br</a>.
        </p>

        <h2>7. Alterações nesta política</h2>
        <p>
          Esta política pode ser atualizada periodicamente. Recomendamos a revisão regular
          desta página para se manter informado sobre como protegemos seus dados.
        </p>
      </div>
    </section>
  `;
  return () => {};
}