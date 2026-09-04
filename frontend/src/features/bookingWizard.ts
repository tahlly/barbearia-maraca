import { CONFIG } from "../config.js";
import type { Appointment, BookingDraft } from "../types.js";
import { loadProfessionals, loadServices } from "../services/catalog.js";
import { createAppointment, reschedule } from "../services/booking.js";
import { isDateOpen, slotsForDate } from "../services/schedule.js";
import { $, $$, clearElement, clearFormErrors, escapeHtml, initials } from "../ui/dom.js";
import { icon, serviceIcon } from "../ui/icons.js";
import { formatCurrency, formatDateLong, toIsoDate } from "../ui/format.js";
import { attachPhoneMask } from "../ui/mask.js";
import { closeModal, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

const TOTAL_STEPS = 4;

interface WizardState {
  step: number;
  serviceId: string | null;
  professionalId: string | null;
  dateIso: string | null;
  time: string | null;
  rescheduleId: string | null;
  rescheduleAppointment: Appointment | null;
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
  const prevBtn = $<HTMLButtonElement>("#booking-prev")!;
  const nextBtn = $<HTMLButtonElement>("#booking-next")!;
  const phoneInput = $<HTMLInputElement>("#client-phone")!;
  const successTitle = $("#booking-success-title")!;
  const summaryEl = $("#booking-summary")!;

  const state: WizardState = {
    step: 1,
    serviceId: null,
    professionalId: null,
    dateIso: null,
    time: null,
    rescheduleId: null,
    rescheduleAppointment: null,
  };

  const today = new Date();
  const minIso = toIsoDate(today);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + CONFIG.bookingHorizonDays);
  const maxIso = toIsoDate(horizon);

  attachPhoneMask(phoneInput);

  async function isDateEnabled(iso: string): Promise<boolean> {
    if (!state.professionalId) return false;
    return isDateOpen(iso, state.professionalId);
  }

  async function defaultDateIso(): Promise<string> {
    const candidate = new Date(today);
    for (let attempt = 0; attempt < 7; attempt++) {
      const iso = toIsoDate(candidate);
      if (await isDateEnabled(iso)) return iso;
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
        validateStep(2, false);
        return;
      }
      if (value < minIso || value > maxIso) {
        showToast("Escolha uma data dentro do horizonte de 45 dias.", "error");
        dateInput.value = state.dateIso ?? "";
        return;
      }
      void (async () => {
        const enabled = await isDateEnabled(value);
        if (!enabled) {
          showToast("A barbearia está fechada nesta data. Escolha outra.", "error");
          dateInput.value = state.dateIso ?? "";
          return;
        }
        state.dateIso = value;
        state.time = null;
        await renderSlots();
        validateStep(2, false);
      })();
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
        validateStep(1, false);
      });
      servicesBox.appendChild(label);
    }
    updateTotal();
  }

  async function renderProfessionals(): Promise<void> {
    clearElement(prosBox);
    const available = catalogProfessionals.filter((p) => p.active);

    if (state.professionalId && !available.some((p) => p.id === state.professionalId)) {
      state.professionalId = null;
    }

    if (available.length === 0) {
      prosBox.innerHTML = `<p class="options-empty options-empty--alert options-empty--error">${icon("alert-circle", 18)}<span>Nenhum profissional disponível no momento.</span></p>`;
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
            const hasSlots = await isDateEnabled(state.dateIso ?? "");
            if (state.dateIso && hasSlots) {
              state.time = null;
              await renderSlots();
            }
          })();
        }
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

  async function renderSlots(): Promise<void> {
    clearElement(slotsBox);
    slotsHint.hidden = true;
    slotsBox.hidden = false;
    if (!state.dateIso || !state.professionalId) {
      const message = !state.dateIso
        ? "Escolha uma data para ver os horários disponíveis."
        : "Escolha um profissional para ver os horários disponíveis.";
      showSlotsHint(message);
      return;
    }

    // slotsForDate() já retorna apenas slots realmente livres (filtra
    // ocupados via endpoint /horarios/funcionario-disponibilidade).
    const slots = await slotsForDate(state.dateIso, state.professionalId);
    if (slots.length === 0) {
      showSlotsHint("A barbearia está fechada nesta data. Escolha outra.", "error");
      return;
    }

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
        validateStep(2, false);
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
    nextBtn.textContent = step === 3 ? "Confirmar agendamento" : "Continuar";
    if (step === 2) {
      void renderSlots();
    }
    const activePanel = panels.find((p) => Number(p.dataset.step) === step);
    if (activePanel) activePanel.scrollTop = 0;
  }

  function validateStep(step: number, report: boolean): boolean {
    if (step === 1) {
      const valid = Boolean(state.serviceId);
      if (!valid && report) showToast("Selecione um serviço.", "error");
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
    if (step === 3) {
      return true;
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
      ["Serviço", serviceName],
      ["Profissional", professional],
      ["Data", formatDateLong(appointment.data)],
      ["Horário", appointment.hora],
      ["Cliente", appointment.clienteNome ?? "-"],
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
    if (state.step === TOTAL_STEPS) return;
    if (!validateStep(3, true)) return;
    if (!state.professionalId || !state.dateIso || !state.time || !state.serviceId) return;

    const draft: BookingDraft = {
      funcionario_id: state.professionalId,
      servico_id: state.serviceId,
      data: state.dateIso,
      hora: state.time,
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
      goToStep(TOTAL_STEPS);
      showToast(
        state.rescheduleId
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

  async function resetWizard(): Promise<void> {
    state.serviceId = null;
    state.professionalId = null;
    state.dateIso = await defaultDateIso();
    state.time = null;
    state.rescheduleId = null;
    state.rescheduleAppointment = null;
    form.reset();
    clearFormErrors(form);
    dateInput.value = state.dateIso;
    renderServices();
    await renderProfessionals();
    await renderSlots();
    goToStep(1);
  }

  prevBtn.addEventListener("click", () => {
    if (state.step > 1) goToStep(state.step - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (state.step === 3) {
      void submit();
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
    if (state.step === TOTAL_STEPS) void resetWizard();
  });

  async function openNew(preselectServiceId?: string): Promise<void> {
    refreshCatalog();
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
    refreshCatalog();
    await resetWizard();
    state.rescheduleId = appointment.id;
    state.rescheduleAppointment = appointment;
    // Preenche com o serviço e profissional do agendamento atual.
    state.serviceId = appointment.servicoId;
    const servInput = servicesBox.querySelector<HTMLInputElement>(
      `input[value="${appointment.servicoId}"]`,
    );
    if (servInput) servInput.checked = true;
    updateTotal();

    if (state.professionalId !== appointment.funcionarioId) {
      state.professionalId = appointment.funcionarioId;
      const proInput = prosBox.querySelector<HTMLInputElement>(
        `input[value="${appointment.funcionarioId}"]`,
      );
      if (proInput) proInput.checked = true;
    }

    const reIso =
      appointment.data >= minIso &&
      appointment.data <= maxIso &&
      (await isDateEnabled(appointment.data))
        ? appointment.data
        : await defaultDateIso();
    state.dateIso = reIso;
    dateInput.value = reIso;
    state.time = null;
    await renderSlots();
    goToStep(2);
    openModal(overlay);
  }

  initDateField();
  renderServices();
  void renderProfessionals();
  goToStep(1);

  return { openNew, openForReschedule };
}
