import { CONFIG } from "../config.js";
import { httpJson, isMockMode } from "./api.js";

// ── Tipos de contrato HTTP (espelho de shared/types — mantidos localmente
// para evitar import fora do rootDir do frontend) ────────────────────────

interface HorarioTrabalhoDTO {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CreateHorarioRequest {
  funcionario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

interface UpdateHorarioRequest {
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
}

// ── Tipos públicos (mantidos para compatibilidade com views) ────────────

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

// ── Constantes ──────────────────────────────────────────────────────────

const SLOT_STEP_MIN = 30;

export const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

// ── Funções puras (stateless, sem side-effects) ─────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
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

function sanitizeDay(raw: unknown): DaySchedule {
  const source = (raw ?? {}) as Partial<DaySchedule>;
  return {
    open: Boolean(source.open),
    start: isValidTime(source.start ?? "") ? source.start! : "09:00",
    end: isValidTime(source.end ?? "") ? source.end! : "19:00",
  };
}

// ── Helpers de mapeamento API ───────────────────────────────────────────

/**
 * Normaliza o campo TIME do Postgres ("09:00:00" ou "09:00") para "HH:MM".
 */
function normalizeTime(raw: string): string {
  return raw.length >= 5 ? raw.slice(0, 5) : raw;
}

/**
 * Mapeia `HorarioTrabalhoDTO[]` (resposta do backend) para `ScheduleConfig`.
 *
 * Decisão de mapeamento:
 * - Cada registro com `ativo=true` define o horário de um dia da semana.
 * - Dias sem registro ficam fechados (`open: false`).
 * - `blockedDates` e `exceptions` não são modelados pelo backend; retornam [].
 * - Se há mais de um registro para o mesmo `dia_semana`, prevalece o último.
 */
function horariosToScheduleConfig(horarios: HorarioTrabalhoDTO[]): ScheduleConfig {
  const weekly = defaultWeekly();

  // Se nenhum horário ativo existe, todos os dias ficam fechados.
  const hasAnyActive = horarios.some((h) => h.ativo);
  if (!hasAnyActive) {
    for (const day of DEFAULT_DAYS) {
      weekly[day] = { open: false, start: "09:00", end: "19:00" };
    }
  } else {
    // Começa tudo fechado; abre apenas os que têm horário ativo.
    for (const day of DEFAULT_DAYS) {
      weekly[day] = { open: false, start: "09:00", end: "19:00" };
    }
    for (const h of horarios) {
      if (!h.ativo) continue;
      if (h.dia_semana >= 0 && h.dia_semana <= 6) {
        weekly[h.dia_semana] = {
          open: true,
          start: normalizeTime(h.hora_inicio),
          end: normalizeTime(h.hora_fim),
        };
      }
    }
  }

  return {
    weekly,
    blockedDates: [], // Backend não modela datas bloqueadas
    exceptions: [], // Backend não modela exceções de agenda
  };
}

/**
 * Gera slots de 30 minutos a partir de um intervalo `start`–`end`.
 */
function generateSlots(start: string, end: string): string[] {
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  if (to <= from) return [];

  const slots: string[] = [];
  for (let minutes = from; minutes <= to; minutes += SLOT_STEP_MIN) {
    slots.push(minutesToTime(minutes));
  }
  return slots;
}

// ── Helpers de mock (localStorage) ───────────────────────────────────────

function loadScheduleFromStorage(): ScheduleConfig {
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
        (d): d is string =>
          typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
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

function saveScheduleToStorage(config: ScheduleConfig): void {
  localStorage.setItem(CONFIG.scheduleKey, JSON.stringify(config));
}

// ── Funções auxiliares de consulta (sync, usadas por utils abaixo) ──────

export function exceptionFor(
  dateIso: string,
  config: ScheduleConfig,
): ScheduleException | null {
  return config.exceptions.find((e) => e.dateIso === dateIso) ?? null;
}

export function isDateBlocked(
  dateIso: string,
  config: ScheduleConfig,
): boolean {
  return config.blockedDates.includes(dateIso);
}

/**
 * Versão síncrona de `isDateOpen` (lê do ScheduleConfig in-memory).
 * Usada internamente quando já se tem o config carregado.
 */
function isDateOpenFromConfig(dateIso: string, config: ScheduleConfig): boolean {
  if (isDateBlocked(dateIso, config)) return false;
  if (exceptionFor(dateIso, config)) return true;
  return config.weekly[weekdayOf(dateIso)]?.open === true;
}

/**
 * Versão síncrona de `slotsForDate` (lê do ScheduleConfig in-memory).
 */
function slotsForDateFromConfig(
  dateIso: string,
  config: ScheduleConfig,
): string[] {
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

  return generateSlots(day.start, day.end);
}

// ── API pública ─────────────────────────────────────────────────────────

/**
 * Carrega a configuração de horários de um funcionário.
 *
 * **Modo mock:** lê de `localStorage` (comportamento legado).
 * **Modo API:** chama `GET /horarios?funcionario_id={id}` e mapeia a lista
 * de `HorarioTrabalhoDTO` para `ScheduleConfig`.
 *
 * Mapeamento API → ScheduleConfig:
 * - Cada `HorarioTrabalhoDTO` com `ativo=true` define `weekly[dia_semana]`.
 * - Dias sem registro → `{ open: false }`.
 * - `blockedDates` e `exceptions` são mantidos apenas em localStorage
 *   (o backend não os modela).
 *
 * PENDÊNCIA: A assinatura mudou para `async` + parâmetro opcional
 * `funcionarioId`. As chamadas síncronas em `manage.ts` e
 * `bookingWizard.ts` precisarão ser adaptadas para usar `await`.
 */
export async function loadSchedule(
  funcionarioId?: string,
): Promise<ScheduleConfig> {
  if (isMockMode()) {
    return loadScheduleFromStorage();
  }

  try {
    const qs = funcionarioId
      ? `?funcionario_id=${encodeURIComponent(funcionarioId)}`
      : "";
    const horarios = await httpJson<HorarioTrabalhoDTO[]>(`/horarios${qs}`);
    return horariosToScheduleConfig(horarios);
  } catch {
    return defaultSchedule();
  }
}

/**
 * Salva a configuração de horários de um funcionário.
 *
 * **Modo mock:** grava em `localStorage` (comportamento legado).
 * **Modo API:** compara o estado desejado com o backend e executa
 * `POST`/`PUT`/`DELETE` necessários para cada dia da semana.
 *
 * `blockedDates` e `exceptions` continuam sendo gravados em localStorage
 * (o backend não os suporta).
 *
 * PENDÊNCIA: A assinatura agora requer `funcionarioId` em modo API.
 * A chamada em `manage.ts` será quebrada até o modal ser atualizado
 * para suportar configuração por funcionário.
 */
export async function saveSchedule(
  config: ScheduleConfig,
  funcionarioId?: string,
): Promise<void> {
  // Sempre persiste blockedDates/exceptions localmente
  if (isMockMode()) {
    saveScheduleToStorage(config);
    return;
  }

  if (!funcionarioId) return;

  // Busca horários atuais para calcular o diff
  let existing: HorarioTrabalhoDTO[] = [];
  try {
    existing = await httpJson<HorarioTrabalhoDTO[]>(
      `/horarios?funcionario_id=${encodeURIComponent(funcionarioId)}`,
    );
  } catch {
    return;
  }

  const existingByDay = new Map<number, HorarioTrabalhoDTO>();
  for (const h of existing) {
    if (h.ativo) {
      existingByDay.set(h.dia_semana, h);
    }
  }

  for (const day of DEFAULT_DAYS) {
    const dayCfg = config.weekly[day];
    const existingRecord = existingByDay.get(day);

    if (dayCfg.open) {
      if (existingRecord) {
        // Atualiza se horário mudou
        const currentStart = normalizeTime(existingRecord.hora_inicio);
        const currentEnd = normalizeTime(existingRecord.hora_fim);
        if (currentStart !== dayCfg.start || currentEnd !== dayCfg.end) {
          await httpJson<HorarioTrabalhoDTO>(
            `/horarios/${existingRecord.id}`,
            {
              method: "PUT",
              body: JSON.stringify({
                hora_inicio: dayCfg.start,
                hora_fim: dayCfg.end,
              } satisfies UpdateHorarioRequest),
            },
          );
        }
      } else {
        // Cria novo horário para este dia
        await httpJson<HorarioTrabalhoDTO>("/horarios", {
          method: "POST",
          body: JSON.stringify({
            funcionario_id: funcionarioId,
            dia_semana: day,
            hora_inicio: dayCfg.start,
            hora_fim: dayCfg.end,
          } satisfies CreateHorarioRequest),
        });
      }
    } else if (existingRecord) {
      // Dia fechado mas tem registro → remove
      await httpJson<void>(`/horarios/${existingRecord.id}`, {
        method: "DELETE",
      });
    }
  }

  // Mantém blockedDates/exceptions no localStorage (sem equivalente backend)
  saveScheduleToStorage({
    weekly: config.weekly,
    blockedDates: config.blockedDates,
    exceptions: config.exceptions,
  });
}

/**
 * Retorna os horários disponíveis (slots de 30 min) para uma data.
 *
 * **Modo mock:** gera localmente a partir do `ScheduleConfig` em localStorage.
 * **Modo API:** chama `GET /horarios/funcionario-disponibilidade` e gera
 * slots a partir dos `horario_trabalho` retornados.
 *
 * PENDÊNCIA: O endpoint de disponibilidade requer autenticação.
 * Clientes não autenticados (booking wizard público) não poderão
 * obter slots via API até o backend disponibilizar acesso público
 * ou `authenticateOptional` neste endpoint.
 *
 * PENDÊNCIA: A assinatura mudou para `async` + `funcionarioId`.
 * `bookingWizard.ts` chama `slotsForDate(dateIso)` sem `funcionarioId`;
 * precisa ser atualizado para passar `state.professionalId`.
 */
export async function slotsForDate(
  dateIso: string,
  funcionarioId?: string,
): Promise<string[]> {
  if (isMockMode()) {
    return slotsForDateFromConfig(dateIso, loadScheduleFromStorage());
  }

  if (!funcionarioId) return [];

  try {
    const resp = await httpJson<{ horarios: HorarioTrabalhoDTO[]; ocupados: string[] }>(
      `/horarios/funcionario-disponibilidade?funcionario_id=${encodeURIComponent(funcionarioId)}&data=${dateIso}`,
    );
    // O endpoint retorna { horarios, ocupados }.
    // Geramos os slots de 30 min a partir de cada horário ativo
    // e excluímos os que já estão ocupados por agendamentos.
    const ocupadosSet = new Set(resp.ocupados);
    const slots: string[] = [];
    for (const h of resp.horarios) {
      if (!h.ativo) continue;
      const start = normalizeTime(h.hora_inicio);
      const end = normalizeTime(h.hora_fim);
      for (const slot of generateSlots(start, end)) {
        if (!ocupadosSet.has(slot)) {
          slots.push(slot);
        }
      }
    }
    return slots;
  } catch {
    return [];
  }
}

/**
 * Verifica se uma data está aberta (tem horários disponíveis).
 *
 * **Modo mock:** verifica `blockedDates`, `exceptions` e `weekly` localmente.
 * **Modo API:** delega para `slotsForDate` (verifica se há ao menos 1 slot).
 *
 * PENDÊNCIA: Mesma restrição de autenticação que `slotsForDate`.
 * PENDÊNCIA: Mesma mudança de assinatura (`async` + `funcionarioId`).
 */
export async function isDateOpen(
  dateIso: string,
  funcionarioId?: string,
): Promise<boolean> {
  if (isMockMode()) {
    return isDateOpenFromConfig(dateIso, loadScheduleFromStorage());
  }

  if (!funcionarioId) return false;

  const slots = await slotsForDate(dateIso, funcionarioId);
  return slots.length > 0;
}
