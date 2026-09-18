import { deCentavos } from '../utils/dinheiro';
import { exigirAccessToken } from '../config/mercadopago';

/**
 * Client HTTP do Mercado Pago (Checkout Pro — Preferences API e Checkout
 * Bricks — Payments API) usando apenas o `fetch` global do Node — sem axios
 * nem SDK (stack aprovada no repositório).
 *
 * Contrato FECHADO pela doc oficial:
 * - POST /checkout/preferences (sem prefixo /v1): `items` [{ title, unit_price, quantity }],
 *   `external_reference`, `back_urls` (success/failure/pending), `auto_return`
 *   e `notification_url`. Resposta com `id` e `init_point` (checkout);
 *   fallback defensivo `sandbox_init_point`.
 * - POST /v1/payments (Checkout Bricks): `transaction_amount`, `token`,
 *   `description`, `installments`, `payment_method_id`, `payer`,
 *   `external_reference` e `notification_url`. Resposta com `id`, `status`,
 *   `status_detail` e `external_reference`.
 * - GET /v1/payments/{id}: `status`, `status_detail`, `external_reference` —
 *   usado pelo webhook `type=payment` (não confiamos no corpo do webhook).
 * - GET /v1/payments/search?external_reference=...: fallback do retorno do
 *   Checkout Pro quando a URL não traz `payment_id`; `results` ordenado por
 *   `date_created` desc.
 */
const API_BASE = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15_000;

export interface BackUrlsCheckout {
  success: string;
  failure: string;
  pending: string;
}

export interface CriarPreferenciaParams {
  /** Chave de idempotência (X-Idempotency-Key): usamos o id do pagamento. */
  idempotencyKey: string;
  /** Referência externa (external_reference): usamos o id do pagamento. */
  externalReference: string;
  titulo: string;
  valorCentavos: number;
  backUrls: BackUrlsCheckout;
}

export interface PagamentoMercadoPago {
  id: string | null;
  status: string | null;
  statusDetail: string | null;
  externalReference: string | null;
}

/**
 * Dados do comprador para criar pagamento com cartão (Checkout Bricks). O
 * Card Payment Brick coleta esses campos no navegador e envia ao backend; o
 * backend NÃO confia em valor/parcelas vindos do cliente — apenas repassa o
 * token e os dados do pagador, e grava o valor a partir do banco.
 */
export interface PayerCartaoMercadoPago {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  identification?: { type: string; number: string } | null;
}

export interface CriarPagamentoCartaoParams {
  /** Chave de idempotência (X-Idempotency-Key): usamos o id do pagamento. */
  idempotencyKey: string;
  /** Referência externa (external_reference): usamos o id do pagamento. */
  externalReference: string;
  titulo: string;
  valorCentavos: number;
  /** Token de cartão gerado pelo Brick no frontend (nunca armazenado). */
  tokenCartao: string;
  paymentMethodId: string;
  installments: number;
  payer: PayerCartaoMercadoPago;
}

async function lerJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const corpo: unknown = await res.json();
    if (typeof corpo === 'object' && corpo !== null) {
      return corpo as Record<string, unknown>;
    }
  } catch {
    // corpo não-JSON — resposta vazia
  }
  return {};
}

/**
 * Erro de API do Mercado Pago com o status HTTP da resposta. Permite que o
 * chamador distinga casos específicos (ex.: 404 de pagamento inexistente) sem
 * depender de parsing de mensagem. NÃO é um AppError: o errorHandler continua
 * mapeando para 500 sempre que o erro não for tratado pelo serviço.
 */
export class ErroApiMercadoPago extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ErroApiMercadoPago';
    this.status = status;
  }
}

async function lancarErroApi(res: Response, contexto: string): Promise<never> {
  const corpo = await lerJson(res);
  const detalhe = Object.keys(corpo).length > 0 ? ` — ${JSON.stringify(corpo)}` : '';
  throw new ErroApiMercadoPago(
    `${contexto}: Mercado Pago retornou HTTP ${res.status}${detalhe}`,
    res.status,
  );
}

