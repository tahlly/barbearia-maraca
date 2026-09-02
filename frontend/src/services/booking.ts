import { CONFIG } from "../config.js";
import type { Appointment, BookingDraft } from "../types.js";
import { delay, isMockMode } from "./api.js";
import { httpJson } from "./api.js";

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChar(source: string): string {
  return source.charAt(crypto.getRandomValues(new Uint32Array(1))[0]! % source.length);
}

function loadStored(): Appointment[] {
  const raw = localStorage.getItem(CONFIG.appointmentsKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Appointment[];
  } catch {
    return [];
  }
}

function persist(list: Appointment[]): void {
  localStorage.setItem(CONFIG.appointmentsKey, JSON.stringify(list));
}

function loadAll(): Appointment[] {
  return loadStored();
}

export function loadAllAppointments(): Appointment[] {
  return loadStored();
}

export function occupiedTimes(dateIso: string, professionalId: string): Set<string> {
  const occupied = new Set<string>();
  for (const appointment of loadStored()) {
    if (appointment.dateIso === dateIso && appointment.professionalId === professionalId && appointment.status !== "cancelado") {
      occupied.add(appointment.time);
    }
  }
  return occupied;
}

export function listByEmail(email: string): Appointment[] {
  const normalized = email.trim().toLowerCase();
  return loadStored().filter((a) => a.email.toLowerCase() === normalized);
}

export function generateCode(existing: string[] = []): string {
  const used = new Set(existing);
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    code += randomChar(CODE_LETTERS);
    code += randomChar(CODE_LETTERS);
    code += "-";
    for (let i = 0; i < 5; i++) {
      code += randomChar(CODE_CHARS);
    }
    if (!used.has(code)) return code;
  }
  return `XX-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export async function createAppointment(draft: BookingDraft): Promise<Appointment> {
  if (isMockMode()) {
    await delay(850);
    const all = loadAll();
    const appointment: Appointment = {
      code: generateCode(all.map((a) => a.code)),
      clientName: draft.clientName.trim(),
      phone: draft.phone,
      email: draft.email,
      serviceIds: [...draft.serviceIds],
      professionalId: draft.professionalId,
      dateIso: draft.dateIso,
      time: draft.time,
      status: "pendente",
      createdAt: new Date().toISOString(),
    };
    persist([...loadStored(), appointment]);
    return appointment;
  }
  return httpJson<Appointment>("/agendamentos", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function findByCode(code: string): Promise<Appointment | null> {
  if (isMockMode()) {
    await delay(550);
    const normalized = code.trim().toUpperCase();
    return loadAll().find((a) => a.code === normalized) ?? null;
  }
  try {
    return await httpJson<Appointment>(`/agendamentos/${encodeURIComponent(code)}`);
  } catch {
    return null;
  }
}

export async function cancelAppointment(code: string): Promise<Appointment | null> {
  if (isMockMode()) {
    await delay(500);
    const stored = loadStored();
    const index = stored.findIndex((a) => a.code === code.toUpperCase());
    if (index >= 0) {
      stored[index]!.status = "cancelado";
      persist(stored);
      return stored[index]!;
    }
    return null;
  }
  return httpJson<Appointment>(`/agendamentos/${encodeURIComponent(code)}/cancelar`, {
    method: "PATCH",
  });
}

export async function setAppointmentStatus(
  code: string,
  status: Appointment["status"],
): Promise<Appointment | null> {
  if (isMockMode()) {
    await delay(450);
    const stored = loadStored();
    const index = stored.findIndex((a) => a.code === code.toUpperCase());
    if (index >= 0) {
      stored[index]!.status = status;
      persist(stored);
      return stored[index]!;
    }
    return null;
  }
  return httpJson<Appointment>(`/agendamentos/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function rescheduleAppointment(
  code: string,
  changes: { professionalId: string; dateIso: string; time: string },
): Promise<Appointment | null> {
  if (isMockMode()) {
    await delay(700);
    const stored = loadStored();
    const index = stored.findIndex((a) => a.code === code.toUpperCase());
    if (index >= 0) {
      const updated: Appointment = {
        ...stored[index]!,
        professionalId: changes.professionalId,
        dateIso: changes.dateIso,
        time: changes.time,
        status: "pendente",
      };
      stored[index] = updated;
      persist(stored);
      return updated;
    }
    return null;
  }
  return httpJson<Appointment>(`/agendamentos/${encodeURIComponent(code)}/reagendar`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}
