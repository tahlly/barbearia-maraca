import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import {
  criarAgendamento,
  cancelarAgendamento,
  reagendarAgendamento,
  confirmarAgendamento,
  concluirAgendamento,
  reverterConclusaoAgendamento,
} from '../services/agendamento-service';
import type { CreateAgendamentoRequest } from '../dtos/agendamento-dto';
import type { AgendamentoRow } from '../repositories/agendamento-repository';
import type { PagamentoRow } from '../repositories/pagamento-repository';

// ── Mocks ─────────────────────────────────────────────────────

// permissao-repository: todas as funções importadas por permissao-service.
const listarCatalogoPermissoesMock = vi.fn();
const listarPermissoesPorUsuariosMock = vi.fn();
const aplicarAlteracaoPermissaoMock = vi.fn();
const listarUsuariosInternosMock = vi.fn();
const listarIdsAdminsMock = vi.fn();
const listarIdsComPermissaoEfetivaMock = vi.fn();
const buscarFuncionarioPorUsuarioIdPermissaoMock = vi.fn();

// auth-service: mapearTipoParaRole usado por permissao-service.
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
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) => buscarFuncionarioPorUsuarioIdPermissaoMock(...args),
}));

vi.mock('../services/auth-service', () => ({
  mapearTipoParaRole: (...args: unknown[]) => mapearTipoParaRoleMock(...args),
}));

// agendamento-repository: funções importadas pelo agendamento-service.
const criarMock = vi.fn();
const buscarPorIdMock = vi.fn();
const listarMock = vi.fn();
const atualizarStatusMock = vi.fn();
const atualizarDataHoraMock = vi.fn();
const buscarClientePorUsuarioIdMock = vi.fn();
const buscarFuncionarioPorUsuarioIdMock = vi.fn();
const funcionarioExisteAtivoMock = vi.fn();
const servicoExisteAtivoMock = vi.fn();
const resumirFaturamentoMock = vi.fn();
const buscarDadosServicoDoAgendamentoMock = vi.fn();

vi.mock('../repositories/agendamento-repository', () => ({
  criar: (...args: unknown[]) => criarMock(...args),
  buscarPorId: (...args: unknown[]) => buscarPorIdMock(...args),
  listar: (...args: unknown[]) => listarMock(...args),
  atualizarStatus: (...args: unknown[]) => atualizarStatusMock(...args),
  atualizarDataHora: (...args: unknown[]) => atualizarDataHoraMock(...args),
  buscarClientePorUsuarioId: (...args: unknown[]) => buscarClientePorUsuarioIdMock(...args),
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) => buscarFuncionarioPorUsuarioIdMock(...args),
  funcionarioExisteAtivo: (...args: unknown[]) => funcionarioExisteAtivoMock(...args),
  servicoExisteAtivo: (...args: unknown[]) => servicoExisteAtivoMock(...args),
  resumirFaturamento: (...args: unknown[]) => resumirFaturamentoMock(...args),
  buscarDadosServicoDoAgendamento: (...args: unknown[]) =>
    buscarDadosServicoDoAgendamentoMock(...args),
}));

// pagamento-repository: funções importadas pelo agendamento-service. O
// reagendamento preserva o pagamento da MESMA linha e devolve pagamentoStatus
// no DTO; a conclusão com a flag da recepção registra o pagamento presencial
// NA MESMA transação (buscarPendente/atualizarStatus/criarPresencial).
const buscarPagamentoMaisRecenteMock = vi.fn();
const buscarStatusPagamentoPorAgendamentosMock = vi.fn();
const buscarPendentePorAgendamentoMock = vi.fn();
const atualizarStatusPagamentoMock = vi.fn();
const criarPagamentoPresencialMock = vi.fn();

vi.mock('../repositories/pagamento-repository', () => ({
  buscarPorAgendamentoMaisRecente: (...args: unknown[]) => buscarPagamentoMaisRecenteMock(...args),
  buscarStatusPagamentoPorAgendamentos: (...args: unknown[]) =>
    buscarStatusPagamentoPorAgendamentosMock(...args),
  buscarPendentePorAgendamento: (...args: unknown[]) => buscarPendentePorAgendamentoMock(...args),
  atualizarStatus: (...args: unknown[]) => atualizarStatusPagamentoMock(...args),
  criarPagamentoPresencial: (...args: unknown[]) => criarPagamentoPresencialMock(...args),
}));

// cliente-repository: buscarClientePorId usado no fluxo staff.
const buscarClientePorIdMock = vi.fn();

