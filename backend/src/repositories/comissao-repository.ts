import type { Knex } from 'knex';
import db from '../database/connection';
import type { ComissaoServicoDTO } from '../dtos/comissao-dto';

// Repositório do domínio de Regras de Comissão (spec 3.4/3.5).
//
// DECISÃO DE ESCOPO (despesa automática): as funções de hook
// (`criarDespesaComissaoAutomatica` / `removerDespesaComissaoPorAgendamento`)
// vivem AQUI, não em despesa-repository, porque o gancho de comissão precisa
// escrever na tabela `despesa` DENTRO da MESMA transação da mudança de status
// do agendamento (atomicidade exigida pelo Passo 5). O CRUD manual de despesas
// (despesa-repository) permanece intocado — despesa de comissão nunca passa por
// ele (a service de despesa já bloqueia `tipo_despesa === 'comissao'`).
//
// As consultas de hook usam o parâmetro `trx` obrigatório: quem chama é o
// agendamento-service dentro de `db.transaction`, garantindo consistência
// (nunca agendamento concluído sem despesa, nem despesa para não concluído).

/** PK fixa da tabela singleton `configuracao_comissao` (ver migration). */
export const ID_CONFIGURACAO_GLOBAL = 'global';

interface ConfiguracaoRow {
  id: string;
  comissao_ativa: boolean;
}

interface ComissaoServicoRow {
  servico_id: string;
  servico_nome: string;
  percentual: string | number;
}

interface DadosComissaoAgendamentoRow {
  funcionario_id: string;
  funcionario_nome: string;
  servico_id: string;
  servico_preco: string | number;
  data: string;
}

/** Dados mínimos para gerar a despesa automática de comissão (Passo 5). */
export interface DadosComissaoAgendamento {
  funcionario_id: string;
  funcionario_nome: string;
  servico_id: string;
  servico_preco: string;
  data: string;
}

function toDTO(row: ComissaoServicoRow): ComissaoServicoDTO {
  return {
    servico_id: row.servico_id,
    servico_nome: row.servico_nome,
    percentual: String(row.percentual),
  };
}

/** Retorna a conexão da transação quando ativa; caso contrário o pool padrão. */
function conexao(trx?: Knex.Transaction): Knex | Knex.Transaction {
  return trx ?? db;
}

/**
 * Lê o interruptor global. Retorna `null` quando a linha singleton ainda não
 * existe (a service converte para `comissao_ativa: false` sem inventar linha).
 */
export async function buscarConfiguracaoComissao(trx?: Knex.Transaction): Promise<boolean | null> {
  const row = (await conexao(trx)('configuracao_comissao')
    .where('id', ID_CONFIGURACAO_GLOBAL)
    .first()) as ConfiguracaoRow | undefined;
  return row ? Boolean(row.comissao_ativa) : null;
}

/** Upsert do interruptor global na linha `id='global'` (spec 3.4). */
export async function upsertConfiguracaoComissao(
  comissaoAtiva: boolean,
  trx?: Knex.Transaction,
): Promise<void> {
  await conexao(trx)('configuracao_comissao')
    .insert({ id: ID_CONFIGURACAO_GLOBAL, comissao_ativa: comissaoAtiva })
    .onConflict('id')
    .merge({ comissao_ativa: comissaoAtiva, updated_at: conexao(trx).fn.now() });
}

/** Lista as comissões de um funcionário (com nome do serviço via JOIN). */
export async function listarComissoesDoFuncionario(
  funcionarioId: string,
  trx?: Knex.Transaction,
): Promise<ComissaoServicoDTO[]> {
  const rows = (await conexao(trx)('comissao_servico as cs')
    .join('servico as s', 's.id', 'cs.servico_id')
    .where('cs.funcionario_id', funcionarioId)
    .select('cs.servico_id', 's.nome as servico_nome', 'cs.percentual')
    .orderBy('s.nome', 'asc')) as ComissaoServicoRow[];
  return rows.map(toDTO);
}

/**
 * REPLACE (spec 3.5): apaga todas as linhas do funcionário e insere as novas,
 * devolvendo a lista salva (mesma transação). A service garante a atomicidade
 * com `db.transaction`; aqui `trx` é obrigatório por contrato.
 */
export async function substituirComissoesDoFuncionario(
  funcionarioId: string,
  itens: Array<{ servico_id: string; percentual: string }>,
  trx: Knex.Transaction,
): Promise<ComissaoServicoDTO[]> {
  await trx('comissao_servico').where('funcionario_id', funcionarioId).del();
  if (itens.length > 0) {
    await trx('comissao_servico').insert(
      itens.map((item) => ({
        funcionario_id: funcionarioId,
        servico_id: item.servico_id,
        percentual: item.percentual,
      })),
    );
  }
  return listarComissoesDoFuncionario(funcionarioId, trx);
}

/** Percentual configurado para (funcionário, serviço), ou `null` se ausente. */
export async function buscarPercentualComissao(
  funcionarioId: string,
  servicoId: string,
  trx: Knex.Transaction,
): Promise<string | null> {
  const row = (await trx('comissao_servico')
    .where({ funcionario_id: funcionarioId, servico_id: servicoId })
    .first()) as { percentual: string | number } | undefined;
  return row ? String(row.percentual) : null;
}

/**
 * Dados mínimos do agendamento para o cálculo da comissão (Passo 5):
 * funcionário (id/nome), serviço (id/preço) e data do agendamento.
 * Todo o JOIN roda dentro da transação para leitura consistente.
 */
