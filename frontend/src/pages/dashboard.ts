export function renderDashboard(): string {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) {
    window.location.href = '/login';
    return '<div class="loading">Redirecionando...</div>';
  }

  return `
    <h1>Dashboard</h1>
    <div class="card" style="margin-top: 1rem;">
      <h3>Ola, ${user.nome || user.email}!</h3>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">
        Tipo: <strong>${user.tipo || user.role || 'N/A'}</strong>
      </p>
    </div>
    <div style="margin-top: 2rem;">
      <h2>Proximos Agendamentos</h2>
      <div id="agendamentos-list" class="loading" style="margin-top: 1rem;">Carregando...</div>
    </div>
    <button id="logout-btn" class="btn" style="margin-top: 2rem; background: var(--error);">Sair</button>
  `;
}

export function mountDashboard(): void {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    });
  }

  const container = document.getElementById('agendamentos-list');
  if (container) {
    container.innerHTML = '<p style="color: var(--text-muted);">Nenhum agendamento encontrado.</p>';
  }
}
