import type { Knex } from 'knex';
import db from '../database/connection';
import type { AgendamentoStatus } from '../dtos/agendamento-dto';
import { deCentavos, paraCentavos } from '../utils/dinheiro';

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

/**
 * Dados mínimos do serviço vinculado a um agendamento (para criar o pagamento
 * sem confiar no cliente, com o preço vindo do banco).
 *
 * `trx` é usado pelo fluxo de conclusão com pagamento presencial: o snapshot do
 * preço precisa participar da MESMA transação do registro do pagamento.
 */
export interface DadosServicoDoAgendamento {
  nome: string;
  preco: string;
}

export async function buscarDadosServicoDoAgendamento(
  agendamentoId: string,
  trx?: Knex.Transaction,
): Promise<DadosServicoDoAgendamento | null> {
  const base = trx ?? db;
  const row = await base('servico as s')
    .join('agendamento as a', 'a.servico_id', 's.id')
    .select('s.nome', 's.preco')
    .where('a.id', agendamentoId)
    .first<unknown>();
  return row as DadosServicoDoAgendamento | null;
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

/**
 * Atualiza o status de um agendamento.
 *
 * `trx` é opcional e usado pelo fluxo de conclusão/reversão: a mudança de
 * status e o gancho de comissão rodam na MESMA transação (atomicidade — ver
 * agendamento-service.alterarStatusOperacional). Os demais fluxos
 * (cancelar/confirmar simples) continuam usando o pool padrão.
 */
export async function atualizarStatus(
  id: string,
  status: AgendamentoStatus,
  trx?: Knex.Transaction,
): Promise<void> {
  const base = trx ?? db;
  await base('agendamento').where('id', id).update({ status });
}

/**
 * Reagendamento: altera SOMENTE `data` e `hora` da MESMA linha de
 * `agendamento`. Nada mais é tocado — nem status, nem pagamento, nem serviço,
 * nem funcionário, nem observação, nem created_at. A violação do índice único
 * parcial `uq_agendamento_funcionario_data_hora` (23505) é tratada na service.
 */
export async function atualizarDataHora(id: string, data: string, hora: string): Promise<void> {
  await db('agendamento').where('id', id).update({ data, hora });
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

/** Acumulador em JS para mesclar as duas bases do faturamento por serviço. */
interface AgrupadoPorServico {
  servicoId: string;
  servicoNome: string;
  quantidade: number;
  valorCentavos: bigint;
}

/**
 * Agrupa a base recebida por serviço, devolvendo linhas
 * `FaturamentoPorServicoRow`. `soma` é a expressão de valor da base:
 * `s.preco` para concluídos e `p.valor_centavos / 100.0` para cancelados
 * com pagamento aprovado (valor realmente pago).
 */
async function agruparPorServico(
  query: Knex.QueryBuilder,
  soma: string | Knex.Raw,
): Promise<FaturamentoPorServicoRow[]> {
  const rows = await query
    .clone()
    .select('a.servico_id as servicoId', 's.nome as servicoNome')
    .count({ quantidade: '*' })
    .sum({ valorTotal: soma })
    .groupBy('a.servico_id', 's.nome') as unknown as FaturamentoPorServicoRow[];
  return rows;
}

/**
 * Resume o faturamento em um período: agendamentos `concluido` (somados pelo
 * preço do serviço, `s.preco`) + agendamentos `cancelado` com pagamento
 * `aprovado` e NÃO estornado (somados pelo valor realmente pago,
 * `p.valor_centavos / 100.0`, nunca `s.preco`). Pagamento feito e não
 * estornado é receita da barbearia, independente de o agendamento ter sido
 * concluído ou cancelado.
 *
 * O índice único parcial `uq_pagamento_agendamento_aprovado` garante UM
 * pagamento aprovado por agendamento — o join de cancelados pagos não
 * duplica linhas. Se `funcionarioId` for informado, restringe ao barbeiro
 * (dashboard do profissional).
 */
export async function resumirFaturamento(opcoes: {
  funcionarioId?: string;
  inicio: string;
  fim: string;
}): Promise<FaturamentoResumoRow> {
  // Base 1: concluídos — mesmo comportamento de sempre (soma `s.preco`).
  const queryConcluidos = db('agendamento as a')
    .join('servico as s', 's.id', 'a.servico_id')
    .where('a.status', 'concluido')
    .whereBetween('a.data', [opcoes.inicio, opcoes.fim]);

  // Base 2: cancelados com pagamento aprovado (não estornado = receita).
  const queryCanceladosPagos = db('agendamento as a')
    .join('servico as s', 's.id', 'a.servico_id')
    .join('pagamento as p', 'p.agendamento_id', 'a.id')
    .where('a.status', 'cancelado')
    .where('p.status', 'aprovado')
    .whereBetween('a.data', [opcoes.inicio, opcoes.fim]);

  if (opcoes.funcionarioId) {
    queryConcluidos.where('a.funcionario_id', opcoes.funcionarioId);
    queryCanceladosPagos.where('a.funcionario_id', opcoes.funcionarioId);
  }

  const [
    totalConcluidos,
    somaConcluidos,
    totalCanceladosPagos,
    somaCanceladosPagos,
    porServicoConcluidos,
    porServicoCanceladosPagos,
  ] = await Promise.all([
    queryConcluidos.clone().count({ quantidade: '*' }).first<FaturamentoTotalRow>(),
    queryConcluidos.clone().sum({ valorTotal: 's.preco' }).first<FaturamentoSomaRow>(),
    queryCanceladosPagos.clone().count({ quantidade: '*' }).first<FaturamentoTotalRow>(),
    queryCanceladosPagos
      .clone()
      .sum({ valorTotal: db.raw('p.valor_centavos / 100.0') })
      .first<FaturamentoSomaRow>(),
    agruparPorServico(queryConcluidos, 's.preco'),
    agruparPorServico(queryCanceladosPagos, db.raw('p.valor_centavos / 100.0')),
  ]);

  const quantidade =
    Number(totalConcluidos?.quantidade ?? 0) + Number(totalCanceladosPagos?.quantidade ?? 0);
  // Soma em centavos (BigInt) para não acumular imprecisão de ponto flutuante.
  const valorTotal = deCentavos(
    paraCentavos(String(somaConcluidos?.valorTotal ?? 0)) +
      paraCentavos(String(somaCanceladosPagos?.valorTotal ?? 0)),
  );

  // Mescla as duas bases por serviço (mesma chave `servicoId`), somando
  // quantidade e valorTotal. A ordenação continua por valorTotal desc,
  // mesmo padrão da consulta única anterior.
  const porServicoMap = new Map<string, AgrupadoPorServico>();
  for (const r of [...porServicoConcluidos, ...porServicoCanceladosPagos]) {
    const existente = porServicoMap.get(r.servicoId);
    if (existente) {
      existente.quantidade += Number(r.quantidade);
      existente.valorCentavos += paraCentavos(String(r.valorTotal ?? '0'));
    } else {
      porServicoMap.set(r.servicoId, {
        servicoId: r.servicoId,
        servicoNome: r.servicoNome,
        quantidade: Number(r.quantidade),
        valorCentavos: paraCentavos(String(r.valorTotal ?? '0')),
      });
    }
  }

  const porServico = [...porServicoMap.values()]
    .sort((a, b) =>
      a.valorCentavos < b.valorCentavos ? 1 : a.valorCentavos > b.valorCentavos ? -1 : 0,
    )
    .map((r) => ({
      servicoId: r.servicoId,
      servicoNome: r.servicoNome,
      quantidade: r.quantidade,
      valorTotal: deCentavos(r.valorCentavos),
    }));

  return { quantidade, valorTotal, porServico };
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
 * - realizada = `['concluido']` (base PRÓPRIA do Resumo — NÃO inclui
 *   cancelados com pagamento aprovado, ao contrário de `resumirFaturamento`);
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
