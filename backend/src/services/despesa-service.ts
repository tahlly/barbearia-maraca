import type { DespesaResumoDTO } from '../dtos/despesa-dto';
import { somarDespesasPeriodo } from '../repositories/despesa-repository';
import { exigirPermissao } from './permissao-service';
import { validarIntervaloData } from '../utils/validadores';

/**
 * Resumo de despesas de um período (soma necessária ao Dashboard / Financeiro).
 *
 * - Acesso restrito à permissão efetiva `ver_financeiro` (admin por padrão;
 *   overrides no banco contam). Negação por padrão: sem a permissão → 403.
 * - Valida formato das datas (`YYYY-MM-DD`) e `inicio <= fim` → 400.
 * - Sem `inicio`/`fim`, assume o ano corrente (mesma regra de `obterFaturamento`).
 * - Só soma: CRUD de despesas é rodada futura.
 */
export async function obterResumoDespesas(
  usuarioId: string,
  role: string,
  filtros: { inicio?: string; fim?: string },
): Promise<DespesaResumoDTO> {
  // Defesa em profundidade: mesmo com o middleware `requerPermissao` na rota,
  // a service revalida a permissão efetiva antes de tocar os dados.
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  const anoAtual = new Date().getFullYear();
  const inicio = filtros.inicio ?? `${anoAtual}-01-01`;
  const fim = filtros.fim ?? `${anoAtual}-12-31`;
  validarIntervaloData(inicio, fim);

  const total = await somarDespesasPeriodo({ inicio, fim });
  const despesaTotal = Number(total).toFixed(2);

  return { inicio, fim, despesaTotal };
}