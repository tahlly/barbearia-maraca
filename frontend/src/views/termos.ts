export function renderTermos(container: HTMLElement): () => void {
  container.innerHTML = `
    <section class="section">
      <div class="container" style="max-width: 760px;">
        <a href="#/" class="btn" style="margin-bottom: var(--space-5);">&larr; Voltar</a>
        <span class="section__eyebrow">Institucional</span>
        <h1 class="section__title">Termos de Uso</h1>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-5);">
          Última atualização: <strong>legislação vigente</strong>.
        </p>

        <h2>1. Aceite dos termos</h2>
        <p>
          Ao acessar o site e utilizar os serviços da Barbearia Maracá, você concorda com
          estes Termos de Uso. Caso não concorde, recomendamos que não utilize o serviço.
        </p>

        <h2>2. Uso do serviço</h2>
        <p>
          O site permite consultar serviços e realizar agendamentos. Você se compromete a
          fornecer informações verdadeiras e a utilizar o serviço apenas para fins legítimos.
        </p>

        <h2>3. Agendamentos</h2>
        <p>
          Horários reservados podem ser cancelados. A barbearia reserva-se o direito de
          recusar ou remarcar um agendamento, mantendo o cliente informado pelos meios de
          contato cadastrados.
        </p>

        <h2>4. Propriedade intelectual</h2>
        <p>
          Todo o conteúdo do site — textos, imagens, marca e identidade visual — é de
          titularidade da Barbearia Maracá e não pode ser reproduzido sem autorização
          prévia.
        </p>

        <h2>5. Limitação de responsabilidade</h2>
        <p>
          Nos esforçamos para manter as informações atualizadas e corretas, mas não
          garantimos a ausência de erros. O uso do site é por conta e risco do usuário.
        </p>

        <h2>6. Contato</h2>
        <p>
          Dúvidas sobre estes Termos de Uso podem ser enviadas para
          <a href="mailto:contato@barbeariamaraca.com.br">contato@barbeariamaraca.com.br</a>.
        </p>
      </div>
    </section>
  `;
  return () => {};
}