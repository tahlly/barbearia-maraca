import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { ValidationError } from '../errors/ValidationError';
import {
  cancelarPagamentoPendente,
  confirmarRetorno,
  criarPagamento,
  criarPagamentoComCartao,
  obterPagamento,
  processarWebhookMercadoPago,
} from '../services/pagamento-service';
import { ErroApiMercadoPago } from '../services/mercadopago-client';
import { listarAgendamentos, obterAgendamento } from '../services/agendamento-service';
import { ConflitoPagamentoPendente } from '../repositories/pagamento-repository';
import type { AgendamentoRow } from '../repositories/agendamento-repository';
import type { PagamentoRow } from '../repositories/pagamento-repository';

// ── Mocks ────────────────────────────────────────────────────────────────

// agendamento-service importa permissao-service → permissao-repository + auth-service.
const listarCatalogoPermissoesMock = vi.fn();
const listarPermissoesPorUsuariosMock = vi.fn();
const aplicarAlteracaoPermissaoMock = vi.fn();
const listarUsuariosInternosMock = vi.fn();
const listarIdsAdminsMock = vi.fn();
const listarIdsComPermissaoEfetivaMock = vi.fn();
const buscarFuncionarioPorUsuarioIdPermissaoMock = vi.fn();

const mapearTipoParaRoleMock = vi.fn((tipo: string, cargo?: string | null): string => {
  if (tipo === 'cliente') return 'cliente';
  if (cargo === 'administrador') return 'admin';
  if (cargo === 'recepcionista') return 'recepcionista';
  return 'profissional';
});

vi.mock('../repositories/permissao-repository', () => ({
  listarCatalogoPermissoes: (...args: unknown[]) => listarCatalogoPermissoesMock(...args),
  listarPermissoesPorUsuarios: (...args: unknown[]) => listarPermissoesPorUsuariosMock(...args),
  aplicarAlteracaoPermissao: (...args: unknown[]) => aplicarAlteracaoPermissaoMock(...args),
  listarUsuariosInternos: (...args: unknown[]) => listarUsuariosInternosMock(...args),
  listarIdsAdmins: (...args: unknown[]) => listarIdsAdminsMock(...args),
  listarIdsComPermissaoEfetiva: (...args: unknown[]) => listarIdsComPermissaoEfetivaMock(...args),
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) =>
    buscarFuncionarioPorUsuarioIdPermissaoMock(...args),
}));

vi.mock('../services/auth-service', () => ({
  mapearTipoParaRole: (...args: unknown[]) => mapearTipoParaRoleMock(...args),
}));

// agendamento-service importa comissao-service (apenas 2 funções no fluxo); mockamos
// o módulo inteiro para ESPIONAR que o webhook NÃO dispara comissão.
const aplicarComissaoNaConclusaoMock = vi.fn();
const removerComissaoDaConclusaoMock = vi.fn();

vi.mock('../services/comissao-service', () => ({
  aplicarComissaoNaConclusao: (...args: unknown[]) => aplicarComissaoNaConclusaoMock(...args),
  removerComissaoDaConclusao: (...args: unknown[]) => removerComissaoDaConclusaoMock(...args),
}));

// agendamento-repository: funções importadas por pagamento-service E agendamento-service.
const criarAgendamentoMock = vi.fn();
const buscarPorIdMock = vi.fn();
const listarMock = vi.fn();
const atualizarStatusAgendamentoMock = vi.fn();
const buscarClientePorUsuarioIdMock = vi.fn();
const buscarFuncionarioPorUsuarioIdMock = vi.fn();
const funcionarioExisteAtivoMock = vi.fn();
const servicoExisteAtivoMock = vi.fn();
const resumirFaturamentoMock = vi.fn();
const buscarDadosServicoDoAgendamentoMock = vi.fn();

vi.mock('../repositories/agendamento-repository', () => ({
  criar: (...args: unknown[]) => criarAgendamentoMock(...args),
  buscarPorId: (...args: unknown[]) => buscarPorIdMock(...args),
  listar: (...args: unknown[]) => listarMock(...args),
  atualizarStatus: (...args: unknown[]) => atualizarStatusAgendamentoMock(...args),
  buscarClientePorUsuarioId: (...args: unknown[]) => buscarClientePorUsuarioIdMock(...args),
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) => buscarFuncionarioPorUsuarioIdMock(...args),
  funcionarioExisteAtivo: (...args: unknown[]) => funcionarioExisteAtivoMock(...args),
  servicoExisteAtivo: (...args: unknown[]) => servicoExisteAtivoMock(...args),
  resumirFaturamento: (...args: unknown[]) => resumirFaturamentoMock(...args),
  buscarDadosServicoDoAgendamento: (...args: unknown[]) =>
    buscarDadosServicoDoAgendamentoMock(...args),
}));

