import {
  criar,
  buscarPorId,
  listar,
  atualizarStatus,
  buscarClientePorUsuarioId,
  buscarFuncionarioPorUsuarioId,
  funcionarioExisteAtivo,
  servicoExisteAtivo,
  resumirFaturamento,
  type AgendamentoRow,
} from '../repositories/agendamento-repository';
import type { AgendamentoDTO, AgendamentoStatus, CreateAgendamentoRequest } from '../dtos/agendamento-dto';
import type { FaturamentoResumoDTO } from '../dtos/faturamento-dto';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import { buscarClientePorId } from '../repositories/cliente-repository';
import { exigirPermissao } from './permissao-service';
import { formatarData, formatarHora } from '../utils/formatadores';

type Role = 'admin' | 'recepcionista' | 'profissional' | 'cliente';

const TRANSICOES: Record<AgendamentoStatus, AgendamentoStatus[]> = {
  pendente: ['confirmado', 'cancelado'],
  confirmado: ['concluido', 'cancelado'],
  cancelado: [],
  concluido: ['confirmado'],
};

function isRole(value: string): value is Role {
  return value === 'admin' || value === 'recepcionista' || value === 'profissional' || value === 'cliente';
}

function toDTO(row: AgendamentoRow): AgendamentoDTO {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    funcionarioId: row.funcionario_id,
    funcionarioNome: row.funcionario_nome,
    servicoId: row.servico_id,
    servicoNome: row.servico_nome,
    data: formatarData(row.data),
    hora: formatarHora(row.hora),
    status: row.status,
    observacao: row.observacao,
    criadoEm: row.created_at ?? undefined,
  };
}

function validarDataHora(
  data: string,
  hora: string,
  timezoneOffsetMinutes?: number | null,
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new ValidationError('Data inválida');
  }
  if (!/^\d{2}:\d{2}$/.test(hora)) {
    throw new ValidationError('Hora inválida');
  }
  // Interpreta data+hora no fuso do cliente (offset em minutos enviado pelo
  // navegador). Quando ausente, usa o fuso local do processo (Docker = UTC).
  // Sem isso, o agendamento "19:00 no horário do cliente" seria comparado como
  // 19:00 UTC e rejeitado indevidamente quando o cliente está em UTC-3.
  const offsetMin = timezoneOffsetMinutes ?? 0;
  const offsetSign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offsetHH = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMM = String(absOffset % 60).padStart(2, '0');
  const date = new Date(`${data}T${hora}:00${offsetSign}${offsetHH}:${offsetMM}`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Data ou hora inválida');
  }
  if (date.getTime() < Date.now()) {
    throw new ValidationError('Não é possível agendar em horário passado');
  }
}

function validarTransicao(atual: AgendamentoStatus, destino: AgendamentoStatus): void {
  const permitidas = TRANSICOES[atual];
  if (!permitidas.includes(destino)) {
    throw new ValidationError(`Transição de status inválida: ${atual} -> ${destino}`);
  }
}

function validarIntervalo(inicio: string, fim: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    throw new ValidationError('Intervalo de datas inválido');
  }
  if (inicio > fim) {
    throw new ValidationError('Data inicial não pode ser maior que a final');
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const e = error as { code?: unknown; message?: unknown };
  return (
    e.code === '23505' ||
    (typeof e.message === 'string' && e.message.includes('duplicate key'))
  );
}

export async function criarAgendamento(
  usuarioId: string,
  role: string,
  dados: CreateAgendamentoRequest,
): Promise<AgendamentoDTO> {
  if (!isRole(role)) {
    throw new ForbiddenError('Acesso negado');
  }

  // Quem pode criar? Cliente (próprio registro via token) OU staff com a
  // permissão efetiva `agendar_para_cliente` (em nome de um cliente informado
  // em `cliente_id`). Profissional só pode criar na própria agenda.
  let clienteId: string;
  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente) {
      throw new ForbiddenError('Perfil de cliente não encontrado');
    }
    clienteId = cliente.id;
  } else {
    await exigirPermissao({ id: usuarioId, role }, 'agendar_para_cliente');
    if (!dados.cliente_id) {
      throw new ValidationError('cliente_id é obrigatório para criação de agendamento');
    }
    const cliente = await buscarClientePorId(dados.cliente_id);
    if (!cliente) {
      throw new NotFoundError('Cliente não encontrado');
    }
    clienteId = cliente.id;

    if (role === 'profissional') {
      const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
      if (!funcionario) {
        throw new ForbiddenError('Perfil de funcionário não encontrado');
      }
      if (dados.funcionario_id !== funcionario.id) {
        throw new ForbiddenError('Acesso negado');
      }
    }
  }

  if (!(await funcionarioExisteAtivo(dados.funcionario_id))) {
    throw new NotFoundError('Funcionário não encontrado ou inativo');
  }

  if (!(await servicoExisteAtivo(dados.servico_id))) {
    throw new NotFoundError('Serviço não encontrado ou inativo');
  }

  validarDataHora(dados.data, dados.hora, dados.timezone_offset_minutes);

  try {
    const row = await criar({
      clienteId,
      funcionarioId: dados.funcionario_id,
      servicoId: dados.servico_id,
      data: dados.data,
      hora: dados.hora,
      observacao: dados.observacao ?? null,
    });
    return toDTO(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError('Horário indisponível');
    }
    throw error;
  }
}

