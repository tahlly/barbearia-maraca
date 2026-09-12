import type { Knex } from 'knex';
import db from '../database/connection';
import type {
  ComissaoServicoDTO,
  ConfiguracaoComissaoDTO,
  RequestAtualizarConfiguracaoComissao,
  RequestSalvarComissoesFuncionario,
} from '../dtos/comissao-dto';
import {
  buscarConfiguracaoComissao,
  upsertConfiguracaoComissao,
  listarComissoesDoFuncionario as listarComissoesDoFuncionarioRepo,
  substituirComissoesDoFuncionario,
  buscarPercentualComissao,
  buscarDadosParaComissaoDeAgendamento,
  buscarDespesaComissaoPorAgendamento,
  criarDespesaComissaoAutomatica,
  removerDespesaComissaoPorAgendamento,
} from '../repositories/comissao-repository';
import { buscarPorId as buscarFuncionarioPorId } from '../repositories/funcionario-repository';
import { buscarServicoPorId } from '../repositories/servico-repository';
import { exigirPermissao } from './permissao-service';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import { paraCentavos, deCentavos } from '../utils/dinheiro';

/**
 * Serviço do domínio Regras de Comissão (spec 3.4/3.5).
 *
 * ACESSO: todos os endpoints exigem a permissão EFETIVA `ver_financeiro`
 * (middleware `requerPermissao` na rota + `exigirPermissao` aqui — defesa em
 * profundidade, mesmo padrão do módulo financeiro). Os hooks automáticos de
 * conclusão NÃO pedem permissão: são disparados pelo sistema, não por usuário.
 *
 * DECISÃO DE DESCRIÇÃO (Passo 5): a despesa automática usa
 * `Comissão {nome do funcionário}` (ex.: "Comissão João Pedro") — mesma
 * convenção da spec (seção 3.2: "Comissão João Pedro") e da tela de Despesas.
 * Optou-se por NÃO incluir o serviço na descrição para manter a linha curta e
 * estável (a despesa já registra o vínculo via `agendamento_id`/funcionário).
 *
 * DECISÃO DE DESATIVAÇÃO: desligar o interruptor (`comissao_ativa: false`) NUNCA
 * apaga as linhas de `comissao_servico` — elas são mantidas e simplesmente
 * deixam de ser aplicadas (spec 3.4: o cálculo para de incluir a comissão).
 */

// ── Interruptor global (spec 3.4) ─────────────────────────────────────

/** Lê o interruptor global; linha inexistente ⇒ `comissao_ativa: false`. */
export async function obterConfiguracao(
  usuarioId: string,
  role: string,
): Promise<ConfiguracaoComissaoDTO> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  const ativa = await buscarConfiguracaoComissao();
  return { comissao_ativa: ativa ?? false };
}

/** Upsert do interruptor global (nunca toca em `comissao_servico`). */
export async function atualizarConfiguracao(
  usuarioId: string,
  role: string,
  input: RequestAtualizarConfiguracaoComissao,
): Promise<ConfiguracaoComissaoDTO> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  if (typeof input.comissao_ativa !== 'boolean') {
    throw new ValidationError('comissao_ativa deve ser um booleano');
  }

  await upsertConfiguracaoComissao(input.comissao_ativa);
  return { comissao_ativa: input.comissao_ativa };
}

// ── Comissões por funcionário + serviço (spec 3.5) ────────────────────

/** Lista as comissões configuradas de um funcionário (com nome do serviço). */
export async function listarComissoesDoFuncionario(
  usuarioId: string,
  role: string,
  funcionarioId: string,
): Promise<ComissaoServicoDTO[]> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');
  await validarFuncionarioExiste(funcionarioId);

  return listarComissoesDoFuncionarioRepo(funcionarioId);
}

/**
 * Salva as comissões de um funcionário em lote (REPLACE).
 *
 * - Valida o funcionário e cada serviço (existente e ativo);
 * - valida cada percentual (numérico, 0..100, máx. 2 casas);
 * - rejeita serviço duplicado na lista (evita depender do erro de UNIQUE);
 * - substitui as linhas do funcionário em UMA transação (atomicidade).
 */
