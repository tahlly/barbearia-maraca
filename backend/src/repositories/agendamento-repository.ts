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
export interface FaturamentoResumoRow {
  quantidade: number;
  valorTotal: string;
  porServico: Array<{
    servicoId: string;
    servicoNome: string;
    quantidade: number;
    valorTotal: string;
  }>;
}

interface FaturamentoTotalRow {
  quantidade: string | number;
}

interface FaturamentoSomaRow {
  valorTotal: string | number | null;
}

interface FaturamentoPorServicoRow {
  servicoId: string;
  servicoNome: string;
  quantidade: string | number;
  valorTotal: string | number | null;
}

/**
 * Resume o faturamento de agendamentos `concluido` em um período,
 * somando o preço do serviço do agendamento. Se `funcionarioId` for
 * informado, restringe ao barbeiro (usca do dashboard do profissional).
 */
export async function resumirFaturamento(opcoes: {
  funcionarioId?: string;
  inicio: string;
  fim: string;
}): Promise<FaturamentoResumoRow> {
  const query = db('agendamento as a')
    .join('servico as s', 's.id', 'a.servico_id')
    .where('a.status', 'concluido')
    .whereBetween('a.data', [opcoes.inicio, opcoes.fim]);

  if (opcoes.funcionarioId) {
    query.where('a.funcionario_id', opcoes.funcionarioId);
  }

  const totalRow = await query.clone().count({ quantidade: '*' }).first<FaturamentoTotalRow>();
  const somaRow = await query.clone().sum({ valorTotal: 's.preco' }).first<FaturamentoSomaRow>();

  const porServicoRows = await query
    .clone()
    .select('a.servico_id as servicoId', 's.nome as servicoNome')
    .count({ quantidade: '*' })
    .sum({ valorTotal: 's.preco' })
    .groupBy('a.servico_id', 's.nome')
    .orderBy('valorTotal', 'desc') as unknown as FaturamentoPorServicoRow[];

  return {
    quantidade: Number(totalRow?.quantidade ?? 0),
    valorTotal: String(somaRow?.valorTotal ?? 0),
    porServico: porServicoRows.map((r) => ({
      servicoId: r.servicoId,
      servicoNome: r.servicoNome,
      quantidade: Number(r.quantidade),
      valorTotal: String(r.valorTotal ?? 0),
    })),
  };
}

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

// ── Agregações financeiras do Resumo (seção 3.3) ─────────────────────

interface ReceitaPorPeriodoRow {
  periodo: string;
  valorTotal: string | number | null;
}

/**
 * Soma o preço dos serviços de agendamentos com os `status` informados,
 * agrupado por semana de calendário (segunda-feira, via `date_trunc('week')`).
 *
 * Usado pelo bloco "Receita realizada vs. prevista" do Resumo:
 * - realizada = `['concluido']` (mesma base do `resumirFaturamento`);
 * - prevista = `['pendente', 'confirmado']` (agendados, ainda não concluídos).
 * A service completa as semanas sem dados com zero — aqui retorna apenas as
 * semanas com pelo menos um agendamento.
 */
export async function somarReceitaPorSemana(opcoes: {
  status: AgendamentoStatus[];
  inicio: string;
  fim: string;
}): Promise<ReceitaPorPeriodoRow[]> {
  const exprSemana = db.raw("to_char(date_trunc('week', a.data), 'YYYY-MM-DD') as periodo");
  const rows = await db('agendamento as a')
    .join('servico as s', 's.id', 'a.servico_id')
    .select(exprSemana)
    .sum({ valorTotal: 's.preco' })
    .whereIn('a.status', opcoes.status)
    .whereBetween('a.data', [opcoes.inicio, opcoes.fim])
    .groupBy(db.raw("date_trunc('week', a.data)"))
    .orderBy(db.raw("date_trunc('week', a.data)"), 'asc');

  return rows as unknown as ReceitaPorPeriodoRow[];
}

/**
 * Soma o preço dos serviços de agendamentos com os `status` informados,
 * agrupado por mês (YYYY-MM). Base do gráfico de evolução mensal do Resumo
 * (Receita × Despesa × Lucro) — chamado com `['concluido']` para a receita.
 */
export async function somarReceitaPorMes(opcoes: {
  status: AgendamentoStatus[];
  inicio: string;
  fim: string;
}): Promise<ReceitaPorPeriodoRow[]> {
  const exprMes = db.raw("to_char(a.data, 'YYYY-MM') as periodo");
  const rows = await db('agendamento as a')
    .join('servico as s', 's.id', 'a.servico_id')
    .select(exprMes)
    .sum({ valorTotal: 's.preco' })
    .whereIn('a.status', opcoes.status)
    .whereBetween('a.data', [opcoes.inicio, opcoes.fim])
    .groupBy(db.raw("to_char(a.data, 'YYYY-MM')"))
    .orderBy(db.raw("to_char(a.data, 'YYYY-MM')"), 'asc');

  return rows as unknown as ReceitaPorPeriodoRow[];
}
