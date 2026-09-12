import { renderPanel } from "../ui/layout.js";
import { requireRole } from "../services/auth.js";
import { $, $$, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateShort, todayIso } from "../ui/format.js";
import { closeModal, confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { attachCurrencyMask, currencyToNumber } from "../ui/mask.js";
import {
  criarDespesa,
  DESPESA_CATEGORIAS,
  listarDespesas,
  removerDespesa,
  type Despesa,
} from "../services/despesas.js";

const CATEGORIA_BADGE: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  INSUMOS: "info",
  EQUIPAMENTOS: "info",
  ALUGUEL: "warning",
  FUNCIONÁRIOS: "success",
  MARKETING: "info",
  UTILIDADES: "warning",
  MANUTENÇÃO: "danger",
  OUTROS: "neutral",
};

function categoriaBadge(categoria: string): string {
  const variant = CATEGORIA_BADGE[categoria] ?? "neutral";
  return `<span class="badge badge--${variant}">${escapeHtml(categoria)}</span>`;
}

function recorrenteBadge(recorrente: boolean): string {
  return recorrente
    ? `<span class="badge badge--success">Recorrente</span>`
    : `<span class="badge badge--neutral">Pontual</span>`;
}

export function renderFinanceiro(container: HTMLElement): () => void {
  const session = requireRole(["admin"]);
  const isAdmin = session.role === "admin";
  const base = "/admin";

  const links = isAdmin
    ? [
        { href: `#${base}`, label: "Dashboard", icon: "grid" },
        { href: `#${base}/agendamentos`, label: "Agendamentos", icon: "calendar" },
        { href: `#${base}/servicos`, label: "Serviços", icon: "scissors" },
        { href: `#${base}/profissionais`, label: "Profissionais", icon: "users" },
        { href: `#${base}/financeiro`, label: "Financeiro", icon: "dollar" },
        { href: `#${base}/configuracoes`, label: "Configurações", icon: "cog" }
      ]
    : [];

  const { content, cleanup: cleanupPanel } = renderPanel(container, {
    title: "Financeiro",
    roleLabel: "ADMINISTRADOR",
    links,
  });

  const cleanups: Array<() => void> = [];

  function renderTabela(): void {
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Despesas</h3>
          <p class="manage-head__sub">Controle as saídas financeiras do salão</p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--primary" data-new-despesa>${icon("plus", 16)} Nova Despesa</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor (R$)</th>
              <th>Data</th>
              <th>Recorrente</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${listarDespesas()
              .map(
                (d) => `
                  <tr>
                    <td><strong>${escapeHtml(d.descricao)}</strong></td>
                    <td>${categoriaBadge(d.categoria)}</td>
                    <td>${formatCurrency(d.valor)}</td>
                    <td>${formatDateShort(d.data)}</td>
                    <td>${recorrenteBadge(d.recorrente)}</td>
                    <td>
                      <span class="cell-actions">
                        <button type="button" class="btn btn--sm btn--danger-outline" data-delete-despesa="${escapeHtml(d.id)}">Excluir</button>
                      </span>
                    </td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
        ${listarDespesas().length === 0 ? `<p class="panel__empty">Nenhuma despesa cadastrada.</p>` : ""}
      </div>
    `;

    const newBtn = $<HTMLButtonElement>("[data-new-despesa]", content);
    if (newBtn) {
      const h = (): void => openNovaDespesa();
      newBtn.addEventListener("click", h);
      cleanups.push(() => newBtn.removeEventListener("click", h));
    }

    $$("[data-delete-despesa]", content).forEach((btn) => {
      const id = btn.getAttribute("data-delete-despesa")!;
      const h = (): void => {
        const despesa = listarDespesas().find((d) => d.id === id);
        if (!despesa) return;
        void handleDeleteDespesa(despesa);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });
  }

  async function handleDeleteDespesa(despesa: Despesa): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Excluir despesa",
      message: `Excluir a despesa "${despesa.descricao}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!confirmed) return;
    removerDespesa(despesa.id);
    showToast("Despesa removida.");
    renderTabela();
  }

  function openNovaDespesa(): void {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="fin-modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="fin-modal-title">Nova despesa</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <form class="modal__body" id="fin-form" novalidate>
          <div class="field">
            <label class="field__label" for="fin-desc">Descrição *</label>
            <input type="text" id="fin-desc" class="uppercase" maxlength="80" placeholder="Ex.: Aluguel do salão" required>
            <span class="field__error">Informe a descrição.</span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="fin-cat">Categoria *</label>
              <select id="fin-cat" class="uppercase" required>
                <option value="">Selecione...</option>
                ${DESPESA_CATEGORIAS.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
              </select>
              <span class="field__error">Selecione a categoria.</span>
            </div>
            <div class="field">
              <label class="field__label" for="fin-valor">Valor (R$) *</label>
              <input type="text" id="fin-valor" class="uppercase" inputmode="decimal" placeholder="R$ 0,00" autocomplete="off" required>
              <span class="field__error">Informe um valor válido.</span>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="fin-data">Data *</label>
            <input type="date" id="fin-data" value="${todayIso()}" required>
            <span class="field__error">Informe a data.</span>
          </div>
          <label class="check-line">
            <input type="checkbox" id="fin-recorrente">
            <span>Despesa recorrente</span>
          </label>
          <div class="modal__footer">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn--primary">Salvar despesa</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector<HTMLFormElement>("#fin-form")!;
    const finish = (): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
    };

    const valorInput = overlay.querySelector<HTMLInputElement>("#fin-valor");
    if (valorInput) attachCurrencyMask(valorInput);

    const submitHandler = (event: Event): void => {
      event.preventDefault();
      const descricao = (overlay.querySelector<HTMLInputElement>("#fin-desc")?.value ?? "")
        .trim()
        .toUpperCase();
      const categoria = overlay.querySelector<HTMLSelectElement>("#fin-cat")?.value ?? "";
      const valor = currencyToNumber(overlay.querySelector<HTMLInputElement>("#fin-valor")?.value ?? "");
      const data = (overlay.querySelector<HTMLInputElement>("#fin-data")?.value ?? "").trim();
      const recorrente = overlay.querySelector<HTMLInputElement>("#fin-recorrente")?.checked ?? false;

      if (descricao.length < 3) {
        showToast("Informe a descrição da despesa.", "error");
        return;
      }
      if (!categoria) {
        showToast("Selecione a categoria.", "error");
        return;
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        showToast("Informe um valor válido.", "error");
        return;
      }
      if (!data) {
        showToast("Informe a data.", "error");
        return;
      }

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("is-loading");
      }

      // Mock em memória (serviço compartilhado): adiciona a despesa e re-renderiza.
      criarDespesa({ descricao, categoria, valor, data, recorrente });
      showToast("Despesa criada!");
      finish();
      renderTabela();
    };

    form.addEventListener("submit", submitHandler);
    overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", finish));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });

    document.body.appendChild(overlay);
    openModal(overlay);
  }

  renderTabela();

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}