export async function listarAgendamentos(
  usuarioId: string,
  role: string,
  filtros: { data?: string; status?: AgendamentoStatus },
): Promise<AgendamentoDTO[]> {
  if (!isRole(role)) {
    throw new ForbiddenError('Acesso negado');
  }

  const opcoes: { clienteId?: string; funcionarioId?: string; data?: string; status?: AgendamentoStatus } = {
    data: filtros.data,
    status: filtros.status,
  };

  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente) {
      throw new ForbiddenError('Perfil de cliente não encontrado');
    }
    opcoes.clienteId = cliente.id;
  } else if (role === 'profissional') {
    const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
    if (!funcionario) {
      throw new ForbiddenError('Perfil de funcionário não encontrado');
    }
    opcoes.funcionarioId = funcionario.id;
  }

  const rows = await listar(opcoes);
  return rows.map(toDTO);
}

async function verificarOwnership(
  usuarioId: string,
  role: Role,
  row: AgendamentoRow,
): Promise<void> {
  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente || cliente.id !== row.cliente_id) {
      throw new ForbiddenError('Acesso negado');
    }
  } else if (role === 'profissional') {
    const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
    if (!funcionario || funcionario.id !== row.funcionario_id) {
      throw new ForbiddenError('Acesso negado');
    }
  }
}

export async function obterAgendamento(
  usuarioId: string,
  role: string,
  id: string,
): Promise<AgendamentoDTO> {
  if (!isRole(role)) {
    throw new ForbiddenError('Acesso negado');
  }

  const row = await buscarPorId(id);
  if (!row) {
    throw new NotFoundError('Agendamento não encontrado');
  }

  await verificarOwnership(usuarioId, role, row);
  return toDTO(row);
}

export async function cancelarAgendamento(
  usuarioId: string,
  role: string,
  id: string,
): Promise<AgendamentoDTO> {
  if (!isRole(role)) {
    throw new ForbiddenError('Acesso negado');
  }

  const row = await buscarPorId(id);
  if (!row) {
    throw new NotFoundError('Agendamento não encontrado');
  }

  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente || cliente.id !== row.cliente_id) {
      throw new ForbiddenError('Acesso negado');
    }
  } else {
    await exigirPermissao({ id: usuarioId, role }, 'agendar_para_cliente');
    if (role === 'profissional') {
      const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
      if (!funcionario || funcionario.id !== row.funcionario_id) {
        throw new ForbiddenError('Acesso negado');
      }
    }
  }

  validarTransicao(row.status, 'cancelado');
  await atualizarStatus(id, 'cancelado');
  return toDTO({ ...row, status: 'cancelado' });
}

async function alterarStatusOperacional(
  usuarioId: string,
  role: string,
  id: string,
  destino: 'confirmado' | 'concluido',
): Promise<AgendamentoDTO> {
  if (!isRole(role)) {
    throw new ForbiddenError('Acesso negado');
  }

  const row = await buscarPorId(id);
  if (!row) {
    throw new NotFoundError('Agendamento não encontrado');
  }

  if (role === 'profissional') {
    const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
    if (!funcionario || funcionario.id !== row.funcionario_id) {
      throw new ForbiddenError('Acesso negado');
    }
  }

  validarTransicao(row.status, destino);
  await atualizarStatus(id, destino);
  return toDTO({ ...row, status: destino });
}

export async function confirmarAgendamento(
  usuarioId: string,
  role: string,
  id: string,
): Promise<AgendamentoDTO> {
  return alterarStatusOperacional(usuarioId, role, id, 'confirmado');
}

export async function concluirAgendamento(
  usuarioId: string,
  role: string,
  id: string,
): Promise<AgendamentoDTO> {
  return alterarStatusOperacional(usuarioId, role, id, 'concluido');
}

export async function reverterConclusaoAgendamento(
  usuarioId: string,
  role: string,
  id: string,
): Promise<AgendamentoDTO> {
  return alterarStatusOperacional(usuarioId, role, id, 'confirmado');
}

/**
 * Resumo de faturamento (agendamentos `concluido`) para o período informado.
 *
 * - Profissional: sempre calcula sobre a própria agenda.
 * - Admin: calcula sobre todos os barbeiros.
 * - Recepcionista/cliente: sem acesso (PRD mantém o financeiro restrito).
 * - Sem `inicio`/`fim`, assume o ano corrente (mesmo padrão das telas).
 */
export async function obterFaturamento(
  usuarioId: string,
  role: string,
  filtros: { inicio?: string; fim?: string },
): Promise<FaturamentoResumoDTO> {
  if (!isRole(role)) {
    throw new ForbiddenError('Acesso negado');
  }
  if (role === 'cliente' || role === 'recepcionista') {
    throw new ForbiddenError(
      role === 'recepcionista'
        ? 'Recepcionista não possui acesso ao faturamento'
        : 'Acesso negado',
    );
  }

  const anoAtual = new Date().getFullYear();
  const inicio = filtros.inicio ?? `${anoAtual}-01-01`;
  const fim = filtros.fim ?? `${anoAtual}-12-31`;
  validarIntervalo(inicio, fim);

  let funcionarioId: string | undefined;
  if (role === 'profissional') {
    const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
    if (!funcionario) {
      throw new ForbiddenError('Perfil de funcionário não encontrado');
    }
    funcionarioId = funcionario.id;
  }

  const resumo = await resumirFaturamento({ funcionarioId, inicio, fim });

  const valorTotal = Number(resumo.valorTotal).toFixed(2);
  const quantidade = resumo.quantidade;
  const ticketMedio = quantidade > 0 ? (Number(valorTotal) / quantidade).toFixed(2) : '0.00';
  const porServico = resumo.porServico.map((item) => ({
    servicoId: item.servicoId,
    servicoNome: item.servicoNome,
    quantidade: item.quantidade,
    valorTotal: Number(item.valorTotal).toFixed(2),
  }));

  return { inicio, fim, valorTotal, quantidade, ticketMedio, porServico };
}
