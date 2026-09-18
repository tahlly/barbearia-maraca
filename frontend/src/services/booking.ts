import type { Appointment, AppointmentStatus, BookingDraft } from "../types.js";
import type { PagamentoStatus } from "./pagamento.js";
import { httpJson } from "./api.js";

/* ------------------------------------------------------------------ */
/*  DTO shapes (espelho fiel de AgendamentoDTO em shared/types/index.ts */
/*  — não importar diretamente por rootDir ser src/ no tsconfig)        */
/* ------------------------------------------------------------------ */

type AgendamentoStatusDTO = "pendente" | "confirmado" | "cancelado" | "concluido";

interface AgendamentoDTO {
  id: string;
  clienteId: string;
  clienteNome: string | null;
  funcionarioId: string;
  funcionarioNome: string | null;
  servicoId: string;
  servicoNome: string | null;
  data: string;
  hora: string;
  status: AgendamentoStatusDTO;
  observacao: string | null;
  criadoEm?: string;
  /** Aditivo do contrato: pode vir preenchido ou ausente/null. */
  pagamentoStatus?: PagamentoStatus | null;
}

/**
 * Mapeia um `AgendamentoDTO` (contrato do backend) para o tipo `Appointment`
 * do frontend. As views consomem apenas o tipo local.
 */
export function mapAppointment(dto: AgendamentoDTO): Appointment {
  return {
    id: dto.id,
    clienteId: dto.clienteId,
    clienteNome: dto.clienteNome,
    funcionarioId: dto.funcionarioId,
    funcionarioNome: dto.funcionarioNome,
    servicoId: dto.servicoId,
    servicoNome: dto.servicoNome,
    data: dto.data,
    hora: dto.hora,
    status: mapStatus(dto.status),
    observacao: dto.observacao ?? undefined,
    criadoEm: dto.criadoEm,
    pagamentoStatus: dto.pagamentoStatus ?? null,
  };
}

function mapStatus(status: AgendamentoStatusDTO): AppointmentStatus {
  switch (status) {
    case "confirmado":
    case "pendente":
    case "concluido":
    case "cancelado":
      return status;
  }
}

/**
 * Cria um agendamento.
 *
 * - Papel cliente: o backend resolve o cliente autenticado via token JWT.
 * - Recepcionista/admin: deve informar `draft.clienteId` para criar o
 *   agendamento em nome de um cliente (ver agendamento-service).
 * `draft` recebe os ids já resolvidos (funcionário e serviço únicos).
 * POST /api/agendamentos
 */
export async function createAppointment(draft: BookingDraft): Promise<Appointment> {
  const dto = await httpJson<AgendamentoDTO>("/agendamentos", {
    method: "POST",
    body: JSON.stringify({
      funcionario_id: draft.funcionario_id,
      servico_id: draft.servico_id,
      data: draft.data,
      hora: draft.hora,
      observacao: draft.observacao ?? null,
      timezone_offset_minutes: draft.timezoneOffsetMinutes ?? null,
      ...(draft.clienteId ? { cliente_id: draft.clienteId } : {}),
    }),
  });
  return mapAppointment(dto);
}

/**
 * Lista os agendamentos visíveis ao usuário autenticado.
 * O backend já filtra por papel (cliente vê os seus; barbeiro vê a própria
 * agenda; recep/admin veem todos). Não é necessário enviar e-mail.
 * GET /api/agendamentos
 */
export async function listAppointments(): Promise<Appointment[]> {
  const dtos = await httpJson<AgendamentoDTO[]>("/agendamentos");
  return dtos.map(mapAppointment);
}

/** Busca um agendamento pelo id filtrando a listagem (não há GET por id dedicado). */
export async function findById(id: string): Promise<Appointment | null> {
  const list = await listAppointments();
  return list.find((a) => a.id === id) ?? null;
}

/**
 * Cancela um agendamento.
 * PATCH /api/agendamentos/:id/cancelar
 */
export async function cancelAppointment(id: string): Promise<Appointment | null> {
  const dto = await httpJson<AgendamentoDTO>(`/agendamentos/${encodeURIComponent(id)}/cancelar`, {
    method: "PATCH",
  });
  return mapAppointment(dto);
}

