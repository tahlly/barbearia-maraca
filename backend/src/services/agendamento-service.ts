import {
  criar,
  buscarPorId,
  listar,
  atualizarStatus,
  buscarClientePorUsuarioId,
  buscarFuncionarioPorUsuarioId,
  funcionarioExisteAtivo,
  servicoExisteAtivo,
  type AgendamentoRow,
} from '../repositories/agendamento-repository';
import type { AgendamentoDTO, AgendamentoStatus, CreateAgendamentoRequest } from '../dtos/agendamento-dto';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import { formatarData, formatarHora } from '../utils/formatadores';

type Role = 'admin' | 'recepcionista' | 'profissional' | 'cliente';

const TRANSICOES: Record<AgendamentoStatus, AgendamentoStatus[]> = {
  pendente: ['confirmado', 'cancelado'],
  confirmado: ['concluido', 'cancelado'],
  cancelado: [],
  concluido: [],
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

function validarDataHora(data: string, hora: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new ValidationError('Data inválida');
  }
  if (!/^\d{2}:\d{2}$/.test(hora)) {
    throw new ValidationError('Hora inválida');
  }
  const date = new Date(`${data}T${hora}:00`);
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
  if (!isRole(role) || role !== 'cliente') {
    throw new ForbiddenError('Somente clientes podem criar agendamentos');
  }

  const cliente = await buscarClientePorUsuarioId(usuarioId);
  if (!cliente) {
    throw new ForbiddenError('Perfil de cliente não encontrado');
  }

  if (!(await funcionarioExisteAtivo(dados.funcionario_id))) {
    throw new NotFoundError('Funcionário não encontrado ou inativo');
  }

  if (!(await servicoExisteAtivo(dados.servico_id))) {
    throw new NotFoundError('Serviço não encontrado ou inativo');
  }

  validarDataHora(dados.data, dados.hora);

  try {
    const row = await criar({
      clienteId: cliente.id,
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
  } else if (role === 'profissional') {
    throw new ForbiddenError('Barbeiro não pode cancelar agendamento');
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
