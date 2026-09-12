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
  listarDespesas,
  removerDespesa,
  TIPO_DESPESA_LABEL,
  TIPO_DESPESA_MANUAL,
  type Despesa,
} from "../services/despesas.js";

const TIPO_BADGE: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  fixa: "warning",
  variavel: "info",
  comissao: "success",
  outro: "neutral",
};

function tipoBadge(tipo: string): string {
  const variant = TIPO_BADGE[tipo] ?? "neutral";
  const label = TIPO_DESPESA_LABEL[tipo as Despesa["tipo_despesa"]] ?? tipo;
  return `<span class="badge badge--${variant}">${escapeHtml(label)}</span>`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
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

  async function renderTabela(): Promise<void> {
    let despesas: Despesa[];
    try {
      despesas = await listarDespesas();
    } catch (error) {
      content.innerHTML = `
        <div class="panel__section manage-head">
          <div class="manage-head__titles">
            <h3 class="panel__section-title">Despesas</h3>
            <p class="manage-head__sub">Controle as saídas financeiras do salão</p>
          </div>
        </div>
        <p class="panel__empty" role="alert">${escapeHtml(errorMessage(error, "Não foi possível carregar as despesas."))}</p>
      `;
      return;
    }

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
              <th>Tipo</th>
              <th>Valor (R$)</th>
              <th>Data</th>
              <th>Recorrente</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${despesas
              .map(
                (d) => `
                  <tr>
                    <td><strong>${escapeHtml(d.descricao)}</strong></td>
                    <td>${tipoBadge(d.tipo_despesa)}</td>
                    <td>${formatCurrency(d.valor)}</td>
                    <td>${formatDateShort(d.data)}</td>
                    <td>${recorrenteBadge(d.recorrente)}</td>
                    <td>
                      <span class="cell-actions">
                        ${
                          d.automatica
                            ? `<span class="muted-note">Gerada pelo sistema</span>`
                            : `<button type="button" class="btn btn--sm btn--danger-outline" data-delete-despesa="${escapeHtml(d.id)}">Excluir</button>`
                        }
                      </span>
                    </td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
        ${despesas.length === 0 ? `<p class="panel__empty">Nenhuma despesa cadastrada.</p>` : ""}
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
        const despesa = despesas.find((d) => d.id === id);
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
    try {
      const ok = await removerDespesa(despesa.id);
      if (!ok) {
        showToast("Não foi possível excluir a despesa.", "error");
        return;
      }
    } catch (error) {
      showToast(errorMessage(error, "Não foi possível excluir a despesa."), "error");
      return;
    }
    showToast("Despesa removida.");
    await renderTabela();
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
              <label class="field__label" for="fin-tipo">Tipo *</label>
              <select id="fin-tipo" class="uppercase" required>
                <option value="">Selecione...</option>
                ${TIPO_DESPESA_MANUAL.map((t) => `<option value="${t}">${escapeHtml(TIPO_DESPESA_LABEL[t])}</option>`).join("")}
              </select>
              <span class="field__error">Selecione o tipo.</span>
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
      const tipoRaw = overlay.querySelector<HTMLSelectElement>("#fin-tipo")?.value ?? "";
      const tipo = TIPO_DESPESA_MANUAL.find((t) => t === tipoRaw) ?? null;
      const valor = currencyToNumber(overlay.querySelector<HTMLInputElement>("#fin-valor")?.value ?? "");
      const data = (overlay.querySelector<HTMLInputElement>("#fin-data")?.value ?? "").trim();
      const recorrente = overlay.querySelector<HTMLInputElement>("#fin-recorrente")?.checked ?? false;

      if (descricao.length < 3) {
        showToast("Informe a descrição da despesa.", "error");
        return;
      }
      if (!tipo) {
        showToast("Selecione o tipo.", "error");
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

      // Persiste a despesa no Backend (POST /api/despesas) e re-renderiza.
      void (async () => {
        try {
          await criarDespesa({ descricao, tipo_despesa: tipo, valor, data, recorrente });
        } catch (error) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove("is-loading");
          }
          showToast(errorMessage(error, "Não foi possível criar a despesa."), "error");
          return;
        }
        showToast("Despesa criada!");
        finish();
        await renderTabela();
      })();
    };

    form.addEventListener("submit", submitHandler);
    overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", finish));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });

    document.body.appendChild(overlay);
    openModal(overlay);
  }

  void renderTabela();

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}