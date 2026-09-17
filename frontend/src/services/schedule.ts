import { apiFetch, httpJson, ApiError, readErrorMessage } from "./api.js";

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
  ativo?: boolean;
}

interface HorarioExcecaoDTO {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: "bloqueio" | "liberacao";
  motivo: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CreateHorarioExcecaoRequest {
  funcionario_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: "bloqueio" | "liberacao";
  motivo?: string | null;
}

interface UpdateHorarioExcecaoRequest {
  data?: string;
  hora_inicio?: string;
  hora_fim?: string;
  tipo?: "bloqueio" | "liberacao";
  motivo?: string | null;
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
 * - `blockedDates` e `exceptions` voltam vazios aqui: exceções de horário
 *   são mapeadas separadamente por `excecoesToScheduleConfig`, com fonte na
 *   API `/horario-excecoes`.
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
    blockedDates: [], // Mapeado por excecoesToScheduleConfig (GET /horario-excecoes)
    exceptions: [], // Mapeado por excecoesToScheduleConfig (GET /horario-excecoes)
  };
}

// ── Exceções de horário (dias bloqueados e aberturas excepcionais) ──────

/**
 * Horários fixos do mapeamento obrigatório de data bloqueada: dia inteiro
 * ⇄ `tipo='bloqueio'` com `hora_inicio='00:00'` e `hora_fim='23:59'`.
 */
const BLOCKED_START = "00:00";
const BLOCKED_END = "23:59";

/** Campos de exceção de `ScheduleConfig` derivados da API de exceções. */
export interface ScheduleExcecoesView {
  blockedDates: string[];
  exceptions: ScheduleException[];
}

/**
 * Mapeia `HorarioExcecaoDTO[]` (resposta do backend) para os campos de
 * exceção de `ScheduleConfig`:
 * - `tipo='bloqueio'` → `blockedDates` (data bloqueada por inteiro);
 * - `tipo='liberacao'` → `exceptions` (abertura excepcional com horário).
 *
 * Se há mais de um registro para o mesmo par `(tipo, data)`, prevalece o
 * último (mesmo critério do mapeamento semanal).
 */
export function excecoesToScheduleConfig(
  excecoes: HorarioExcecaoDTO[],
): ScheduleExcecoesView {
  const blockedDates: string[] = [];
  const exceptions: ScheduleException[] = [];
  const seenBlocked = new Set<string>();
  const seenException = new Set<string>();

  for (const e of excecoes) {
    if (e.tipo === "bloqueio") {
      if (!seenBlocked.has(e.data)) {
        seenBlocked.add(e.data);
        blockedDates.push(e.data);
      }
    } else if (e.tipo === "liberacao") {
      if (!seenException.has(e.data)) {
        seenException.add(e.data);
        exceptions.push({
          dateIso: e.data,
          start: normalizeTime(e.hora_inicio),
          end: normalizeTime(e.hora_fim),
        });
      }
    }
  }

  return { blockedDates, exceptions };
}

/** Operação de atualização (PUT) de uma exceção existente. */
export interface HorarioExcecaoUpdateItem {
  id: string;
  body: UpdateHorarioExcecaoRequest;
}

/** Diff calculado entre o estado desejado e as exceções atuais do backend. */
export interface HorarioExcecaoDiff {
  create: CreateHorarioExcecaoRequest[];
  update: HorarioExcecaoUpdateItem[];
  remove: string[];
}

/**
 * Calcula o diff entre o estado desejado (`config`) e as exceções atuais
 * (`existing`), produzindo operações idempotentes:
 * - cria (`POST`) exceções que ainda não existem;
 * - atualiza (`PUT`) registros reutilizáveis cujo valor mudou;
 * - remove (`DELETE`) apenas o que realmente saiu do estado desejado.
 *
 * `blockedDates` e `exceptions` são tratados como buckets independentes
 * (`tipo='bloqueio'` e `tipo='liberacao'` no backend): um registro de um
 * tipo nunca é reaproveitado para representar o outro. Datas repetidas no
 * mesmo estado desejado geram uma única operação.
 */
