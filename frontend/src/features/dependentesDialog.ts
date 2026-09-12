import { closeModal, openModal } from "../ui/modal.js";
import { icon } from "../ui/icons.js";
import { clearFormErrors, setFieldError } from "../ui/dom.js";
import { PARENTESCO_OPTIONS } from "../services/dependentesService.js";
import type { Dependente, DependenteProps, Parentesco } from "../types.js";

export interface DependentesDialogOptions {
  title: string;
  confirmLabel: string;
  /** Dependente sendo editado; null/undefined = criação. */
  dependente?: Dependente | null;
  /** Executa a persistência (mock hoje, API depois). */
  onSubmit: (input: DependenteProps) => Promise<void>;
}

/**
 * Modal de cadastro/edição de dependente — reutilizado pela view de
 * Dependentes e pelo wizard de agendamento (botão "+ Cadastrar novo
 * dependente"). Resolve `true` quando o formulário foi salvo com sucesso.
 */
export function dependentesDialog(options: DependentesDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const initial: DependenteProps = options.dependente ?? { nome: "", parentesco: "conjuge" };

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="dependente-title">
        <div class="modal__header">
          <h2 class="modal__title" id="dependente-title"></h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <div class="modal__body">
          <form class="dependente-form" novalidate>
            <div class="field">
              <label class="field__label" for="dependente-nome">Nome *</label>
              <input type="text" id="dependente-nome" class="uppercase" maxlength="80" placeholder="Nome do dependente" autocomplete="off" required>
            </div>
            <div class="field">
              <label class="field__label" for="dependente-parentesco">Parentesco *</label>
              <select id="dependente-parentesco" class="uppercase" required>
                ${PARENTESCO_OPTIONS.map(
                  (opt) =>
                    `<option value="${opt.value}"${opt.value === initial.parentesco ? " selected" : ""}>${opt.label}</option>`,
                ).join("")}
              </select>
            </div>
            <p class="field__hint">O dependente é cadastrado no seu perfil e pode ser escolhido ao agendar.</p>
            <div class="dependente__actions">
              <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
              <button type="button" class="btn btn--primary" data-submit>${icon("check", 16)} Salvar</button>
            </div>
          </form>
        </div>
      </div>`;

    const titleEl = overlay.querySelector(".modal__title")!;
    titleEl.textContent = options.title;
    const form = overlay.querySelector<HTMLFormElement>(".dependente-form")!;
    const nomeInput = overlay.querySelector<HTMLInputElement>("#dependente-nome")!;
    const selectEl = overlay.querySelector<HTMLSelectElement>("#dependente-parentesco")!;
    nomeInput.value = initial.nome;
    selectEl.value = initial.parentesco;

    const submitBtn = overlay.querySelector<HTMLButtonElement>("[data-submit]")!;
    let saving = false;

    const finish = (result: boolean): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
      resolve(result);
    };

    const handleSubmit = (event: Event): void => {
      event.preventDefault();
      if (saving) return;
      const nome = nomeInput.value.trim();
      if (nome.length < 2) {
        setFieldError(nomeInput, "Informe o nome do dependente.");
        nomeInput.focus();
        return;
      }
      const parentesco = selectEl.value as Parentesco;
      if (!PARENTESCO_OPTIONS.some((o) => o.value === parentesco)) {
        setFieldError(selectEl, "Selecione um parentesco.");
        return;
      }
      saving = true;
      submitBtn.disabled = true;
      form.classList.add("is-saving");
      // Padronização de texto: nomes cadastrais são gravados em CAIXA ALTA
      // (exceto e-mail e senha, que não passam por este formulário).
      void options
        .onSubmit({ nome: nome.toUpperCase(), parentesco })
        .then(() => finish(true))
        .catch((error: unknown) => {
          saving = false;
          submitBtn.disabled = false;
          form.classList.remove("is-saving");
          const message =
            error instanceof Error && error.message.trim() !== ""
              ? error.message
              : "Não foi possível salvar o dependente. Tente novamente.";
          setFieldError(nomeInput, message);
        });
    };

    form.addEventListener("submit", handleSubmit);
    form.addEventListener("input", () => clearFormErrors(form));
    submitBtn.addEventListener("click", handleSubmit);
    form.querySelector("[data-cancel]")!.addEventListener("click", () => finish(false));
    overlay.querySelector("[data-close]")!.addEventListener("click", () => finish(false));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish(false);
    });

    document.body.appendChild(overlay);
    openModal(overlay);
  });
}