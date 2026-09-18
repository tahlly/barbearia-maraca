import crypto from 'crypto';
import type { Request } from 'express';
import { exigirWebhookSecret } from '../config/mercadopago';
import { UnauthorizedError } from '../errors/UnauthorizedError';

/**
 * Validação da assinatura HMAC-SHA256 do webhook do Mercado Pago (Orders API).
 *
 * Regras FECHADAS (confirmadas no comportamento real da plataforma): o
 * sdk-nodejs oficial REMOVEU o lowercase do `data.id` no PR #439 porque o MP
 * assina o manifesto com o casing ORIGINAL do id; a nota de lowercase presente
 * na doc oficial está desatualizada. O `ts` do header é apenas ecoado no
 * manifesto (sem janela de tolerância), então a ambiguidade sec/milissegundo
 * da doc não afeta esta validação.
 *
 * - Header `x-signature`: `ts=<millis>,v1=<hex64>` (pares separados por vírgula;
 *   cada par é `chave=valor`, sempre dividido no PRIMEIRO `=`).
 * - Header `x-request-id`: id da requisição do webhook (presente nas entregas
 *   reais; se ausente, o par correspondente é omitido do manifesto).
 * - `data.id` é lido da QUERY STRING (`?data.id=...&type=order`), com o valor
 *   RAW, sem lowercase e sem re-encode.
 * - Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *   (apenas os pares presentes, nessa ordem, sempre terminando em `;`).
 * - HMAC-SHA256(MERCADOPAGO_WEBHOOK_SECRET, manifesto) em hex, comparado com
 *   timing-safe contra `v1`.
 *
 * Nega por padrão: header/marca ausente, formato inválido, ts fora do padrão ou
 * hash divergente → UnauthorizedError (401). Fórmula de assinatura difere do
 * formato antigo de webhooks de payment (que usava uma única string), por isso
 * o algoritmo fica explícito aqui.
 */
export interface AssinaturaWebhookValidada {
  ts: string;
  v1: string;
  requestId: string | null;
  dataId: string;
}

function parsearXSignature(valor: string): { ts: string; v1: string } | null {
  const partes = valor.split(',').map((parte) => parte.trim()).filter((parte) => parte.length > 0);
  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of partes) {
    const indiceIgual = parte.indexOf('=');
    if (indiceIgual < 0) {
      continue;
    }
    const chave = parte.slice(0, indiceIgual);
    const valorParte = parte.slice(indiceIgual + 1);
    if (chave === 'ts') {
      ts = valorParte;
    } else if (chave === 'v1') {
      v1 = valorParte;
    }
  }
  if (!ts || !v1) {
    return null;
  }
  return { ts, v1 };
}

function validarFormatoHex(v1: string): void {
  // HMAC-SHA256 em hex tem exatamente 64 caracteres; tamanhos diferentes não
  // podem ser comparados com timingSafeEqual.
  if (!/^[0-9a-f]{64}$/i.test(v1)) {
    throw new UnauthorizedError('Assinatura do webhook inválida');
  }
}

export function validarAssinaturaWebhook(req: Request): AssinaturaWebhookValidada {
  const headerAssinaturaRaw = req.headers['x-signature'];
  const headerRequestIdRaw = req.headers['x-request-id'];

  if (typeof headerAssinaturaRaw !== 'string' || headerAssinaturaRaw.trim() === '') {
    throw new UnauthorizedError('Assinatura do webhook ausente');
  }

  const headerRequestId = typeof headerRequestIdRaw === 'string' ? headerRequestIdRaw : null;

  const dataIdRaw = req.query['data.id'];
  if (typeof dataIdRaw !== 'string' || dataIdRaw.trim() === '') {
    throw new UnauthorizedError('Dados do webhook inválidos');
  }
  const dataId = dataIdRaw; // RAW, sem lowercase nem re-encode

  const assinatura = parsearXSignature(headerAssinaturaRaw);
  if (!assinatura) {
    throw new UnauthorizedError('Assinatura do webhook inválida');
  }

  validarFormatoHex(assinatura.v1);

  // Manifesto canônico: somente pares presentes, sempre terminando em `;`.
  const pares: string[] = [`id:${dataId}`];
  if (headerRequestId) {
    pares.push(`request-id:${headerRequestId}`);
  }
  pares.push(`ts:${assinatura.ts}`);
  const manifesto = `${pares.join(';')};`;

  const hmac = crypto.createHmac('sha256', exigirWebhookSecret()).update(manifesto, 'utf8').digest();
  // v1 vem em hex (64 caracteres → 32 bytes), garantido pelo validarFormatoHex.
  const v1Recebido = Buffer.from(assinatura.v1, 'hex');
  if (hmac.length !== v1Recebido.length) {
    throw new UnauthorizedError('Assinatura do webhook inválida');
  }
  if (!crypto.timingSafeEqual(hmac, v1Recebido)) {
    throw new UnauthorizedError('Assinatura do webhook inválida');
  }

  return { ts: assinatura.ts, v1: assinatura.v1, requestId: headerRequestId, dataId };
}