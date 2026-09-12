import type {
  CreateDespesaInput,
  DespesaDTO,
  DespesaResumoDTO,
  ListarDespesasFiltros,
  TipoDespesa,
  TipoDespesaManual,
  UpdateDespesaInput,
} from '../dtos/despesa-dto';
import {
  somarDespesasPeriodo,
  listarDespesas,
  buscarDespesaPorId,
  criarDespesa,
  atualizarDespesa,
  excluirDespesa,
} from '../repositories/despesa-repository';
import { buscarPorId as buscarFuncionarioPorId } from '../repositories/funcionario-repository';
import { exigirPermissao } from './permissao-service';
import { validarIntervaloData, validarDataISO } from '../utils/validadores';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';

/**
 * Regra de proteção do módulo (obrigatória — ver especificação 3.2/3.4):
 *
 * Despesas com `tipo_despesa === 'comissao'` NÃO podem ser criadas, editadas
 * ou excluídas manualmente. Elas são geradas EXCLUSIVAMENTE pelo hook
 * automático de comissão (Passo 5, Regras de Comissão), que preenche
 * `agendamento_id` e marca a despesa como `automatica`. Tentativas manuais
 * geram `ValidationError` (400) com mensagem explicando o motivo.
 */
const MSG_BLOQUEIO_COMISSAO =
  'Despesas de comissão são geradas automaticamente pelo sistema (Regras de Comissão) e não podem ser criadas, editadas ou excluídas manualmente';

/**
 * Resumo de despesas de um período (soma necessária ao Dashboard / Financeiro).
 *
 * - Acesso restrito à permissão efetiva `ver_financeiro` (admin por padrão;
 *   overrides no banco contam). Negação por padrão: sem a permissão → 403.
 * - Valida formato das datas (`YYYY-MM-DD`) e `inicio <= fim` → 400.
 * - Sem `inicio`/`fim`, assume o ano corrente (mesma regra de `obterFaturamento`).
 * - Só soma: CRUD de despesas é feito em `listarDespesasDoProjeto` e demais.
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

/**
 * Lista despesas (tabela da tela Financeiro › Despesas).
 *
 * Filtros opcionais: `inicio`/`fim` devem vir JUNTOS (intervalo) e
 * `tipoDespesa` é um valor do enum `tipo_despesa`. Sem filtros, lista
 * todas as despesas (mais recentes primeiro).
 */
export async function listarDespesasDoProjeto(
  usuarioId: string,
  role: string,
  filtros: ListarDespesasFiltros,
): Promise<DespesaDTO[]> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  if (filtros.inicio !== undefined && filtros.fim !== undefined) {
    validarIntervaloData(filtros.inicio, filtros.fim);
  } else if (filtros.inicio !== undefined || filtros.fim !== undefined) {
    throw new ValidationError('Informe inicio e fim juntos para filtrar por período');
  }

  return listarDespesas(filtros);
}

/** Busca uma despesa por id (para edição/exclusão); lança 404 se ausente. */
export async function obterDespesaPorId(id: string): Promise<DespesaDTO> {
  const despesa = await buscarDespesaPorId(id);
  if (!despesa) {
    throw new NotFoundError('Despesa não encontrada');
  }
  return despesa;
}

/** Valida um `funcionario_id` opcional informado pelo cliente. */
async function validarFuncionarioId(funcionarioId: string | null | undefined): Promise<void> {
  if (funcionarioId === undefined || funcionarioId === null) {
    return;
  }
  const funcionario = await buscarFuncionarioPorId(funcionarioId);
  if (!funcionario) {
    throw new ValidationError('Funcionário não encontrado');
  }
}

function validarValor(valor: string): void {
  const numeric = Number(valor);
  if (Number.isNaN(numeric)) {
    throw new ValidationError('Valor deve ser um número válido');
  }
  if (numeric < 0) {
    throw new ValidationError('Valor não pode ser negativo');
  }
}

function validarDescricao(descricao: string): void {
  if (!descricao || descricao.trim().length === 0) {
    throw new ValidationError('Descrição é obrigatória');
  }
}

/**
 * Cria uma despesa MANUAL com validação de negócio.
 *
 * - `tipo_despesa` NUNCA pode ser `comissao` (ver regra de proteção acima);
 * - `valor` é string decimal não negativa;
 * - `data` é uma data de calendário real (YYYY-MM-DD);
 * - `funcionario_id` opcional deve existir.
 */
export async function criarDespesaManual(
  usuarioId: string,
  role: string,
  input: CreateDespesaInput,
): Promise<DespesaDTO> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  validarTipoManual(input.tipo_despesa);
  validarDescricao(input.descricao);
  validarValor(input.valor);
  validarDataLancamento(input.data);
  await validarFuncionarioId(input.funcionarioId);

  return criarDespesa(input);
}

/**
 * Edita uma despesa MANUAL existente (campos parciais).
 *
 * Bloqueia:
 * - editar uma despesa já marcada como `comissao` (automática);
 * - tentar mudar o tipo de uma despesa para `comissao`.
 * Demais campos seguem as mesmas validações do POST.
 */
export async function editarDespesaManual(
  usuarioId: string,
  role: string,
  id: string,
  input: UpdateDespesaInput,
): Promise<DespesaDTO> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  const existente = await obterDespesaPorId(id);
  if (existente.tipo_despesa === 'comissao') {
    throw new ValidationError(MSG_BLOQUEIO_COMISSAO);
  }

  if (input.tipo_despesa !== undefined) {
    validarTipoManual(input.tipo_despesa);
  }
  if (input.descricao !== undefined) {
    validarDescricao(input.descricao);
  }
  if (input.valor !== undefined) {
    validarValor(input.valor);
  }
  if (input.data !== undefined) {
    validarDataLancamento(input.data);
  }
  await validarFuncionarioId(input.funcionarioId);

  const atualizado = await atualizarDespesa(id, input);
  if (!atualizado) {
    throw new NotFoundError('Despesa não encontrada');
  }
  return atualizado;
}

/**
 * Exclui uma despesa.
 *
 * Bloqueia excluir despesa de comissão (automática) — essas só podem ser
 * removidas pelo fluxo que as gerou (Regras de Comissão, Passo 5).
 */
export async function excluirDespesaManual(
  usuarioId: string,
  role: string,
  id: string,
): Promise<void> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  const existente = await obterDespesaPorId(id);
  if (existente.tipo_despesa === 'comissao') {
    throw new ValidationError(MSG_BLOQUEIO_COMISSAO);
  }

  const removida = await excluirDespesa(id);
  if (!removida) {
    throw new NotFoundError('Despesa não encontrada');
  }
}

function validarTipoManual(tipo: TipoDespesa): void {
  // O tipo de entrada já exclui 'comissao' em tempo de compilação; a checagem
  // abaixo é defesa de runtime contra chamadas diretas malformadas.
  if (tipo === 'comissao') {
    throw new ValidationError(MSG_BLOQUEIO_COMISSAO);
  }
}

function validarDataLancamento(data: string): void {
  if (!validarDataISO(data)) {
    throw new ValidationError('Data do lançamento inválida');
  }
}
