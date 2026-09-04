import { $, clearFormErrors, setFieldError } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { registerCliente } from "../services/clientes.js";
import { getSession, loginCliente, redirectForRole } from "../services/auth.js";
import { loginWithGoogle, promptGoogleIdToken, decodeGoogleProfile } from "../services/googleAuth.js";
import { showToast } from "../ui/toast.js";
import { delay, isMockMode } from "../services/api.js";
import { attachPhoneMask } from "../ui/mask.js";

type ViewName = "login" | "cadastro" | "recover" | "recover-sent";

const VIEW_IDS: Record<ViewName, string> = {
  login: "client-login-view",
  cadastro: "client-register-view",
  recover: "client-recover-view",
  "recover-sent": "client-recover-sent-view",
};

function showView(name: ViewName): void {
  for (const [key, id] of Object.entries(VIEW_IDS)) {
    const el = document.getElementById(id);
    if (el) el.hidden = key !== name;
  }
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
  };
  button.addEventListener("click", handler);
  return () => button.removeEventListener("click", handler);
}

function authHeader(title: string, subtitle: string): string {
  return `
    <span class="auth__guard" aria-hidden="true"><i class="bx bx-check-shield"></i></span>
    <h1 class="auth__title">${title}</h1>
    <p class="auth__subtitle">${subtitle}</p>
  `;
}

