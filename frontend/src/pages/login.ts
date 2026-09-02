export function renderLogin(): string {
  return `
    <div style="max-width: 400px; margin: 2rem auto;">
      <div class="card">
        <h2>Entrar</h2>
        <form id="login-form" style="margin-top: 1rem;">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="senha">Senha</label>
            <input type="password" id="senha" name="senha" required autocomplete="current-password">
          </div>
          <div id="login-error" class="error-msg" style="display: none;"></div>
          <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">Entrar</button>
        </form>
        <p style="text-align: center; margin-top: 1rem; color: var(--text-muted); font-size: 0.875rem;">
          Ainda nao tem conta? <a href="/cadastro" data-nav>Cadastrar</a>
        </p>
      </div>
    </div>
  `;
}

export function mountLogin(): void {
  const form = document.getElementById('login-form') as HTMLFormElement | null;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.style.display = 'none';

    const email = (document.getElementById('email') as HTMLInputElement).value;
    const senha = (document.getElementById('senha') as HTMLInputElement).value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (errorEl) {
          errorEl.textContent = data.message || 'Credenciais invalidas.';
          errorEl.style.display = 'block';
        }
        return;
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch {
      if (errorEl) {
        errorEl.textContent = 'Erro de conexao. Tente novamente.';
        errorEl.style.display = 'block';
      }
    }
  });
}
