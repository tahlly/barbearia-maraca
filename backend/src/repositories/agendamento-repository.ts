import db from '../database/connection';
import type { AgendamentoStatus } from '../dtos/agendamento-dto';

export interface AgendamentoRow {
  id: string;
  cliente_id: string;
  cliente_nome: string | null;
  funcionario_id: string;
  funcionario_nome: string | null;
  servico_id: string;
  servico_nome: string | null;
  data: string;
  hora: string;
  status: AgendamentoStatus;
  observacao: string | null;
  created_at: string | null;
}

interface ClienteRow {
  id: string;
  usuario_id: string;
}

interface FuncionarioRow {
  id: string;
  usuario_id: string;
  ativo: boolean;
}

const SELECT_COLUNAS = [
  'a.id',
  'a.cliente_id',
  'a.funcionario_id',
  'a.servico_id',
  'a.data',
  'a.hora',
  'a.status',
  'a.observacao',
  'a.created_at',
  'cliente.nome as cliente_nome',
  'funcionario.nome as funcionario_nome',
  'servico.nome as servico_nome',
];

function baseQuery() {
  return db<AgendamentoRow>('agendamento as a')
    .join('cliente', 'cliente.id', 'a.cliente_id')
    .join('funcionario', 'funcionario.id', 'a.funcionario_id')
    .join('servico', 'servico.id', 'a.servico_id')
    .select(SELECT_COLUNAS);
}

export async function buscarClientePorUsuarioId(usuarioId: string): Promise<ClienteRow | null> {
  const row = await db<ClienteRow>('cliente').where('usuario_id', usuarioId).first();
  return row ?? null;
}

export async function buscarFuncionarioPorUsuarioId(usuarioId: string): Promise<FuncionarioRow | null> {
  const row = await db<FuncionarioRow>('funcionario').where('usuario_id', usuarioId).first();
  return row ?? null;
}

export async function funcionarioExisteAtivo(funcionarioId: string): Promise<boolean> {
  const row = await db<FuncionarioRow>('funcionario')
    .where({ id: funcionarioId, ativo: true })
    .first();
  return row !== undefined;
}

export async function servicoExisteAtivo(servicoId: string): Promise<boolean> {
  const row = await db('servico').where({ id: servicoId, ativo: true }).first();
  return row !== undefined;
}

interface AgendamentoInsertRow {
  id: string;
  cliente_id: string;
  funcionario_id: string;
  servico_id: string;
  data: string;
  hora: string;
  status: AgendamentoStatus;
  observacao: string | null;
}

export async function criar(dados: {
  clienteId: string;
  funcionarioId: string;
  servicoId: string;
  data: string;
  hora: string;
  observacao: string | null;
}): Promise<AgendamentoRow> {
  const inseridos = await db<AgendamentoInsertRow>('agendamento')
    .insert({
      cliente_id: dados.clienteId,
      funcionario_id: dados.funcionarioId,
      servico_id: dados.servicoId,
      data: dados.data,
      hora: dados.hora,
      status: 'pendente',
      observacao: dados.observacao,
    })
    .returning('id');

  const id = inseridos[0]?.id;
  if (!id) {
    throw new Error('Falha ao recuperar agendamento criado');
  }

  const row = await buscarPorId(id);
  if (!row) {
    throw new Error('Falha ao recuperar agendamento criado');
  }
  return row;
}

export async function buscarPorId(id: string): Promise<AgendamentoRow | null> {
  const rows = await baseQuery().where('a.id', id);
  const row = rows[0];
  return row ?? null;
}

export async function listar(opcoes: {
  clienteId?: string;
  funcionarioId?: string;
  data?: string;
  status?: AgendamentoStatus;
}): Promise<AgendamentoRow[]> {
  const query = baseQuery().orderBy('a.data', 'asc').orderBy('a.hora', 'asc');

  if (opcoes.clienteId) {
    query.where('a.cliente_id', opcoes.clienteId);
  }
  if (opcoes.funcionarioId) {
    query.where('a.funcionario_id', opcoes.funcionarioId);
  }
  if (opcoes.data) {
    query.where('a.data', opcoes.data);
  }
  if (opcoes.status) {
    query.where('a.status', opcoes.status);
  }

  return query;
}

export async function atualizarStatus(id: string, status: AgendamentoStatus): Promise<void> {
  await db('agendamento').where('id', id).update({ status });
}

/**
 * Retorna as horas ocupadas (coluna `hora`) de um funcionário em uma data
 * específica, excluindo agendamentos cancelados. Usado pelo endpoint de
 * disponibilidade para remover slots já reservados.
 */
export async function buscarHorariosOcupados(
  funcionarioId: string,
  data: string,
): Promise<string[]> {
  const rows = await db('agendamento')
    .select('hora')
    .where({
      funcionario_id: funcionarioId,
      data,
    })
    .whereNot('status', 'cancelado');

  return rows.map((r: { hora: string }) => r.hora);
}
