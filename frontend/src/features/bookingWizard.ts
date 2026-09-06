import { CONFIG } from "../config.js";
import type { Appointment, BookingDraft } from "../types.js";
import { loadProfessionals, loadServices } from "../services/catalog.js";
import { occupiedTimes } from "../services/booking.js";
import { isDateOpen, slotsForDate } from "../services/schedule.js";
import { getSession } from "../services/auth.js";
import { findClienteByEmail } from "../services/clientes.js";
import { $, $$, clearElement, clearFormErrors, escapeHtml, initials } from "../ui/dom.js";
import { icon, serviceIcon } from "../ui/icons.js";
import { formatCurrency, formatDateLong, toIsoDate } from "../ui/format.js";
import { closeModal, openModal } from "../ui/modal.js";
import { createAppointment, rescheduleAppointment } from "../services/booking.js";
import { showToast } from "../ui/toast.js";

const TOTAL_STEPS = 3;

interface WizardState {
  step: number;
  serviceIds: Set<string>;
  professionalId: string | null;
  dateIso: string | null;
  time: string | null;
  rescheduleCode: string | null;
}

export interface BookingWizardHandle {
  openNew(preselectServiceId?: string): void;
  openForReschedule(appointment: Appointment): void;
}

export interface BookingWizardOptions {
  onBookingCreated?: () => void;
}