export async function salvarComissoesDoFuncionario(
  usuarioId: string,
  role: string,
  funcionarioId: string,
  input: RequestSalvarComissoesFuncionario,
): Promise<ComissaoServicoDTO[]> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');
  await validarFuncionarioExiste(funcionarioId);

  const itens = await validarItensComissao(input.comissoes);

  return db.transaction(async (trx) =>
    substituirComissoesDoFuncionario(funcionarioId, itens, trx),
  );
}

// ── Hooks automáticos (Passo 5) ───────────────────────────────────────

/**
 * Formato aceito para `servico_preco` (vem do JOIN com `servico.preco`,
 * numeric(10,2): ex. "45.00"). O guard evita que um dado inesperado chegue ao
 * `paraCentavos` (que faria `BigInt` de string inválida); o hook então apenas
 * NÃO cria a despesa — mesmo comportamento silencioso do código anterior.
 */
const PRECO_VALIDO_RE = /^\d+(?:\.\d{0,2})?$/;

/**
 * Gancho chamado pelo `alterarStatusOperacional` (agendamento-service) QUANDO
 * um agendamento passa a `concluido`, dentro da MESMA transação da mudança de
 * status. Regras:
 * - comissão inativa → não faz nada (linhas de `comissao_servico` preservadas);
 * - sem percentual configurado ou percentual 0 → não cria despesa;
 * - já existe despesa de comissão para o agendamento → não duplica;
 * - senão, cria despesa automática:
 *   `descricao = "Comissão {nome do funcionário}"`,
 *   `tipo_despesa = 'comissao'`,
 *   `valor = preço_do_serviço × percentual / 100` (arredondado para o centavo
 *   mais próximo — aritmética EXATA de inteiros/BigInt, nunca ponto flutuante
 *   binário; ver util `dinheiro.ts`),
 *   `data = data do agendamento`, `recorrente = false`,
 *   `funcionario_id` e `agendamento_id` preenchidos.
 */
export async function aplicarComissaoNaConclusao(input: {
  agendamentoId: string;
  trx: Knex.Transaction;
}): Promise<void> {
  const { agendamentoId, trx } = input;

  const ativa = await buscarConfiguracaoComissao(trx);
  if (ativa !== true) {
    return;
  }

  // Proteção contra re-processamento: nunca criar uma 2ª despesa para a mesma
  // conclusão (idempotência).
  const jaExiste = await buscarDespesaComissaoPorAgendamento(agendamentoId, trx);
  if (jaExiste) {
    return;
  }

  const dados = await buscarDadosParaComissaoDeAgendamento(agendamentoId, trx);
  if (!dados) {
    return;
  }

  const percentual = await buscarPercentualComissao(
    dados.funcionario_id,
    dados.servico_id,
    trx,
  );
  if (percentual === null) {
    return;
  }
  const percentualBase = percentualParaBaseCentesimal(percentual);
  if (percentualBase === null || percentualBase <= 0n) {
    return;
  }

  if (!PRECO_VALIDO_RE.test(dados.servico_preco)) {
    return;
  }

  // CÁLCULO EXATO, sem ponto flutuante binário (achado QA MR-3.4/3.5 M-1):
  // 1) preço → centavos (BigInt): "1.25" → 125n;
  // 2) percentual → Base Centesimal (BigInt): "80.40" → 8040n;
  // 3) valor_centavos = (preco_centavos × base_centesimal + 5000n) / 10000n,
  //    arredondando para o centavo mais próximo (meio sobe).
  //    Ex.: R$ 1,25 × 80,40% = R$ 1,005 → R$ 1,01 (e não R$ 1,00, que é o
  //    resultado viciado de `(1.005).toFixed(2)` em binário).
  const valorCentavos =
    (paraCentavos(dados.servico_preco) * percentualBase + 5000n) / 10000n;
  const valor = deCentavos(valorCentavos);
  const descricao = `Comissão ${dados.funcionario_nome}`;

  await criarDespesaComissaoAutomatica(
    {
      descricao,
      valor,
      data: dados.data,
      funcionarioId: dados.funcionario_id,
      agendamentoId,
    },
    trx,
  );
}