// pagamento-repository: funções importadas por pagamento-service E agendamento-service.
const criarPagamentoRepoMock = vi.fn();
const buscarPagamentoPorIdMock = vi.fn();
const buscarPagamentoMaisRecenteMock = vi.fn();
const buscarPendenteMock = vi.fn();
const buscarPorOrderIdMock = vi.fn();
const atualizarStatusPagamentoMock = vi.fn();
const atualizarDadosOrdemMock = vi.fn();
const buscarStatusPagamentoPorAgendamentosMock = vi.fn();

vi.mock('../repositories/pagamento-repository', () => {
  // Classe definida DENTRO do factory para evitar o hoisting do vi.mock (TDZ).
  class ConflitoPagamentoPendenteFake extends Error {
    constructor() {
      super('Já existe pagamento pendente para este agendamento');
      this.name = 'ConflitoPagamentoPendente';
    }
  }
  return {
    criar: (...args: unknown[]) => criarPagamentoRepoMock(...args),
    buscarPorId: (...args: unknown[]) => buscarPagamentoPorIdMock(...args),
    buscarPorAgendamentoMaisRecente: (...args: unknown[]) => buscarPagamentoMaisRecenteMock(...args),
    buscarPendentePorAgendamento: (...args: unknown[]) => buscarPendenteMock(...args),
    buscarPorOrderId: (...args: unknown[]) => buscarPorOrderIdMock(...args),
    atualizarStatus: (...args: unknown[]) => atualizarStatusPagamentoMock(...args),
    atualizarDadosOrdem: (...args: unknown[]) => atualizarDadosOrdemMock(...args),
    buscarStatusPagamentoPorAgendamentos: (...args: unknown[]) =>
      buscarStatusPagamentoPorAgendamentosMock(...args),
    ConflitoPagamentoPendente: ConflitoPagamentoPendenteFake,
  };
});

// Mercado Pago (Checkout Pro — Preferences API / Bricks — Payments API) —
// nunca tocar na rede nos testes.
const criarPreferenciaMpMock = vi.fn();
const criarPagamentoCartaoMpMock = vi.fn();
const obterPaymentMpMock = vi.fn();
const buscarPagamentosPorReferenciaExternaMock = vi.fn();

vi.mock('../services/mercadopago-client', () => {
  // Classe definida DENTRO do factory para o `instanceof` do service enxergar a
  // MESMA identidade (TDZ do hoisting do vi.mock), igual ao ConflitoPagamentoPendente.
  class ErroApiMercadoPagoFake extends Error {
    public readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ErroApiMercadoPago';
      this.status = status;
    }
  }
  return {
    criarPreferencia: (...args: unknown[]) => criarPreferenciaMpMock(...args),
    criarPagamentoCartao: (...args: unknown[]) => criarPagamentoCartaoMpMock(...args),
    obterPayment: (...args: unknown[]) => obterPaymentMpMock(...args),
    buscarPagamentosPorReferenciaExterna: (...args: unknown[]) =>
      buscarPagamentosPorReferenciaExternaMock(...args),
    ErroApiMercadoPago: ErroApiMercadoPagoFake,
  };
});

const validarAssinaturaMock = vi.fn();

vi.mock('../utils/mercadopago-assinatura', () => ({
  validarAssinaturaWebhook: (...args: unknown[]) => validarAssinaturaMock(...args),
}));

// demais repositories importados por agendamento-service.
const buscarClientePorIdMock = vi.fn();
vi.mock('../repositories/cliente-repository', () => ({
  buscarClientePorId: (...args: unknown[]) => buscarClientePorIdMock(...args),
}));

const somarDespesasPeriodoMock = vi.fn();
vi.mock('../repositories/despesa-repository', () => ({
  somarDespesasPeriodo: (...args: unknown[]) => somarDespesasPeriodoMock(...args),
}));

