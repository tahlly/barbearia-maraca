export function renderServicos(): string {
  return `
    <h1>Servicos</h1>
    <div id="servicos-list" class="loading">Carregando...</div>
  `;
}

export async function mountServicos(): Promise<void> {
  const container = document.getElementById('servicos-list');
  if (!container) return;

  try {
    const res = await fetch('/api/servicos');
    if (!res.ok) throw new Error('Erro ao carregar servicos');

    const servicos = await res.json();

    if (servicos.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">Nenhum servico disponivel.</p>';
      return;
    }

    container.innerHTML = servicos.map((s: any) => `
      <div class="card">
        <h3>${s.nome}</h3>
        <p style="color: var(--text-muted); margin: 0.5rem 0;">${s.descricao || ''}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
          <span style="color: var(--primary); font-weight: bold;">R$ ${Number(s.preco).toFixed(2)}</span>
          <span style="color: var(--text-muted); font-size: 0.875rem;">${s.duracao_minutos} min</span>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p class="error-msg">Erro ao carregar servicos.</p>';
  }
}
