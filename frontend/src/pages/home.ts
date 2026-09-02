export function renderHome(): string {
  return `
    <h1>Bem-vindo a Barbearia Maraca</h1>
    <p style="color: var(--text-muted); margin-top: 1rem;">
      Escolha um servico e agende seu horario.
    </p>
    <div style="margin-top: 2rem; display: flex; gap: 1rem;">
      <a href="/servicos" data-nav class="btn">Ver Servicos</a>
      <a href="/agendar" data-nav class="btn" style="background: var(--bg-light); border: 1px solid var(--border);">Agendar Agora</a>
    </div>
  `;
}