// database/connection: somente db.transaction é usado em runtime (webhook).
const transactionMock = vi.fn();
vi.mock('../database/connection', () => ({
  default: {
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────

function agendamentoRow(sobre: Partial<AgendamentoRow> = {}): AgendamentoRow {
  return {
    id: 'ag-1',
    cliente_id: 'cliente-1',
    cliente_nome: 'João Cliente',
    funcionario_id: 'func-1',
    funcionario_nome: 'Barbeiro',
    servico_id: 'serv-1',
    servico_nome: 'Corte',
    data: '2026-09-20',
    hora: '10:00',
    status: 'pendente',
    observacao: null,
    created_at: '2026-09-13T10:00:00.000Z',
    ...sobre,
  };
}

function pagamentoRow(sobre: Partial<PagamentoRow> = {}): PagamentoRow {
  return {
    id: 'pag-1',
    agendamento_id: 'ag-1',
    mercadopago_order_id: 'tmp-ordem-1',
    mercadopago_payment_id: null,
    valor_centavos: 4500,
    status: 'pendente',
    checkoutUrl: null,
    created_at: '2026-09-13T10:00:00.000Z',
    updated_at: '2026-09-13T10:00:00.000Z',
    ...sobre,
  };
}

function mockReq(sobre: { dataId?: string; type?: string } = {}): Request {
  const query: Record<string, string> = {};
  if (sobre.dataId !== undefined) query['data.id'] = sobre.dataId;
  if (sobre.type !== undefined) query.type = sobre.type;
  return { headers: {}, query } as unknown as Request;
}

function assinaturaValida(dataId = 'PAY-1'): { ts: string; v1: string; requestId: string; dataId: string } {
  return { ts: '1700000000', v1: 'a'.repeat(64), requestId: 'req-1', dataId };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── criarPagamento: autorização e regras de domínio ─────────────────────

describe('criarPagamento', () => {
  it('nega por padrão quando o papel não é cliente', async () => {
    await expect(criarPagamento('user-1', 'admin', 'ag-1')).rejects.toThrow(ForbiddenError);
    expect(buscarClientePorUsuarioIdMock).not.toHaveBeenCalled();
    expect(criarPagamentoRepoMock).not.toHaveBeenCalled();
  });

  it('nega quando o usuário não possui perfil de cliente', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue(null);
    await expect(criarPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow(ForbiddenError);
  });

  it('rejeita agendamento inexistente', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(null);
    await expect(criarPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow(NotFoundError);
  });

  it('nega quando o cliente não é dono do agendamento', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-X', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    await expect(criarPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow(ForbiddenError);
  });

  it('rejeita agendamento cancelado ou concluído', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'cancelado' }));
    await expect(criarPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow(ValidationError);
  });

  it('rejeita quando já existe pagamento aprovado', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-9' }),
    );
    await expect(criarPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow(ValidationError);
    expect(criarPagamentoRepoMock).not.toHaveBeenCalled();
  });

  it('reutiliza pendente existente SEM chamar o Mercado Pago de novo', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendenteMock.mockResolvedValue(
      pagamentoRow({ checkoutUrl: 'https://checkout.mercadopago.com/v1/pendente-1' }),
    );

    const resultado = await criarPagamento('user-1', 'cliente', 'ag-1');

    expect(resultado.pagamento.id).toBe('pag-1');
    expect(resultado.pagamento.status).toBe('pendente');
    expect(resultado.checkoutUrl).toBe('https://checkout.mercadopago.com/v1/pendente-1');
    // Reuso devolve a URL SALVA no banco também no DTO (contrato PagamentoDTO).
    expect(resultado.pagamento.checkoutUrl).toBe('https://checkout.mercadopago.com/v1/pendente-1');
    expect(criarPagamentoRepoMock).not.toHaveBeenCalled();
    expect(criarPreferenciaMpMock).not.toHaveBeenCalled();
  });

  it('cria a preferência no MP, grava o id real e devolve a URL de checkout', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendenteMock.mockResolvedValue(null);
    criarPagamentoRepoMock.mockResolvedValue(pagamentoRow());
    buscarDadosServicoDoAgendamentoMock.mockResolvedValue({ nome: 'Corte', preco: '45.00' });
    criarPreferenciaMpMock.mockResolvedValue({
      id: 'PREF-1',
      checkoutUrl: 'https://checkout.mercadopago.com/v1/PREF-1',
    });

    const resultado = await criarPagamento('user-1', 'cliente', 'ag-1');

    expect(criarPreferenciaMpMock).toHaveBeenCalledTimes(1);
    expect(criarPreferenciaMpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'pag-1',
        externalReference: 'pag-1',
        titulo: 'Corte',
        valorCentavos: 4500,
      }),
    );
    expect(atualizarDadosOrdemMock).toHaveBeenCalledWith('pag-1', {
      orderId: 'PREF-1',
      checkoutUrl: 'https://checkout.mercadopago.com/v1/PREF-1',
    });
    expect(resultado.checkoutUrl).toBe('https://checkout.mercadopago.com/v1/PREF-1');
    expect(resultado.pagamento.mercadopagoOrderId).toBe('PREF-1');
    // DTO expõe a URL persistida logo na criação (contrato PagamentoDTO).
    expect(resultado.pagamento.checkoutUrl).toBe('https://checkout.mercadopago.com/v1/PREF-1');
  });

  it('reutiliza pendente quando perde a corrida de checkout duplo (23505 → ConflitoPagamentoPendente)', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendenteMock.mockResolvedValue(null);
    criarPagamentoRepoMock.mockRejectedValue(new ConflitoPagamentoPendente());
    const pendente = pagamentoRow({ checkoutUrl: 'https://checkout.mercadopago.com/v1/pendente-2' });
    buscarPendenteMock.mockResolvedValueOnce(null).mockResolvedValueOnce(pendente);

    const resultado = await criarPagamento('user-1', 'cliente', 'ag-1');

    expect(resultado.pagamento.id).toBe('pag-1');
    expect(resultado.checkoutUrl).toBe('https://checkout.mercadopago.com/v1/pendente-2');
    expect(criarPreferenciaMpMock).not.toHaveBeenCalled();
  });

  it('cancela o pagamento e relança quando a criação da preferência falha (sem pendente órfão)', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendenteMock.mockResolvedValue(null);
    criarPagamentoRepoMock.mockResolvedValue(pagamentoRow());
    buscarDadosServicoDoAgendamentoMock.mockResolvedValue({ nome: 'Corte', preco: '45.00' });
    criarPreferenciaMpMock.mockRejectedValue(new Error('mp indisponivel'));

    await expect(criarPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow('mp indisponivel');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'cancelado');
  });
});

