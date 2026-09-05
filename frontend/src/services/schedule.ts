import { CONFIG } from "../config.js";
import { httpJson } from "./api.js";

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

// ── Helper de persistência local (blockedDates/exceptions) ──────────────

function saveScheduleToStorage(config: ScheduleConfig): void {
  localStorage.setItem(CONFIG.scheduleKey, JSON.stringify(config));
}

// ── API pública ─────────────────────────────────────────────────────────

/**
 * Carrega a configuração de horários de um funcionário.
 *
 * Chama `GET /horarios?funcionario_id={id}` e mapeia a lista de
 * `HorarioTrabalhoDTO` para `ScheduleConfig`.
 *
 * Mapeamento API → ScheduleConfig:
 * - Cada `HorarioTrabalhoDTO` com `ativo=true` define `weekly[dia_semana]`.
 * - Dias sem registro → `{ open: false }`.
 * - `blockedDates` e `exceptions` são mantidos apenas em localStorage
 *   (o backend não os modela).
 */
export async function loadSchedule(
  funcionarioId?: string,
): Promise<ScheduleConfig> {

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
 * Compara o estado desejado com o backend e executa `POST`/`PUT`/`DELETE`
 * necessários para cada dia da semana.
 *
 * `blockedDates` e `exceptions` continuam sendo gravados em localStorage
 * (o backend não os suporta).
 *
 * O modal de agenda em `manage.ts` resolve o `funcionarioId` do usuário
 * logado e o repassa para esta função.
 */
export async function saveSchedule(
  config: ScheduleConfig,
  funcionarioId?: string,
): Promise<void> {
  // Sempre persiste blockedDates/exceptions localmente

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
 * Chama `GET /horarios/funcionario-disponibilidade` e gera slots a partir
 * dos `horario_trabalho` retornados.
 *
 * O endpoint de disponibilidade é público (não exige autenticação), permitindo
 * que o booking wizard obtenha slots sem login.
 */
export async function slotsForDate(
  dateIso: string,
  funcionarioId?: string,
): Promise<string[]> {

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
 * Delega para `slotsForDate` (verifica se há ao menos 1 slot).
 */
export async function isDateOpen(
  dateIso: string,
  funcionarioId?: string,
): Promise<boolean> {
  if (!funcionarioId) return false;

  const slots = await slotsForDate(dateIso, funcionarioId);
  return slots.length > 0;
}