/**
 * Gancho chamado na REVERSÃO da conclusão (`confirmado` vindo de `concluido`),
 * dentro da MESMA transação da mudança de status. Remove APENAS a despesa de
 * comissão vinculada ao agendamento (nunca despesas manuais deste cliente).
 */
export async function removerComissaoDaConclusao(input: {
  agendamentoId: string;
  trx: Knex.Transaction;
}): Promise<void> {
  await removerDespesaComissaoPorAgendamento(input.agendamentoId, input.trx);
}

// ── Validações ────────────────────────────────────────────────────────

async function validarFuncionarioExiste(funcionarioId: string): Promise<void> {
  const funcionario = await buscarFuncionarioPorId(funcionarioId);
  if (!funcionario) {
    throw new NotFoundError('Funcionário não encontrado');
  }
}

async function validarItensComissao(
  comissoes: Array<{ servico_id: string; percentual: number }> | undefined,
): Promise<Array<{ servico_id: string; percentual: string }>> {
  if (!Array.isArray(comissoes)) {
    throw new ValidationError('comissoes deve ser uma lista');
  }

  const servicosVistos = new Set<string>();
  const itens: Array<{ servico_id: string; percentual: string }> = [];

  for (const item of comissoes) {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError('Item de comissão inválido');
    }

    const servicoId = item.servico_id;
    if (typeof servicoId !== 'string' || servicoId.trim().length === 0) {
      throw new ValidationError('servico_id é obrigatório');
    }
    if (servicosVistos.has(servicoId)) {
      throw new ValidationError('Serviço duplicado na lista de comissões');
    }
    servicosVistos.add(servicoId);

    const servico = await buscarServicoPorId(servicoId);
    if (!servico || !servico.ativo) {
      throw new ValidationError('Serviço não encontrado ou inativo');
    }

    itens.push({ servico_id: servicoId, percentual: validarPercentual(item.percentual) });
  }

  return itens;
}

function validarPercentual(percentual: unknown): string {
  if (typeof percentual !== 'number' || !Number.isFinite(percentual)) {
    throw new ValidationError('Percentual deve ser um número');
  }
  if (percentual < 0 || percentual > 100) {
    throw new ValidationError('Percentual deve estar entre 0 e 100');
  }
  // Coluna decimal(5,2) — aceita no máximo 2 casas decimais (explícito, sem
  // arredondamento silencioso do banco).
  const arredondado = Math.round(percentual * 100) / 100;
  if (Math.abs(arredondado - percentual) > 1e-9) {
    throw new ValidationError('Percentual deve ter no máximo 2 casas decimais');
  }
  return arredondado.toFixed(2);
}

// ── Helpers para cálculo exato (BigInt) ────────────────────────────────

/**
 * Converte percentual string (ex.: "80.40") para Base Centesimal BigInt
 * (80,40% → 8040n), SEM passar por ponto flutuante binário (que distorce
 * percentuais como 80,40 em binário e resultaria em R$ 1,00 em vez de R$ 1,01
 * no cálculo de comissão).
 *
 * Parse direto dos dígitos da string: aceita 0..999,99 (cobre o range de
 * decimal(5,2) do banco); retorna `null` para formatos inválidos (o hook de
 * comissão então não cria a despesa, comportamento silencioso padrão).
 */
function percentualParaBaseCentesimal(percentual: string): bigint | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(percentual);
  if (!match) {
    return null;
  }
  const inteiro = BigInt(match[1]);
  // PadEnd(2) garante 2 dígitos no mínimo (ex.: "4" → "40", "" → "00").
  const decimais = (match[2] ?? '').padEnd(2, '0');
  return inteiro * 100n + BigInt(decimais);
}