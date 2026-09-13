import db from '../database/connection';
import type {
  CreateDespesaInput,
  DespesaDTO,
  ListarDespesasFiltros,
  TipoDespesa,
  UpdateDespesaInput,
} from '../dtos/despesa-dto';
import type { TipoDespesa as TipoDespesaEnum } from '../dtos/despesa-dto';

// Repositório do domínio de Despesas (módulo financeiro).

interface DespesaSomaRow {
  total: string | number | null;
}

interface DespesaRow {
  id: string;
  descricao: string;
  tipo_despesa: TipoDespesa;
  valor: string;
  data: Date | string;
  recorrente: boolean;
  funcionario_id: string | null;
  agendamento_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function toDTO(row: DespesaRow): DespesaDTO {
  return {
    id: row.id,
    descricao: row.descricao,
    tipo_despesa: row.tipo_despesa,
    valor: String(row.valor),
    data: row.data instanceof Date ? row.data.toISOString().slice(0, 10) : String(row.data).slice(0, 10),
    recorrente: Boolean(row.recorrente),
    funcionario_id: row.funcionario_id,
    // ID do agendamento que gerou a despesa (só comissão automática tem).
    // O Frontend usa para montar o link "Ver atendimento".
    agendamento_id: row.agendamento_id,
    // Despesa automática = gerada pelo hook de comissão (agendamento_id
    // preenchido). Despesas manuais SEMPRE têm agendamento_id NULL.
    automatica: row.agendamento_id !== null,
  };
}

const TIPOS_DESPESA: TipoDespesa[] = ['fixa', 'variavel', 'comissao', 'outro'];

/** Valida se `tipo` é um valor do enum `tipo_despesa` do banco. */
export function tipoDespesaValido(tipo: string): tipo is TipoDespesa {
  return TIPOS_DESPESA.includes(tipo as TipoDespesa);
}

/**
 * Soma `valor` das despesas com `data` no intervalo `[inicio, fim]`
 * (usa o índice `idx_despesa_data` via `BETWEEN`).
 *
 * Retorna o total como string crua do driver (numeric do PG já vem como
 * string, ex.: "57.50"); quando não há despesas no período retorna "0".
 * A normalização para 2 casas decimais acontece na camada de service,
 * mesmo padrão do `resumirFaturamento`.
 */
export async function somarDespesasPeriodo(opcoes: {
  inicio: string;
  fim: string;
}): Promise<string> {
  const row = await db('despesa')
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .sum({ total: 'valor' })
    .first<DespesaSomaRow>();

  const total = row?.total;
  return total !== null && total !== undefined ? String(total) : '0';
}

/**
 * Lista despesas ordenadas por data (mais recentes primeiro), dentro de uma
 * página (`limit`/`offset`).
 *
 * Filtros:
 * - `inicio`/`fim`: apenas despesas com `data` no intervalo;
 * - `tipoDespesa`: apenas despesas do tipo informado (opcional).
 *
 * O retorno carrega apenas os itens da página atual + o total de itens que
 * obedecem aos filtros (para o cálculo de `totalPages` na service). O limite
 * máximo (100) e a página mínima (1) são decisões de aplicação na service.
 */
export async function listarDespesas(
  opcoes: ListarDespesasFiltros & { page: number; limit: number },
): Promise<{ items: DespesaDTO[]; total: number }> {
  const query = db<DespesaRow>('despesa');

  if (opcoes.inicio !== undefined && opcoes.fim !== undefined) {
    query.whereBetween('data', [opcoes.inicio, opcoes.fim]);
  }
  if (opcoes.tipoDespesa !== undefined) {
    query.where('tipo_despesa', opcoes.tipoDespesa);
  }

  const totalRow = await query
    .clone()
    .count<{ total: string | number }>({ total: '*' })
    .first();

  const rows = await query
    .select(
      'id',
      'descricao',
      'tipo_despesa',
      'valor',
      'data',
      'recorrente',
      'funcionario_id',
      'agendamento_id',
      'created_at',
      'updated_at',
    )
    .orderBy('data', 'desc')
    .orderBy('created_at', 'desc')
    .limit(opcoes.limit)
    .offset((opcoes.page - 1) * opcoes.limit);

  return {
    items: rows.map(toDTO),
    total: Number(totalRow?.total ?? 0),
  };
}

/** Busca uma despesa por id (para edição/exclusão). */
export async function buscarDespesaPorId(id: string): Promise<DespesaDTO | null> {
  const row = await db<DespesaRow>('despesa')
    .where('id', id)
    .first();
  if (!row) {
    return null;
  }
  return toDTO(row);
}

/**
 * Cria uma despesa MANUAL.
 *
 * IMPORTANTE (regra de proteção): nunca preenche `agendamento_id` — esse
 * campo é reservado ao hook automático de comissão (Passo 5). A service
 * garante que `tipo_despesa !== 'comissao'` antes de chamar esta função.
 */
export async function criarDespesa(input: CreateDespesaInput): Promise<DespesaDTO> {
  const [row] = await db<DespesaRow>('despesa')
    .insert({
      descricao: input.descricao,
      tipo_despesa: input.tipo_despesa as TipoDespesaEnum,
      valor: input.valor,
      data: input.data,
      recorrente: input.recorrente,
      funcionario_id: input.funcionarioId ?? null,
      // agendamento_id fica NULL de propósito: é o marcador de despesa
      // automática (comissão). Manuais nunca são automáticas.
    })
    .returning('*');

  return toDTO(row);
}

/** Atualiza uma despesa MANUAL existente (campos parciais). */
export async function atualizarDespesa(
  id: string,
  input: UpdateDespesaInput,
): Promise<DespesaDTO | null> {
  const patch: Record<string, unknown> = {};

  if (input.descricao !== undefined) {
    patch.descricao = input.descricao;
  }
  if (input.tipo_despesa !== undefined) {
    patch.tipo_despesa = input.tipo_despesa as TipoDespesaEnum;
  }
  if (input.valor !== undefined) {
    patch.valor = input.valor;
  }
  if (input.data !== undefined) {
    patch.data = input.data;
  }
  if (input.recorrente !== undefined) {
    patch.recorrente = input.recorrente;
  }
  if (input.funcionarioId !== undefined) {
    patch.funcionario_id = input.funcionarioId;
  }
  patch.updated_at = new Date();

  const [row] = await db<DespesaRow>('despesa')
    .where('id', id)
    .update(patch)
    .returning('*');

  if (!row) {
    return null;
  }
  return toDTO(row);
}

/** Exclui uma despesa. Retorna `true` se algum registro foi removido. */
export async function excluirDespesa(id: string): Promise<boolean> {
  const removidos = await db('despesa').where('id', id).del();
  return removidos > 0;
}

// ── Agregações do Resumo (seção 3.3) ──────────────────────────────────

interface DespesaPorCategoriaRow {
  tipo_despesa: TipoDespesa;
  total: string | number | null;
}

interface DespesaPorMesRow {
  mes: string;
  total: string | number | null;
}

/**
 * Soma `valor` das despesas por `tipo_despesa` no período.
 * Usado pelo gráfico "Despesas por categoria" do Resumo. A service completa
 * as 4 categorias do enum com zero — aqui retorna apenas as que têm despesa.
 */
export async function somarDespesasPorCategoria(opcoes: {
  inicio: string;
  fim: string;
}): Promise<DespesaPorCategoriaRow[]> {
  const rows = await db('despesa')
    .select('tipo_despesa')
    .sum({ total: 'valor' })
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .groupBy('tipo_despesa')
    .orderBy('tipo_despesa', 'asc');

  return rows as unknown as DespesaPorCategoriaRow[];
}

/**
 * Soma `valor` das despesas agrupado por mês (YYYY-MM).
 * Base do gráfico de evolução mensal do Resumo (Receita × Despesa × Lucro).
 */
export async function somarDespesasPorMes(opcoes: {
  inicio: string;
  fim: string;
}): Promise<DespesaPorMesRow[]> {
  const exprMes = db.raw("to_char(data, 'YYYY-MM') as mes");
  const rows = await db('despesa')
    .select(exprMes)
    .sum({ total: 'valor' })
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .groupBy(db.raw("to_char(data, 'YYYY-MM')"))
    .orderBy(db.raw("to_char(data, 'YYYY-MM')"), 'asc');

  return rows as unknown as DespesaPorMesRow[];
}

// ── Agregado do Painel do Profissional ───────────────────────────────

interface SomaComissaoRow {
  total: string | number | null;
}

/**
 * Soma as comissões (despesas `tipo_despesa='comissao'`, geradas pelo hook
 * automático ao concluir atendimento) de UM funcionário em um período.
 *
 * Decisão de semântica: a comissão do profissional é materializada como
 * despesa automática (`agendamento_id` preenchido) na MESMA data do
 * atendimento (`despesa.data` = `agendamento.data`). Portanto o filtro de
 * período é sobre `despesa.data`, e `funcionario_id` é OBRIGATÓRIO — nunca
 * soma comissão de outros profissionais (nem a receita da barbearia).
 */
export async function somarComissaoFuncionarioPeriodo(opcoes: {
  funcionarioId: string;
  inicio: string;
  fim: string;
}): Promise<string> {
  const row = (await db('despesa')
    .where('funcionario_id', opcoes.funcionarioId)
    .where('tipo_despesa', 'comissao')
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .sum({ total: 'valor' })
    .first()) as SomaComissaoRow | undefined;

  return String(row?.total ?? 0);
}
