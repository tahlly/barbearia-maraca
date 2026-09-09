import { CONFIG } from "../config.js";
import { $, clearFormErrors, setFieldError } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { completeFirstAccess, getSession, loginInterno, redirectForRole, solicitarRecuperacaoSenha, redefinirSenha } from "../services/auth.js";
import { showToast } from "../ui/toast.js";
import { closeModal, openModal } from "../ui/modal.js";
import { isSenhaForte, SENHA_FORTE_MESSAGE } from "../ui/password.js";
import type { UserRole } from "../types.js";

type ViewName = "login" | "recover" | "recover-sent" | "reset" | "reset-done";

const VIEWS: Record<ViewName, string> = {
  login: "view-login",
  recover: "view-recover",
  "recover-sent": "view-recover-sent",
  reset: "view-reset",
  "reset-done": "view-reset-done",
};

function showView(name: ViewName): void {
  for (const [key, id] of Object.entries(VIEWS)) {
    const el = document.getElementById(id);
    if (el) el.hidden = key !== name;
  }
}

function getResetTokenFromUrl(): string | null {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return params.get("token");
}

function setupPasswordToggle(buttonId: string, inputId: string): () => void {
  const button = $<HTMLButtonElement>(`#${buttonId}`);
  const input = $<HTMLInputElement>(`#${inputId}`);
  if (!button || !input) return () => {};

  const handler = (): void => {
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.innerHTML = icon(reveal ? "eye-off" : "eye", 18);
    button.setAttribute("aria-label", reveal ? "Ocultar senha" : "Mostrar senha");
    input.focus({ preventScroll: true });
  };

  button.addEventListener("click", handler);
  return () => button.removeEventListener("click", handler);
}

function isLockedOut(): number {
  const raw = sessionStorage.getItem("maraca.lockout");
  if (!raw) return 0;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    sessionStorage.removeItem("maraca.lockout");
    return 0;
  }
  return Math.ceil((until - Date.now()) / 1000);
}

function registerFailure(): void {
  const attempts = Number(sessionStorage.getItem("maraca.attempts") ?? "0") + 1;
  sessionStorage.setItem("maraca.attempts", String(attempts));
  if (attempts >= CONFIG.maxLoginAttempts) {
    sessionStorage.setItem("maraca.lockout", String(Date.now() + CONFIG.lockoutMs));
    sessionStorage.setItem("maraca.attempts", "0");
  }
}

/**
 * Popup bloqueante de primeiro acesso: exige a criação de uma nova senha
 * (com o padrão forte) antes de liberar o painel. Não pode ser fechado por
 * Escape/backdrop — a troca é obrigatória (ver ui/modal.ts: dataset.blocking).
 */
