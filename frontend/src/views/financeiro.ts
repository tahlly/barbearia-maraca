import { renderPanel } from "../ui/layout.js";
import { requireRole } from "../services/auth.js";
import { $, $$, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateShort, todayIso } from "../ui/format.js";
import { closeModal, confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { attachCurrencyMask, currencyToNumber } from "../ui/mask.js";
import {
  atualizarDespesa,
  criarDespesa,
  listarDespesas,
  removerDespesa,
  TIPO_DESPESA_LABEL,
  TIPO_DESPESA_MANUAL,
  type Despesa,
} from "../services/despesas.js";
import {
  atualizarConfiguracaoComissao,
  obterConfiguracaoComissao,
  obterResumoFinanceiro,
  type ResumoFinanceiro,
} from "../services/financeiro.js";

const TIPO_BADGE: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  fixa: "warning",
  variavel: "info",
  comissao: "success",
  outro: "neutral",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

function recorrenteBadge(recorrente: boolean): string {
  return recorrente
    ? `<span class="badge badge--success">Recorrente</span>`
    : `<span class="badge badge--neutral">Pontual</span>`;
}

type AbaFinanceiro = "despesas" | "resumo" | "comissao";

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
  let abaAtiva: AbaFinanceiro = "despesas";

  function renderAbas(): string {
    const items: Array<{ id: AbaFinanceiro; label: string }> = [
      { id: "despesas", label: "Despesas" },
      { id: "resumo", label: "Resumo" },
      { id: "comissao", label: "Regras de Comissão" },
    ];
    return `
      <div class="tab-bar" role="tablist" aria-label="Seções do financeiro">
        ${items
          .map(
            (t) => `
              <button type="button" role="tab" id="fin-tab-${t.id}" aria-selected="${abaAtiva === t.id}" aria-controls="fin-panel-${t.id}"
                class="tab${abaAtiva === t.id ? " tab--active" : ""}" data-fin-abas="${t.id}">
                ${escapeHtml(t.label)}
              </button>`,
          )
          .join("")}
      </div>
    `;
  }

  async function renderConteudo(): Promise<void> {
    content.innerHTML = `
      ${renderAbas()}
      <section class="tab-panel" id="fin-panel-${abaAtiva}" role="tabpanel" aria-labelledby="fin-tab-${abaAtiva}">
      </section>
    `;

    const panel = content.querySelector<HTMLElement>("#fin-panel-" + abaAtiva);
    if (!panel) return;

    if (abaAtiva === "despesas") await renderTabelaDespesas(panel);
    if (abaAtiva === "resumo") await renderResumo(panel);
    if (abaAtiva === "comissao") await renderRegrasComissao(panel);

    $$("[data-fin-abas]", content).forEach((btn) => {
      const h = (): void => {
        abaAtiva = btn.getAttribute("data-fin-abas") as AbaFinanceiro;
        void renderConteudo();
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });
  }

  // ── Aba 1: Despesas ──────────────────────────────────────────────────
  async function renderTabelaDespesas(panel: HTMLElement): Promise<void> {
    let despesas: Despesa[];
    try {
      despesas = await listarDespesas();
    } catch (error) {
      panel.innerHTML = `
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

    panel.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Despesas</h3>
          <p class="manage-head__sub">Controle as saídas financeiras do salão</p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--primary" data-new-despesa>${escapeHtml("Nova Despesa")}</button>
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
            ${despesas
              .map(
                (d) => `
                  <tr>
                    <td><strong class="uppercase">${escapeHtml(d.descricao)}</strong></td>
                    <td>${tipoBadge(d.tipo_despesa)}</td>
                    <td>${formatCurrency(d.valor)}</td>
                    <td>${formatDateShort(d.data)}</td>
                    <td>${recorrenteBadge(d.recorrente)}</td>
                    <td>
                      <span class="cell-actions">
                        ${
                          // Pré-editar/editar/excluir só para despesas MANUAIS.
                          d.automatica
                            ? `<span class="muted-note">Gerada pelo sistema</span>`
                            : `<span class="cell-actions">
                                <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-edit-despesa="${escapeHtml(d.id)}">Editar</button>
                                <button type="button" class="btn btn--sm btn--danger-outline" data-delete-despesa="${escapeHtml(d.id)}">Excluir</button>
                              </span>`
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

    const newBtn = $<HTMLButtonElement>("[data-new-despesa]", panel);
    if (newBtn) {
      const h = (): void => openNovaDespesa();
      newBtn.addEventListener("click", h);
      cleanups.push(() => newBtn.removeEventListener("click", h));
    }

    $$("[data-edit-despesa]", panel).forEach((btn) => {
      const id = btn.getAttribute("data-edit-despesa")!;
      const h = (): void => {
        const despesa = despesas.find((d) => d.id === id);
        if (!despesa) return;
        openEditarDespesa(despesa);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });

    $$("[data-delete-despesa]", panel).forEach((btn) => {
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
    await renderConteudo();
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
        // MINÚSCULAS: o visual em MAIÚSCULAS é responsabilidade da classe `uppercase`.
        .toLowerCase();
      const tipoRaw = overlay.querySelector<HTMLSelectElement>("#fin-tipo")?.value ?? "";
      const tipo = TIPO_DESPESA_MANUAL.find((t) => t === tipoRaw) ?? null;
      const valor = currencyToNumber(overlay.querySelector<HTMLInputElement>("#fin-valor")?.value ?? "");
      const data = (overlay.querySelector<HTMLInputElement>("#fin-data")?.value ?? "").trim();
      const recorrente = overlay.querySelector<HTMLInputElement>("#fin-recorrente")?.checked ?? false;

      if (descricao.length < 3) {
        showToast("Informe a descrição.", "error");
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

      const submitBtn = overlay.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("is-loading");
      }

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
        await renderConteudo();
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

  function openEditarDespesa(despesa: Despesa): void {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="fin-modal-title-ed">
        <div class="modal__header">
          <h2 class="modal__title" id="fin-modal-title-ed">Editar despesa</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <form class="modal__body" id="fin-form" novalidate>
          <div class="field">
            <label class="field__label" for="fin-desc">Descrição *</label>
            <input type="text" id="fin-desc" class="uppercase" maxlength="80" value="${escapeHtml(despesa.descricao)}" required>
            <span class="field__error">Informe a descrição.</span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="fin-tipo">Tipo *</label>
              <select id="fin-tipo" class="uppercase" required>
                <option value="">Selecione...</option>
                ${TIPO_DESPESA_MANUAL.map((t) => `<option value="${t}"${t === despesa.tipo_despesa ? " selected" : ""}>${escapeHtml(TIPO_DESPESA_LABEL[t])}</option>`).join("")}
              </select>
              <span class="field__error">Selecione o tipo.</span>
            </div>
            <div class="field">
              <label class="field__label" for="fin-valor">Valor (R$) *</label>
              <input type="text" id="fin-valor" class="uppercase" inputmode="decimal" value="${escapeHtml(formatCurrency(despesa.valor))}" autocomplete="off" required>
              <span class="field__error">Informe um valor válido.</span>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="fin-data">Data *</label>
            <input type="date" id="fin-data" value="${escapeHtml(despesa.data)}" required>
            <span class="field__error">Informe a data.</span>
          </div>
          <label class="check-line">
            <input type="checkbox" id="fin-recorrente"${despesa.recorrente ? " checked" : ""}>
            <span>Despesa recorrente</span>
          </label>
          <div class="modal__footer">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn--primary">Salvar alterações</button>
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
        // MINÚSCULAS: o visual em MAIÚSCULAS é responsabilidade da classe `uppercase`.
        .toLowerCase();
      const tipoRaw = overlay.querySelector<HTMLSelectElement>("#fin-tipo")?.value ?? "";
      const tipo = TIPO_DESPESA_MANUAL.find((t) => t === tipoRaw) ?? null;
      const valor = currencyToNumber(overlay.querySelector<HTMLInputElement>("#fin-valor")?.value ?? "");
      const data = (overlay.querySelector<HTMLInputElement>("#fin-data")?.value ?? "").trim();
      const recorrente = overlay.querySelector<HTMLInputElement>("#fin-recorrente")?.checked ?? false;

      if (descricao.length < 3) {
        showToast("Informe a descrição.", "error");
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

      const submitBtn = overlay.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("is-loading");
      }

      void (async () => {
        try {
          await atualizarDespesa(despesa.id, {
            descricao,
            tipo_despesa: tipo,
            valor,
            data,
            recorrente,
          });
        } catch (error) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove("is-loading");
          }
          showToast(errorMessage(error, "Não foi possível atualizar a despesa."), "error");
          return;
        }
        showToast("Despesa atualizada!");
        finish();
        await renderConteudo();
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

  // ── Aba 2: Resumo ────────────────────────────────────────────────────
  async function renderResumo(panel: HTMLElement): Promise<void> {
    let resumo: ResumoFinanceiro;
    try {
      resumo = await obterResumoFinanceiro();
    } catch (error) {
      panel.innerHTML = `
        <h3 class="panel__section-title">Resumo financeiro</h3>
        <p class="panel__empty" role="alert">${escapeHtml(errorMessage(error, "Não foi possível carregar o resumo."))}</p>
      `;
      return;
    }

    const kpis = resumo.kpis;
    const comp = resumo.comparativoMensal;
    const diff = (v: string | null): string => {
      if (v === null || v === undefined) return '<span class="muted-note">sem base</span>';
      const num = Number(v);
      const arrow = num >= 0 ? "▲" : "▼";
      const cls = num >= 0 ? "text--success" : "text--danger";
      return `<span class="${cls}">${arrow} ${Math.abs(num).toFixed(1)}%</span>`;
    };

    panel.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Resumo financeiro</h3>
          <p class="manage-head__sub">Visão consolidada do período</p>
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi">
          <span class="kpi__label">Receita</span>
          <strong class="kpi__value">${escapeHtml(formatCurrency(Number(kpis.receita)))}</strong>
        </div>
        <div class="kpi">
          <span class="kpi__label">Despesas</span>
          <strong class="kpi__value">${escapeHtml(formatCurrency(Number(kpis.despesa)))}</strong>
        </div>
        <div class="kpi">
          <span class="kpi__label">Lucro Líquido</span>
          <strong class="kpi__value">${escapeHtml(formatCurrency(Number(kpis.lucroLiquido)))}</strong>
        </div>
        <div class="kpi">
          <span class="kpi__label">Margem</span>
          <strong class="kpi__value">${escapeHtml(Number(kpis.margem).toFixed(1))}%</strong>
        </div>
      </div>
      <div class="compare-card">
        <strong class="compare-card__title">Este mês vs. mês anterior</strong>
        <div class="compare-card__row">
          <span>Receita</span>${diff(comp.variacaoReceitaPercentual)}
          <span>Despesas</span>${diff(comp.variacaoDespesaPercentual)}
          <span>Lucro</span>${diff(comp.variacaoLucroPercentual)}
        </div>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <h4 class="chart-card__title">Evolução mensal (Receita × Despesa × Lucro)</h4>
          <div class="chart chart--lines" data-chart-evolucao>${renderEvolucaoBars(resumo.evolucaoMensal)}</div>
        </div>
        <div class="chart-card">
          <h4 class="chart-card__title">Despesas por categoria</h4>
          <div class="chart chart--cats" data-chart-categorias>${renderCategorias(resumo.despesasPorCategoria)}</div>
        </div>
      </div>
    `;
  }

  function renderEvolucaoBars(evolucao: ResumoFinanceiro["evolucaoMensal"]): string {
    const max = Math.max(1, ...evolucao.map((e) => Number(e.receita)), ...evolucao.map((e) => Number(e.despesa)));
    return `
      <div class="bars">
        ${evolucao
          .map((e) => {
            const receita = (Number(e.receita) / max) * 100;
            const despesa = (Number(e.despesa) / max) * 100;
            return `
              <div class="bars__col" title="${escapeHtml(e.mes)}">
                <div class="bars__bar bars__bar--receita" style="height:${receita.toFixed(1)}%"></div>
                <div class="bars__bar bars__bar--despesa" style="height:${despesa.toFixed(1)}%"></div>
                <span class="bars__label">${escapeHtml(e.mes.slice(5))}</span>
              </div>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderCategorias(cats: ResumoFinanceiro["despesasPorCategoria"]): string {
    const total = cats.reduce((acc, c) => acc + Number(c.valor), 0) || 1;
    return `
      <ul class="cat-list">
        ${cats
          .map((c) => {
            const pct = ((Number(c.valor) / total) * 100).toFixed(1);
            return `
              <li class="cat-list__item">
                <span class="cat-list__label uppercase">${escapeHtml(TIPO_DESPESA_LABEL[c.tipo_despesa as Despesa["tipo_despesa"]] ?? c.tipo_despesa)}</span>
                <span class="cat-list__track"><span class="cat-list__fill" style="width:${pct}%"></span></span>
                <span class="cat-list__value">${escapeHtml(formatCurrency(Number(c.valor)))}</span>
              </li>`;
          })
          .join("")}
      </ul>
    `;
  }

  // ── Aba 3: Regras de Comissão ────────────────────────────────────────
  async function renderRegrasComissao(panel: HTMLElement): Promise<void> {
    panel.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Regras de Comissão</h3>
          <p class="manage-head__sub">Defina se a barbearia paga comissão aos profissionais</p>
        </div>
      </div>
      <div class="switch-card">
        <div class="switch-card__head">
          <div>
            <strong class="switch-card__title">A barbearia paga comissão aos profissionais?</strong>
            <p class="switch-card__hint">Interruptor global das comissões do salão</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="fin-comissao-toggle" data-comissao-toggle>
            <span class="switch__track" aria-hidden="true"></span>
            <span class="switch__state" data-comissao-state>CARREGANDO…</span>
          </label>
        </div>
      </div>
    `;

    const toggle = panel.querySelector<HTMLInputElement>("[data-comissao-toggle]");
    const stateEl = panel.querySelector<HTMLElement>("[data-comissao-state]");

    // Carrega o estado atual (GET) para não sobrescrever o valor real.
    let config: { comissao_ativa: boolean };
    try {
      config = await obterConfiguracaoComissao();
    } catch (error) {
      showToast(errorMessage(error, "Não foi possível carregar a configuração de comissão."), "error");
      if (toggle) toggle.disabled = true;
      if (stateEl) stateEl.textContent = "INDISPONÍVEL";
      return;
    }

    const apply = (): void => {
      if (!toggle || !stateEl) return;
      const ativa = toggle.checked;
      stateEl.textContent = ativa ? "SIM" : "NÃO";
      stateEl.className = "switch__state " + (ativa ? "switch__state--on" : "switch__state--off");
      // Texto explicativo dinâmico quando o interruptor está desligado.
      const tip = panel.querySelector<HTMLElement>("[data-comissao-tip]");
      if (tip) {
        tip.innerHTML = ativa
          ? `<p>Comissões ativas: cada serviço do profissional recebe o percentual configurado.</p>`
          : `<p><strong>O que o sistema calcula com o interruptor desligado:</strong> Faturamento − Despesas gerais = Lucro Líquido. Nenhuma pergunta de comissão aparece em nenhuma outra tela.</p>`;
      }
    };

    if (toggle) {
      toggle.checked = config.comissao_ativa;
      toggle.addEventListener("change", () => {
        const next = toggle.checked;
        void (async () => {
          try {
            await atualizarConfiguracaoComissao(next);
            showToast(next ? "Comissão ativada!" : "Comissão desativada.");
            apply();
          } catch (error) {
            toggle.checked = !next;
            showToast(errorMessage(error, "Não foi possível salvar a configuração."), "error");
          }
        })();
      });
      cleanups.push(() => toggle.addEventListener("change", () => {}));
    }

    // Insere o bloco de texto dinâmico abaixo do card.
    const tip = document.createElement("div");
    tip.className = "note note--info";
    tip.setAttribute("data-comissao-tip", "");
    tip.innerHTML = `<p class="muted-note">Carregando…</p>`;
    panel.querySelector(".switch-card")?.after(tip);
    apply();
  }

  void renderConteudo();

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}

// Helpers de exibição (módulo)
export function tipoBadge(tipo: string): string {
  const variant = TIPO_BADGE[tipo] ?? "neutral";
  const label = TIPO_DESPESA_LABEL[tipo as Despesa["tipo_despesa"]] ?? tipo;
  return `<span class="badge badge--${variant}">${escapeHtml(label)}</span>`;
}
