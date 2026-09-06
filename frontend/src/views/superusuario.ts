import { requireRole } from "../services/auth.js";
import {
  createAdmin,
  deleteAdmin,
  findAdminByEmail,
  isLastAdmin,
  listAdmins,
  updateAdmin,
} from "../services/admins.js";
import { findUsuarioByEmail } from "../services/usuarios.js";
import { $$, $, escapeHtml, initials } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { renderPanel } from "../ui/layout.js";
import { closeModal, confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import type { AdminProfile } from "../services/admins.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function renderSuperusuario(container: HTMLElement): () => void {
  requireRole(["superusuario"]);

  const { content, cleanup } = renderPanel(container, {
    title: "Supervisão",
    roleLabel: "Superusuário",
    links: [
      { href: "#/superusuario", label: "Lista de usuários", icon: "users" },
      { href: "#/", label: "Voltar ao site", icon: "arrow-left" },
    ],
  });

  const cleanups: Array<() => void> = [];

  function cleanupOn(fn: () => void): () => void {
    cleanups.push(fn);
    return fn;
  }

  function renderList(): void {
    const admins = listAdmins();

    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Lista de usuários</h3>
          <p class="manage-head__sub">Perfis administrativos cadastrados</p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--primary" data-new-admin>${icon("user-plus", 16)} Adicionar administrador</button>
        </div>
      </div>

      <div class="panel__section">
        ${admins
          .map(
            (admin) => `
              <div class="user-list">
                <div class="user-list__identity">
                  <span class="avatar user-list__avatar">${initials(admin.nome)}</span>
                  <div class="user-list__meta">
                    <strong>${escapeHtml(admin.nome)}</strong>
                    <small>${escapeHtml(admin.email)}</small>
                  </div>
                </div>
                <div class="cell-actions">
                  <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-edit-admin="${escapeHtml(admin.id)}">${icon("edit", 15)} Editar</button>
                  <button type="button" class="btn btn--sm btn--danger-outline" data-delete-admin="${escapeHtml(admin.id)}">${icon("trash", 15)} Excluir</button>
                </div>
              </div>`,
          )
          .join("")}
        ${admins.length === 0 ? `<p class="panel__empty">Nenhum administrador cadastrado.</p>` : ""}
      </div>
    `;

    const newBtn = $<HTMLButtonElement>("[data-new-admin]", content);
    if (newBtn) {
      const handler = (): void => openAdminModal(null);
      newBtn.addEventListener("click", handler);
      cleanupOn(() => newBtn.removeEventListener("click", handler));
    }

    $$("[data-edit-admin]", content).forEach((btn) => {
      const id = btn.getAttribute("data-edit-admin")!;
      const handler = (): void => {
        const admin = listAdmins().find((a) => a.id === id);
        if (admin) openAdminModal(admin);
      };
      btn.addEventListener("click", handler);
      cleanupOn(() => btn.removeEventListener("click", handler));
    });

    $$("[data-delete-admin]", content).forEach((btn) => {
      const id = btn.getAttribute("data-delete-admin")!;
      const handler = async (): Promise<void> => {
        const admin = listAdmins().find((a) => a.id === id);
        if (!admin) return;
        if (isLastAdmin()) {
          showToast("Não é possível excluir o último administrador.", "error");
          return;
        }
        const confirmed = await confirmDialog({
          title: "Excluir administrador",
          message: `Excluir o acesso de "${admin.nome}"? Esta ação não pode ser desfeita.`,
          confirmLabel: "Excluir",
          danger: true,
        });
        if (!confirmed) return;
        deleteAdmin(admin.id);
        showToast("Administrador excluído.", "success");
        renderList();
      };
      btn.addEventListener("click", handler);
      cleanupOn(() => btn.removeEventListener("click", handler));
    });
  }

  function openAdminModal(admin: AdminProfile | null): void {
    const overlay = document.createElement("div");
    const isEdit = admin !== null;
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="super-admin-modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="super-admin-modal-title">${isEdit ? "Editar administrador" : "Adicionar administrador"}</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <form class="modal__body" id="super-admin-form" novalidate>
          <div class="field">
            <label class="field__label" for="super-admin-name">Nome completo *</label>
            <input type="text" id="super-admin-name" value="${escapeHtml(admin?.nome ?? "")}" maxlength="80" autocomplete="off" required>
            <span class="field__error">Informe o nome.</span>
          </div>
          <div class="field">
            <label class="field__label" for="super-admin-email">E-mail *</label>
            <input type="email" id="super-admin-email" value="${escapeHtml(admin?.email ?? "")}" maxlength="100" autocapitalize="none" spellcheck="false" autocomplete="off" required>
            <span class="field__error">Informe um e-mail válido.</span>
          </div>
          <div class="field">
            <label class="field__label" for="super-admin-password">Senha ${isEdit ? "(deixe em branco para manter)" : "*"}</label>
            <div class="input-wrap">
              <input type="password" id="super-admin-password" maxlength="64" autocomplete="new-password">
              <button type="button" class="input-suffix" id="toggle-super-admin-password" aria-label="${isEdit ? "Mostrar senha" : "Mostrar senha"}">
                <i class="bx bx-show"></i>
              </button>
            </div>
            <span class="field__error">A senha deve ter pelo menos 6 caracteres.</span>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn--primary">${isEdit ? "Salvar" : "Cadastrar"}</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector<HTMLFormElement>("#super-admin-form")!;
    const passwordInput = $<HTMLInputElement>("#super-admin-password", overlay)!;
    const toggleBtn = $<HTMLButtonElement>("#toggle-super-admin-password", overlay);

    const toggleHandler = (): void => {
      const reveal = passwordInput.type === "password";
      passwordInput.type = reveal ? "text" : "password";
      toggleBtn?.setAttribute("aria-label", reveal ? "Ocultar senha" : "Mostrar senha");
      toggleBtn!.innerHTML = icon(reveal ? "eye-off" : "eye", 18);
    };
    toggleBtn?.addEventListener("click", toggleHandler);

    const finish = (): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
    };

    const submitHandler = async (event: Event): Promise<void> => {
      event.preventDefault();
      const name = ($("#super-admin-name", overlay) as HTMLInputElement).value.trim();
      const email = ($("#super-admin-email", overlay) as HTMLInputElement).value.trim().toLowerCase();
      const password = passwordInput.value;

      if (name.length < 3) {
        showToast("Informe o nome completo.", "error");
        return;
      }
      if (!EMAIL_RE.test(email)) {
        showToast("Informe um e-mail válido.", "error");
        return;
      }
      if (password.length > 0 && password.length < 6) {
        showToast("A senha deve ter pelo menos 6 caracteres.", "error");
        return;
      }
      if (!isEdit && password.length === 0) {
        showToast("Informe uma senha.", "error");
        return;
      }

      const conflict = findAdminByEmail(email);
      if (conflict && conflict.id !== admin?.id) {
        showToast("Já existe um administrador com este e-mail.", "error");
        return;
      }
      if (findUsuarioByEmail(email) && email !== admin?.email) {
        showToast("Este e-mail já é usado por outro perfil.", "error");
        return;
      }

      if (isEdit && admin) {
        updateAdmin(admin.id, {
          nome: name,
          email,
          senha: password.length > 0 ? password : undefined,
        });
        showToast("Administrador atualizado.", "success");
      } else {
        createAdmin({ nome: name, email, senha: password });
        showToast("Administrador cadastrado.", "success");
      }

      finish();
      renderList();
    };
    form.addEventListener("submit", submitHandler);

    overlay.querySelectorAll<HTMLElement>("[data-close]").forEach((btn) => {
      const closeHandler = (): void => finish();
      btn.addEventListener("click", closeHandler);
      cleanups.push(() => btn.removeEventListener("click", closeHandler));
    });

    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });

    document.body.appendChild(overlay);
    openModal(overlay);
  }

  renderList();

  return () => {
    cleanup();
    cleanups.forEach((fn) => fn());
  };
}