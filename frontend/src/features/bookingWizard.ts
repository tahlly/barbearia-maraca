import { CONFIG } from "../config.js";
import type { Appointment, BookingDraft, Professional } from "../types.js";
import { fetchBarbeiros, fetchFuncionarioPorEmail, loadProfessionals, loadServices } from "../services/catalog.js";
import { createAppointment, reschedule } from "../services/booking.js";
import { buscarClientes, criarCliente } from "../services/clientes.js";
import { getSession } from "../services/auth.js";
import { isDateOpen, slotsForDate } from "../services/schedule.js";
import { $, $$, clearElement, clearFormErrors, escapeHtml, initials } from "../ui/dom.js";
import { icon, serviceIcon } from "../ui/icons.js";
import { formatCurrency, formatDateLong, toIsoDate } from "../ui/format.js";
import { closeModal, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

type StepName = "cliente" | "servicos" | "horario" | "atendimento" | "revisao" | "confirmacao";

interface ClienteSelecionado {
  id: string;
  nome: string;
  email: string;
}

interface WizardState {
  step: number;
  serviceId: string | null;
  professionalId: string | null;
  dateIso: string | null;
  time: string | null;
  rescheduleId: string | null;
  rescheduleAppointment: Appointment | null;
  cliente: ClienteSelecionado | null;
  clientResults: ClienteSelecionado[];
  clientSearchPerformed: boolean;
  attendance: "proprio" | "outra_pessoa";
  pessoaAtendidaNome: string | null;
}

export interface BookingWizardHandle {
  openNew(preselectServiceId?: string): void;
  openForReschedule(appointment: Appointment): void;
}

export interface BookingWizardOptions {
  onBookingCreated?: () => void;
}

// O modal #booking-modal é global e compartilhado por todas as views
// (landing, minhaConta, manage). O wizard só pode ser inicializado UMA vez:
// re-inicializar anexaria listeners duplicados em elementos persistentes e
// causaria submissões duplas. O callback de sucesso é trocável conforme a
// view ativa (só uma view está ativa por vez na SPA).
let activeHandle: BookingWizardHandle | null = null;
let onBookingCreatedRef: (() => void) | null = null;

export function initBookingWizard(options: BookingWizardOptions = {}): BookingWizardHandle {
  if (activeHandle) {
    onBookingCreatedRef = options.onBookingCreated ?? null;
    return activeHandle;
  }
  onBookingCreatedRef = options.onBookingCreated ?? null;
  let catalogServices = loadServices();
  let catalogProfessionals: Professional[] = [];

  // Atualiza o catálogo local do wizard buscando SOMENTE barbeiros.
  // O cache global (`loadProfessionals`) permanece completo para o painel
  // admin/recepção e para minhaConta; o wizard passa a depender desta lista.
  const refreshCatalog = async (): Promise<void> => {
    catalogServices = loadServices();
    try {
      catalogProfessionals = await fetchBarbeiros();
    } catch {
      // Fallback: usa o cache global já populado (pelo prime), se houver.
      catalogProfessionals = loadProfessionals().filter((p) => p.cargo === "barbeiro");
    }
    // Barbeiro agenda somente para si — resolve o id do próprio funcionário.
    if (sessionRole === "profissional") {
      const sess = getSession();
      if (sess?.userEmail) {
        const me = await fetchFuncionarioPorEmail(sess.userEmail);
        ownProfessionalId = me?.id ?? null;
      }
    }
  };

  // Guard de sequência: evita que duas renderizações concorrentes de horários
  // (ex.: trocar profissional e mudar data em paralelo) montem a grade duas vezes.
  let slotsRenderSeq = 0;

  // Recepcionista e admin operam em MODO OPERADOR: o primeiro passo identifica
  // o cliente (buscar existente ou cadastrar novo) e o agendamento é criado em
  // nome desse cliente. Cliente autenticado usa o fluxo padrão (token).
  const sessionRole = getSession()?.role;
  const operatorMode = sessionRole === "recepcionista" || sessionRole === "admin" || sessionRole === "profissional";

  /** Quando o papel é `profissional`, armazena o id do próprio funcionário. */
  let ownProfessionalId: string | null = null;

  const overlay = $("#booking-modal")!;
  const form = $<HTMLFormElement>("#booking-form")!;
  const stepsItems = $$("#booking-steps .steps__item");
  const progressFill = $("#booking-progress")!;
  const panels = $$(".wizard__step", form);
  const servicesBox = $("#booking-services")!;
  const prosBox = $("#booking-professionals")!;
  const dateInput = $<HTMLInputElement>("#booking-date")!;
  const dateControl = $("#booking-date-control")!;
  const slotsBox = $("#booking-slots")!;
  const slotsHint = $("#slots-hint")!;
  const totalEl = $("#booking-total")!;
  const footer = $(".wizard__footer", form)!;
  const bodyScroll = $(".wizard__body", form)!;
  const prevBtn = $<HTMLButtonElement>("#booking-prev")!;
  const nextBtn = $<HTMLButtonElement>("#booking-next")!;
  const successTitle = $("#booking-success-title")!;
  const summaryEl = $("#booking-summary")!;
  const reviewSummaryEl = $("#booking-review-summary")!;

  // Passo Cliente (modo operador)
  const clientSearchInput = $<HTMLInputElement>("#booking-client-search")!;
  const clientResultsBox = $("#booking-client-results")!;
  const clientCreateToggle = $<HTMLButtonElement>("[data-client-create-toggle]", form)!;
  const clientCreateForm = $<HTMLElement>("[data-client-create-form]", form)!;
  const clientCreateSubmit = $<HTMLButtonElement>("[data-client-create-submit]", form)!;
  const clientCreateCancel = $<HTMLButtonElement>("[data-client-create-cancel]", form)!;

  const attendeeOptions = $("#booking-attendee-options")!;
  const attendeeNameWrap = $("#booking-attendee-name-wrap")!;
  const attendeeInput = $<HTMLInputElement>("#booking-attendee-name");

  const clientStepItem = stepsItems.find((el) => el.dataset.stepName === "cliente");
  const clientPanel = panels.find((el) => el.dataset.stepName === "cliente");
  if (clientStepItem) clientStepItem.hidden = !operatorMode;
  if (clientPanel) clientPanel.hidden = !operatorMode;

  // Etapa "Para quem" — visível somente no fluxo do cliente autenticado.
  const atendimentoStepItem = stepsItems.find((el) => el.dataset.stepName === "atendimento");
  const atendimentoPanel = panels.find((el) => el.dataset.stepName === "atendimento");
  if (atendimentoStepItem) atendimentoStepItem.hidden = operatorMode;
  if (atendimentoPanel) atendimentoPanel.hidden = operatorMode;

  // Barbeiro não cadastra clientes — oculta o toggle de criação
  if (operatorMode && sessionRole === "profissional") {
    const createToggle = form.querySelector<HTMLElement>("[data-client-create-toggle]");
    if (createToggle) createToggle.hidden = true;
    const createForm = form.querySelector<HTMLElement>("[data-client-create-form]");
    if (createForm) createForm.hidden = true;
  }

  // Passos visíveis (ordem real do wizard para o papel atual).
  const steps = stepsItems.filter((el) => !el.hidden);
  const stepPanels = panels.filter((el) => !el.hidden);
  const stepNames = stepPanels.map((el) => el.dataset.stepName as StepName);
  const TOTAL_STEPS = stepPanels.length;
  const positionOf = (name: StepName): number => {
    const index = stepNames.indexOf(name);
    return index >= 0 ? index : 0;
  };
  const positionName = (pos: number): StepName => stepNames[pos] ?? "confirmacao";

  const state: WizardState = {
    step: 0,
    serviceId: null,
    professionalId: null,
    dateIso: null,
    time: null,
    rescheduleId: null,
    rescheduleAppointment: null,
    cliente: null,
    clientResults: [],
    clientSearchPerformed: false,
    attendance: "proprio",
    pessoaAtendidaNome: null,
  };

  const today = new Date();
  const minIso = toIsoDate(today);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + CONFIG.bookingHorizonDays);
  const maxIso = toIsoDate(horizon);

  async function isDateEnabled(iso: string): Promise<boolean> {
    if (!state.professionalId) return false;
    return isDateOpen(iso, state.professionalId);
  }

  async function defaultDateIso(): Promise<string> {
    const candidate = new Date(today);
    for (let attempt = 0; attempt < 7; attempt++) {
      const iso = toIsoDate(candidate);
      let enabled = false;
      try {
        enabled = await isDateEnabled(iso);
      } catch {
        return minIso;
      }
      if (enabled) return iso;
      candidate.setDate(candidate.getDate() + 1);
    }
    return minIso;
  }

  function initDateField(): void {
    dateInput.min = minIso;
    dateInput.max = maxIso;

    dateControl.addEventListener("click", () => {
      try {
        dateInput.showPicker();
      } catch {
        dateInput.focus();
      }
    });

    dateInput.addEventListener("change", () => {
      const value = dateInput.value;
      if (!value) {
        state.dateIso = null;
        state.time = null;
        void renderSlots();
        validateStep(positionOf("horario"), false);
        return;
      }
      if (value < minIso || value > maxIso) {
        showToast("Escolha uma data dentro do horizonte de 45 dias.", "error");
        dateInput.value = state.dateIso ?? "";
        return;
      }
      void (async () => {
        let enabled = false;
        try {
          enabled = await isDateEnabled(value);
        } catch {
          showToast("Não foi possível verificar a disponibilidade. Tente novamente.", "error");
          return;
        }
        if (!enabled) {
          showToast("A barbearia está fechada nesta data. Escolha outra.", "error");
          dateInput.value = state.dateIso ?? "";
          return;
        }
        state.dateIso = value;
        state.time = null;
        await renderSlots();
        validateStep(positionOf("horario"), false);
      })();
    });
  }

  function initAttendeeField(): void {
    attendeeOptions.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.name !== "attendance") return;
      if (target.value === "outra_pessoa") {
        state.attendance = "outra_pessoa";
        attendeeNameWrap.hidden = false;
        attendeeInput?.focus();
      } else {
        state.attendance = "proprio";
        attendeeNameWrap.hidden = true;
        state.pessoaAtendidaNome = null;
        if (attendeeInput) attendeeInput.value = "";
      }
      validateStep(positionOf("atendimento"), false);
    });

    attendeeInput?.addEventListener("input", () => {
      state.pessoaAtendidaNome = attendeeInput.value.trim() || null;
      validateStep(positionOf("atendimento"), false);
    });
  }

  function renderServices(): void {
    clearElement(servicesBox);
    const active = catalogServices.filter((s) => s.active);
    if (active.length === 0) {
      servicesBox.innerHTML = `<p class="options-empty options-empty--alert">${icon("alert-circle", 18)}<span>Nenhum serviço disponível no momento. Entre em contato com a barbearia.</span></p>`;
      return;
    }
    for (const service of active) {
      const label = document.createElement("label");
      label.className = "option-card service-option";
      label.innerHTML = `
        <input type="radio" name="service" value="${service.id}">
        <span class="service-option__icon">${serviceIcon(service.icon)}</span>
        <span class="service-option__info">
          <strong>${escapeHtml(service.name)}</strong>
          <small><i class="inline-icon">${icon("clock", 13)}</i> ${service.durationMin} min</small>
        </span>
        <span class="service-option__price">${formatCurrency(service.price)}</span>
        <span class="option-check">${icon("check", 14)}</span>`;
      const input = label.querySelector<HTMLInputElement>("input")!;
      input.checked = state.serviceId === service.id;
      input.addEventListener("change", () => {
        if (input.checked) state.serviceId = service.id;
        updateTotal();
        void renderProfessionals();
        validateStep(positionOf("servicos"), false);
      });
      servicesBox.appendChild(label);
    }
    updateTotal();
  }

  async function renderProfessionals(): Promise<void> {
    clearElement(prosBox);
    // O barbeiro agenda apenas para si mesmo: oculta a lista e mostra confirmação.
    if (sessionRole === "profissional") {
      prosBox.innerHTML = `
        <p class="options-empty"><span>Você será o responsável pelo atendimento.</span></p>`;
      return;
    }
    // Somente barbeiros podem ser agendados. Itens sem o campo `cargo`
    // (payload antigo) NÃO são exibidos, para não permitir agendar com
    // recepcionista/administrador que não possuem horario_trabalho.
    // Quando um serviço com categorias está selecionado, mantém apenas os
    // profissionais que atendem ao menos uma das categorias do serviço.
    const selectedService = catalogServices.find((s) => s.id === state.serviceId);
    const serviceCategories = selectedService?.categories ?? [];
    const hasFilter = serviceCategories.length > 0;
    const matchesService = (p: Professional): boolean =>
      !hasFilter ||
      (p.categories.length > 0 && p.categories.some((c) => serviceCategories.includes(c)));
    const available = catalogProfessionals.filter(
      (p) => p.active && p.cargo === "barbeiro" && matchesService(p),
    );

    if (state.professionalId && !available.some((p) => p.id === state.professionalId)) {
      state.professionalId = null;
    }

    if (available.length === 0) {
      prosBox.innerHTML = `<p class="options-empty options-empty--alert options-empty--error">${icon("alert-circle", 18)}<span>${hasFilter ? "Nenhum profissional atende este serviço no momento. Escolha outro serviço." : "Nenhum profissional disponível no momento."}</span></p>`;
      return;
    }

    for (const pro of available) {
      const label = document.createElement("label");
      label.className = "option-card pro-option";
      label.innerHTML = `
        <input type="radio" name="professional" value="${pro.id}">
        <span class="avatar avatar--sm">${initials(pro.name)}</span>
        <span class="pro-option__info">
          <strong>${escapeHtml(pro.name)}</strong>
          <small>${escapeHtml(pro.role)}</small>
        </span>
        <span class="option-check">${icon("check", 14)}</span>`;
      const input = label.querySelector<HTMLInputElement>("input")!;
      input.checked = state.professionalId === pro.id;
      input.addEventListener("change", () => {
        if (input.checked) {
          state.professionalId = pro.id;
          // Ao trocar de profissional, reavalia a data e os horários.
          void (async () => {
            try {
              const hasSlots = await isDateEnabled(state.dateIso ?? "");
              if (state.dateIso && hasSlots) {
                state.time = null;
                await renderSlots();
              }
            } catch {
              /* renderSlots mostrará o erro de disponibilidade ao usuário */
            }
          })();
        }
        validateStep(positionOf("horario"), false);
      });
      prosBox.appendChild(label);
    }
  }

  function showSlotsHint(message: string, variant: "warning" | "error" = "warning"): void {
    slotsHint.innerHTML = `${icon("alert-circle", 18)}<span>${escapeHtml(message)}</span>`;
    slotsHint.classList.toggle("slots-hint--error", variant === "error");
    slotsHint.hidden = false;
    slotsBox.hidden = true;
  }

  async function renderSlots(): Promise<void> {
    const renderSeq = ++slotsRenderSeq;
    if (!state.dateIso || !state.professionalId) {
      clearElement(slotsBox);
      slotsHint.hidden = true;
      slotsBox.hidden = false;
      const message = !state.dateIso
        ? "Escolha uma data para ver os horários disponíveis."
        : "Escolha um profissional para ver os horários disponíveis.";
      showSlotsHint(message);
      return;
    }

    // slotsForDate() já retorna apenas slots realmente livres (filtra
    // ocupados via endpoint /horarios/funcionario-disponibilidade).
    let slots: string[];
    try {
      slots = await slotsForDate(state.dateIso, state.professionalId);
    } catch (error) {
      if (renderSeq !== slotsRenderSeq) return;
      const message =
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : "Não foi possível carregar os horários disponíveis. Tente novamente.";
      showSlotsHint(message, "error");
      return;
    }
    if (slots.length === 0) {
      if (renderSeq !== slotsRenderSeq) return;
      showSlotsHint("A barbearia está fechada nesta data. Escolha outra.", "error");
      return;
    }

    if (renderSeq !== slotsRenderSeq) return;
    clearElement(slotsBox);
    slotsHint.hidden = true;
    slotsBox.hidden = false;

    const now = new Date();
    const isToday = state.dateIso === toIsoDate(now);
    for (const hour of slots) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot";
      btn.textContent = hour;
      const expired =
        isToday &&
        (() => {
          const [h, m] = hour.split(":").map(Number);
          const slotDate = new Date(now);
          slotDate.setHours(h ?? 0, m ?? 0, 0, 0);
          return slotDate.getTime() <= now.getTime();
        })();
      btn.disabled = expired;
      if (state.time === hour && !btn.disabled) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", () => {
        state.time = hour;
        $$(".slot", slotsBox).forEach((el) => el.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        validateStep(positionOf("horario"), false);
      });
      slotsBox.appendChild(btn);
    }
  }

  function updateTotal(): void {
    let total = 0;
    if (state.serviceId) {
      total += catalogServices.find((s) => s.id === state.serviceId)?.price ?? 0;
    }
    totalEl.textContent = formatCurrency(total);
  }

  function goToStep(pos: number): void {
    state.step = pos;
    const activeName = positionName(pos);
    stepPanels.forEach((panel, index) => {
      panel.classList.toggle("is-active", index === pos);
    });
    // Por segurança, painéis ocultos nunca ficam ativos.
    panels.forEach((panel) => {
      if (panel.hidden) panel.classList.remove("is-active");
    });
    steps.forEach((item, index) => {
      item.classList.toggle("is-active", index === pos);
      item.classList.toggle("is-done", index < pos);
      const dot = item.querySelector(".steps__dot");
      if (dot) dot.textContent = `${index + 1}`;
    });
    progressFill.style.width = `${((pos + 1) / TOTAL_STEPS) * 100}%`;
    prevBtn.hidden = pos === 0 || pos === TOTAL_STEPS - 1;
    nextBtn.hidden = pos === TOTAL_STEPS - 1;
    footer.classList.toggle("wizard__footer--summary", pos === TOTAL_STEPS - 1);
    nextBtn.textContent = activeName === "revisao" ? "Confirmar agendamento" : "Continuar";
    if (activeName === "horario") {
      void renderSlots();
    }
    if (activeName === "revisao") {
      renderReviewSummary();
    }
    const activePanel = stepPanels[pos];
    if (activePanel) activePanel.scrollTop = 0;
    bodyScroll.scrollTop = 0;
  }

  function validateStep(pos: number, report: boolean): boolean {
    const name = positionName(pos);
    if (name === "cliente") {
      const valid = Boolean(state.cliente);
      if (!valid && report) showToast("Selecione ou cadastre um cliente.", "error");
      return valid;
    }
    if (name === "servicos") {
      const valid = Boolean(state.serviceId);
      if (!valid && report) showToast("Selecione um serviço.", "error");
      return valid;
    }
    if (name === "horario") {
      const valid = Boolean(state.professionalId && state.dateIso && state.time);
      if (!valid && report) {
        showToast(
          !state.professionalId
            ? "Escolha um profissional."
            : "Escolha uma data e um horário disponíveis.",
          "error",
        );
      }
      return valid;
    }
    if (name === "atendimento") {
      const valid = state.attendance === "proprio" || Boolean(state.pessoaAtendidaNome);
      if (!valid && report) showToast("Informe o nome da pessoa que será atendida.", "error");
      return valid;
    }
    return true;
  }

  function buildSummaryRows(appointment: Appointment): void {
    const serviceName =
      catalogServices.find((s) => s.id === appointment.servicoId)?.name ??
      appointment.servicoNome ??
      "";
    const professional =
      catalogProfessionals.find((p) => p.id === appointment.funcionarioId)?.name ??
      appointment.funcionarioNome ??
      "-";
    const total = catalogServices.find((s) => s.id === appointment.servicoId)?.price ?? 0;
    const rows: Array<[string, string]> = [
      ["Serviço(s)", serviceName],
      ["Profissional", professional],
      ["Data", formatDateLong(appointment.data)],
      ["Horário", appointment.hora],
      ["Cliente", appointment.clienteNome ?? "-"],
    ];
    if (appointment.pessoaAtendidaNome) {
      rows.push(["Atendido", appointment.pessoaAtendidaNome]);
    }
    rows.push(["Total", formatCurrency(total)]);
    summaryEl.innerHTML = rows
      .map(
        ([label, value]) =>
          `<div class="summary__row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join("");
  }

  function renderReviewSummary(): void {
    const serviceName =
      catalogServices.find((s) => s.id === state.serviceId)?.name ?? "";
    const professional =
      catalogProfessionals.find((p) => p.id === state.professionalId)?.name ?? "-";
    const total = catalogServices.find((s) => s.id === state.serviceId)?.price ?? 0;
    const clienteName = operatorMode ? (state.cliente?.nome ?? "-") : (getSession()?.userName ?? "-");
    const rows: Array<[string, string]> = [
      ["Serviço(s)", serviceName],
      ["Profissional", professional],
      ["Data", state.dateIso ? formatDateLong(state.dateIso) : "-"],
      ["Horário", state.time ?? "-"],
      ["Cliente", clienteName],
    ];
    if (!operatorMode) {
      const attendLabel =
        state.attendance === "outra_pessoa" && state.pessoaAtendidaNome
          ? state.pessoaAtendidaNome
          : "Para mim";
      rows.push(["Atendimento", attendLabel]);
    }
    rows.push(["Total", formatCurrency(total)]);
    reviewSummaryEl.innerHTML = rows
      .map(
        ([label, value]) =>
          `<div class="summary__row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join("");
  }

  async function submit(): Promise<void> {
    if (!state.professionalId || !state.serviceId || !state.dateIso || !state.time) return;
    if (operatorMode && !state.cliente) return;

    const draft: BookingDraft = {
      funcionario_id: state.professionalId,
      servico_id: state.serviceId,
      data: state.dateIso,
      hora: state.time,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      ...(operatorMode && state.cliente ? { clienteId: state.cliente.id } : {}),
      ...(
        !operatorMode && state.attendance === "outra_pessoa" && state.pessoaAtendidaNome
          ? { pessoaAtendidaNome: state.pessoaAtendidaNome }
          : {}
      ),
    };

    nextBtn.disabled = true;
    try {
      let appointment: Appointment;
      if (state.rescheduleId) {
        // Decisão aprovada: reagendar = cancelar + criar.
        await reschedule(state.rescheduleId);
        appointment = await createAppointment(draft);
      } else {
        appointment = await createAppointment(draft);
      }

      successTitle.textContent = state.rescheduleId
        ? "Horário atualizado!"
        : "Agendamento realizado!";
      buildSummaryRows(appointment);
      goToStep(TOTAL_STEPS - 1);
      showToast(
        state.rescheduleId
          ? "Horário do agendamento atualizado."
          : "Agendamento criado! Aguarde a confirmação da barbearia.",
      );
onBookingCreatedRef?.();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : "Não foi possível concluir o agendamento. Tente novamente.";
      showToast(message, "error");
    } finally {
      nextBtn.disabled = false;
    }
  }

  async function resetWizard(): Promise<void> {
    state.serviceId = null;
    // Barbeiro só agenda para si mesmo — mantém o próprio id fixo.
    state.professionalId = sessionRole === "profissional" ? ownProfessionalId : null;
    state.dateIso = await defaultDateIso();
    state.time = null;
    state.rescheduleId = null;
    state.rescheduleAppointment = null;
    state.cliente = null;
    state.clientResults = [];
    state.clientSearchPerformed = false;
    state.attendance = "proprio";
    state.pessoaAtendidaNome = null;
    form.reset();
    clearFormErrors(form);
    dateInput.value = state.dateIso;
    if (attendeeInput) attendeeInput.value = "";
    if (attendeeNameWrap) attendeeNameWrap.hidden = true;
    if (operatorMode) {
      clientSearchInput.value = "";
      clearElement(clientResultsBox);
      clientCreateForm.hidden = true;
      // Barbeiro não cadastra clientes — mantém toggle oculto no reset
      clientCreateToggle.hidden = sessionRole === "profissional";
    }
    renderServices();
    await renderProfessionals();
    await renderSlots();
    goToStep(operatorMode ? positionOf("cliente") : positionOf("servicos"));
  }

  // ------------------------------------------------------------- Passo Cliente
  function renderClientResults(): void {
    clearElement(clientResultsBox);

    if (state.cliente) {
      clientResultsBox.insertAdjacentHTML(
        "beforeend",
        `<div class="client-picked">
          <span class="avatar avatar--sm">${initials(state.cliente.nome)}</span>
          <span class="client-picked__info">
            <strong>${escapeHtml(state.cliente.nome)}</strong>
            <small>${escapeHtml(state.cliente.email)}</small>
          </span>
          <span class="client-picked__check">${icon("check", 14)}</span>
          <button type="button" class="btn btn--sm btn--ghost" data-clear-client>Alterar</button>
        </div>`,
      );
      return;
    }

    if (state.clientSearchPerformed && state.clientResults.length === 0) {
      clientResultsBox.innerHTML = `<p class="options-empty options-empty--alert">${icon("user-plus", 18)}<span>Nenhum cliente encontrado. Use "Cadastrar novo cliente" para criá-lo.</span></p>`;
      return;
    }

    for (const c of state.clientResults) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-card client-option client-option--btn";
      btn.setAttribute("data-pick-client", c.id);
      btn.innerHTML = `
        <span class="avatar avatar--sm">${initials(c.nome)}</span>
        <span class="pro-option__info">
          <strong>${escapeHtml(c.nome)}</strong>
          <small>${escapeHtml(c.email)}</small>
        </span>
        <span class="option-check">${icon("check", 14)}</span>`;
      clientResultsBox.appendChild(btn);
    }
  }

  function setCliente(cliente: ClienteSelecionado): void {
    state.cliente = cliente;
    state.clientResults = [];
    state.clientSearchPerformed = false;
    renderClientResults();
    validateStep(positionOf("cliente"), false);
  }

  function clearCliente(): void {
    state.cliente = null;
    renderClientResults();
    validateStep(positionOf("cliente"), false);
  }

  if (operatorMode) {
    $<HTMLButtonElement>("[data-client-search]", form)!.addEventListener("click", () => {
      void runClientSearch();
    });
    clientSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void runClientSearch();
      }
    });
    clientResultsBox.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const pick = target.closest("[data-pick-client]");
      if (pick) {
        const id = pick.getAttribute("data-pick-client")!;
        const cliente = state.clientResults.find((c) => c.id === id);
        if (cliente) setCliente(cliente);
        return;
      }
      if (target.closest("[data-clear-client]")) {
        clearCliente();
      }
    });
    clientCreateToggle.addEventListener("click", () => {
      clientCreateToggle.hidden = true;
      clientCreateForm.hidden = false;
    });
    clientCreateCancel.addEventListener("click", () => {
      clientCreateForm.hidden = true;
      clientCreateToggle.hidden = false;
    });
    clientCreateSubmit.addEventListener("click", () => {
      void createNewClient();
    });
  }

  async function runClientSearch(): Promise<void> {
    const term = clientSearchInput.value.trim();
    if (!term) {
      showToast("Digite um nome ou e-mail para buscar.", "error");
      return;
    }
    const searchBtn = form.querySelector<HTMLButtonElement>("[data-client-search]");
    if (searchBtn) searchBtn.disabled = true;
    try {
      const found = await buscarClientes(term);
      state.clientResults = found.map((c) => ({ id: c.id, nome: c.nome, email: c.email }));
      state.clientSearchPerformed = true;
      if (state.cliente && !state.clientResults.some((c) => c.id === state.cliente?.id)) {
        state.cliente = null;
      }
      renderClientResults();
    } finally {
      if (searchBtn) searchBtn.disabled = false;
    }
  }

  async function createNewClient(): Promise<void> {
    const nome = form.querySelector<HTMLInputElement>("#client-create-nome")!.value.trim();
    const email = form.querySelector<HTMLInputElement>("#client-create-email")!.value.trim().toLowerCase();
    const telefone = form.querySelector<HTMLInputElement>("#client-create-telefone")!.value.trim();
    const senha = form.querySelector<HTMLInputElement>("#client-create-senha")!.value;

    if (nome.length < 2) {
      showToast("Informe o nome do cliente.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showToast("Informe um e-mail válido.", "error");
      return;
    }
    if (senha.length < 6) {
      showToast("A senha deve ter no mínimo 6 caracteres.", "error");
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>("[data-client-create-submit]");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const created = await criarCliente({ nome, email, telefone, senha });
      setCliente({ id: created.id, nome: created.nome, email: created.email });
      clientCreateForm.hidden = true;
      clientCreateToggle.hidden = false;
      clientSearchInput.value = "";
      showToast("Cliente cadastrado e selecionado.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Não foi possível cadastrar o cliente.",
        "error",
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  prevBtn.addEventListener("click", () => {
    if (state.step > 0) goToStep(state.step - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (positionName(state.step) === "revisao") {
      if (validateStep(state.step, true)) {
        void submit();
      }
      return;
    }
    if (validateStep(state.step, true)) {
      goToStep(state.step + 1);
    }
  });

  $<HTMLButtonElement>("#booking-restart")!.addEventListener("click", () => {
    void resetWizard();
    closeModal(overlay);
  });

  overlay.addEventListener("modal:close", () => {
    if (positionName(state.step) === "confirmacao") void resetWizard();
  });

  async function openNew(preselectServiceId?: string): Promise<void> {
    await refreshCatalog();
    await resetWizard();
    if (preselectServiceId) {
      state.serviceId = preselectServiceId;
      const input = servicesBox.querySelector<HTMLInputElement>(
        `input[value="${preselectServiceId}"]`,
      );
      if (input) input.checked = true;
      updateTotal();
    }
    openModal(overlay);
  }

  async function openForReschedule(appointment: Appointment): Promise<void> {
    await refreshCatalog();
    await resetWizard();
    // Em modo operador o reagendamento também pertence a um cliente; o id já
    // vem no agendamento (não passa pelo passo Cliente).
    if (operatorMode) {
      state.cliente = {
        id: appointment.clienteId,
        nome: appointment.clienteNome ?? "",
        email: "",
      };
    }
    state.rescheduleId = appointment.id;

    // Restaura estado de "Para quem" no fluxo cliente
    if (!operatorMode) {
      if (appointment.pessoaAtendidaNome) {
        state.attendance = "outra_pessoa";
        state.pessoaAtendidaNome = appointment.pessoaAtendidaNome;
        const radio = form.querySelector<HTMLInputElement>(
          'input[name="attendance"][value="outra_pessoa"]',
        );
        if (radio) radio.checked = true;
        if (attendeeInput) attendeeInput.value = appointment.pessoaAtendidaNome;
        attendeeNameWrap.hidden = false;
      } else {
        state.attendance = "proprio";
        state.pessoaAtendidaNome = null;
      }
    }

    if (appointment.servicoId) {
      state.serviceId = appointment.servicoId;
      const input = servicesBox.querySelector<HTMLInputElement>(
        `input[value="${appointment.servicoId}"]`,
      );
      if (input) input.checked = true;
      updateTotal();
    }
    state.professionalId = appointment.funcionarioId;
    renderServices();
    renderProfessionals();

    let rescheduleIso = appointment.data;
    let rescheduleOpen = false;
    try {
      rescheduleOpen = rescheduleIso >= minIso && rescheduleIso <= maxIso && (await isDateEnabled(rescheduleIso));
    } catch {
      rescheduleOpen = false;
    }
    if (rescheduleOpen) {
      state.dateIso = rescheduleIso;
    } else {
      state.dateIso = await defaultDateIso();
    }
    dateInput.value = state.dateIso;
    state.time = appointment.data === state.dateIso ? appointment.hora : null;
    renderSlots();
    goToStep(positionOf("horario"));
    openModal(overlay);
  }

  initDateField();
  initAttendeeField();
  renderServices();
  void renderProfessionals();
  goToStep(operatorMode ? positionOf("cliente") : positionOf("servicos"));

  activeHandle = { openNew, openForReschedule };
  return activeHandle;
}