// ── obterPagamento: ownership e escopo ──────────────────────────────────

describe('obterPagamento', () => {
  it('retorna o pagamento para o cliente dono', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());

    const pagamento = await obterPagamento('user-1', 'cliente', 'ag-1');

    expect(pagamento).not.toBeNull();
    expect(pagamento?.id).toBe('pag-1');
    expect(pagamento?.status).toBe('pendente');
    expect(pagamento?.agendamentoId).toBe('ag-1');
    expect(pagamento?.valorCentavos).toBe(4500);
  });

  it('nega cliente que não é dono do agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-X', usuario_id: 'user-1' });

    await expect(obterPagamento('user-1', 'cliente', 'ag-1')).rejects.toThrow(ForbiddenError);
  });

  it('permite admin ver qualquer agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow({ status: 'aprovado' }));

    const pagamento = await obterPagamento('user-1', 'admin', 'ag-1');
    expect(pagamento?.status).toBe('aprovado');
  });

  it('devolve mercadopagoOrderId null em um pagamento presencial (contrato honesto no GET /pagamento)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    // Linha presencial: forma presencial → sem ordem do MP (migration 20260913000003).
    buscarPagamentoMaisRecenteMock.mockResolvedValue(
      pagamentoRow({
        mercadopago_order_id: null,
        mercadopago_payment_id: null,
        status: 'aprovado',
      }),
    );

    const pagamento = await obterPagamento('user-1', 'cliente', 'ag-1');

    expect(pagamento).not.toBeNull();
    expect(pagamento?.mercadopagoOrderId).toBeNull();
    expect(pagamento?.status).toBe('aprovado');
    // O DTO continua sem expor forma/valor novos; o id da ordem é o ÚNICO
    // campo de ordem que existe no contrato, e ele é honestamente null aqui.
    expect(Object.keys(pagamento ?? {}).sort()).toEqual([
      'agendamentoId',
      'atualizadoEm',
      'checkoutUrl',
      'criadoEm',
      'id',
      'mercadopagoOrderId',
      'mercadopagoPaymentId',
      'status',
      'valorCentavos',
    ]);
  });

  it('retorna null quando não existe pagamento (200 com pagamento null)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);

    const pagamento = await obterPagamento('user-1', 'admin', 'ag-1');
    expect(pagamento).toBeNull();
  });

  it('nega recepcionista (sem escopo de pagamento)', async () => {
    await expect(obterPagamento('user-1', 'recepcionista', 'ag-1')).rejects.toThrow(ForbiddenError);
    expect(buscarPorIdMock).not.toHaveBeenCalled();
  });
});

// ── Webhook: assinatura, mapeamento e idempotência ──────────────────────

