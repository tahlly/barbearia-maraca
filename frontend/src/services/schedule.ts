import { CONFIG } from "../config.js";

export interface DaySchedule {
  open: boolean;
  start: string;
  end: string;
}

export interface ScheduleException {
  dateIso: string;
  start: string;
  end: string;
}

export interface ScheduleConfig {
  weekly: Record<number, DaySchedule>;
  blockedDates: string[];
  exceptions: ScheduleException[];
}

const SLOT_STEP_MIN = 30;

export const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function defaultWeekly(): Record<number, DaySchedule> {
  return {
    0: { open: false, start: "09:00", end: "19:00" },
    1: { open: true, start: "09:00", end: "19:00" },
    2: { open: true, start: "09:00", end: "19:00" },
    3: { open: true, start: "09:00", end: "19:00" },
    4: { open: true, start: "09:00", end: "19:00" },
    5: { open: true, start: "09:00", end: "19:00" },
    6: { open: true, start: "09:00", end: "19:00" },
  };
}

export function defaultSchedule(): ScheduleConfig {
  return {
    weekly: defaultWeekly(),
    blockedDates: [],
    exceptions: [],
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

function sanitizeDay(raw: unknown): DaySchedule {
  const source = (raw ?? {}) as Partial<DaySchedule>;
  return {
    open: Boolean(source.open),
    start: isValidTime(source.start ?? "") ? source.start! : "09:00",
    end: isValidTime(source.end ?? "") ? source.end! : "19:00",
  };
}

export function loadSchedule(): ScheduleConfig {
  let config = defaultSchedule();
  try {
    const raw = localStorage.getItem(CONFIG.scheduleKey);
    if (!raw) return config;
    const parsed = JSON.parse(raw) as Partial<ScheduleConfig>;
    if (parsed.weekly && typeof parsed.weekly === "object") {
      for (let day = 0; day <= 6; day++) {
        config.weekly[day] = sanitizeDay(parsed.weekly[day]);
      }
    }
    if (Array.isArray(parsed.blockedDates)) {
      config.blockedDates = parsed.blockedDates.filter(
        (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
      );
    }
    if (Array.isArray(parsed.exceptions)) {
      config.exceptions = parsed.exceptions.filter(
        (e): e is ScheduleException =>
          Boolean(e) &&
          typeof e.dateIso === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.dateIso) &&
          isValidTime(e.start ?? "") &&
          isValidTime(e.end ?? ""),
      );
    }
  } catch {
    config = defaultSchedule();
  }
  return config;
}

export function saveSchedule(config: ScheduleConfig): void {
  localStorage.setItem(CONFIG.scheduleKey, JSON.stringify(config));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getDay();
}

export function exceptionFor(dateIso: string, config = loadSchedule()): ScheduleException | null {
  return config.exceptions.find((e) => e.dateIso === dateIso) ?? null;
}

export function isDateBlocked(dateIso: string, config = loadSchedule()): boolean {
  return config.blockedDates.includes(dateIso);
}

/** A data está aberta? Bloqueios e a regra semanal são respeitados; exceção abre o dia. */
export function isDateOpen(dateIso: string, config = loadSchedule()): boolean {
  if (isDateBlocked(dateIso, config)) return false;
  if (exceptionFor(dateIso, config)) return true;
  return config.weekly[weekdayOf(dateIso)]?.open === true;
}

/**
 * Horários disponíveis na data (slots de 30 em 30 minutos, do início ao fim
 * configurados — inclusive). Exceção de horário especial sobrepõe a regra
 * semanal; datas bloqueadas não geram horários.
 */
export function slotsForDate(dateIso: string, config = loadSchedule()): string[] {
  if (isDateBlocked(dateIso, config)) return [];

  const exception = exceptionFor(dateIso, config);
  let day: DaySchedule;
  if (exception) {
    day = { open: true, start: exception.start, end: exception.end };
  } else {
    const weeklyDay = config.weekly[weekdayOf(dateIso)];
    if (!weeklyDay || !weeklyDay.open) return [];
    day = weeklyDay;
  }

  const from = timeToMinutes(day.start);
  const to = timeToMinutes(day.end);
  if (to <= from) return [];

  const slots: string[] = [];
  for (let minutes = from; minutes <= to; minutes += SLOT_STEP_MIN) {
    slots.push(minutesToTime(minutes));
  }
  return slots;
}
