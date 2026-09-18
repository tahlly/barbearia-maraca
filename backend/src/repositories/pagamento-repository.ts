import type { Knex } from 'knex';
import db from '../database/connection';
import type { PagamentoStatus } from '../dtos/pagamento-dto';

/**
 * Erro de domínio lançado quando a inserção de um pagamento pendente viola o
 * índice único parcial `uq_pagamento_agendamento_pendente` (23505): já existe
 * um pagamento pendente para o mesmo agendamento — corrida de checkout duplo.
 * O service captura e reutiliza o pendente existente; não é erro de usuário.
 */
export class ConflitoPagamentoPendente extends Error {
  constructor() {
    super('Já existe pagamento pendente para este agendamento');
    this.name = 'ConflitoPagamentoPendente';
  }
}

export interface PagamentoRow {
  id: string;
  agendamento_id: string;
  mercadopago_order_id: string;
  mercadopago_payment_id: string | null;
  valor_centavos: number;
  status: PagamentoStatus;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  /**
   * URL de checkout do Mercado Pago persistida em `pagamento.checkout_url`
   * (migration aditiva 20260913000002). `null` quando a criação da ordem não
   * devolveu URL ou antes da primeira ordem ser criada.
   */
  checkoutUrl: string | null;
}

/**
 * Forma bruta retornada pelo Postgres: a coluna é `checkout_url` (snake_case),
 * enquanto o `PagamentoRow` público expõe `checkoutUrl` (camelCase) — ver
 * `mapearRow`.
 */
interface PagamentoDbRow extends Omit<PagamentoRow, 'checkoutUrl'> {
  checkout_url: string | null;
}

function mapearRow(raw: PagamentoDbRow): PagamentoRow {
  const { checkout_url, ...resto } = raw;
  return { ...resto, checkoutUrl: checkout_url ?? null };
}

interface InsertPagamentoRow {
  agendamento_id: string;
  mercadopago_order_id: string;
  valor_centavos: number;
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

/**
 * Cria um pagamento pendente com id temporário (`tmp-<uuid>`, 40 chars <
 * 64). O id real da preferência do MP só existe depois da chamada à API;
 * a coluna `mercadopago_order_id` é NOT NULL e o UUID evita colisão com o
 * índice único. O service atualiza para o id da preferência real logo depois
 * (ou cancela em erro).
 */
export async function criar(dados: {
  agendamentoId: string;
  valorCentavos: number;
}): Promise<PagamentoRow> {
  const idTemporario = `tmp-${cryptoRandomUUID()}`;
  const inseridos = await db<InsertPagamentoRow & { id: string }>('pagamento')
    .insert({
      agendamento_id: dados.agendamentoId,
      mercadopago_order_id: idTemporario,
      valor_centavos: dados.valorCentavos,
    })
    .returning('id')
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        // Violou uq_pagamento_agendamento_pendente (ou outro unique): sinaliza
        // conflito de pendente para o service reutilizar a linha existente.
        throw new ConflitoPagamentoPendente();
      }
      throw error;
    });

  const id = inseridos[0]?.id;
  if (!id) {
    throw new Error('Falha ao recuperar pagamento criado');
  }

  const row = await buscarPorId(id);
  if (!row) {
    throw new Error('Falha ao recuperar pagamento criado');
  }
  return row;
}

function cryptoRandomUUID(): string {
  // Node disponível no runtime do backend (crypto global); evita dependência
  // extra apenas para gerar um id de 36 chars.
  return globalThis.crypto.randomUUID();
}

export async function buscarPorId(id: string): Promise<PagamentoRow | null> {
  const rows = await db<PagamentoDbRow>('pagamento').where('id', id);
  const row = rows[0];
  return row ? mapearRow(row) : null;
}

export async function buscarPorAgendamentoMaisRecente(agendamentoId: string): Promise<PagamentoRow | null> {
  const row = await db<PagamentoDbRow>('pagamento')
    .where('agendamento_id', agendamentoId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .first();
  return row ? mapearRow(row) : null;
}

/** Retorna o pendente ativo do agendamento (índice único parcial garante 0 ou 1). */
export async function buscarPendentePorAgendamento(agendamentoId: string): Promise<PagamentoRow | null> {
  const row = await db<PagamentoDbRow>('pagamento')
    .where({ agendamento_id: agendamentoId, status: 'pendente' })
    .first();
  return row ? mapearRow(row) : null;
}

export async function buscarPorOrderId(orderId: string): Promise<PagamentoRow | null> {
  const row = await db<PagamentoDbRow>('pagamento').where('mercadopago_order_id', orderId).first();
  return row ? mapearRow(row) : null;
}

export async function atualizarStatus(
  id: string,
  status: PagamentoStatus,
  opcoes: { mercadopagoPaymentId?: string | null; trx?: Knex.Transaction } = {},
): Promise<void> {
  const base = opcoes.trx ?? db;
  const payload: Record<string, unknown> = { status };
  if (opcoes.mercadopagoPaymentId !== undefined) {
    payload.mercadopago_payment_id = opcoes.mercadopagoPaymentId;
  }
  await base('pagamento').where('id', id).update(payload);
}

export async function atualizarDadosOrdem(
  pagamentoId: string,
  dados: { orderId: string; checkoutUrl: string | null },
): Promise<void> {
  await db('pagamento').where('id', pagamentoId).update({
    mercadopago_order_id: dados.orderId,
    checkout_url: dados.checkoutUrl,
  });
}

/**
 * Status do pagamento mais recente de cada agendamento, em lote (evita N+1 no
 * listar/obter de agendamentos). Usa `distinctOn` para pegar a linha mais nova
 * por agendamento. Assume `criadoEm` como string ISO quando vem do pg.
 */
export async function buscarStatusPagamentoPorAgendamentos(
  agendamentoIds: string[],
): Promise<Map<string, PagamentoStatus>> {
  const mapa = new Map<string, PagamentoStatus>();
  if (agendamentoIds.length === 0) {
    return mapa;
  }
  const rows = await db<{ agendamento_id: string; status: PagamentoStatus }>('pagamento')
    .distinctOn('agendamento_id')
    .select('agendamento_id', 'status')
    .whereIn('agendamento_id', agendamentoIds)
    .orderBy('agendamento_id', 'asc')
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');
  for (const row of rows) {
    mapa.set(row.agendamento_id, row.status);
  }
  return mapa;
}