describe('processarWebhookMercadoPago', () => {
  it('rejeita assinatura inválida com 401 e não toca no banco', async () => {
    validarAssinaturaMock.mockImplementation(() => {
      throw new UnauthorizedError('Assinatura do webhook ausente');
    });

    await expect(processarWebhookMercadoPago(mockReq())).rejects.toThrow(UnauthorizedError);
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('ignora tópicos diferentes de payment', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-9'));
    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-9', type: 'order' }));
    expect(res).toEqual({ aceito: false, motivo: 'topico_ignorado' });
  });

  it('responde pagamento desconhecido (external_reference sem registro) com 200 amigável', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-DESCONHECIDO'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-DESCONHECIDO',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'PAG-DESCONHECIDO',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(null);

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-DESCONHECIDO', type: 'payment' }));
    expect(res).toEqual({ aceito: false, motivo: 'pagamento_desconhecido' });
    expect(buscarPagamentoPorIdMock).toHaveBeenCalledWith('PAG-DESCONHECIDO');
  });

  it('aprovado: atualiza pagamento SEM confirmar agendamento (pagamento não altera status) e SEM comissão', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));

    expect(res).toEqual({ aceito: true, status: 'aprovado' });
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'aprovado', {
      mercadopagoPaymentId: 'PAY-1',
    });
    // Regra central: pagamento aprovado NÃO confirma o agendamento (confirmação
    // é exclusiva do fluxo manual) e NÃO dispara comissão (exclusiva de conclusão).
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(aplicarComissaoNaConclusaoMock).not.toHaveBeenCalled();
    expect(removerComissaoDaConclusaoMock).not.toHaveBeenCalled();
  });

  it('entrega duplicada do webhook continua idempotente (200, sem erro)', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-1' }),
    );

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));

    expect(res).toEqual({ aceito: true, status: 'aprovado' });
    // Re-entrega reescreve o mesmo estado final; nunca toca no agendamento.
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('payment approved sem accredited mantém estado (sem falso aprovado)', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'pending_review',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));
    expect(res).toEqual({ aceito: false, motivo: 'sem_payment_accredited' });
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('payment cancelled move o pagamento para cancelado', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'cancelled',
      statusDetail: null,
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));
    expect(res).toEqual({ aceito: true, status: 'cancelado' });
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'cancelado');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('payment rejected move o pagamento para recusado', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));
    expect(res).toEqual({ aceito: true, status: 'recusado' });
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'recusado');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('estados intermediários (in_process/pending) são no-op', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'in_process',
      statusDetail: 'pending_review',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));
    expect(res).toEqual({ aceito: true, status: 'pendente' });
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('status de pagamento desconhecido mantém estado com resposta amigável', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'weird_future_status',
      statusDetail: null,
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));
    expect(res).toEqual({ aceito: true, motivo: 'status_desconhecido' });
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('webhook sem external_reference é tratado como suspeito (sem atualizar)', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-1'));
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: '',
    });

    const res = await processarWebhookMercadoPago(mockReq({ dataId: 'PAY-1', type: 'payment' }));
    expect(res).toEqual({ aceito: false, motivo: 'sem_external_reference' });
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('webhook NÃO converte 404 do MP em NotFoundError (comportamento inalterado — propagação segue como antes)', async () => {
    validarAssinaturaMock.mockResolvedValue(assinaturaValida('PAY-DESAPARECIDO'));
    obterPaymentMpMock.mockRejectedValue(
      new ErroApiMercadoPago(
        'Falha ao consultar pagamento PAY-DESAPARECIDO: Mercado Pago retornou HTTP 404',
        404,
      ),
    );

    // O webhook continua tratando erros do MP como hoje (relança; o errorHandler
    // mapeia para 500). A conversão para NotFoundError é EXCLUSIVA do
    // confirmarRetorno — este teste trava a restrição da revisão de QA.
    await expect(
      processarWebhookMercadoPago(mockReq({ dataId: 'PAY-DESAPARECIDO', type: 'payment' })),
    ).rejects.toThrow(ErroApiMercadoPago);
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });
});

// ── Aditivo pagamentoStatus nos DTOs de agendamento (listar/obter) ──────

describe('pagamentoStatus no AgendamentoDTO', () => {
  it('listarAgendamentos preenche pagamentoStatus em lote (null quando não há pagamento)', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    listarMock.mockResolvedValue([
      agendamentoRow({ id: 'ag-1' }),
      agendamentoRow({ id: 'ag-2', servico_nome: 'Barba' }),
    ]);
    buscarStatusPagamentoPorAgendamentosMock.mockResolvedValue(
      new Map([['ag-1', 'aprovado']]),
    );

    const resultado = await listarAgendamentos('user-1', 'cliente', {});

    expect(resultado).toHaveLength(2);
    expect(resultado[0].pagamentoStatus).toBe('aprovado');
    expect(resultado[1].pagamentoStatus).toBeNull();
    expect(buscarStatusPagamentoPorAgendamentosMock).toHaveBeenCalledWith(['ag-1', 'ag-2']);
  });

  it('obterAgendamento inclui pagamentoStatus do pagamento mais recente', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow({ status: 'recusado' }));

    const resultado = await obterAgendamento('user-1', 'admin', 'ag-1');
    expect(resultado.pagamentoStatus).toBe('recusado');
  });

  it('obterAgendamento retorna pagamentoStatus null quando não existe pagamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);

    const resultado = await obterAgendamento('user-1', 'admin', 'ag-1');
    expect(resultado.pagamentoStatus).toBeNull();
  });
});

