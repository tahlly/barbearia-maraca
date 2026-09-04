import { $, escapeHtml, initials } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { getSession } from "../services/auth.js";
import { showToast } from "../ui/toast.js";

/**
 * Dados do usuário necessários para renderizar o form de configurações.
 */
export interface SettingsUserData {
  userName: string;
  userEmail: string;
}

/**
 * Payload que o callback de submit recebe.
 * Cada campo é opcional — somente preenchido quando o usuário altera.
 */
export interface SettingsSubmitData {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
}

/**
 * Callback chamado quando o formulário é submetido com dados válidos.
 * Retorna `true` se a operação foi bem-sucedida (ou deve re-renderizar).
 */
export type SettingsSubmitFn = (data: SettingsSubmitData) => Promise<boolean>;

/**
 * Renderiza o form compartilhado de configurações (nome, email, senha, foto)
 * dentro do container fornecido.
 *
 * @param container  - Elemento onde o form será renderizado
 * @param onSubmit   - Callback chamado ao salvar
 * @returns Função de cleanup que remove listeners
 */
export function renderSettingsForm(
  container: HTMLElement,
  onSubmit: SettingsSubmitFn,
): () => void {
  const current = getSession();
  const cleanups: Array<() => void> = [];

  container.innerHTML = `
    <div class="config-card">
      <div class="config-photo">
        <span class="avatar avatar--lg">${initials(current?.userName ?? "?")}</span>
        <input type="file" id="profile-photo" accept="image/*" hidden>
        <button type="button" class="btn btn--sm btn--gold-outline" id="profile-photo-btn">${icon("upload", 14)} Carregar foto</button>
      </div>

      <form id="profile-form" novalidate>
        <div class="field">
          <label class="field__label" for="profile-name">Nome</label>
          <input type="text" id="profile-name" value="${escapeHtml(current?.userName ?? "")}" maxlength="80">
        </div>

        <h4 class="manage-form-title">Alterar Senha</h4>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="pw-current">Senha atual</label>
            <input type="password" id="pw-current" autocomplete="current-password">
          </div>
          <div class="field">
            <label class="field__label" for="pw-new">Nova senha</label>
            <input type="password" id="pw-new" autocomplete="new-password">
          </div>
          <div class="field">
            <label class="field__label" for="pw-confirm">Confirmar nova senha</label>
            <input type="password" id="pw-confirm" autocomplete="new-password">
          </div>
        </div>

        <h4 class="manage-form-title">Alterar Email de Acesso</h4>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="email-current">Email atual</label>
            <input type="password" id="email-current" autocomplete="current-password">
          </div>
          <div class="field">
            <label class="field__label" for="email-new">Novo email</label>
            <input type="email" id="email-new" value="${escapeHtml(current?.userEmail ?? "")}" autocapitalize="none" spellcheck="false">
          </div>
          <div class="field">
            <label class="field__label" for="email-confirm">Confirmar novo email</label>
            <input type="email" id="email-confirm" autocapitalize="none" spellcheck="false">
          </div>
        </div>

        <div class="config-actions">
          <button type="button" class="btn btn--danger" data-profile-cancel>Cancelar</button>
          <button type="submit" class="btn btn--success">Salvar alterações</button>
        </div>
      </form>
    </div>
  `;

  // --- Photo upload ---
  const photoBtn = $<HTMLButtonElement>("#profile-photo-btn", container);
  const photoInput = $<HTMLInputElement>("#profile-photo", container);
  const avatar = $<HTMLElement>(".config-photo .avatar", container);

  if (photoBtn && photoInput && avatar) {
    const click = (): void => photoInput.click();
    photoBtn.addEventListener("click", click);
    cleanups.push(() => photoBtn.removeEventListener("click", click));

    const onPhotoChange = (): void => {
      const file = photoInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        sessionStorage.setItem("maraca.profilePhoto", dataUrl);
        avatar.style.backgroundImage = `url("${dataUrl}")`;
        avatar.textContent = "";
        showToast("Foto atualizada.");
      };
      reader.readAsDataURL(file);
    };
    photoInput.addEventListener("change", onPhotoChange);
    cleanups.push(() => photoInput.removeEventListener("change", onPhotoChange));

    const savedPhoto = sessionStorage.getItem("maraca.profilePhoto");
    if (savedPhoto) {
      avatar.style.backgroundImage = `url("${savedPhoto}")`;
      avatar.textContent = "";
    }
  }

  // --- Form: cancel ---
  const form = $<HTMLFormElement>("#profile-form", container);
  if (form) {
    const cancelBtn = $<HTMLButtonElement>("[data-profile-cancel]", container);
    if (cancelBtn) {
      const cancel = (): void => {
        const s = getSession();
        const nameInput = $("#profile-name", container) as HTMLInputElement;
        nameInput.value = s?.userName ?? "";
        ($("#email-new", container) as HTMLInputElement).value = s?.userEmail ?? "";
        (form.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>).forEach((i) => {
          i.value = "";
        });
        ($("#email-confirm", container) as HTMLInputElement).value = "";
        showToast("Alterações descartadas.");
      };
      cancelBtn.addEventListener("click", cancel);
      cleanups.push(() => cancelBtn.removeEventListener("click", cancel));
    }

    // --- Form: submit ---
    const submit = (event: Event): void => {
      event.preventDefault();
      const nome = ($("#profile-name", container) as HTMLInputElement).value.trim();
      const pwCurrent = ($("#pw-current", container) as HTMLInputElement).value;
      const pwNew = ($("#pw-new", container) as HTMLInputElement).value;
      const pwConfirm = ($("#pw-confirm", container) as HTMLInputElement).value;
      const emailPw = ($("#email-current", container) as HTMLInputElement).value;
      const emailNew = ($("#email-new", container) as HTMLInputElement).value.trim().toLowerCase();
      const emailConfirm = ($("#email-confirm", container) as HTMLInputElement).value.trim().toLowerCase();

      const wantsPassword = pwCurrent !== "" || pwNew !== "" || pwConfirm !== "";
      const emailChanged = emailNew !== (current?.userEmail ?? "");
      const wantsEmail = emailChanged || emailConfirm !== "";

      // --- Validations ---
      if (nome.length === 0) {
        showToast("Informe um nome válido.", "error");
        return;
      }
      if (wantsPassword && pwNew !== pwConfirm) {
        showToast("As novas senhas não coincidem.", "error");
        return;
      }
      if (wantsPassword && (pwCurrent === "" || pwNew.length === 0)) {
        showToast("Preencha senha atual e nova senha.", "error");
        return;
      }
      if (wantsEmail) {
        if (emailPw === "") {
          showToast("Informe a senha atual para alterar o e-mail.", "error");
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNew) || emailNew !== emailConfirm) {
          showToast("Verifique o novo e-mail e a confirmação.", "error");
          return;
        }
      }

      const data: SettingsSubmitData = { nome };
      if (wantsPassword) {
        data.senhaAtual = pwCurrent;
        data.novaSenha = pwNew;
      }
      if (wantsEmail) {
        data.email = emailNew;
      }

      void (async () => {
        const ok = await onSubmit(data);
        if (ok) {
          showToast("Alterações salvas.");
        }
      })();
    };
    form.addEventListener("submit", submit);
    cleanups.push(() => form.removeEventListener("submit", submit));
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
