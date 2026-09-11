import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';
import {
  criarAgendamento,
  cancelarAgendamento,
} from '../services/agendamento-service';
import type { CreateAgendamentoRequest } from '../dtos/agendamento-dto';
import type { AgendamentoRow } from '../repositories/agendamento-repository';

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
const buscarClientePorUsuarioIdMock = vi.fn();
const buscarFuncionarioPorUsuarioIdMock = vi.fn();
const funcionarioExisteAtivoMock = vi.fn();
const servicoExisteAtivoMock = vi.fn();
const resumirFaturamentoMock = vi.fn();

vi.mock('../repositories/agendamento-repository', () => ({
  criar: (...args: unknown[]) => criarMock(...args),
  buscarPorId: (...args: unknown[]) => buscarPorIdMock(...args),
  listar: (...args: unknown[]) => listarMock(...args),
  atualizarStatus: (...args: unknown[]) => atualizarStatusMock(...args),
  buscarClientePorUsuarioId: (...args: unknown[]) => buscarClientePorUsuarioIdMock(...args),
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) => buscarFuncionarioPorUsuarioIdMock(...args),
  funcionarioExisteAtivo: (...args: unknown[]) => funcionarioExisteAtivoMock(...args),
  servicoExisteAtivo: (...args: unknown[]) => servicoExisteAtivoMock(...args),
  resumirFaturamento: (...args: unknown[]) => resumirFaturamentoMock(...args),
}));

// cliente-repository: buscarClientePorId usado no fluxo staff.
const buscarClientePorIdMock = vi.fn();

vi.mock('../repositories/cliente-repository', () => ({
  buscarClientePorId: (...args: unknown[]) => buscarClientePorIdMock(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: gates de existência liberados e matriz default aplicada
  // (nenhum override registrado → permissão avaliada pelo papel).
  funcionarioExisteAtivoMock.mockResolvedValue(true);
  servicoExisteAtivoMock.mockResolvedValue(true);
  listarPermissoesPorUsuariosMock.mockResolvedValue([]);
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