/**
 * Confirma um agendamento (profissional/recep/admin).
 * PATCH /api/agendamentos/:id/confirmar
 */
export async function confirmAppointment(id: string): Promise<Appointment> {
  const dto = await httpJson<AgendamentoDTO>(
    `/agendamentos/${encodeURIComponent(id)}/confirmar`,
    { method: "PATCH" },
  );
  return mapAppointment(dto);
}

/**
 * Conclui um agendamento (profissional/recep/admin).
 * PATCH /api/agendamentos/:id/concluir
 */
export async function concludeAppointment(id: string): Promise<Appointment> {
  const dto = await httpJson<AgendamentoDTO>(
    `/agendamentos/${encodeURIComponent(id)}/concluir`,
    { method: "PATCH" },
  );
  return mapAppointment(dto);
}

/**
 * Reverte a conclusão de um agendamento para "confirmado"
 * (profissional/recep/admin). Espelha `concludeAppointment`.
 * PATCH /api/agendamentos/:id/reverter
 */
export async function revertCompletion(id: string): Promise<Appointment> {
  const dto = await httpJson<AgendamentoDTO>(
    `/agendamentos/${encodeURIComponent(id)}/reverter`,
    { method: "PATCH" },
  );
  return mapAppointment(dto);
}

/** Dados mínimos enviados no reagendamento: somente nova data e novo horário. */
export interface RescheduleDados {
  data: string;
  hora: string;
  timezoneOffsetMinutes?: number | null;
}

/**
 * Reagenda um agendamento existente.
 *
 * Desde o contrato `/reagendar`, o fluxo NÃO é mais "cancelar + criar": o
 * backend atualiza SOMENTE `data` e `hora` na MESMA linha, preservando
 * pagamento, status, serviço e profissional. O `pagamentoStatus` do
 * AgendamentoDTO retornado permanece como estava (pago ou não pago).
 *
 * PATCH /api/agendamentos/:id/reagendar
 */
export async function reschedule(
  id: string,
  dados: RescheduleDados,
): Promise<{ appointment: Appointment }> {
  const dto = await httpJson<AgendamentoDTO>(
    `/agendamentos/${encodeURIComponent(id)}/reagendar`,
    {
      method: "PATCH",
      body: JSON.stringify({
        data: dados.data,
        hora: dados.hora,
        timezone_offset_minutes: dados.timezoneOffsetMinutes ?? null,
      }),
    },
  );
  return { appointment: mapAppointment(dto) };
}

/* ------------------------------------------------------------------ */
/*  Faturamento (dashboard do profissional/admin)                      */
/* ------------------------------------------------------------------ */

export interface RevenueByService {
  servicoId: string;
  servicoNome: string;
  quantidade: number;
  valorTotal: string;
}

/**
 * Resumo de faturamento: considera somente agendamentos `concluido` no
 * período. Os valores monetários chegam como string normalizada (ex.:
 * "45.90") para preservar a precisão vinda do DECIMAL(10,2).
 */
export interface RevenueSummary {
  inicio: string;
  fim: string;
  valorTotal: string;
  quantidade: number;
  ticketMedio: string;
  porServico: RevenueByService[];
}

interface FaturamentoResumoDTO {
  inicio: string;
  fim: string;
  valorTotal: string;
  quantidade: number;
  ticketMedio: string;
  porServico: Array<{
    servicoId: string;
    servicoNome: string;
    quantidade: number;
    valorTotal: string;
  }>;
}

/**
 * Busca o resumo de faturamento do usuário autenticado.
 * Profissional recebe somente a própria agenda; admin recebe o total.
 * GET /api/agendamentos/faturamento?inicio=&fim=
 */
export async function getRevenueSummary(
  inicio?: string,
  fim?: string,
): Promise<RevenueSummary> {
  const params = new URLSearchParams();
  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const dto = await httpJson<FaturamentoResumoDTO>(`/agendamentos/faturamento${query}`);
  return {
    inicio: dto.inicio,
    fim: dto.fim,
    valorTotal: dto.valorTotal,
    quantidade: dto.quantidade,
    ticketMedio: dto.ticketMedio,
    porServico: dto.porServico.map((p) => ({ ...p })),
  };
}