export async function criarPreferencia(
  params: CriarPreferenciaParams,
): Promise<{ id: string; checkoutUrl: string | null }> {
  const accessToken = exigirAccessToken();
  // unit_price exige JSON number (doc oficial). deCentavos devolve string com
  // 2 casas ("45.00"); Number() garante que JSON.stringify emita número (45).
  const valorDecimal = Number(deCentavos(BigInt(params.valorCentavos)));

  const body: Record<string, unknown> = {
    items: [{ title: params.titulo, unit_price: valorDecimal, quantity: 1 }],
    external_reference: params.externalReference,
    notification_url: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/webhooks/mercadopago`,
    back_urls: {
      success: params.backUrls.success,
      failure: params.backUrls.failure,
      pending: params.backUrls.pending,
    },
    auto_return: 'approved',
  };

  const res = await fetch(`${API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    await lancarErroApi(res, 'Falha ao criar preferência de pagamento');
  }

  const dados = await lerJson(res);
  const id =
    typeof dados.id === 'string' && dados.id.trim() !== '' ? dados.id : null;
  if (!id) {
    throw new Error(
      `Falha ao criar preferência de pagamento: resposta sem campo id (chaves: ${Object.keys(dados).join(', ') || 'vazia'})`,
    );
  }

  // Campo oficial da URL de checkout na resposta do POST /checkout/preferences:
  // `init_point` (sandbox quando credencial TEST-). Leitura defensiva com
  // fallback `sandbox_init_point`; se ausente, registra pendência e retorna
  // null — o frontend trata null como "pague no painel MP / aguarde".
  let checkoutUrl: string | null =
    typeof dados.init_point === 'string' && dados.init_point.trim() !== ''
      ? dados.init_point
      : null;
  if (!checkoutUrl) {
    checkoutUrl =
      typeof dados.sandbox_init_point === 'string' && dados.sandbox_init_point.trim() !== ''
        ? dados.sandbox_init_point
        : null;
  }
  if (!checkoutUrl) {
    console.warn(
      `[mercadopago-client] preferência sem init_point (preferenceId=${id}; chaves: ${Object.keys(dados).join(', ') || 'vazia'})`,
    );
  }

  return { id, checkoutUrl };
}

export async function criarPagamentoCartao(
  params: CriarPagamentoCartaoParams,
): Promise<PagamentoMercadoPago> {
  const accessToken = exigirAccessToken();
  // transaction_amount exige JSON number (doc oficial). deCentavos devolve
  // string com 2 casas ("45.00"); Number() garante número no JSON.
  const valorDecimal = Number(deCentavos(BigInt(params.valorCentavos)));

  const payer: Record<string, unknown> = { email: params.payer.email };
  if (params.payer.firstName) payer.first_name = params.payer.firstName;
  if (params.payer.lastName) payer.last_name = params.payer.lastName;
  if (params.payer.identification) {
    payer.identification = {
      type: params.payer.identification.type,
      number: params.payer.identification.number,
    };
  }

  const body: Record<string, unknown> = {
    transaction_amount: valorDecimal,
    token: params.tokenCartao,
    description: params.titulo,
    installments: params.installments,
    payment_method_id: params.paymentMethodId,
    payer,
    external_reference: params.externalReference,
    notification_url: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/webhooks/mercadopago`,
  };

  const res = await fetch(`${API_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    await lancarErroApi(res, 'Falha ao criar pagamento com cartão');
  }

  const dados = await lerJson(res);
  return {
    id: typeof dados.id === 'string' ? dados.id : null,
    status: typeof dados.status === 'string' ? dados.status : null,
    statusDetail: typeof dados.status_detail === 'string' ? dados.status_detail : null,
    externalReference: typeof dados.external_reference === 'string' ? dados.external_reference : null,
  };
}

function mapearPagamentoMp(dados: Record<string, unknown>): PagamentoMercadoPago {
  return {
    // O MP devolve `id` como número em /v1/payments; normalizamos para string
    // (contrato do `PagamentoMercadoPago`).
    id:
      typeof dados.id === 'string'
        ? dados.id
        : typeof dados.id === 'number'
          ? String(dados.id)
          : null,
    status: typeof dados.status === 'string' ? dados.status : null,
    statusDetail: typeof dados.status_detail === 'string' ? dados.status_detail : null,
    externalReference: typeof dados.external_reference === 'string' ? dados.external_reference : null,
  };
}

export async function obterPayment(paymentId: string): Promise<PagamentoMercadoPago> {
  const accessToken = exigirAccessToken();
  const res = await fetch(`${API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    await lancarErroApi(res, `Falha ao consultar pagamento ${paymentId}`);
  }

  return mapearPagamentoMp(await lerJson(res));
}

/**
 * Busca pagamentos do MP pela `external_reference` (usamos o id do nosso
 * pagamento). Usado como fallback no retorno do Checkout Pro quando a URL de
 * retorno NÃO trouxe `payment_id` (o MP não garante o parâmetro em todos os
 * fluxos) — a fonte da verdade continua sendo a API do MP.
 *
 * `GET /v1/payments/search?external_reference=...&sort=date_created&criteria=desc`
 * devolve `{ results: [...] }` ordenado do mais recente para o mais antigo.
 */
export async function buscarPagamentosPorReferenciaExterna(
  externalReference: string,
): Promise<PagamentoMercadoPago[]> {
  const accessToken = exigirAccessToken();
  const params = new URLSearchParams({
    external_reference: externalReference,
    sort: 'date_created',
    criteria: 'desc',
  });
  const res = await fetch(`${API_BASE}/v1/payments/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    await lancarErroApi(res, 'Falha ao buscar pagamentos por referência externa');
  }

  const dados = await lerJson(res);
  const resultados = Array.isArray(dados.results) ? dados.results : [];
  return resultados
    .filter(
      (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
    )
    .map((item) => mapearPagamentoMp(item));
}