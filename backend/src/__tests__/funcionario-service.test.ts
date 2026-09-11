import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';
import type { FuncionarioCompletoDTO } from '../dtos/funcionario-dto';

// ── Mocks (hoisted) ────────────────────────────────────────────

const criarRepoMock = vi.fn();
const atualizarRepoMock = vi.fn();
const buscarPorIdMock = vi.fn();
const trocarStatusMock = vi.fn();

const findUsuarioByEmailMock = vi.fn();
const listarCategoriasAtivasMock = vi.fn();
const incrementarTokenVersionMock = vi.fn(async () => {});
const exigirPermissaoMock = vi.fn(async () => {});

vi.mock('../repositories/funcionario-repository', () => ({
  criar: (...args: unknown[]) => criarRepoMock(...args),
  atualizar: (...args: unknown[]) => atualizarRepoMock(...args),
  buscarPorId: (...args: unknown[]) => buscarPorIdMock(...args),
  trocarStatus: (...args: unknown[]) => trocarStatusMock(...args),
  listarPublicos: vi.fn(),
  listarTodos: vi.fn(),
  buscarPorEmail: vi.fn(),
}));

vi.mock('../repositories/auth-repository', () => ({
  findUsuarioByEmail: (...args: unknown[]) => findUsuarioByEmailMock(...args),
  incrementarTokenVersion: (...args: unknown[]) => incrementarTokenVersionMock(...args),
}));

vi.mock('../services/permissao-service', () => ({
  exigirPermissao: (...args: unknown[]) => exigirPermissaoMock(...args),
}));

vi.mock('../services/categoria-service', () => ({
  listarCategoriasAtivas: (...args: unknown[]) => listarCategoriasAtivasMock(...args),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(async () => true),
    hash: vi.fn(async (senha: string) => `hash:${senha}`),
  },
}));

const { criarFuncionario, atualizarFuncionario, alternarStatusFuncionario } = await import(
  '../services/funcionario-service'
);

// ── Dados de teste ──────────────────────────────────────────────

const BASE_ALVO: FuncionarioCompletoDTO = {
  id: 'f1',
  usuarioId: 'u1',
  nome: 'Barbeiro A',
  telefone: null,
  cargo: 'barbeiro',
  especialidade: null,
  foto: null,
  descricao: null,
  ativo: true,
  email: 'barbeiro@email.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  categorias: [],
};

function alvoCargo(cargo: string, id = 'f1', usuarioId = 'u1'): FuncionarioCompletoDTO {
  return { ...BASE_ALVO, id, usuarioId, cargo };
}

const FUNCIONARIO_BARBEIRO = alvoCargo('barbeiro', 'func-b1', 'u-b1');
const FUNCIONARIO_ADMIN = alvoCargo('administrador', 'func-a1', 'u-a1');
const FUNCIONARIO_RECEPCIONISTA = alvoCargo('recepcionista', 'func-r1', 'u-r1');

const CATEGORIAS_ATIVAS = [
  { id: 'cat-1', nome: 'Corte' },
  { id: 'cat-2', nome: 'Barba' },
];

// ── Helpers ─────────────────────────────────────────────────────

function resetAll(): void {
  criarRepoMock.mockReset();
  atualizarRepoMock.mockReset();
  buscarPorIdMock.mockReset();
  trocarStatusMock.mockReset();
  findUsuarioByEmailMock.mockReset();
  listarCategoriasAtivasMock.mockReset();
  incrementarTokenVersionMock.mockReset();
  exigirPermissaoMock.mockReset();
}

function seedRepoBasico(): void {
  buscarPorIdMock.mockImplementation(async (id: string) => {
    if (id === 'func-a1') return FUNCIONARIO_ADMIN;
    if (id === 'func-b1') return FUNCIONARIO_BARBEIRO;
    if (id === 'func-r1') return FUNCIONARIO_RECEPCIONISTA;
    return null;
  });
  findUsuarioByEmailMock.mockResolvedValue(null);
}

// ── Testes: criarFuncionario (RBAC) ───────────────────────────