vi.mock('../repositories/cliente-repository', () => ({
  buscarClientePorId: (...args: unknown[]) => buscarClientePorIdMock(...args),
}));

// database/connection: agendamento-service agora usa db.transaction para
// aplicar/remover comissão na MESMA transação da mudança de status.
const transactionMock = vi.fn();

vi.mock('../database/connection', () => ({
  default: {
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

// Hook de comissão: os testes de conclusão exercitam o comissao-service REAL,
// portanto comissao-repository (e os repositórios que ele consulta) são mockados
// para que nenhum teste toque no banco. upsert/listar/substituir não participam
// do hook, mas precisam existir no módulo mockado para o import não falhar.
const buscarConfiguracaoComissaoMock = vi.fn();
const buscarDespesaComissaoPorAgendamentoMock = vi.fn();
const buscarDadosParaComissaoDeAgendamentoMock = vi.fn();
const buscarPercentualComissaoMock = vi.fn();
const criarDespesaComissaoAutomaticaMock = vi.fn();
const removerDespesaComissaoPorAgendamentoMock = vi.fn();
const criarPendenciaComissaoMock = vi.fn();
const buscarPendenciaComissaoPorAgendamentoMock = vi.fn();
const removerPendenciaComissaoPorAgendamentoMock = vi.fn();

vi.mock('../repositories/comissao-repository', () => ({
  buscarConfiguracaoComissao: (...args: unknown[]) => buscarConfiguracaoComissaoMock(...args),
  upsertConfiguracaoComissao: vi.fn(),
  listarComissoesDoFuncionario: vi.fn(),
  substituirComissoesDoFuncionario: vi.fn(),
  buscarPercentualComissao: (...args: unknown[]) => buscarPercentualComissaoMock(...args),
  buscarDadosParaComissaoDeAgendamento: (...args: unknown[]) =>
    buscarDadosParaComissaoDeAgendamentoMock(...args),
  buscarDespesaComissaoPorAgendamento: (...args: unknown[]) =>
    buscarDespesaComissaoPorAgendamentoMock(...args),
  criarDespesaComissaoAutomatica: (...args: unknown[]) => criarDespesaComissaoAutomaticaMock(...args),
  removerDespesaComissaoPorAgendamento: (...args: unknown[]) =>
    removerDespesaComissaoPorAgendamentoMock(...args),
  criarPendenciaComissao: (...args: unknown[]) => criarPendenciaComissaoMock(...args),
  buscarPendenciaComissaoPorAgendamento: (...args: unknown[]) =>
    buscarPendenciaComissaoPorAgendamentoMock(...args),
  removerPendenciaComissaoPorAgendamento: (...args: unknown[]) =>
    removerPendenciaComissaoPorAgendamentoMock(...args),
}));

const buscarFuncionarioPorIdMock = vi.fn();

vi.mock('../repositories/funcionario-repository', () => ({
  buscarPorId: (...args: unknown[]) => buscarFuncionarioPorIdMock(...args),
}));

const buscarServicoPorIdMock = vi.fn();

vi.mock('../repositories/servico-repository', () => ({
  buscarServicoPorId: (...args: unknown[]) => buscarServicoPorIdMock(...args),
}));

// ── Helpers ───────────────────────────────────────────────────

function diaFuturo(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function dadosCriacao(overrides: Partial<CreateAgendamentoRequest> = {}): CreateAgendamentoRequest {
  return {
    funcionario_id: 'func-1',
    servico_id: 'svc-1',
    data: diaFuturo(),
    hora: '10:00',
    observacao: null,
    ...overrides,
  };
}

function agendamentoRow(overrides: Partial<AgendamentoRow> = {}): AgendamentoRow {
  return {
    id: 'ag-1',
    cliente_id: 'cliente-1',
    cliente_nome: 'Cliente Teste',
    funcionario_id: 'func-1',
    funcionario_nome: 'Funcionario Teste',
    servico_id: 'svc-1',
    servico_nome: 'Corte',
    data: diaFuturo(),
    hora: '10:00',
    status: 'pendente',
    observacao: null,
    created_at: '2026-09-09T12:00:00.000Z',
    ...overrides,
  };
}

function overridePermissaoNegada(usuarioId: string) {
  return [{ usuario_id: usuarioId, permissao: 'agendar_para_cliente', concedida: false }];
}

const trxObj = { transacao: true };

// Acompanha se a transação fake "commitou": só vira true quando o callback da
// transação termina SEM erro. Usada no teste de rollback do hook de comissão.
let transacaoCommitada = false;

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: gates de existência liberados e matriz default aplicada
  // (nenhum override registrado → permissão avaliada pelo papel).
  funcionarioExisteAtivoMock.mockResolvedValue(true);
  servicoExisteAtivoMock.mockResolvedValue(true);
  listarPermissoesPorUsuariosMock.mockResolvedValue([]);
  // Transação fake: executa o callback passando o trxObj (mesmo padrão do
  // database/connection real do Knex). Quando o callback FALHA, simula o
  // rollback do Knex: nada é commitado e o erro propaga para o chamador.
  transacaoCommitada = false;
  transactionMock.mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
    try {
      const resultado = await cb(trxObj);
      transacaoCommitada = true;
      return resultado;
    } catch (error) {
      transacaoCommitada = false;
      throw error;
    }
  });
});

// ── criarAgendamento ──────────────────────────────────────────

describe('criarAgendamento', () => {
  it('cliente cria para si mesmo sem exigir permissão (clienteId do próprio token)', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });
    criarMock.mockResolvedValue(agendamentoRow());

    const resultado = await criarAgendamento('user-cliente', 'cliente', dadosCriacao());

    expect(listarPermissoesPorUsuariosMock).not.toHaveBeenCalled();
    expect(buscarClientePorUsuarioIdMock).toHaveBeenCalledWith('user-cliente');
    expect(criarMock).toHaveBeenCalledWith({
      clienteId: 'cliente-1',
      funcionarioId: 'func-1',
      servicoId: 'svc-1',
      data: expect.any(String),
      hora: '10:00',
      observacao: null,
    });
    expect(resultado.id).toBe('ag-1');
  });

  it('recepcionista (default true) cria com cliente_id válido', async () => {
    buscarClientePorIdMock.mockResolvedValue({
      id: 'cliente-2',
      usuario_id: 'user-cliente-2',
      nome: 'Cliente 2',
      email: 'c2@email.com',
      telefone: null,
    });
    criarMock.mockResolvedValue(agendamentoRow({ cliente_id: 'cliente-2' }));

    const resultado = await criarAgendamento(
      'user-recep',
      'recepcionista',
      dadosCriacao({ cliente_id: 'cliente-2' }),
    );

    expect(criarMock).toHaveBeenCalledWith({
      clienteId: 'cliente-2',
      funcionarioId: 'func-1',
      servicoId: 'svc-1',
      data: expect.any(String),
      hora: '10:00',
      observacao: null,
    });
    expect(resultado.clienteId).toBe('cliente-2');
  });

  it('admin (default true) cria', async () => {
    buscarClientePorIdMock.mockResolvedValue({
      id: 'cliente-3',
      usuario_id: 'user-cliente-3',
      nome: 'Cliente 3',
      email: 'c3@email.com',
      telefone: null,
    });
    criarMock.mockResolvedValue(agendamentoRow({ cliente_id: 'cliente-3' }));

    const resultado = await criarAgendamento(
      'user-admin',
      'admin',
      dadosCriacao({ cliente_id: 'cliente-3' }),
    );

    expect(criarMock).toHaveBeenCalledWith({
      clienteId: 'cliente-3',
      funcionarioId: 'func-1',
      servicoId: 'svc-1',
      data: expect.any(String),
      hora: '10:00',
      observacao: null,
    });
    expect(resultado.clienteId).toBe('cliente-3');
  });

  it('profissional com permissão (sem override) cria na PRÓPRIA agenda', async () => {
    buscarClientePorIdMock.mockResolvedValue({
      id: 'cliente-4',
      usuario_id: 'user-cliente-4',
      nome: 'Cliente 4',
      email: 'c4@email.com',
      telefone: null,
    });
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });
    criarMock.mockResolvedValue(agendamentoRow({ cliente_id: 'cliente-4' }));

    const resultado = await criarAgendamento(
      'user-prof',
      'profissional',
      dadosCriacao({ cliente_id: 'cliente-4', funcionario_id: 'func-1' }),
    );

    expect(criarMock).toHaveBeenCalledWith({
      clienteId: 'cliente-4',
      funcionarioId: 'func-1',
      servicoId: 'svc-1',
      data: expect.any(String),
      hora: '10:00',
      observacao: null,
    });
    expect(resultado.clienteId).toBe('cliente-4');
  });

  it('profissional com permissão tenta criar na agenda de OUTRO funcionário → ForbiddenError', async () => {
    buscarClientePorIdMock.mockResolvedValue({
      id: 'cliente-5',
      usuario_id: 'user-cliente-5',
      nome: 'Cliente 5',
      email: 'c5@email.com',
      telefone: null,
    });
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });

    await expect(
      criarAgendamento('user-prof', 'profissional', dadosCriacao({ cliente_id: 'cliente-5', funcionario_id: 'func-2' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('profissional SEM permissão (override negado) tenta criar na própria agenda → ForbiddenError', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue(overridePermissaoNegada('user-prof'));
    buscarClientePorIdMock.mockResolvedValue({
      id: 'cliente-6',
      usuario_id: 'user-cliente-6',
      nome: 'Cliente 6',
      email: 'c6@email.com',
      telefone: null,
    });
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });

    await expect(
      criarAgendamento('user-prof', 'profissional', dadosCriacao({ cliente_id: 'cliente-6' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('recepcionista SEM cliente_id → ValidationError', async () => {
    await expect(
      criarAgendamento('user-recep', 'recepcionista', dadosCriacao()),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('role inválido → ForbiddenError', async () => {
    await expect(
      criarAgendamento('user-x', 'fantasma', dadosCriacao()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(criarMock).not.toHaveBeenCalled();
  });
});

// ── cancelarAgendamento ───────────────────────────────────────

describe('cancelarAgendamento', () => {
  it('profissional com permissão cancela agendamento da própria agenda', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });
    atualizarStatusMock.mockResolvedValue(undefined);

    const resultado = await cancelarAgendamento('user-prof', 'profissional', 'ag-1');

    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'cancelado');
    expect(resultado.status).toBe('cancelado');
  });

  it('profissional com permissão tenta cancelar agenda de OUTRO → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ funcionario_id: 'func-9', status: 'pendente' }));
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });

    await expect(
      cancelarAgendamento('user-prof', 'profissional', 'ag-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarStatusMock).not.toHaveBeenCalled();
  });

  it('profissional SEM permissão (override negado) cancela → ForbiddenError', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue(overridePermissaoNegada('user-prof'));
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));

    await expect(
      cancelarAgendamento('user-prof', 'profissional', 'ag-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarStatusMock).not.toHaveBeenCalled();
  });

  it('recepcionista (default true) cancela qualquer agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));
    atualizarStatusMock.mockResolvedValue(undefined);

    const resultado = await cancelarAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'cancelado');
    expect(resultado.status).toBe('cancelado');
  });

  it('cliente cancela o próprio agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });
    atualizarStatusMock.mockResolvedValue(undefined);

    const resultado = await cancelarAgendamento('user-cliente', 'cliente', 'ag-1');

    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'cancelado');
    expect(resultado.status).toBe('cancelado');
  });

  it('cliente tenta cancelar agendamento de OUTRO cliente → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ cliente_id: 'cliente-9', status: 'pendente' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });

    await expect(
      cancelarAgendamento('user-cliente', 'cliente', 'ag-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarStatusMock).not.toHaveBeenCalled();
  });

  it('recepcionista com OVERRIDE FALSE cancela → ForbiddenError (revogação no modal afeta recep)', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue(overridePermissaoNegada('user-recep'));
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));

    await expect(
      cancelarAgendamento('user-recep', 'recepcionista', 'ag-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarStatusMock).not.toHaveBeenCalled();
  });

  it('staff tenta cancelar agendamento concluído → ValidationError (transição inválida preservada)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'concluido' }));

    await expect(
      cancelarAgendamento('user-recep', 'recepcionista', 'ag-1'),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(atualizarStatusMock).not.toHaveBeenCalled();
  });

  it('role inválido → ForbiddenError', async () => {
    await expect(
      cancelarAgendamento('user-x', 'fantasma', 'ag-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarStatusMock).not.toHaveBeenCalled();
  });
});

// ── reagendarAgendamento ─────────────────────────────────────

function dadosReagendamento(
  overrides: Partial<{ data: string; hora: string; timezone_offset_minutes?: number | null }> = {},
) {
  return {
    data: diaFuturo(),
    hora: '14:00',
    ...overrides,
  };
}

describe('reagendarAgendamento', () => {
  it('cliente dono reagenda com sucesso: nova data/hora E pagamento aprovado preservado', async () => {
    const novaData = diaFuturo();
    const novaHora = '14:00';
    buscarPorIdMock
      .mockResolvedValueOnce(agendamentoRow({ status: 'pendente' }))
      .mockResolvedValueOnce(agendamentoRow({ status: 'pendente', data: novaData, hora: novaHora }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });
    atualizarDataHoraMock.mockResolvedValue(undefined);
    buscarPagamentoMaisRecenteMock.mockResolvedValue({ status: 'aprovado' });

    const resultado = await reagendarAgendamento(
      'user-cliente',
      'cliente',
      'ag-1',
      dadosReagendamento({ data: novaData, hora: novaHora }),
    );

    // Altera SOMENTE data/hora na MESMA linha (stay, não recria linha).
    expect(atualizarDataHoraMock).toHaveBeenCalledTimes(1);
    expect(atualizarDataHoraMock).toHaveBeenCalledWith('ag-1', novaData, novaHora);
    expect(resultado.id).toBe('ag-1');
    expect(resultado.data).toBe(novaData);
    expect(resultado.hora).toBe(novaHora);
    // Status e pagamento permanecem intactos (pagamento não se perde).
    expect(resultado.status).toBe('pendente');
    expect(resultado.pagamentoStatus).toBe('aprovado');
  });

  it('reagendamento sem pagamento mantém pagamentoStatus null (não pago preservado)', async () => {
    const novaData = diaFuturo();
    const novaHora = '14:00';
    buscarPorIdMock
      .mockResolvedValueOnce(agendamentoRow({ status: 'pendente' }))
      .mockResolvedValueOnce(agendamentoRow({ status: 'pendente', data: novaData, hora: novaHora }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });
    atualizarDataHoraMock.mockResolvedValue(undefined);
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);

    const resultado = await reagendarAgendamento(
      'user-cliente',
      'cliente',
      'ag-1',
      dadosReagendamento({ data: novaData, hora: novaHora }),
    );

    expect(resultado.pagamentoStatus).toBe(null);
  });

  it('cliente que NÃO é dono → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ cliente_id: 'cliente-9', status: 'pendente' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });

    await expect(
      reagendarAgendamento('user-cliente', 'cliente', 'ag-1', dadosReagendamento()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('staff sem permissão agendar_para_cliente (override negado) → ForbiddenError', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue(overridePermissaoNegada('user-recep'));
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));

    await expect(
      reagendarAgendamento('user-recep', 'recepcionista', 'ag-1', dadosReagendamento()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('profissional com permissão reagenda na PRÓPRIA agenda', async () => {
    const novaData = diaFuturo();
    const novaHora = '14:00';
    buscarPorIdMock
      .mockResolvedValueOnce(agendamentoRow({ status: 'pendente' }))
      .mockResolvedValueOnce(agendamentoRow({ status: 'pendente', data: novaData, hora: novaHora }));
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });
    atualizarDataHoraMock.mockResolvedValue(undefined);

    const resultado = await reagendarAgendamento(
      'user-prof',
      'profissional',
      'ag-1',
      dadosReagendamento({ data: novaData, hora: novaHora }),
    );

    expect(resultado.data).toBe(novaData);
    expect(resultado.hora).toBe(novaHora);
    expect(atualizarDataHoraMock).toHaveBeenCalledWith('ag-1', novaData, novaHora);
  });

  it('profissional tenta reagendar agenda de OUTRO funcionário → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ funcionario_id: 'func-9', status: 'pendente' }));
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({
      id: 'func-1',
      usuario_id: 'user-prof',
      ativo: true,
    });

    await expect(
      reagendarAgendamento('user-prof', 'profissional', 'ag-1', dadosReagendamento()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('agendamento cancelado não pode ser reagendado → ValidationError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'cancelado' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });

    await expect(
      reagendarAgendamento('user-cliente', 'cliente', 'ag-1', dadosReagendamento()),
    ).rejects.toThrow('Agendamento cancelado não pode ser reagendado');
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('agendamento concluído não pode ser reagendado → ValidationError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'concluido' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });

    await expect(
      reagendarAgendamento('user-cliente', 'cliente', 'ag-1', dadosReagendamento()),
    ).rejects.toThrow('Agendamento concluído não pode ser reagendado');
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('horário passado → ValidationError', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });

    await expect(
      reagendarAgendamento(
        'user-cliente',
        'cliente',
        'ag-1',
        dadosReagendamento({ data: '2020-01-01', hora: '10:00' }),
      ),
    ).rejects.toThrow('Não é possível agendar em horário passado');
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('violação de unicidade (23505) no update → ValidationError Horário indisponível', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));
    buscarClientePorUsuarioIdMock.mockResolvedValue({ id: 'cliente-1', usuario_id: 'user-cliente' });
    atualizarDataHoraMock.mockRejectedValue({ code: '23505' });

    await expect(
      reagendarAgendamento('user-cliente', 'cliente', 'ag-1', dadosReagendamento()),
    ).rejects.toThrow('Horário indisponível');
    expect(atualizarDataHoraMock).toHaveBeenCalledTimes(1);
  });

  it('agendamento inexistente → NotFoundError', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    await expect(
      reagendarAgendamento('user-cliente', 'cliente', 'ag-1', dadosReagendamento()),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });

  it('role inválido → ForbiddenError', async () => {
    await expect(
      reagendarAgendamento('user-x', 'fantasma', 'ag-1', dadosReagendamento()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarDataHoraMock).not.toHaveBeenCalled();
  });
});

// ── conclusão / reversão — hook automático de comissão (Passo 5) ──

function dadosComissaoHook(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    funcionario_id: 'func-1',
    funcionario_nome: 'Funcionario Teste',
    servico_id: 'svc-1',
    servico_preco: '45.00',
    data: agendamentoRow().data,
    ...overrides,
  };
}

describe('concluirAgendamento — hook de comissão', () => {
  beforeEach(() => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'confirmado' }));
    atualizarStatusMock.mockResolvedValue(undefined);
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissaoHook());
    buscarPercentualComissaoMock.mockResolvedValue('40.00');
    criarDespesaComissaoAutomaticaMock.mockResolvedValue(undefined);
    buscarPendenciaComissaoPorAgendamentoMock.mockResolvedValue(false);
    criarPendenciaComissaoMock.mockResolvedValue(undefined);
  });

  it('conclui e cria despesa de comissão com valor = preço × percentual / 100 na MESMA transação', async () => {
    const resultado = await concluirAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(resultado.status).toBe('concluido');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'concluido', trxObj);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledTimes(1);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledWith(
      {
        descricao: 'Comissão Funcionario Teste',
        valor: '18.00',
        data: agendamentoRow().data,
        funcionarioId: 'func-1',
        agendamentoId: 'ag-1',
      },
      trxObj,
    );
  });

  it('não duplica: despesa de comissão já existente para o agendamento → não cria', async () => {
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(true);

    await concluirAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('sem percentual configurado (linha ou percentual null) → não cria despesa', async () => {
    buscarPercentualComissaoMock.mockResolvedValue(null);

    await concluirAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('INTERRUPTOR ATIVO + SEM % CADASTRADA → conclui normalmente E registra o aviso (pendência)', async () => {
    buscarPercentualComissaoMock.mockResolvedValue(null);
    buscarPendenciaComissaoPorAgendamentoMock.mockResolvedValue(false);
    criarPendenciaComissaoMock.mockResolvedValue(undefined);

    const resultado = await concluirAgendamento('user-recep', 'recepcionista', 'ag-1');

    // O atendimento conclui NORMALMENTE (nunca é bloqueado por falta de %).
    expect(resultado.status).toBe('concluido');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'concluido', trxObj);
    // Aviso registrado na MESMA transação da conclusão.
    expect(criarPendenciaComissaoMock).toHaveBeenCalledTimes(1);
    expect(criarPendenciaComissaoMock).toHaveBeenCalledWith(
      {
        agendamentoId: 'ag-1',
        funcionarioId: 'func-1',
        servicoId: 'svc-1',
        data: agendamentoRow().data,
      },
      trxObj,
    );
    // Sem despesa (não há % para calcular).
    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
    expect(transacaoCommitada).toBe(true);
  });

  it('comissão inativa → não cria despesa', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(false);

    await concluirAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('hook de comissão falha → operação rejeita E mudança de status não é persistida (rollback)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'confirmado' }));
    atualizarStatusMock.mockResolvedValue(undefined);
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissaoHook());
    buscarPercentualComissaoMock.mockResolvedValue('40.00');
    criarDespesaComissaoAutomaticaMock.mockRejectedValue(new Error('erro simulado no hook'));

    await expect(
      concluirAgendamento('user-recep', 'recepcionista', 'ag-1'),
    ).rejects.toThrow('erro simulado no hook');

    // A mudança de status foi emitida DENTRO da transação (com o trx), porém o
    // Knex executa rollback quando o callback falha: nada é persistido e a
    // operação rejeita — nunca fica agendamento concluído sem despesa de
    // comissão correspondente.
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'concluido', trxObj);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledTimes(1);
    expect(transacaoCommitada).toBe(false);
  });
});

