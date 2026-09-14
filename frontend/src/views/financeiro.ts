import { renderPanel } from "../ui/layout.js";
import { requireRole } from "../services/auth.js";
import { $, $$, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateShort, todayIso } from "../ui/format.js";
import { closeModal, confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { attachCurrencyMask, currencyToNumber } from "../ui/mask.js";
import {
  bindPaginacao,
  criarPaginacaoEstado,
  paginar,
  paginacaoHtml,
} from "../ui/pagination.js";
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
  listarPendenciasComissao,
  obterConfiguracaoComissao,
  obterResumoFinanceiro,
  type EvolucaoMensal,
  type PendenciaComissao,
  type ResumoFinanceiro,
} from "../services/financeiro.js";
import { salvarComissaoDeepLink } from "../services/comissaoDeepLink.js";

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

/** Formata "2026-08" como "Agosto de 2026" (UTC, sem deslocamento de fuso). */
const MES_ANO_PT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function labelMesAno(mesAno: string): string {
  const [ano, mes] = mesAno.split("-").map(Number);
  if (!ano || !mes) return mesAno;
  const label = MES_ANO_PT.format(new Date(Date.UTC(ano, mes - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Mês corrente no formato "YYYY-MM" (regra do select: o mês atual NUNCA é listado). */
function mesCorrenteAnoMes(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Meses anteriores ao corrente extraídos do array de evolução mensal do
 * `ResumoFinanceiro` (fonte do gráfico "Evolução mensal") — ordem do mais
 * recente para o mais antigo; o mês imediatamente anterior fica no topo.
 */
function mesesAnterioresDisponiveis(
  evolucao: EvolucaoMensal[],
): Array<{ mes: string; label: string }> {
  const corrente = mesCorrenteAnoMes();
  return evolucao
    .map((e) => e.mes)
    .filter((mes) => mes < corrente)
    .sort((a, b) => b.localeCompare(a))
    .map((mes) => ({ mes, label: labelMesAno(mes) }));
}

/**
 * Card "Resumo do mês anterior": select de mês/ano (somente meses anteriores
 * ao corrente, imediatamente anterior selecionado por padrão) + Receita,
 * Despesas e Lucro do mês escolhido, extraídos de `evolucaoMensal`.
 */
function resumoMesAnteriorHTML(resumo: ResumoFinanceiro): string {
  const meses = mesesAnterioresDisponiveis(resumo.evolucaoMensal);
  const selecionado = meses[0]?.mes ?? "";
  const entrada = resumo.evolucaoMensal.find((e) => e.mes === selecionado);
  const dinheiro = (v: string | undefined): string => formatCurrency(Number(v ?? 0));
  return `
    <div class="compare-card">
      <strong class="compare-card__title">Resumo do mês anterior</strong>
      <label class="compare-card__select" for="resumo-mes-ref">
        <span class="field__label">Mês de referência</span>
      </label>
      <select id="resumo-mes-ref" class="compare-card__field input" data-resumo-mes>
        ${meses
          .map(
            (m) =>
              `<option value="${escapeHtml(m.mes)}"${m.mes === selecionado ? " selected" : ""}>${escapeHtml(
                m.label,
              )}</option>`,
          )
          .join("")}
      </select>
      <div class="compare-card__row">
        <span>Receita</span>
        <strong data-resumo-receita>${escapeHtml(dinheiro(entrada?.receita))}</strong>
        <span>Despesas</span>
        <strong data-resumo-despesa>${escapeHtml(dinheiro(entrada?.despesa))}</strong>
        <span>Lucro</span>
        <strong data-resumo-lucro>${escapeHtml(dinheiro(entrada?.lucro))}</strong>
      </div>
    </div>
  `;
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

    // Paginação client-side (mesma abordagem dos agendamentos): a lista chega
    // completa da API; o fatiamento (.slice) é feito na página atual.
    const paginacao = criarPaginacaoEstado();

    const bindTabela = (): void => {
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
    };

    const montar = (): void => {
      const pagina = paginar(despesas, paginacao);
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
              ${pagina
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
                            // Despesa automática COM agendamento → link para atendimento;
                            // automática SEM agendamento → texto informativo;
                            // manual → Editar + Excluir.
                            d.automatica && d.agendamento_id
                              ? `<a class="btn btn--sm btn--outline" href="#/admin/agendamentos">Ver atendimento</a>`
                              : d.automatica
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
          ${despesas.length === 0 ? `<p class="panel__empty">Nenhuma despesa cadastrada.</p>` : paginacaoHtml(despesas.length, paginacao, "despesa", "despesas")}
        </div>
      `;
      bindTabela();
    };

    // Controles de paginação (delegação única por renderização, mesmo padrão
    // dos agendamentos): trocar o select de itens por página volta para a
    // página 1; navegar re-monta a tabela da última lista carregada.
    const cleanupPag = bindPaginacao(panel, paginacao, () => despesas.length, montar);
    cleanups.push(cleanupPag);

    montar();
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
      ${resumoMesAnteriorHTML(resumo)}
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

    // Reatividade do select de mês: atualiza Receita/Despesas/Lucro do card
    // sem re-renderizar a aba (fonte: `evolucaoMensal` já carregado no estado).
    const mesSelect = panel.querySelector<HTMLSelectElement>("[data-resumo-mes]");
    if (mesSelect) {
      const h = (): void => {
        const entrada = resumo.evolucaoMensal.find((e) => e.mes === mesSelect.value);
        const aplicar = (sel: string, valor: string | undefined): void => {
          const el = panel.querySelector<HTMLElement>(sel);
          if (el) el.textContent = formatCurrency(Number(valor ?? 0));
        };
        aplicar("[data-resumo-receita]", entrada?.receita);
        aplicar("[data-resumo-despesa]", entrada?.despesa);
        aplicar("[data-resumo-lucro]", entrada?.lucro);
      };
      mesSelect.addEventListener("change", h);
      cleanups.push(() => mesSelect.removeEventListener("change", h));
    }
  }

function renderEvolucaoBars(evolucao: ResumoFinanceiro["evolucaoMensal"]): string {
  const max = Math.max(
    1,
    ...evolucao.map((e) => Number(e.receita)),
    ...evolucao.map((e) => Number(e.despesa)),
    ...evolucao.map((e) => Number(e.lucro)),
  );
  return `
    <div class="bars" role="img" aria-label="Evolução mensal de receita, despesas e lucro">
      ${evolucao
        .map((e) => {
          const receita = (Number(e.receita) / max) * 100;
          const despesa = (Number(e.despesa) / max) * 100;
          const lucro = Number(e.lucro);
          const lucroPct = lucro > 0 ? (lucro / max) * 100 : 0;
          // Lucro não positivo → barra em altura zero (sem min-height falsa);
          // o valor real é sempre comunicado pelo tooltip.
          const lucroCls = lucro > 0 ? "bars__bar--lucro" : "bars__bar--lucro bars__bar--zero";
          const mesLabel = String(Number(e.mes.slice(5)));
          return `
            <div class="bars__col">
              <div class="bars__tooltip" role="tooltip">
                <strong>${escapeHtml(labelMesAno(e.mes))}</strong>
                <span>Receita: ${escapeHtml(formatCurrency(Number(e.receita)))}</span>
                <span>Despesas: ${escapeHtml(formatCurrency(Number(e.despesa)))}</span>
                <span>Lucro: ${escapeHtml(formatCurrency(lucro))}</span>
              </div>
              <div class="bars__bar bars__bar--receita" style="height:${receita.toFixed(1)}%"></div>
              <div class="bars__bar bars__bar--despesa" style="height:${despesa.toFixed(1)}%"></div>
              <div class="bars__bar ${lucroCls}" style="height:${lucroPct.toFixed(1)}%"></div>
              <span class="bars__label">${escapeHtml(mesLabel)}</span>
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

    // ── Pendências de comissão (spec 3.5) ───────────────────────────────
    // Atendimentos concluídos sem percentual cadastrado naquele momento; o
    // próprio PUT de comissões resolve as pendências do par quando o admin
    // cadastra a % — depois do fluxo "Configurar agora", o item some da lista.
    const pendenciasSection = document.createElement("section");
    pendenciasSection.className = "panel__section";
    pendenciasSection.innerHTML = `
      <h3 class="panel__section-title">COMISSÕES PENDENTES</h3>
      <p class="manage-head__sub">Atendimentos concluídos sem percentual de comissão cadastrado</p>
      <div data-pendencias-content><p class="panel__empty">Carregando pendências...</p></div>
    `;
    tip.after(pendenciasSection);

    const pendenciasBox = pendenciasSection.querySelector<HTMLElement>("[data-pendencias-content]");

    const tabelaPendenciasHtml = (pendencias: PendenciaComissao[]): string =>
      pendencias.length === 0
        ? `<p class="panel__empty">Nenhuma comissão pendente.</p>`
        : `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Serviço</th>
                <th>Data do atendimento</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              ${pendencias
                .map(
                  (p) => `
                    <tr>
                      <td><strong>${escapeHtml(p.funcionario_nome)}</strong></td>
                      <td>${escapeHtml(p.servico_nome)}</td>
                      <td>${escapeHtml(formatDateShort(p.data))}</td>
                      <td>
                        <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold"
                          data-link-pendencia
                          data-funcionario-id="${escapeHtml(p.funcionario_id)}"
                          data-servico-id="${escapeHtml(p.servico_id)}">Configurar agora</button>
                      </td>
                    </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>`;

    if (pendenciasBox) {
      void (async () => {
        try {
          const pendencias = await listarPendenciasComissao();
          pendenciasBox.innerHTML = tabelaPendenciasHtml(pendencias);
        } catch (error) {
          pendenciasBox.innerHTML = `<p class="panel__empty" role="alert">${escapeHtml(
            errorMessage(error, "Não foi possível carregar as pendências de comissão."),
          )}</p>`;
        }
      })();
    }

    // "Configurar agora": grava o deep-link (sessionStorage) e navega para
    // Profissionais — `manage.ts` consome o comando e abre o modal do
    // profissional com foco no input percentual do serviço pendente.
    const handleLinkPendencia = (ev: Event): void => {
      const btn = (ev.target as HTMLElement | null)?.closest<HTMLElement>("[data-link-pendencia]");
      if (!btn) return;
      const funcionarioId = btn.getAttribute("data-funcionario-id");
      const servicoId = btn.getAttribute("data-servico-id");
      if (!funcionarioId || !servicoId) return;
      salvarComissaoDeepLink({ funcionarioId, servicoId });
      window.location.hash = "#/admin/profissionais";
    };
    panel.addEventListener("click", handleLinkPendencia);
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