describe('criarFuncionario (RBAC)', () => {
  beforeEach(() => {
    resetAll();
    seedRepoBasico();
    criarRepoMock.mockResolvedValue({
      id: 'func-novo',
      usuarioId: 'u-novo',
      nome: 'Novo',
      email: 'novo@email.com',
      telefone: null,
      cargo: 'barbeiro',
      especialidade: null,
      categorias: [],
    });
  });

  it('recepcionista cria barbeiro ok (repassa categorias)', async () => {
    listarCategoriasAtivasMock.mockResolvedValue(CATEGORIAS_ATIVAS);

    const resultado = await criarFuncionario(
      { nome: 'Novo', email: 'novo@email.com', categorias: ['Corte'] },
      'u-recep',
      'recepcionista',
    );

    expect(resultado.id).toBe('func-novo');
    expect(criarRepoMock).toHaveBeenCalledTimes(1);
    expect(criarRepoMock).toHaveBeenCalledWith(
      expect.objectContaining({ categorias: ['Corte'] }),
    );
  });

  it('recepcionista create cargo administrador → 403', async () => {
    await expect(
      criarFuncionario(
        { nome: 'Admin', email: 'a@email.com', cargo: 'administrador' },
        'u-recep',
        'recepcionista',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista create cargo recepcionista → 403', async () => {
    await expect(
      criarFuncionario(
        { nome: 'Recep', email: 'r@email.com', cargo: 'recepcionista' },
        'u-recep',
        'recepcionista',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('admin cria administrador ok', async () => {
    criarRepoMock.mockResolvedValueOnce({
      id: 'func-novo',
      usuarioId: 'u-novo',
      nome: 'Admin Novo',
      email: 'anovo@email.com',
      telefone: null,
      cargo: 'administrador',
      especialidade: null,
      categorias: [],
    });

    const resultado = await criarFuncionario(
      { nome: 'Admin Novo', email: 'anovo@email.com', cargo: 'administrador' },
      'u-admin',
      'admin',
    );

    expect(resultado.cargo).toBe('administrador');
    expect(criarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('admin sem permissão criar_admin → 403 (gate granular Item 1)', async () => {
    exigirPermissaoMock.mockRejectedValue(new ForbiddenError('Acesso negado'));

    await expect(
      criarFuncionario(
        { nome: 'Admin Novo', email: 'anovo@email.com', cargo: 'administrador' },
        'u-admin',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('cargo ≠ barbeiro com categorias não vazias → 400', async () => {
    await expect(
      criarFuncionario(
        { nome: 'Recep', email: 'r@email.com', cargo: 'recepcionista', categorias: ['Corte'] },
        'u-admin',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('categoria inválida/inativa → 400', async () => {
    listarCategoriasAtivasMock.mockResolvedValue(CATEGORIAS_ATIVAS);

    await expect(
      criarFuncionario(
        { nome: 'Novo', email: 'novo@email.com', categorias: ['Inexistente'] },
        'u-admin',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('categorias: [] com cargo ≠ barbeiro permite (sem erro)', async () => {
    criarRepoMock.mockResolvedValueOnce({
      id: 'func-novo',
      usuarioId: 'u-novo',
      nome: 'Recep',
      email: 'recep@email.com',
      telefone: null,
      cargo: 'recepcionista',
      especialidade: null,
      categorias: [],
    });

    const resultado = await criarFuncionario(
      { nome: 'Recep', email: 'recep@email.com', cargo: 'recepcionista', categorias: [] },
      'u-admin',
      'admin',
    );

    expect(resultado.id).toBe('func-novo');
    expect(criarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('role fora de admin/recep no create → 403 (negar por padrão)', async () => {
    await expect(
      criarFuncionario(
        { nome: 'X', email: 'x@email.com' },
        'u-barb',
        'profissional',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });
});

// ── Testes: atualizarFuncionario (RBAC) ───────────────────────

describe('atualizarFuncionario — regra hierárquica de edição', () => {
  beforeEach(() => {
    resetAll();
    seedRepoBasico();
    atualizarRepoMock.mockResolvedValue(FUNCIONARIO_BARBEIRO);
  });

  it('admin edita outro administrador → sucesso', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));
    atualizarRepoMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));

    const resultado = await atualizarFuncionario(
      'f2',
      { nome: 'Admin Editado' },
      'u1',
      'admin',
    );

    expect(resultado.cargo).toBe('administrador');
    expect(atualizarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('admin tentando editar o próprio cadastro → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f1', 'u1'));

    await expect(
      atualizarFuncionario('f1', { nome: 'Eu' }, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista atualiza barbeiro ok', async () => {
    const resultado = await atualizarFuncionario(
      'func-b1',
      { nome: 'Barbeiro Atualizado' },
      'u-recep',
      'recepcionista',
    );

    expect(resultado.id).toBe('func-b1');
    expect(atualizarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('recepcionista update sobre existente cargo administrador → 403', async () => {
    await expect(
      atualizarFuncionario(
        'func-a1',
        { nome: 'Tentativa' },
        'u-recep',
        'recepcionista',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista update sobre existente cargo recepcionista → 403', async () => {
    await expect(
      atualizarFuncionario(
        'func-r1',
        { nome: 'Tentativa' },
        'u-recep',
        'recepcionista',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista tentando mudar cargo de barbeiro para outro → 403', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('barbeiro'));

    await expect(
      atualizarFuncionario(
        'f1',
        { cargo: 'recepcionista' },
        'u-recep',
        'recepcionista',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista atualiza barbeiro com categorias válidas → repassa categorias', async () => {
    listarCategoriasAtivasMock.mockResolvedValue(CATEGORIAS_ATIVAS);

    await atualizarFuncionario(
      'func-b1',
      { nome: 'Barbeiro Um', categorias: ['Corte'] },
      'u-recep',
      'recepcionista',
    );

    expect(atualizarRepoMock).toHaveBeenCalledWith(
      'func-b1',
      expect.objectContaining({ categorias: ['Corte'] }),
    );
  });

  it('atualização com cargo ≠ barbeiro e categorias não vazias → 400', async () => {
    await expect(
      atualizarFuncionario(
        'func-a1',
        { nome: 'Admin', categorias: ['Corte'] },
        'u-admin',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('atualização com categoria inválida/inativa → 400', async () => {
    listarCategoriasAtivasMock.mockResolvedValue(CATEGORIAS_ATIVAS);

    await expect(
      atualizarFuncionario(
        'func-b1',
        { nome: 'Barbeiro Um', categorias: ['Inexistente'] },
        'u-admin',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('role fora de admin/recepcionista no update → 403 (negar por padrão)', async () => {
    await expect(
      atualizarFuncionario(
        'func-b1',
        { nome: 'X' },
        'u-barb',
        'profissional',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('alvo inexistente → NotFoundError antes de qualquer atualização', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    await expect(
      atualizarFuncionario('f-x', { nome: 'X' }, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });
});

// ── Testes: alternarStatusFuncionario (RBAC) ──────────────────

describe('alternarStatusFuncionario — regra hierárquica de status', () => {
  beforeEach(() => {
    resetAll();
    seedRepoBasico();
    trocarStatusMock.mockResolvedValue(true);
  });

  it('admin aplica em outro admin → sucesso', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));

    const resultado = await alternarStatusFuncionario('f2', false, 'u1', 'admin');

    expect(resultado).toBe(true);
    expect(trocarStatusMock).toHaveBeenCalledWith('f2', false);
  });

  it('ninguém pode alterar o próprio status → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('barbeiro', 'f1', 'u1'));

    await expect(
      alternarStatusFuncionario('f1', false, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('recepcionista alternar sobre existente barbeiro → ok', async () => {
    const resultado = await alternarStatusFuncionario('func-b1', false, 'u-recep', 'recepcionista');

    expect(resultado).toBe(true);
    expect(trocarStatusMock).toHaveBeenCalledTimes(1);
    expect(trocarStatusMock).toHaveBeenCalledWith('func-b1', false);
  });

  it('recepcionista alternar sobre existente administrador → 403', async () => {
    await expect(
      alternarStatusFuncionario('func-a1', false, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('recepcionista alternar sobre existente recepcionista → 403', async () => {
    await expect(
      alternarStatusFuncionario('func-r1', false, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('admin alterna status de qualquer cargo → ok', async () => {
    const resultado = await alternarStatusFuncionario('func-a1', false, 'u-admin', 'admin');

    expect(resultado).toBe(true);
    expect(trocarStatusMock).toHaveBeenCalledTimes(1);
    expect(trocarStatusMock).toHaveBeenCalledWith('func-a1', false);
  });

  it('alternar status sem permissão excluir_desativar_funcionario → 403 (gate granular Item 1)', async () => {
    exigirPermissaoMock.mockRejectedValue(new ForbiddenError('Acesso negado'));

    await expect(
      alternarStatusFuncionario('func-b1', false, 'u-admin', 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('funcionário inexistente → 404', async () => {
    await expect(
      alternarStatusFuncionario('func-x', false, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('role fora de admin/recepcionista no alternar → 403 (negar por padrão)', async () => {
    await expect(
      alternarStatusFuncionario('func-b1', false, 'u-barb', 'profissional'),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusMock).not.toHaveBeenCalled();
  });
});