// ── conclusão com pagamento presencial (flag EXCLUSIVA da recepção) ──

function pagamentoRowMock(sobre: Partial<PagamentoRow> = {}): PagamentoRow {
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

describe('concluirAgendamento — pagamento presencial (recepcionista)', () => {
  beforeEach(() => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'confirmado' }));
    atualizarStatusMock.mockResolvedValue(undefined);
    buscarPagamentoMaisRecenteMock.mockResolvedValue(null);
    buscarPendentePorAgendamentoMock.mockResolvedValue(null);
    buscarDadosServicoDoAgendamentoMock.mockResolvedValue({ nome: 'Corte', preco: '45.00' });
    criarPagamentoPresencialMock.mockResolvedValue(undefined);
    // Comissão desligada por padrão neste describe (foco no pagamento); os
    // testes específicos de comissão reativam o cenário explicitamente.
    buscarConfiguracaoComissaoMock.mockResolvedValue(false);
  });

  it('recepção conclui com a flag: linha presencial/aprovado com o VALOR DO SERVIÇO e registrado_por_usuario_id, resposta pagamentoStatus aprovado', async () => {
    const resultado = await concluirAgendamento('user-recep', 'recepcionista', 'ag-1', {
      registrarPagamentoPresencial: true,
    });

    expect(resultado.status).toBe('concluido');
    expect(resultado.pagamentoStatus).toBe('aprovado');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Todas as consultas do fluxo participam da MESMA transação (trx).
    expect(buscarPagamentoMaisRecenteMock).toHaveBeenCalledWith('ag-1', trxObj);
    expect(buscarPendentePorAgendamentoMock).toHaveBeenCalledWith('ag-1', trxObj);
    expect(buscarDadosServicoDoAgendamentoMock).toHaveBeenCalledWith('ag-1', trxObj);
    expect(criarPagamentoPresencialMock).toHaveBeenCalledTimes(1);
    expect(criarPagamentoPresencialMock).toHaveBeenCalledWith(
      { agendamentoId: 'ag-1', valorCentavos: 4500, registradoPorUsuarioId: 'user-recep' },
      trxObj,
    );
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'concluido', trxObj);
    expect(transacaoCommitada).toBe(true);
  });

  it('recepção conclui SEM a flag: nenhuma linha de pagamento e resposta sem pagamentoStatus (comportamento atual preservado)', async () => {
    const resultado = await concluirAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(resultado.status).toBe('concluido');
    expect(resultado.pagamentoStatus).toBeUndefined();
    expect(criarPagamentoPresencialMock).not.toHaveBeenCalled();
    expect(buscarPendentePorAgendamentoMock).not.toHaveBeenCalled();
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it('flag enviada por ADMIN → 403 ANTES de qualquer consulta/persistência', async () => {
    await expect(
      concluirAgendamento('user-admin', 'admin', 'ag-1', { registrarPagamentoPresencial: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(buscarPorIdMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(criarPagamentoPresencialMock).not.toHaveBeenCalled();
  });

  it('flag enviada por PROFISSIONAL → 403 e nada persistido', async () => {
    await expect(
      concluirAgendamento('user-prof', 'profissional', 'ag-1', { registrarPagamentoPresencial: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(buscarPorIdMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('flag enviada por CLIENTE → 403 e nada persistido', async () => {
    await expect(
      concluirAgendamento('user-cliente', 'cliente', 'ag-1', { registrarPagamentoPresencial: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(buscarPorIdMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('já existe pagamento APROVADO → ValidationError e agendamento NÃO é concluído (rollback total)', async () => {
    buscarPagamentoMaisRecenteMock.mockResolvedValue(pagamentoRowMock({ status: 'aprovado' }));

    await expect(
      concluirAgendamento('user-recep', 'recepcionista', 'ag-1', { registrarPagamentoPresencial: true }),
    ).rejects.toThrow('Pagamento já registrado para este agendamento');

    expect(atualizarStatusMock).not.toHaveBeenCalled();
    expect(criarPagamentoPresencialMock).not.toHaveBeenCalled();
    expect(transacaoCommitada).toBe(false);
  });

  it('existe ordem MP PENDENTE → vira cancelado na MESMA transação do registro presencial', async () => {
    buscarPendentePorAgendamentoMock.mockResolvedValue(
      pagamentoRowMock({ id: 'pag-pend-1', status: 'pendente' }),
    );

    const resultado = await concluirAgendamento('user-recep', 'recepcionista', 'ag-1', {
      registrarPagamentoPresencial: true,
    });

    expect(resultado.pagamentoStatus).toBe('aprovado');
    expect(atualizarStatusPagamentoMock).toHaveBeenCalledWith('pag-pend-1', 'cancelado', { trx: trxObj });
    expect(criarPagamentoPresencialMock).toHaveBeenCalledTimes(1);
    expect(transacaoCommitada).toBe(true);
  });

  it('corrida (23505 do índice de aprovado) → ValidationError amigável, não 500', async () => {
    criarPagamentoPresencialMock.mockRejectedValue({ code: '23505' });

    await expect(
      concluirAgendamento('user-recep', 'recepcionista', 'ag-1', { registrarPagamentoPresencial: true }),
    ).rejects.toThrow('Pagamento já registrado para este agendamento');
    expect(transacaoCommitada).toBe(false);
  });

  it('falha no MEIO da transação → rollback total (nenhuma linha de pagamento, status inalterado)', async () => {
    // O INSERT do pagamento acontece e DEPOIS o hook de comissão falha: o Knex
    // desfaz TUDO (o pagamento presencial também é desfeito) e o agendamento
    // permanece confirmado.
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissaoHook());
    buscarPercentualComissaoMock.mockResolvedValue('40.00');
    criarDespesaComissaoAutomaticaMock.mockRejectedValue(new Error('falha simulada na comissão'));

    await expect(
      concluirAgendamento('user-recep', 'recepcionista', 'ag-1', { registrarPagamentoPresencial: true }),
    ).rejects.toThrow('falha simulada na comissão');

    expect(criarPagamentoPresencialMock).toHaveBeenCalledTimes(1);
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'concluido', trxObj);
    expect(transacaoCommitada).toBe(false);
  });

  it('comissão: conclusão com pagamento presencial gera a despesa de comissão normalmente', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissaoHook());
    buscarPercentualComissaoMock.mockResolvedValue('40.00');
    criarDespesaComissaoAutomaticaMock.mockResolvedValue(undefined);

    await concluirAgendamento('user-recep', 'recepcionista', 'ag-1', {
      registrarPagamentoPresencial: true,
    });

    expect(criarPagamentoPresencialMock).toHaveBeenCalledTimes(1);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledTimes(1);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledWith(
      {
        descricao: 'Comissão Funcionario Teste',
        valor: '18.00',
        data: agendamentoRow().data,
        funcionarioId: 'func-1',
        agendamentoId: 'ag-1',
      },
      trxObj,
    );
  });

  it('comissão: reverter a conclusão remove a despesa (comportamento atual mantido após presencial)', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'concluido' }));
    removerDespesaComissaoPorAgendamentoMock.mockResolvedValue(undefined);
    removerPendenciaComissaoPorAgendamentoMock.mockResolvedValue(undefined);
    atualizarStatusMock.mockResolvedValue(undefined);

    const resultado = await reverterConclusaoAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(resultado.status).toBe('confirmado');
    expect(removerDespesaComissaoPorAgendamentoMock).toHaveBeenCalledWith('ag-1', trxObj);
    expect(removerPendenciaComissaoPorAgendamentoMock).toHaveBeenCalledWith('ag-1', trxObj);
  });

  it('agendamento inexistente com a flag → 404 (sem tocar em pagamento)', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    await expect(
      concluirAgendamento('user-recep', 'recepcionista', 'ag-x', { registrarPagamentoPresencial: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(criarPagamentoPresencialMock).not.toHaveBeenCalled();
  });
});

describe('confirmarAgendamento / reverterConclusaoAgendamento — hook de comissão', () => {
  beforeEach(() => {
    atualizarStatusMock.mockResolvedValue(undefined);
    removerDespesaComissaoPorAgendamentoMock.mockResolvedValue(undefined);
    removerPendenciaComissaoPorAgendamentoMock.mockResolvedValue(undefined);
  });

  it('confirmar a partir de pendente não gera nem remove comissão', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'pendente' }));

    const resultado = await confirmarAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(resultado.status).toBe('confirmado');
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'confirmado', trxObj);
    expect(buscarConfiguracaoComissaoMock).not.toHaveBeenCalled();
    expect(removerDespesaComissaoPorAgendamentoMock).not.toHaveBeenCalled();
    expect(removerPendenciaComissaoPorAgendamentoMock).not.toHaveBeenCalled();
  });

  it('reverter conclusão remove a despesa de comissão E a pendência de % ausente do agendamento', async () => {
    buscarPorIdMock.mockResolvedValue(agendamentoRow({ status: 'concluido' }));

    const resultado = await reverterConclusaoAgendamento('user-recep', 'recepcionista', 'ag-1');

    expect(resultado.status).toBe('confirmado');
    expect(atualizarStatusMock).toHaveBeenCalledWith('ag-1', 'confirmado', trxObj);
    expect(removerDespesaComissaoPorAgendamentoMock).toHaveBeenCalledWith('ag-1', trxObj);
    expect(removerPendenciaComissaoPorAgendamentoMock).toHaveBeenCalledWith('ag-1', trxObj);
  });
});