export async function buscarDadosParaComissaoDeAgendamento(
  agendamentoId: string,
  trx: Knex.Transaction,
): Promise<DadosComissaoAgendamento | null> {
  const row = (await trx('agendamento as a')
    .join('funcionario as f', 'f.id', 'a.funcionario_id')
    .join('servico as s', 's.id', 'a.servico_id')
    .where('a.id', agendamentoId)
    .select(
      'a.funcionario_id',
      'f.nome as funcionario_nome',
      'a.servico_id',
      's.preco as servico_preco',
      'a.data',
    )
    .first()) as DadosComissaoAgendamentoRow | undefined;

  if (!row) {
    return null;
  }
  return {
    funcionario_id: row.funcionario_id,
    funcionario_nome: row.funcionario_nome,
    servico_id: row.servico_id,
    servico_preco: String(row.servico_preco),
    data: row.data,
  };
}

/**
 * Proteção contra duplicação: já existe despesa de comissão (tipo 'comissao')
 * vinculada a este agendamento? Se sim, o hook NÃO deve criar outra.
 */
export async function buscarDespesaComissaoPorAgendamento(
  agendamentoId: string,
  trx: Knex.Transaction,
): Promise<boolean> {
  const row = await trx('despesa')
    .where({ agendamento_id: agendamentoId, tipo_despesa: 'comissao' })
    .first();
  return row !== undefined;
}

/**
 * Cria a despesa AUTOMÁTICA de comissão. Marcadores da automaticidade:
 * `tipo_despesa = 'comissao'` + `agendamento_id` preenchido (ver
 * despesa-repository.toDTO: `automatica = agendamento_id !== null`).
 */
export async function criarDespesaComissaoAutomatica(
  input: {
    descricao: string;
    valor: string;
    data: string;
    funcionarioId: string;
    agendamentoId: string;
  },
  trx: Knex.Transaction,
): Promise<void> {
  await trx('despesa').insert({
    descricao: input.descricao,
    tipo_despesa: 'comissao',
    valor: input.valor,
    data: input.data,
    recorrente: false,
    funcionario_id: input.funcionarioId,
    agendamento_id: input.agendamentoId,
  });
}

/** Remove a despesa de comissão vinculada ao agendamento (reverter conclusão). */
export async function removerDespesaComissaoPorAgendamento(
  agendamentoId: string,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('despesa')
    .where({ agendamento_id: agendamentoId, tipo_despesa: 'comissao' })
    .del();
}

// ── Pendências de comissão (aviso de % ausente) ────────────────────────────
//
// Registro consultável criado pelo hook quando o agendamento é concluído com o
// interruptor de comissão ATIVO e o profissional NÃO tem percentual cadastrado
// para o serviço. O atendimento conclui normalmente (nunca trava); o aviso fica
// para o admin revisar depois (endpoint de leitura protegido por ver_financeiro).

interface ComissaoPendenciaRow {
  id: string;
  agendamento_id: string;
  funcionario_id: string;
  funcionario_nome: string;
  servico_id: string;
  servico_nome: string;
  data: string;
  resolvido: boolean;
}

/** Cria o aviso (pendência) dentro da MESMA transação da conclusão. */
export async function criarPendenciaComissao(
  input: {
    agendamentoId: string;
    funcionarioId: string;
    servicoId: string;
    data: string;
  },
  trx: Knex.Transaction,
): Promise<void> {
  await trx('comissao_pendencia').insert({
    agendamento_id: input.agendamentoId,
    funcionario_id: input.funcionarioId,
    servico_id: input.servicoId,
    data: input.data,
    resolvido: false,
  });
}

/**
 * Já existe pendência NÃO resolvida para este agendamento? Proteção da
 * aplicação contra duplicação (o índice único parcial é o backstop de banco).
 */
export async function buscarPendenciaComissaoPorAgendamento(
  agendamentoId: string,
  trx: Knex.Transaction,
): Promise<boolean> {
  const row = await trx('comissao_pendencia')
    .where({ agendamento_id: agendamentoId, resolvido: false })
    .first();
  return row !== undefined;
}

/** Remove pendências do agendamento (reverter conclusão / limpeza). */
export async function removerPendenciaComissaoPorAgendamento(
  agendamentoId: string,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('comissao_pendencia')
    .where({
      agendamento_id: agendamentoId,
      resolvido: false,
    })
    .del();
}

/**
 * Lista as pendências NÃO resolvidas (aviso de % ausente) com nomes via JOIN —
 * dados mínimos para o admin revisar (funcionario e serviço).
 */
export async function listarPendenciasComissao(): Promise<
  Array<{
    id: string;
    agendamento_id: string;
    funcionario_id: string;
    funcionario_nome: string;
    servico_id: string;
    servico_nome: string;
    data: string;
    resolvido: boolean;
  }>
> {
  const rows = (await db('comissao_pendencia as cp')
    .join('funcionario as f', 'f.id', 'cp.funcionario_id')
    .join('servico as s', 's.id', 'cp.servico_id')
    .where('cp.resolvido', false)
    .orderBy('cp.data', 'desc')
    .orderBy('cp.created_at', 'desc')
    .select(
      'cp.id',
      'cp.agendamento_id',
      'cp.funcionario_id',
      'f.nome as funcionario_nome',
      'cp.servico_id',
      's.nome as servico_nome',
      'cp.data',
      'cp.resolvido',
    )) as ComissaoPendenciaRow[];

  return rows.map((r) => ({
    id: r.id,
    agendamento_id: r.agendamento_id,
    funcionario_id: r.funcionario_id,
    funcionario_nome: r.funcionario_nome,
    servico_id: r.servico_id,
    servico_nome: r.servico_nome,
    data: r.data,
    resolvido: r.resolvido,
  }));
}