function promptFirstAccess(role: UserRole): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.dataset.blocking = "true";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="fa-title">
      <div class="modal__header">
        <h2 class="modal__title" id="fa-title">Criar nova senha</h2>
      </div>
      <form class="modal__body" id="fa-form" novalidate>
        <p class="field__hint">Este é o seu primeiro acesso. Crie uma senha segura antes de continuar.</p>
        <div class="field">
          <label class="field__label" for="fa-password">Nova senha</label>
          <div class="input-wrap">
            <input type="password" id="fa-password" name="new-password" placeholder="••••••••"
                   autocomplete="new-password" maxlength="64" required>
            <button type="button" class="input-suffix" id="toggle-fa-password" aria-label="Mostrar senha">
              <i class='bx bx-show'></i>
            </button>
          </div>
          <span class="field__hint">${SENHA_FORTE_MESSAGE}.</span>
          <span class="field__error">A senha não atende ao padrão exigido.</span>
        </div>
        <div class="field">
          <label class="field__label" for="fa-confirm">Repetir a nova senha</label>
          <div class="input-wrap">
            <input type="password" id="fa-confirm" name="confirm-password" placeholder="••••••••"
                   autocomplete="new-password" maxlength="64" required>
            <button type="button" class="input-suffix" id="toggle-fa-confirm" aria-label="Mostrar senha">
              <i class='bx bx-show'></i>
            </button>
          </div>
          <span class="field__error">As senhas não coincidem.</span>
        </div>
        <div class="modal__footer">
          <button type="submit" class="btn btn--primary btn--block" id="fa-submit">Salvar nova senha</button>
        </div>
      </form>
    </div>
  `;

  const form = overlay.querySelector<HTMLFormElement>("#fa-form")!;
  const passwordInput = $<HTMLInputElement>("#fa-password", overlay)!;
  const confirmInput = $<HTMLInputElement>("#fa-confirm", overlay)!;
  const submitBtn = $<HTMLButtonElement>("#fa-submit", overlay)!;

  const cleanups: Array<() => void> = [];
  cleanups.push(setupPasswordToggle("toggle-fa-password", "fa-password"));
  cleanups.push(setupPasswordToggle("toggle-fa-confirm", "fa-confirm"));

  const toggleHandler = (): void => {
    if (confirmInput.value.length === 0) return;
    if (confirmInput.value === passwordInput.value) {
      setFieldError(confirmInput, null);
    } else {
      setFieldError(confirmInput, "As senhas não coincidem.");
    }
  };
  confirmInput.addEventListener("input", toggleHandler);
  cleanups.push(() => confirmInput.removeEventListener("input", toggleHandler));

  form.addEventListener("submit", async (event: Event) => {
    event.preventDefault();
    clearFormErrors(form);

    let valid = true;
    if (!isSenhaForte(passwordInput.value)) {
      setFieldError(passwordInput, SENHA_FORTE_MESSAGE);
      valid = false;
    }
    if (confirmInput.value !== passwordInput.value || confirmInput.value === "") {
      setFieldError(confirmInput, "As senhas não coincidem.");
      valid = false;
    }
    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");

    const result = await completeFirstAccess(passwordInput.value);
    if (!result.ok) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
      showToast(result.message ?? "Não foi possível atualizar a senha.", "error");
      passwordInput.focus();
      return;
    }

    closeModal(overlay);
    window.setTimeout(() => overlay.remove(), 300);
    cleanups.forEach((fn) => fn());
    showToast("Senha criada. Bem-vindo!", "success");
    redirectForRole(role);
  });

  document.body.appendChild(overlay);
  openModal(overlay);
}

export function renderLogin(container: HTMLElement): () => void {
  const existing = getSession();
  if (existing) {
    // Primeiro acesso pendente: mantém o popup obrigatório mesmo após reload.
    if (existing.precisaTrocarSenha) {
      promptFirstAccess(existing.role);
      return () => {};
    }
    redirectForRole(existing.role);
    return () => {};
  }

  container.innerHTML = `
    <main class="auth auth--restricted">
      <section class="auth__box" id="view-login" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        <span class="auth__guard" aria-hidden="true"><i class='bx bx-check-shield'></i></span>
        <h1 class="auth__title">Acesso Restrito</h1>
        <p class="auth__subtitle">Área restrita para administradores da Barbearia Maracá</p>

        <div class="auth__panel">
          <div class="alert alert--danger auth__alert" id="login-alert" role="alert" hidden></div>
        <form id="login-form" novalidate>
          <div class="field">
            <label class="field__label" for="login-email">Email</label>
            <input type="email" id="login-email" name="email" placeholder="exemplo@email.com.br"
                   autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="100" required>
            <span class="field__error">Informe um e-mail válido.</span>
          </div>
          <div class="field">
            <label class="field__label" for="login-password">Senha</label>
            <div class="input-wrap">
              <input type="password" id="login-password" name="password" placeholder="**************"
                     autocomplete="current-password" maxlength="64" required>
              <button type="button" class="input-suffix" id="toggle-login-password" aria-label="Mostrar senha">
                <i class='bx bx-show'></i>
              </button>
            </div>
            <span class="field__error">A senha deve ter pelo menos 6 caracteres.</span>
          </div>
          <button type="submit" class="btn btn--outline-gold btn--block btn--lg" id="login-submit">Entrar</button>
        </form>

        <p class="auth__footer">Esqueceu a senha?
          <a href="#" class="auth__link" data-goto="recover">Clique aqui para recuperá-la.</a>
        </p>
        </div>
      </section>

      <section class="auth__box" id="view-recover" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        <span class="auth__guard" aria-hidden="true"><i class='bx bx-lock-alt'></i></span>
        <h1 class="auth__title">Recuperar Senha</h1>
        <p class="auth__subtitle">
          Informe o e-mail cadastrado para receber as instruções de redefinição.
        </p>
        <div class="auth__panel">
        <form id="recover-form" novalidate>
          <div class="field">
            <label class="field__label" for="recover-email">E-mail</label>
            <input type="email" id="recover-email" name="email" placeholder="voce@email.com"
                   autocomplete="email" maxlength="100" required>
            <span class="field__error">Informe o e-mail cadastrado.</span>
          </div>
          <button type="submit" class="btn btn--primary btn--block btn--lg">Enviar instruções</button>
        </form>
        <a href="#" class="auth__back" data-goto="login">← Voltar ao login</a>
        </div>
      </section>

      <section class="auth__box" id="view-recover-sent" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        <span class="auth__guard auth__guard--success" aria-hidden="true"><i class='bx bx-check-circle'></i></span>
        <h1 class="auth__title">Instruções enviadas</h1>
        <p class="auth__subtitle">
          Se este contato estiver cadastrado, você receberá em instantes um link seguro
          para redefinir sua senha. Verifique também a caixa de spam.
        </p>
        <a href="#" class="btn btn--outline btn--block" data-goto="login">Voltar ao login</a>
      </section>

      <section class="auth__box" id="view-reset" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        <span class="auth__guard" aria-hidden="true"><i class='bx bx-check-shield'></i></span>
        <h1 class="auth__title">Redefinir Senha</h1>
        <p class="auth__subtitle">Crie uma nova senha segura para acessar sua conta.</p>
        <div class="auth__panel">
        <form id="reset-form" novalidate>
          <div class="field">
            <label class="field__label" for="reset-password">Digite a nova senha</label>
            <div class="input-wrap">
              <input type="password" id="reset-password" name="new-password" placeholder="••••••••"
                     autocomplete="new-password" minlength="8" maxlength="64" required>
              <button type="button" class="input-suffix" id="toggle-reset-password" aria-label="Mostrar senha">
                <i class='bx bx-show'></i>
              </button>
            </div>
            <span class="field__error">A senha não atende à política exigida.</span>
          </div>
          <div class="field">
            <label class="field__label" for="reset-confirm">Repetir a nova senha</label>
            <div class="input-wrap">
              <input type="password" id="reset-confirm" name="confirm-password" placeholder="••••••••"
                     autocomplete="new-password" minlength="8" maxlength="64" required>
              <button type="button" class="input-suffix" id="toggle-reset-confirm" aria-label="Mostrar senha">
                <i class='bx bx-show'></i>
              </button>
            </div>
            <span class="field__error">As senhas não coincidem.</span>
          </div>
          <button type="submit" class="btn btn--primary btn--block btn--lg">Redefinir senha</button>
        </form>
        <a href="#" class="auth__back" data-goto="login">← Voltar ao login</a>
        </div>
      </section>

      <section class="auth__box" id="view-reset-done" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        <span class="auth__guard auth__guard--success" aria-hidden="true"><i class='bx bx-check-circle'></i></span>
        <h1 class="auth__title">Senha redefinida</h1>
        <p class="auth__subtitle">Sua nova senha foi definida com sucesso. Faça login para continuar.</p>
        <a href="#" class="btn btn--primary btn--block" data-goto="login">Ir para o login</a>
      </section>
    </main>
  `;

  const resetToken = getResetTokenFromUrl();
  showView(resetToken ? "reset" : "login");

  const cleanups: Array<() => void> = [];

  cleanups.push(setupPasswordToggle("toggle-login-password", "login-password"));
  cleanups.push(setupPasswordToggle("toggle-reset-password", "reset-password"));
  cleanups.push(setupPasswordToggle("toggle-reset-confirm", "reset-confirm"));

  const form = $<HTMLFormElement>("#login-form")!;
  const emailInput = $<HTMLInputElement>("#login-email")!;
  const passwordInput = $<HTMLInputElement>("#login-password")!;
  const alertBox = $("#login-alert")!;
  const submitBtn = $<HTMLButtonElement>("#login-submit")!;

  let lockoutInterval: ReturnType<typeof setInterval> | null = null;

  function startLockoutCountdown(): void {
    let remaining = isLockedOut();
    if (remaining <= 0) return;

    const tick = (): void => {
      if (remaining <= 0) {
        alertBox.hidden = true;
        submitBtn.disabled = false;
        if (lockoutInterval) clearInterval(lockoutInterval);
        return;
      }
      alertBox.hidden = false;
      alertBox.textContent = `Muitas tentativas inválidas. Aguarde ${remaining}s antes de tentar novamente.`;
      remaining -= 1;
    };
    tick();
    lockoutInterval = setInterval(tick, 1000);
  }

  startLockoutCountdown();

  const handleLoginSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    clearFormErrors(form);
    alertBox.hidden = true;

    const locked = isLockedOut();
    if (locked > 0) {
      alertBox.textContent = `Muitas tentativas inválidas. Aguarde ${locked}s antes de tentar novamente.`;
      alertBox.hidden = false;
      return;
    }

    let valid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.value.trim())) {
      setFieldError(emailInput, "Informe um e-mail válido.");
      valid = false;
    }
    if (passwordInput.value.length < 6) {
      setFieldError(passwordInput, "A senha deve ter pelo menos 6 caracteres.");
      valid = false;
    }
    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");

    const result = await loginInterno(emailInput.value, passwordInput.value);

    submitBtn.disabled = false;
    submitBtn.classList.remove("is-loading");

    if (result.ok && result.role) {
      if (result.precisaTrocarSenha) {
        promptFirstAccess(result.role);
        return;
      }
      showToast("Bem-vindo de volta!", "success");
      redirectForRole(result.role);
      return;
    }

    registerFailure();
    passwordInput.value = "";
    passwordInput.focus();
    alertBox.textContent = result.message ?? "Credenciais inválidas. Verifique e tente novamente.";
    alertBox.hidden = false;
    const box = $(".auth__box:not([hidden])");
    box?.classList.remove("shake");
    void box?.offsetWidth;
    box?.classList.add("shake");
    startLockoutCountdown();
  };
  form.addEventListener("submit", handleLoginSubmit);

  const recoverForm = $<HTMLFormElement>("#recover-form")!;
  const recoverEmail = $<HTMLInputElement>("#recover-email")!;
  const handleRecoverSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();
    clearFormErrors(recoverForm);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(recoverEmail.value.trim())) {
      setFieldError(recoverEmail, "Informe o e-mail cadastrado.");
      return;
    }

    const btn = recoverForm.querySelector<HTMLButtonElement>("button[type=submit]")!;
    btn.disabled = true;
    btn.classList.add("is-loading");
    const result = await solicitarRecuperacaoSenha(recoverEmail.value);
    btn.disabled = false;
    btn.classList.remove("is-loading");
    if (result.ok) {
      showView("recover-sent");
    } else {
      showToast(result.message ?? "Não foi possível enviar as instruções.", "error");
    }
  };
  recoverForm.addEventListener("submit", handleRecoverSubmit);

  const resetForm = $<HTMLFormElement>("#reset-form")!;
  const resetPassword = $<HTMLInputElement>("#reset-password")!;
  const resetConfirm = $<HTMLInputElement>("#reset-confirm")!;
  const handleResetSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();
    clearFormErrors(resetForm);

    let valid = true;
    if (!isSenhaForte(resetPassword.value)) {
      setFieldError(resetPassword, SENHA_FORTE_MESSAGE);
      valid = false;
    }
    if (resetConfirm.value !== resetPassword.value || resetConfirm.value === "") {
      setFieldError(resetConfirm, "As senhas não coincidem.");
      valid = false;
    }
    if (!valid) return;

    if (!resetToken) {
      showToast("Link de redefinição inválido ou expirado.", "error");
      return;
    }

    const btn = resetForm.querySelector<HTMLButtonElement>("button[type=submit]")!;
    btn.disabled = true;
    btn.classList.add("is-loading");
    const result = await redefinirSenha(resetToken, resetPassword.value);
    btn.disabled = false;
    btn.classList.remove("is-loading");
    if (result.ok) {
      showView("reset-done");
    } else {
      showToast(result.message ?? "Não foi possível redefinir a senha.", "error");
    }
  };
  resetForm.addEventListener("submit", handleResetSubmit);

  const handleConfirmInput = (): void => {
    if (resetConfirm.value.length === 0) return;
    if (resetConfirm.value === resetPassword.value) {
      setFieldError(resetConfirm, null);
    } else {
      setFieldError(resetConfirm, "As senhas não coincidem.");
    }
  };
  resetConfirm.addEventListener("input", handleConfirmInput);

  const gotoHandlers: Array<() => void> = [];
  document.querySelectorAll("[data-goto]").forEach((el) => {
    const handler = (event: Event): void => {
      event.preventDefault();
      showView((el.getAttribute("data-goto") ?? "login") as ViewName);
    };
    el.addEventListener("click", handler);
    gotoHandlers.push(() => el.removeEventListener("click", handler));
  });

  return () => {
    form.removeEventListener("submit", handleLoginSubmit);
    recoverForm.removeEventListener("submit", handleRecoverSubmit);
    resetForm.removeEventListener("submit", handleResetSubmit);
    resetConfirm.removeEventListener("input", handleConfirmInput);
    gotoHandlers.forEach((fn) => fn());
    cleanups.forEach((fn) => fn());
    if (lockoutInterval) clearInterval(lockoutInterval);
  };
}