// ── criarPagamentoComCartao: aprovado atualiza pagamento SEM confirmar ──

describe('criarPagamentoComCartao', () => {
  it('nega por padrão quando o papel não é cliente', async () => {
    await expect(
      criarPagamentoComCartao('user-1', 'recepcionista', 'ag-1', {
        token: 'tok-1',
        paymentMethodId: 'visa',
        payer: { email: 'joao@teste.com' },
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(criarPagamentoCartaoMpMock).not.toHaveBeenCalled();
  });

  it('aprovado (approved+accredited): atualiza pagamento SEM confirmar agendamento', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendenteMock.mockResolvedValue(pagamentoRow());
    buscarDadosServicoDoAgendamentoMock.mockResolvedValue({ nome: 'Corte', preco: '45.00' });
    criarPagamentoCartaoMpMock.mockResolvedValue({
      id: 'PAY-CARTAO-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-CARTAO-1' }),
    );

    const resultado = await criarPagamentoComCartao('user-1', 'cliente', 'ag-1', {
      token: 'tok-1',
      paymentMethodId: 'visa',
      payer: { email: 'joao@teste.com' },
    });

    expect(resultado.status).toBe('aprovado');
    expect(resultado.pagamento.status).toBe('aprovado');
    expect(resultado.pagamento.mercadopagoPaymentId).toBe('PAY-CARTAO-1');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'aprovado', {
      mercadopagoPaymentId: 'PAY-CARTAO-1',
    });
    // Regra central: pagamento aprovado NÃO confirma o agendamento.
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('recusado: move o pagamento para recusado sem tocar no agendamento', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendenteMock.mockResolvedValue(pagamentoRow());
    buscarDadosServicoDoAgendamentoMock.mockResolvedValue({ nome: 'Corte', preco: '45.00' });
    criarPagamentoCartaoMpMock.mockResolvedValue({
      id: 'PAY-CARTAO-2',
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(
      pagamentoRow({ status: 'recusado', mercadopago_payment_id: 'PAY-CARTAO-2' }),
    );

    const resultado = await criarPagamentoComCartao('user-1', 'cliente', 'ag-1', {
      token: 'tok-1',
      paymentMethodId: 'visa',
      payer: { email: 'joao@teste.com' },
    });

    expect(resultado.status).toBe('recusado');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'recusado', {
      mercadopagoPaymentId: 'PAY-CARTAO-2',
    });
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
  });
});

// ── confirmarRetorno: retorno do Checkout Pro (autoritativo e imediato) ──

describe('confirmarRetorno', () => {
  beforeEach(() => {
    // Padrão do describe: SEM pagamento aprovado prévio — o curto-circuito de
    // idempotência (F2a) só deve disparar nos testes que montam esse estado
    // explicitamente. `vi.clearAllMocks()` (hook global) NÃO reseta
    // implementações, então o valor precisa ser redefinido por describe.
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
  });

  it('nega por padrão papéis sem escopo (recepcionista/barbeiro)', async () => {
    await expect(confirmarRetorno('user-1', 'recepcionista', 'ag-1', 'PAY-1')).rejects.toThrow(
      ForbiddenError,
    );
    expect(buscarPorIdMock).not.toHaveBeenCalled();
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
  });

  it('rejeita agendamento inexistente', async () => {
    buscarPorIdMock.mockResolvedValue(null);
    await expect(confirmarRetorno('user-1', 'admin', 'ag-inexistente', 'PAY-1')).rejects.toThrow(
      NotFoundError,
    );
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
  });

  it('rejeita cliente que não é dono do agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-X', usuario_id: 'user-1' });
    await expect(confirmarRetorno('user-1', 'cliente', 'ag-1', 'PAY-1')).rejects.toThrow(
      ForbiddenError,
    );
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
  });

  it('valida no MP e rejeita sem external_reference (sem vazar dados)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: null,
    });
    await expect(confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-1')).rejects.toThrow(
      NotFoundError,
    );
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('rejeita pagamento local desconhecido no banco', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'PAG-DESCONHECIDO',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(null);
    await expect(confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-1')).rejects.toThrow(
      NotFoundError,
    );
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('rejeita quando o external_reference pertence a outro agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'pag-outro',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(
      pagamentoRow({ id: 'pag-outro', agendamento_id: 'ag-2' }),
    );
    await expect(confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-1')).rejects.toThrow(
      NotFoundError,
    );
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('é idempotente ANTES do MP: pagamento mais recente aprovado retorna o estado atual sem chamar o MP', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPagamentoMaisRecenteMock.mockResolvedValue(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-1' }),
    );

    const pagamento = await confirmarRetorno('user-1', 'cliente', 'ag-1', 'PAY-1');

    expect(pagamento.status).toBe('aprovado');
    expect(pagamento.mercadopagoPaymentId).toBe('PAY-1');
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
  });

  it('(F2a) MP fora do ar com pagamento local já aprovado devolve aprovado SEM consultar o MP (não vira 500)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPagamentoMaisRecenteMock.mockResolvedValue(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-1' }),
    );
    // Simula rede/MP indisponível: se o service consultasse o MP, falharia.
    obterPaymentMpMock.mockRejectedValue(new Error('Mercado Pago fora do ar'));

    const pagamento = await confirmarRetorno('user-1', 'cliente', 'ag-1', 'PAY-1');

    expect(pagamento.status).toBe('aprovado');
    expect(pagamento.mercadopagoPaymentId).toBe('PAY-1');
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
  });

  it('(F2b) paymentId inexistente no MP (HTTP 404) vira NotFoundError — não 500 genérico', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockRejectedValue(
      new ErroApiMercadoPago(
        'Falha ao consultar pagamento PAY-999: Mercado Pago retornou HTTP 404',
        404,
      ),
    );

    const erro = await confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-999').catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(NotFoundError);
    expect(erro).toHaveProperty('message', 'Pagamento não encontrado');
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('(F2b) erro NÃO-404 do MP (rede/5xx) NÃO vira NotFoundError — propaga ao errorHandler', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockRejectedValue(
      new ErroApiMercadoPago('Falha ao consultar pagamento: Mercado Pago retornou HTTP 503', 503),
    );

    await expect(confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-1')).rejects.toThrow(
      ErroApiMercadoPago,
    );
    expect(buscarPagamentoPorIdMock).not.toHaveBeenCalled();
  });

  it('approved+accredited: atualiza pagamento para aprovado SEM confirmar agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock
      .mockResolvedValueOnce(pagamentoRow())
      .mockResolvedValueOnce(
        pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-1' }),
      );

    const pagamento = await confirmarRetorno('user-1', 'cliente', 'ag-1', 'PAY-1');

    expect(pagamento.status).toBe('aprovado');
    expect(pagamento.mercadopagoPaymentId).toBe('PAY-1');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'aprovado', {
      mercadopagoPaymentId: 'PAY-1',
    });
    // Regra central: pagamento aprovado NÃO toca no status do agendamento.
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('approved sem accredited mantém o estado atual', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-1',
      status: 'approved',
      statusDetail: 'pending_review',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const pagamento = await confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-1');

    expect(pagamento.status).toBe('pendente');
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
  });

  it('recusado/cancelado: atualiza o pagamento e retorna o estado atualizado', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-2',
      status: 'cancelled',
      statusDetail: null,
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock
      .mockResolvedValueOnce(pagamentoRow())
      .mockResolvedValueOnce(
        pagamentoRow({ status: 'cancelado', mercadopago_payment_id: 'PAY-2' }),
      );

    const pagamento = await confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-2');

    expect(pagamento.status).toBe('cancelado');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'cancelado');
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
  });

  it('pending/in_process: retorna o estado atual (no-op, front segue em polling)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    obterPaymentMpMock.mockResolvedValue({
      id: 'PAY-3',
      status: 'in_process',
      statusDetail: 'pending_review',
      externalReference: 'pag-1',
    });
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow());

    const pagamento = await confirmarRetorno('user-1', 'admin', 'ag-1', 'PAY-3');

    expect(pagamento.status).toBe('pendente');
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
  });

  // ── paymentId ausente: resolve pela external_reference local ──────────

  it('sem paymentId busca no MP pela referência local e aprova (approved+accredited)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());
    buscarPagamentosPorReferenciaExternaMock.mockResolvedValue([
      { id: 'PAY-77', status: 'approved', statusDetail: 'accredited', externalReference: 'pag-1' },
    ]);
    buscarPagamentoPorIdMock.mockResolvedValueOnce(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-77' }),
    );

    const pagamento = await confirmarRetorno('user-1', 'admin', 'ag-1');

    expect(buscarPagamentosPorReferenciaExternaMock).toHaveBeenCalledWith('pag-1');
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'aprovado', {
      mercadopagoPaymentId: 'PAY-77',
    });
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
    expect(pagamento.status).toBe('aprovado');
    expect(pagamento.mercadopagoPaymentId).toBe('PAY-77');
  });

  it('sem paymentId prefere um pagamento aprovado sobre tentativas mais recentes recusadas', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());
    buscarPagamentosPorReferenciaExternaMock.mockResolvedValue([
      { id: 'PAY-NEW', status: 'rejected', statusDetail: null, externalReference: 'pag-1' },
      { id: 'PAY-OLD', status: 'approved', statusDetail: 'accredited', externalReference: 'pag-1' },
    ]);
    buscarPagamentoPorIdMock.mockResolvedValueOnce(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-OLD' }),
    );

    const pagamento = await confirmarRetorno('user-1', 'admin', 'ag-1');

    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'aprovado', {
      mercadopagoPaymentId: 'PAY-OLD',
    });
    expect(pagamento.status).toBe('aprovado');
  });

  it('sem paymentId e MP ainda sem pagamento para a referência → estado local (no-op)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());
    buscarPagamentosPorReferenciaExternaMock.mockResolvedValue([]);

    const pagamento = await confirmarRetorno('user-1', 'admin', 'ag-1');

    expect(pagamento.status).toBe('pendente');
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('sem paymentId e sem pagamento local → 404 sem consultar o MP', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    // buscarPagamentoMaisRecenteMock = null (padrão do describe)

    await expect(confirmarRetorno('user-1', 'admin', 'ag-1')).rejects.toThrow(NotFoundError);
    expect(buscarPagamentosPorReferenciaExternaMock).not.toHaveBeenCalled();
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
  });
});