export function diffScheduleExceptions(
  config: ScheduleConfig,
  existing: HorarioExcecaoDTO[],
  funcionarioId: string,
): HorarioExcecaoDiff {
  const create: CreateHorarioExcecaoRequest[] = [];
  const update: HorarioExcecaoUpdateItem[] = [];
  const remove: string[] = [];

  // Último registro por (tipo, data) — "prevalece o último" (mesmo critério
  // do diff semanal, que mantém o melhor candidato por dia).
  const existingByTipoData = new Map<string, HorarioExcecaoDTO>();
  for (const e of existing) {
    existingByTipoData.set(`${e.tipo}|${e.data}`, e);
  }

  // Bloqueios: data inteira com horas fixas (uma operação por data).
  const desiredBlockedDates = [...new Set(config.blockedDates)];
  for (const dateIso of desiredBlockedDates) {
    const rec = existingByTipoData.get(`bloqueio|${dateIso}`);
    if (!rec) {
      create.push({
        funcionario_id: funcionarioId,
        data: dateIso,
        hora_inicio: BLOCKED_START,
        hora_fim: BLOCKED_END,
        tipo: "bloqueio",
        motivo: null,
      });
    } else if (
      normalizeTime(rec.hora_inicio) !== BLOCKED_START ||
      normalizeTime(rec.hora_fim) !== BLOCKED_END
    ) {
      // Reaproveita o registro normalizando para o bloqueio de dia inteiro.
      update.push({
        id: rec.id,
        body: { hora_inicio: BLOCKED_START, hora_fim: BLOCKED_END },
      });
    }
  }

  // Aberturas excepcionais: uma por data, com os horários desejados
  // (prevalece a última exceção quando há datas repetidas).
  const desiredExceptionByDate = new Map<string, ScheduleException>();
  for (const ex of config.exceptions) {
    desiredExceptionByDate.set(ex.dateIso, ex);
  }
  for (const ex of desiredExceptionByDate.values()) {
    const rec = existingByTipoData.get(`liberacao|${ex.dateIso}`);
    if (!rec) {
      create.push({
        funcionario_id: funcionarioId,
        data: ex.dateIso,
        hora_inicio: ex.start,
        hora_fim: ex.end,
        tipo: "liberacao",
        motivo: null,
      });
    } else if (
      normalizeTime(rec.hora_inicio) !== ex.start ||
      normalizeTime(rec.hora_fim) !== ex.end
    ) {
      // Reaproveita o registro atualizando apenas os horários.
      update.push({
        id: rec.id,
        body: { hora_inicio: ex.start, hora_fim: ex.end },
      });
    }
  }

  // Remoções: registros existentes que não estão no estado desejado.
  const desiredBlocked = new Set(config.blockedDates);
  for (const e of existing) {
    const stillDesired =
      (e.tipo === "bloqueio" && desiredBlocked.has(e.data)) ||
      (e.tipo === "liberacao" && desiredExceptionByDate.has(e.data));
    if (!stillDesired) {
      remove.push(e.id);
    }
  }

  return { create, update, remove };
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

// ── API pública ─────────────────────────────────────────────────────────

/**
 * Carrega a configuração de horários de um funcionário via
 * `GET /horarios?funcionario_id={id}` e as exceções de horário via
 * `GET /horario-excecoes?funcionario_id={id}`.
 *
 * A busca de exceções degrada para `[]` em falha (ex.: papel sem acesso,
 * 403) sem quebrar o carregamento do horário semanal.
 */
export async function loadSchedule(
  funcionarioId?: string,
): Promise<ScheduleConfig> {
  try {
    const qs = funcionarioId
      ? `?funcionario_id=${encodeURIComponent(funcionarioId)}`
      : "";
    const horarios = await httpJson<HorarioTrabalhoDTO[]>(`/horarios${qs}`);
    const config = horariosToScheduleConfig(horarios);

    // Exceções exigem autenticação e só fazem sentido com funcionário alvo.
    if (funcionarioId) {
      try {
        const excecoes = await httpJson<HorarioExcecaoDTO[]>(
          `/horario-excecoes?funcionario_id=${encodeURIComponent(funcionarioId)}`,
        );
        return { ...config, ...excecoesToScheduleConfig(excecoes) };
      } catch {
        // Degrada para sem exceções (mantém o weekly carregado).
        return config;
      }
    }

    return config;
  } catch {
    return defaultSchedule();
  }
}

/**
 * Salva a configuração de horários de um funcionário, comparando o estado
 * desejado com o backend e executando `POST`/`PUT`/`DELETE` por dia.
 *
 * Além do diff semanal, aplica o diff de exceções (`blockedDates` e
 * `exceptions`): cria o que falta, atualiza registros reutilizáveis e
 * exclui apenas o que foi removido.
 */
export async function saveSchedule(
  config: ScheduleConfig,
  funcionarioId?: string,
): Promise<void> {
  if (!funcionarioId) return;

  // Busca horários atuais para calcular o diff. Falha aqui é falha de
  // gravação: propagamos para o caller exibir feedback ao usuário.
  const existing: HorarioTrabalhoDTO[] = await httpJson<HorarioTrabalhoDTO[]>(
    `/horarios?funcionario_id=${encodeURIComponent(funcionarioId)}`,
  );

  // Mantém o melhor candidato por dia: registros ativos E inativos entram na
  // conta, para que um dia desmarcado use PUT `ativo=false` e não perca o
  // horário configurado (nunca DELETE).
  const existingByDay = new Map<number, HorarioTrabalhoDTO>();
  for (const h of existing) {
    const previous = existingByDay.get(h.dia_semana);
    if (!previous || previous.ativo) {
      existingByDay.set(h.dia_semana, h);
    }
  }

  for (const day of DEFAULT_DAYS) {
    const dayCfg = config.weekly[day];
    const existingRecord = existingByDay.get(day);

    if (dayCfg.open) {
      if (existingRecord) {
        // Garante horário E `ativo=true` (re-ativa um registro desativado).
        const currentStart = normalizeTime(existingRecord.hora_inicio);
        const currentEnd = normalizeTime(existingRecord.hora_fim);
        if (
          !existingRecord.ativo ||
          currentStart !== dayCfg.start ||
          currentEnd !== dayCfg.end
        ) {
          await httpJson<HorarioTrabalhoDTO>(`/horarios/${existingRecord.id}`, {
            method: "PUT",
            body: JSON.stringify({
              hora_inicio: dayCfg.start,
              hora_fim: dayCfg.end,
              ativo: true,
            } satisfies UpdateHorarioRequest),
          });
        }
      } else {
        // Cria novo horário para este dia (ativo por padrão no banco)
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
    } else if (existingRecord?.ativo) {
      // Dia fechado mas com registro ativo → desativa, preservando o diff.
      await httpJson<HorarioTrabalhoDTO>(`/horarios/${existingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({ ativo: false } satisfies UpdateHorarioRequest),
      });
    }
  }

  // ── Exceções de horário (dias bloqueados e aberturas excepcionais) ──
  // Difere contra o estado atual e emite POST/PUT/DELETE idempotente.
  const excecoesAtuais: HorarioExcecaoDTO[] = await httpJson<HorarioExcecaoDTO[]>(
    `/horario-excecoes?funcionario_id=${encodeURIComponent(funcionarioId)}`,
  );
  const diff = diffScheduleExceptions(config, excecoesAtuais, funcionarioId);

  for (const item of diff.create) {
    await httpJson<HorarioExcecaoDTO>("/horario-excecoes", {
      method: "POST",
      body: JSON.stringify(item satisfies CreateHorarioExcecaoRequest),
    });
  }
  for (const item of diff.update) {
    await httpJson<HorarioExcecaoDTO>(
      `/horario-excecoes/${encodeURIComponent(item.id)}`,
      {
        method: "PUT",
        body: JSON.stringify(item.body satisfies UpdateHorarioExcecaoRequest),
      },
    );
  }
  // DELETE responde 204 sem corpo: usa apiFetch (httpJson faria response.json()).
  for (const id of diff.remove) {
    const res = await apiFetch(
      `/horario-excecoes/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const serverMessage =
        (await readErrorMessage(res)) ??
        `Erro ao excluir exceção de horário (${res.status}).`;
      throw new ApiError(serverMessage, res.status);
    }
  }
}

/**
 * Retorna os horários disponíveis (slots de 30 min) para uma data via
 * `GET /horarios/funcionario-disponibilidade` (público).
 */
export async function slotsForDate(
  dateIso: string,
  funcionarioId?: string,
): Promise<string[]> {
  if (!funcionarioId) return [];

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
}

/**
 * Verifica se uma data está aberta (tem horários disponíveis), delegando
 * para `slotsForDate`.
 */
export async function isDateOpen(
  dateIso: string,
  funcionarioId?: string,
): Promise<boolean> {
  if (!funcionarioId) return false;

  const slots = await slotsForDate(dateIso, funcionarioId);
  return slots.length > 0;
}

/**
 * Dia da semana (0=domingo ... 6=sábado) de uma data ISO "YYYY-MM-DD",
 * calculado pelas partes com `Date.UTC` — imune ao fuso local do navegador
 * (mesmo critério do backend, que adota America/Sao_Paulo).
 */
export function weekdayOf(dateIso: string): number {
  const [ano, mes, dia] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1)).getUTCDay();
}

/**
 * Dias da semana (0-6) em que o funcionário possui horário ATIVO, via endpoint
 * público de disponibilidade SEM data. Permite diferenciar "profissional sem
 * agenda cadastrada" de "fechado nesta data" e avaliar se outros profissionais
 * cobrem o dia.
 */
export async function professionalWorkdays(
  funcionarioId: string,
): Promise<number[]> {
  try {
    const resp = await httpJson<{ horarios: HorarioTrabalhoDTO[]; ocupados: string[] }>(
      `/horarios/funcionario-disponibilidade?funcionario_id=${encodeURIComponent(funcionarioId)}`,
    );
    return [...new Set(resp.horarios.filter((h) => h.ativo).map((h) => h.dia_semana))];
  } catch {
    return [];
  }
}
