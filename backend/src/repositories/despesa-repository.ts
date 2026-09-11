import db from '../database/connection';

// Repositório do domínio de Despesas (módulo financeiro).
// CRUD completo é rodada futura; aqui só a agregação necessária ao Dashboard.

interface DespesaSomaRow {
  total: string | number | null;
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