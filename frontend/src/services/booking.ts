import type { Appointment, AppointmentStatus, BookingDraft } from "../types.js";
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
 * Cria um agendamento. O backend resolve o cliente autenticado via token.
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
 * Reagendar: não há endpoint próprio no backend. A composição recomendada é
 * **cancelar o agendamento antigo** e **criar um novo** com os novos dados.
 * Esta função cancela o antigo e devolve o agendamento cancelado; a view deve
 * então abrir o wizard de novo (estado "novo") com os dados pré-preenchidos.
 */
export async function reschedule(
  id: string,
): Promise<{ canceled: Appointment }> {
  const canceled = await cancelAppointment(id);
  if (!canceled) {
    throw new Error("Agendamento não encontrado para reagendar.");
  }
  return { canceled };
}