export function initBookingWizard(options: BookingWizardOptions = {}): BookingWizardHandle {
  let catalogServices = loadServices();
  let catalogProfessionals = loadProfessionals();

  const refreshCatalog = (): void => {
    catalogServices = loadServices();
    catalogProfessionals = loadProfessionals();
  };
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

  const state: WizardState = {
    step: 1,
    serviceIds: new Set(),
    professionalId: null,
    dateIso: null,
    time: null,
    rescheduleCode: null,
  };

  const today = new Date();
  const minIso = toIsoDate(today);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + CONFIG.bookingHorizonDays);
  const maxIso = toIsoDate(horizon);

  function isDateEnabled(iso: string): boolean {
    return isDateOpen(iso);
  }

  function defaultDateIso(): string {
    const candidate = new Date(today);
    for (let attempt = 0; attempt < 7; attempt++) {
      const iso = toIsoDate(candidate);
      if (isDateEnabled(iso)) return iso;
      candidate.setDate(candidate.getDate() + 1);
    }
    return minIso;
  }

  function initDateField(): void {
    dateInput.min = minIso;
    dateInput.max = maxIso;
    if (!dateInput.value) dateInput.value = defaultDateIso();

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
        renderSlots();
        validateStep(2, false);
        return;
      }
      if (value < minIso || value > maxIso) {
        showToast("Escolha uma data dentro do horizonte de 45 dias.", "error");
        dateInput.value = state.dateIso ?? defaultDateIso();
        return;
      }
      if (!isDateEnabled(value)) {
        showToast("A barbearia está fechada nesta data. Escolha outra.", "error");
        dateInput.value = state.dateIso ?? defaultDateIso();
        return;
      }
      state.dateIso = value;
      state.time = null;
      renderSlots();
      validateStep(2, false);
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
        <input type="checkbox" name="service" value="${service.id}">
        <span class="service-option__icon">${serviceIcon(service.icon)}</span>
        <span class="service-option__info">
          <strong>${escapeHtml(service.name)}</strong>
          <small><i class="inline-icon">${icon("clock", 13)}</i> ${service.durationMin} min</small>
        </span>
        <span class="service-option__price">${formatCurrency(service.price)}</span>
        <span class="option-check">${icon("check", 14)}</span>`;
      const input = label.querySelector<HTMLInputElement>("input")!;
      input.checked = state.serviceIds.has(service.id);
      input.addEventListener("change", () => {
        if (input.checked) {
          state.serviceIds.add(service.id);
        } else {
          state.serviceIds.delete(service.id);
        }
        updateTotal();
        renderProfessionals();
        validateStep(1, false);
      });
      servicesBox.appendChild(label);
    }
    updateTotal();
  }

  function selectedCategories(): Set<string> {
    const categories = new Set<string>();
    for (const id of state.serviceIds) {
      const category = catalogServices.find((s) => s.id === id)?.category;
      if (category) categories.add(category);
    }
    return categories;
  }

  function renderProfessionals(): void {
    clearElement(prosBox);
    const categories = selectedCategories();
    const available = catalogProfessionals.filter(
      (p) => p.active && (categories.size === 0 || categories.has(p.category)),
    );

    if (state.professionalId && !available.some((p) => p.id === state.professionalId)) {
      state.professionalId = null;
    }

    if (available.length === 0) {
      prosBox.innerHTML = `<p class="options-empty options-empty--alert options-empty--error">${icon("alert-circle", 18)}<span>Nenhum profissional atende a categoria selecionada.</span></p>`;
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
        if (input.checked) state.professionalId = pro.id;
        renderSlots();
        validateStep(2, false);
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

  function renderSlots(): void {
    clearElement(slotsBox);
    if (!state.dateIso || !state.professionalId) {
      const message = !state.dateIso
        ? "Escolha uma data para ver os horários disponíveis."
        : "Escolha um profissional para ver os horários disponíveis.";
      showSlotsHint(message);
      return;
    }

    const slots = slotsForDate(state.dateIso);
    if (slots.length === 0) {
      showSlotsHint("A barbearia está fechada nesta data. Escolha outra.", "error");
      return;
    }

    slotsHint.hidden = true;
    slotsBox.hidden = false;
    const occupied = occupiedTimes(state.dateIso, state.professionalId ?? "");
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
      btn.disabled = occupied.has(hour) || expired;
      if (btn.disabled && occupied.has(hour)) {
        btn.title = "Horário ocupado";
      }
      if (state.time === hour && !btn.disabled) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", () => {
        state.time = hour;
        $$(".slot", slotsBox).forEach((el) => el.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        validateStep(2, false);
      });
      slotsBox.appendChild(btn);
    }
  }

  function updateTotal(): void {
    let total = 0;
    for (const id of state.serviceIds) {
      total += catalogServices.find((s) => s.id === id)?.price ?? 0;
    }
    totalEl.textContent = formatCurrency(total);
  }

  function goToStep(step: number): void {
    state.step = step;
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", Number(panel.dataset.step) === step);
    });
    stepsItems.forEach((item, index) => {
      item.classList.toggle("is-active", index + 1 === step);
      item.classList.toggle("is-done", index + 1 < step);
    });
    progressFill.style.width = `${(step / TOTAL_STEPS) * 100}%`;
    prevBtn.hidden = step === 1 || step === TOTAL_STEPS;
    nextBtn.hidden = step === TOTAL_STEPS;
    footer.classList.toggle("wizard__footer--summary", step === TOTAL_STEPS);
    nextBtn.textContent = step === 2 ? "Confirmar agendamento" : "Continuar";
    if (step === 2) {
      renderSlots();
    }
    const activePanel = panels.find((p) => Number(p.dataset.step) === step);
    if (activePanel) activePanel.scrollTop = 0;
    bodyScroll.scrollTop = 0;
  }

  function validateStep(step: number, report: boolean): boolean {
    if (step === 1) {
      const valid = state.serviceIds.size > 0;
      if (!valid && report) showToast("Selecione pelo menos um serviço.", "error");
      return valid;
    }
    if (step === 2) {
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
    return true;
  }

  function buildSummaryRows(appointment: Appointment): void {
    const serviceNames = appointment.serviceIds
      .map((id) => catalogServices.find((s) => s.id === id)?.name ?? "")
      .filter(Boolean)
      .join(", ");
    const professional = catalogProfessionals.find((p) => p.id === appointment.professionalId);
    let total = 0;
    for (const id of appointment.serviceIds) {
      total += catalogServices.find((s) => s.id === id)?.price ?? 0;
    }
    const rows: Array<[string, string]> = [
      ["Serviço(s)", serviceNames],
      ["Profissional", professional?.name ?? "-"],
      ["Data", formatDateLong(appointment.dateIso)],
      ["Horário", appointment.time],
      ["Cliente", appointment.clientName],
      ["Telefone", appointment.phone || "—"],
      ["Total", formatCurrency(total)],
    ];
    summaryEl.innerHTML = rows
      .map(
        ([label, value]) =>
          `<div class="summary__row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join("");
  }

  async function submit(): Promise<void> {
    const session = getSession();
    const cliente = session ? findClienteByEmail(session.userEmail) : null;
    const clientName = cliente?.nome ?? session?.userName ?? "";
    const email = session?.userEmail ?? "";
    const phone = cliente?.telefone ?? "";

    if (!session?.userEmail || !clientName) {
      showToast("Você precisa estar logado para agendar.", "error");
      return;
    }
    if (!state.professionalId || !state.dateIso || !state.time) return;

    const draft: BookingDraft = {
      serviceIds: [...state.serviceIds],
      professionalId: state.professionalId,
      dateIso: state.dateIso,
      time: state.time,
      clientName,
      phone,
      email,
    };

    nextBtn.disabled = true;
    try {
      const appointment = state.rescheduleCode
        ? await rescheduleAppointment(state.rescheduleCode, {
            professionalId: draft.professionalId,
            dateIso: draft.dateIso,
            time: draft.time,
          })
        : await createAppointment(draft);

      if (!appointment) throw new Error("not-found");

      successTitle.textContent = state.rescheduleCode
        ? "Horário atualizado!"
        : "Agendamento realizado!";
      buildSummaryRows(appointment);
      goToStep(TOTAL_STEPS);
      showToast(
        state.rescheduleCode
          ? "Horário do agendamento atualizado."
          : "Agendamento criado! Aguarde a confirmação da barbearia.",
      );
      options.onBookingCreated?.();
    } catch {
      showToast("Não foi possível concluir o agendamento. Tente novamente.", "error");
    } finally {
      nextBtn.disabled = false;
    }
  }

  function resetWizard(): void {
    state.serviceIds.clear();
    state.professionalId = null;
    state.dateIso = defaultDateIso();
    state.time = null;
    state.rescheduleCode = null;
    form.reset();
    clearFormErrors(form);
    dateInput.value = state.dateIso;
    renderServices();
    renderProfessionals();
    renderSlots();
    goToStep(1);
  }

  prevBtn.addEventListener("click", () => {
    if (state.step > 1) goToStep(state.step - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (state.step === 2) {
      if (validateStep(2, true)) {
        void submit();
      }
      return;
    }
    if (validateStep(state.step, true)) {
      goToStep(state.step + 1);
    }
  });

  $<HTMLButtonElement>("#booking-restart")!.addEventListener("click", () => {
    resetWizard();
    closeModal(overlay);
  });

  overlay.addEventListener("modal:close", () => {
    if (state.step === TOTAL_STEPS) resetWizard();
  });

  async function openNew(preselectServiceId?: string): Promise<void> {
    refreshCatalog();
    resetWizard();
    if (preselectServiceId) {
      state.serviceIds.add(preselectServiceId);
      const input = servicesBox.querySelector<HTMLInputElement>(
        `input[value="${preselectServiceId}"]`,
      );
      if (input) input.checked = true;
      updateTotal();
    }
    openModal(overlay);
  }

  function openForReschedule(appointment: Appointment): void {
    refreshCatalog();
    resetWizard();
    state.rescheduleCode = appointment.code;
    state.serviceIds = new Set(appointment.serviceIds);
    state.professionalId = appointment.professionalId;
    renderServices();
    renderProfessionals();
    const rescheduleIso =
      appointment.dateIso >= minIso &&
      appointment.dateIso <= maxIso &&
      isDateEnabled(appointment.dateIso)
        ? appointment.dateIso
        : defaultDateIso();
    state.dateIso = rescheduleIso;
    dateInput.value = rescheduleIso;
    state.time = appointment.dateIso === rescheduleIso ? appointment.time : null;
    renderSlots();
    goToStep(2);
    openModal(overlay);
  }

  initDateField();
  renderServices();
  renderProfessionals();
  goToStep(1);

  return { openNew, openForReschedule };
}
