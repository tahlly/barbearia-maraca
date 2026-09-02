import { $, clearFormErrors, setFieldError } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { registerCliente, findClienteByEmail } from "../services/clientes.js";
import { getSession, loginCliente, redirectForRole } from "../services/auth.js";
import { showToast } from "../ui/toast.js";
import { delay } from "../services/api.js";
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
    if (findClienteByEmail(regEmail.value.trim())) {
      setFieldError(regEmail, "Já existe uma conta com este e-mail.");
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
      registerCliente({
        nome: regName.value,
        email: regEmail.value,
        telefone: regPhone.value,
        senha: regPassword.value,
      });
      await loginCliente(regEmail.value, regPassword.value);
      showToast("Conta criada com sucesso! Bem-vindo(a).", "success");
      redirectForRole("cliente");
    } catch {
      regAlert.textContent = "Não foi possível criar a conta. Tente novamente.";
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