// ── cancelarPagamentoPendente: desistência no checkout do MP ─────────────

describe('cancelarPagamentoPendente', () => {
  it('dono cancela pagamento pendente → cancelado (sem chamar o MP)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow({ status: 'cancelado' }));

    const pagamento = await cancelarPagamentoPendente('user-1', 'cliente', 'ag-1');

    expect(pagamento).not.toBeNull();
    expect(pagamento?.status).toBe('cancelado');
    expect(pagamento?.agendamentoId).toBe('ag-1');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'cancelado');
    expect(obterPaymentMpMock).not.toHaveBeenCalled();
    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
  });

  it('admin pode cancelar o pendente de qualquer agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ cliente_id: 'cliente-99' }));
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow({ status: 'cancelado' }));

    const pagamento = await cancelarPagamentoPendente('user-9', 'admin', 'ag-1');

    expect(pagamento?.status).toBe('cancelado');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-1', 'cancelado');
    expect(buscarClientePorUsuarioIdMock).not.toHaveBeenCalled();
  });

  it('nega cliente que não é dono do agendamento (terceiro)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-X', usuario_id: 'user-1' });

    await expect(cancelarPagamentoPendente('user-1', 'cliente', 'ag-1')).rejects.toThrow(
      ForbiddenError,
    );
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('nega papéis sem escopo de pagamento (recepcionista/barbeiro)', async () => {
    await expect(
      cancelarPagamentoPendente('user-1', 'recepcionista', 'ag-1'),
    ).rejects.toThrow(ForbiddenError);
    await expect(cancelarPagamentoPendente('user-1', 'profissional', 'ag-1')).rejects.toThrow(
      ForbiddenError,
    );
    expect(buscarPorIdMock).not.toHaveBeenCalled();
    expect(buscarPagamentoMaisRecenteMock).not.toHaveBeenCalled();
  });

  it('pagamento já aprovado → no-op (jamais desfaz aprovado)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(
      pagamentoRow({ status: 'aprovado', mercadopago_payment_id: 'PAY-1' }),
    );

    const pagamento = await cancelarPagamentoPendente('user-1', 'admin', 'ag-1');

    expect(pagamento?.status).toBe('aprovado');
    expect(pagamento?.mercadopagoPaymentId).toBe('PAY-1');
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('pagamento já cancelado/recusado/expirado → no-op (estado final preservado)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    for (const status of ['cancelado', 'recusado', 'expirado'] as const) {
      buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow({ status }));

      const pagamento = await cancelarPagamentoPendente('user-1', 'admin', 'ag-1');

      expect(pagamento?.status).toBe(status);
      expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
    }
  });

  it('não existe pagamento → retorna null (200 com { pagamento: null })', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);

    const pagamento = await cancelarPagamentoPendente('user-1', 'admin', 'ag-1');

    expect(pagamento).toBeNull();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('agendamento inexistente → 404', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    await expect(
      cancelarPagamentoPendente('user-1', 'admin', 'ag-inexistente'),
    ).rejects.toThrow(NotFoundError);
    expect(buscarPagamentoMaisRecenteMock).not.toHaveBeenCalled();
    expect(atualizarStatusPagamentoMock).not.toHaveBeenCalled();
  });

  it('jamais altera o status do agendamento (rota separada do cancelamento de agendamento)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow());
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-1' });
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRow());
    buscarPagamentoPorIdMock.mockResolvedValue(pagamentoRow({ status: 'cancelado' }));

    await cancelarPagamentoPendente('user-1', 'cliente', 'ag-1');

    expect(atualizarStatusAgendamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});