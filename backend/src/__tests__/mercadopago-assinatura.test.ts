import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import type { Request } from 'express';
import { validarAssinaturaWebhook } from '../utils/mercadopago-assinatura';
import { UnauthorizedError } from '../errors/UnauthorizedError';

// O validador lê MERCADOPAGO_WEBHOOK_SECRET via config (fail-fast apenas no uso).
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo-teste-super-secreto';

const SECRET = 'segredo-teste-super-secreto';

function hmacHex(manifesto: string): string {
  return crypto.createHmac('sha256', SECRET).update(manifesto, 'utf8').digest('hex');
}

/** Assina conforme o manifesto canônico: id;request-id?;ts; — sempre terminando em ';'. */
function assinar(dataId: string, ts: string, xRequestId?: string): string {
  const pares: string[] = [`id:${dataId}`];
  if (xRequestId) {
    pares.push(`request-id:${xRequestId}`);
  }
  pares.push(`ts:${ts}`);
  return hmacHex(`${pares.join(';')};`);
}

function criarReq(
  opcoes: { dataId?: string; type?: string; xSignature?: string; xRequestId?: string | null } = {},
): Request {
  const query: Record<string, string> = {};
  if (opcoes.dataId !== undefined) query['data.id'] = opcoes.dataId;
  if (opcoes.type !== undefined) query.type = opcoes.type;
  const headers: Record<string, string | undefined> = {};
  if (opcoes.xSignature !== undefined) headers['x-signature'] = opcoes.xSignature;
  if (opcoes.xRequestId !== undefined) headers['x-request-id'] = opcoes.xRequestId ?? undefined;
  return { headers, query } as unknown as Request;
}

describe('validarAssinaturaWebhook (Mercado Pago / Orders API)', () => {
  it('aceita assinatura válida com x-request-id', () => {
    const ts = '1700000000';
    const dataId = 'ORD-123';
    const requestId = 'REQ-456';
    const v1 = assinar(dataId, ts, requestId);
    const req = criarReq({ dataId, type: 'order', xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId });

    const resultado = validarAssinaturaWebhook(req);
    expect(resultado.ts).toBe(ts);
    expect(resultado.v1).toBe(v1);
    expect(resultado.requestId).toBe(requestId);
    expect(resultado.dataId).toBe(dataId);
  });

  it('aceita assinatura válida sem x-request-id (par ausente omitido)', () => {
    const ts = '1700000000';
    const dataId = 'ORD-123';
    const v1 = assinar(dataId, ts);
    const req = criarReq({ dataId, type: 'order', xSignature: `ts=${ts},v1=${v1}` });

    const resultado = validarAssinaturaWebhook(req);
    expect(resultado.requestId).toBeNull();
    expect(resultado.dataId).toBe(dataId);
  });

  it('preserva data.id RAW (sem lowercase nem re-encode)', () => {
    const ts = '1700000000';
    const dataId = 'ORD-ABC-123';
    const v1 = assinar(dataId, ts);
    const req = criarReq({ dataId, type: 'order', xSignature: `ts=${ts},v1=${v1}` });

    const resultado = validarAssinaturaWebhook(req);
    expect(resultado.dataId).toBe('ORD-ABC-123');
  });

  it('aceita pares fora de ordem no header (ts e v1 em qualquer posição)', () => {
    const ts = '1700000000';
    const dataId = 'ORD-123';
    const v1 = assinar(dataId, ts);
    const req = criarReq({ dataId, type: 'order', xSignature: `v1=${v1},ts=${ts}` });

    expect(() => validarAssinaturaWebhook(req)).not.toThrow();
  });

  it('rejeita header x-signature ausente (nega por padrão)', () => {
    const req = criarReq({ dataId: 'ORD-123', type: 'order' });
    expect(() => validarAssinaturaWebhook(req)).toThrow(UnauthorizedError);
  });

  it('rejeita header sem ts ou v1 (formato inválido)', () => {
    const req = criarReq({ dataId: 'ORD-123', type: 'order', xSignature: 'foo=bar' });
    expect(() => validarAssinaturaWebhook(req)).toThrow(UnauthorizedError);
  });

  it('rejeita v1 com hex de tamanho diferente (não vira TypeError)', () => {
    const ts = '1700000000';
    const req = criarReq({ dataId: 'ORD-123', type: 'order', xSignature: `ts=${ts},v1=abc123` });
    expect(() => validarAssinaturaWebhook(req)).toThrow(UnauthorizedError);
  });

  it('rejeita v1 incorreto (mesmo tamanho, hash trocado)', () => {
    const ts = '1700000000';
    const dataId = 'ORD-123';
    const v1 = assinar(dataId, ts);
    const v1Trocado = crypto
      .createHmac('sha256', 'outro-segredo')
      .update(`id:${dataId};ts:${ts};`)
      .digest('hex');
    expect(v1Trocado.length).toBe(v1.length);
    const req = criarReq({ dataId, type: 'order', xSignature: `ts=${ts},v1=${v1Trocado}` });
    expect(() => validarAssinaturaWebhook(req)).toThrow(UnauthorizedError);
  });

  it('rejeita quando o data.id assinado difere do da query (replay/adulteração)', () => {
    const ts = '1700000000';
    const v1 = assinar('ORD-SIGNED', ts);
    const req = criarReq({ dataId: 'ORD-OUTRO', type: 'order', xSignature: `ts=${ts},v1=${v1}` });
    expect(() => validarAssinaturaWebhook(req)).toThrow(UnauthorizedError);
  });

  it('rejeita quando data.id está ausente na query', () => {
    const ts = '1700000000';
    const v1 = assinar('ORD-1', ts);
    const req = criarReq({ type: 'order', xSignature: `ts=${ts},v1=${v1}` });
    expect(() => validarAssinaturaWebhook(req)).toThrow(UnauthorizedError);
  });
});