export function renderLoginCliente(container: HTMLElement): () => void {
  const existing = getSession();
  if (existing) {
    redirectForRole(existing.role);
    return () => {};
  }

  container.innerHTML = `
    <main class="auth auth--restricted">
      <section class="auth__box" id="client-login-view">
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        ${authHeader("Acesso Restrito", "Faça o login para realizar o agendamento ou crie uma conta")}

        <div class="alert alert--danger auth__alert" id="client-login-alert" role="alert" hidden></div>

        <form id="client-login-form" novalidate>
          <div class="field">
            <label class="field__label" for="client-login-email">Email</label>
            <input type="email" id="client-login-email" name="email" placeholder="exemplo@email.com.br"
                   autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="100" required>
            <span class="field__error">Informe um e-mail válido.</span>
          </div>
          <div class="field">
            <label class="field__label" for="client-login-password">Senha</label>
            <div class="input-wrap">
              <input type="password" id="client-login-password" name="password" placeholder="**************"
                     autocomplete="current-password" maxlength="64" required>
              <button type="button" class="input-suffix" id="toggle-client-login-password" aria-label="Mostrar senha">
                <i class='bx bx-show'></i>
              </button>
            </div>
            <span class="field__error">Informe sua senha.</span>
          </div>
          <button type="submit" class="btn btn--outline-gold btn--block btn--lg" id="client-login-submit">Entrar</button>
        </form>

        <div class="auth__divider" aria-hidden="true"><span>ou</span></div>

        <button type="button" class="btn btn--google btn--block btn--lg" id="client-login-google">
          <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          LOGIN COM GOOGLE
        </button>

        <p class="auth__recover">Esqueceu a senha?
          <a href="#" class="auth__link" data-goto="recover">Clique aqui para recuperá-la.</a>
        </p>

        <button type="button" class="btn btn--gold-outline btn--block btn--lg" data-goto="cadastro">Faça seu cadastro</button>
      </section>

      <section class="auth__box auth__box--lg" id="client-register-view" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        ${authHeader("Acesso Restrito", "Faça o login para realizar o agendamento ou crie uma conta")}

        <div class="alert alert--danger auth__alert" id="client-register-alert" role="alert" hidden></div>

        <form id="client-register-form" novalidate>
          <div class="field">
            <label class="field__label" for="client-register-name">Nome completo</label>
            <input type="text" id="client-register-name" name="name" placeholder="digite seu nome completo" autocomplete="name" maxlength="80" required>
            <span class="field__error">Informe seu nome completo.</span>
          </div>
          <div class="field">
            <label class="field__label" for="client-register-email">Email</label>
            <input type="email" id="client-register-email" name="email" placeholder="digite seu melhor email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="100" required>
            <span class="field__error">Informe um e-mail válido.</span>
          </div>
          <div class="field">
            <label class="field__label" for="client-register-phone">Whatsapp</label>
            <input type="tel" id="client-register-phone" name="phone" placeholder="(99) 99999-9999" autocomplete="tel" inputmode="numeric" maxlength="15" required>
            <span class="field__error">Informe um WhatsApp válido com DDD.</span>
          </div>
          <div class="field" id="client-register-password-field">
            <label class="field__label" for="client-register-password">Crie uma senha</label>
            <div class="input-wrap">
              <input type="password" id="client-register-password" name="password" placeholder="**********" autocomplete="new-password" maxlength="64" required>
              <button type="button" class="input-suffix" id="toggle-client-register-password" aria-label="Mostrar senha">
                <i class='bx bx-show'></i>
              </button>
            </div>
            <ul class="auth__rules">
              <li>A sua senha deve ter pelo menos 8 caracteres.</li>
              <li>Uma letra maiúscula.</li>
              <li>Um caracter especial.</li>
            </ul>
            <span class="field__error">A senha deve ter 8+ caracteres, com letra maiúscula e caracter especial.</span>
          </div>
          <div class="field">
            <label class="field__label" for="client-register-confirm">Repita a senha</label>
            <div class="input-wrap">
              <input type="password" id="client-register-confirm" name="confirm-password" placeholder="**********" autocomplete="new-password" maxlength="64" required>
              <button type="button" class="input-suffix" id="toggle-client-register-confirm" aria-label="Mostrar senha">
                <i class='bx bx-show'></i>
              </button>
            </div>
            <span class="field__error">As senhas não coincidem.</span>
          </div>
          <button type="submit" class="btn btn--outline-gold btn--block btn--lg" id="client-register-submit">Cadastrar</button>
        </form>
        <a href="#" class="auth__back" data-goto="login">← Já tenho conta</a>
      </section>

      <section class="auth__box" id="client-recover-view" hidden>
        <a href="#/" class="auth__close" aria-label="Fechar e voltar ao site">
          <i class='bx bx-x'></i>
        </a>
        ${authHeader("Recuperar Senha", "Informe o e-mail cadastrado para receber as instruções de redefinição.")}

        <form id="client-recover-form" novalidate>
          <div class="field">
            <label class="field__label" for="client-recover-email">Email</label>
            <input type="email" id="client-recover-email" name="email" placeholder="voce@email.com"
                   autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="100" required>
            <span class="field__error">Informe o e-mail cadastrado.</span>
          </div>
          <button type="submit" class="btn btn--primary btn--block btn--lg">Enviar instruções</button>
        </form>
        <a href="#" class="auth__back" data-goto="login">← Voltar ao login</a>
      </section>

      <section class="auth__box" id="client-recover-sent-view" hidden>
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
    </main>
  `;

  showView("login");
  const cleanups: Array<() => void> = [];

  cleanups.push(setupPasswordToggle("toggle-client-login-password", "client-login-password"));
  cleanups.push(setupPasswordToggle("toggle-client-register-password", "client-register-password"));
  cleanups.push(setupPasswordToggle("toggle-client-register-confirm", "client-register-confirm"));

  const phoneInput = $<HTMLInputElement>("#client-register-phone");
  if (phoneInput) attachPhoneMask(phoneInput);

  const loginForm = $<HTMLFormElement>("#client-login-form")!;
  const loginEmail = $<HTMLInputElement>("#client-login-email")!;
  const loginPassword = $<HTMLInputElement>("#client-login-password")!;
  const loginAlert = $("#client-login-alert")!;
  const loginSubmit = $<HTMLButtonElement>("#client-login-submit")!;

  const handleLoginSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();
    clearFormErrors(loginForm);
    loginAlert.hidden = true;

    let valid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(loginEmail.value.trim())) {
      setFieldError(loginEmail, "Informe um e-mail válido.");
      valid = false;
    }
    if (loginPassword.value.length === 0) {
      setFieldError(loginPassword, "Informe sua senha.");
      valid = false;
    }
    if (!valid) return;

    loginSubmit.disabled = true;
    loginSubmit.classList.add("is-loading");
    const result = await loginCliente(loginEmail.value, loginPassword.value);
    loginSubmit.disabled = false;
    loginSubmit.classList.remove("is-loading");

    if (result.ok && result.role) {
      showToast("Bem-vindo de volta!", "success");
      redirectForRole(result.role);
      return;
    }
    loginAlert.textContent = result.message ?? "Credenciais inválidas. Verifique e tente novamente.";
    loginAlert.hidden = false;
  };
  loginForm.addEventListener("submit", handleLoginSubmit);
  cleanups.push(() => loginForm.removeEventListener("submit", handleLoginSubmit));

  const googleBtn = $<HTMLButtonElement>("#client-login-google");
  const handleGoogleClick = async (): Promise<void> => {
    if (!googleBtn) return;
    loginAlert.hidden = true;
    googleBtn.disabled = true;
    googleBtn.classList.add("is-loading");

    try {
      if (isMockMode()) {
        const result = await loginWithGoogle();
        if (result.ok && result.session) {
          showToast("Bem-vindo(a)!", "success");
          redirectForRole(result.session.role);
        } else {
          loginAlert.textContent = result.message ?? "Não foi possível entrar com o Google.";
          loginAlert.hidden = false;
        }
        return;
      }

      const idToken = await promptGoogleIdToken();
      const profile = decodeGoogleProfile(idToken);
      if (!profile) {
        loginAlert.textContent = "Não foi possível ler as informações da conta Google.";
        loginAlert.hidden = false;
        return;
      }
      const result = await loginWithGoogle(idToken, profile);
      if (result.ok && result.session) {
        showToast("Bem-vindo(a)!", "success");
        redirectForRole(result.session.role);
      } else {
        loginAlert.textContent = result.message ?? "Não foi possível entrar com o Google.";
        loginAlert.hidden = false;
      }
    } catch {
      loginAlert.textContent = "Não foi possível concluir a autenticação com o Google.";
      loginAlert.hidden = false;
    } finally {
      googleBtn.disabled = false;
      googleBtn.classList.remove("is-loading");
    }
  };
  googleBtn?.addEventListener("click", () => void handleGoogleClick());
  cleanups.push(() => googleBtn?.removeEventListener("click", handleGoogleClick));

  const registerForm = $<HTMLFormElement>("#client-register-form")!;
  const regName = $<HTMLInputElement>("#client-register-name")!;
  const regEmail = $<HTMLInputElement>("#client-register-email")!;
  const regPhone = $<HTMLInputElement>("#client-register-phone")!;
  const regPassword = $<HTMLInputElement>("#client-register-password")!;
  const regConfirm = $<HTMLInputElement>("#client-register-confirm")!;
  const regAlert = $("#client-register-alert")!;
  const regSubmit = $<HTMLButtonElement>("#client-register-submit")!;

  const handleRegisterSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();
    clearFormErrors(registerForm);
    regAlert.hidden = true;

    let valid = true;
    if (regName.value.trim().length < 3 || !regName.value.includes(" ")) {
      setFieldError(regName, "Informe seu nome completo.");
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(regEmail.value.trim())) {
      setFieldError(regEmail, "Informe um e-mail válido.");
      valid = false;
    }
    if (regPhone.value.replace(/\D/g, "").length < 11) {
      setFieldError(regPhone, "Informe um WhatsApp válido com DDD.");
      valid = false;
    }
    if (!/^(?=.*[A-ZÀ-Ü])(?=.*[^A-Za-z0-9À-ÿ\s]).{8,}$/.test(regPassword.value)) {
      setFieldError(regPassword, "A senha deve ter 8+ caracteres, com letra maiúscula e caracter especial.");
      valid = false;
    }
    if (regConfirm.value !== regPassword.value || regConfirm.value === "") {
      setFieldError(regConfirm, "As senhas não coincidem.");
      valid = false;
    }
    if (!valid) return;

    regSubmit.disabled = true;
    regSubmit.classList.add("is-loading");
    try {
      await registerCliente({
        nome: regName.value,
        email: regEmail.value,
        telefone: regPhone.value,
        senha: regPassword.value,
      });
      showToast("Conta criada com sucesso! Bem-vindo(a).", "success");
      redirectForRole("cliente");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível criar a conta.";
      regAlert.textContent = message;
      regAlert.hidden = false;
    } finally {
      regSubmit.disabled = false;
      regSubmit.classList.remove("is-loading");
    }
  };
  registerForm.addEventListener("submit", handleRegisterSubmit);
  cleanups.push(() => registerForm.removeEventListener("submit", handleRegisterSubmit));

  const handleConfirmInput = (): void => {
    if (regConfirm.value.length === 0) return;
    setFieldError(regConfirm, regConfirm.value === regPassword.value ? null : "As senhas não coincidem.");
  };
  regConfirm.addEventListener("input", handleConfirmInput);
  cleanups.push(() => regConfirm.removeEventListener("input", handleConfirmInput));

  const recoverForm = $<HTMLFormElement>("#client-recover-form")!;
  const recoverEmail = $<HTMLInputElement>("#client-recover-email")!;
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
    await delay(900);
    btn.disabled = false;
    btn.classList.remove("is-loading");
    showView("recover-sent");
  };
  recoverForm.addEventListener("submit", handleRecoverSubmit);
  cleanups.push(() => recoverForm.removeEventListener("submit", handleRecoverSubmit));

  const gotoHandlers: Array<() => void> = [];
  const gotoEls = Array.from(document.querySelectorAll("[data-goto]"));
  gotoEls.forEach((el) => {
    const handler = (event: Event): void => {
      event.preventDefault();
      showView((el.getAttribute("data-goto") ?? "login") as ViewName);
    };
    el.addEventListener("click", handler);
    gotoHandlers.push(() => el.removeEventListener("click", handler));
  });

  return () => {
    cleanups.forEach((fn) => fn());
    gotoHandlers.forEach((fn) => fn());
  };
}