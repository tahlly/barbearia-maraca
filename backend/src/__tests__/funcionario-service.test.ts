import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';

// ── Mocks (hoisted) ────────────────────────────────────────────

const criarRepoMock = vi.fn();
const atualizarRepoMock = vi.fn();
const buscarPorIdRepoMock = vi.fn();
const trocarStatusRepoMock = vi.fn();

const findUsuarioByEmailMock = vi.fn();
const listarCategoriasAtivasMock = vi.fn();

vi.mock('../repositories/funcionario-repository', () => ({
  criar: (...args: unknown[]) => criarRepoMock(...args),
  atualizar: (...args: unknown[]) => atualizarRepoMock(...args),
  buscarPorId: (...args: unknown[]) => buscarPorIdRepoMock(...args),
  trocarStatus: (...args: unknown[]) => trocarStatusRepoMock(...args),
  listarPublicos: vi.fn(),
  listarTodos: vi.fn(),
  buscarPorEmail: vi.fn(),
}));

vi.mock('../repositories/auth-repository', () => ({
  findUsuarioByEmail: (...args: unknown[]) => findUsuarioByEmailMock(...args),
}));

vi.mock('../services/categoria-service', () => ({
  listarCategoriasAtivas: (...args: unknown[]) => listarCategoriasAtivasMock(...args),
}));

const { criarFuncionario, atualizarFuncionario, alternarStatusFuncionario } =
  await import('../services/funcionario-service');

// ── Dados de teste ──────────────────────────────────────────────

const FUNCIONARIO_BARBEIRO = {
  id: 'func-b1',
  usuarioId: 'u-b1',
  nome: 'Barbeiro Um',
  telefone: null,
  cargo: 'barbeiro',
  especialidade: null,
  foto: null,
  descricao: null,
  ativo: true,
  email: 'barbeiro@email.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  categorias: [] as string[],
};

const FUNCIONARIO_ADMIN = {
  id: 'func-a1',
  usuarioId: 'u-a1',
  nome: 'Admin Um',
  telefone: null,
  cargo: 'administrador',
  especialidade: null,
  foto: null,
  descricao: null,
  ativo: true,
  email: 'admin@email.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  categorias: [] as string[],
};

const FUNCIONARIO_RECEPCIONISTA = {
  id: 'func-r1',
  usuarioId: 'u-r1',
  nome: 'Recep Uma',
  telefone: null,
  cargo: 'recepcionista',
  especialidade: null,
  foto: null,
  descricao: null,
  ativo: true,
  email: 'recep@email.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  categorias: [] as string[],
};

const CATEGORIAS_ATIVAS = [
  { id: 'cat-1', nome: 'Corte' },
  { id: 'cat-2', nome: 'Barba' },
];

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashfalso'),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────

function resetAll(): void {
  criarRepoMock.mockReset();
  atualizarRepoMock.mockReset();
  buscarPorIdRepoMock.mockReset();
  trocarStatusRepoMock.mockReset();
  findUsuarioByEmailMock.mockReset();
  listarCategoriasAtivasMock.mockReset();
}

function seedRepoBasico(): void {
  buscarPorIdRepoMock.mockImplementation(async (id: string) => {
    if (id === 'func-a1') return FUNCIONARIO_ADMIN;
    if (id === 'func-b1') return FUNCIONARIO_BARBEIRO;
    if (id === 'func-r1') return FUNCIONARIO_RECEPCIONISTA;
    return null;
  });
  findUsuarioByEmailMock.mockResolvedValue(null);
}

// ── Testes ──────────────────────────────────────────────────────

describe('criarFuncionario (RBAC)', () => {
  beforeEach(() => {
    resetAll();
    seedRepoBasico();
    criarRepoMock.mockResolvedValue({
      id: 'func-novo',
      usuarioId: 'u-novo',
      nome: 'Novo',
      email: 'novo@email.com',
      cargo: 'barbeiro',
      categorias: [],
    });
  });

  it('recepcionista cria barbeiro ok (repassa categorias)', async () => {
    listarCategoriasAtivasMock.mockResolvedValue(CATEGORIAS_ATIVAS);

    const resultado = await criarFuncionario(
      { nome: 'Novo', email: 'novo@email.com', categorias: ['Corte'] },
      { id: 'u-recep', role: 'recepcionista' },
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
        { id: 'u-recep', role: 'recepcionista' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista create cargo recepcionista → 403', async () => {
    await expect(
      criarFuncionario(
        { nome: 'Recep', email: 'r@email.com', cargo: 'recepcionista' },
        { id: 'u-recep', role: 'recepcionista' },
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
      cargo: 'administrador',
      categorias: [],
    });

    const resultado = await criarFuncionario(
      { nome: 'Admin Novo', email: 'anovo@email.com', cargo: 'administrador' },
      { id: 'u-admin', role: 'admin' },
    );

    expect(resultado.cargo).toBe('administrador');
    expect(criarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('cargo ≠ barbeiro com categorias não vazias → 400', async () => {
    await expect(
      criarFuncionario(
        { nome: 'Recep', email: 'r@email.com', cargo: 'recepcionista', categorias: ['Corte'] },
        { id: 'u-admin', role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });

  it('categoria inválida/inativa → 400', async () => {
    listarCategoriasAtivasMock.mockResolvedValue(CATEGORIAS_ATIVAS);

    await expect(
      criarFuncionario(
        { nome: 'Novo', email: 'novo@email.com', categorias: ['Inexistente'] },
        { id: 'u-admin', role: 'admin' },
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
      cargo: 'recepcionista',
      categorias: [],
    });

    const resultado = await criarFuncionario(
      { nome: 'Recep', email: 'recep@email.com', cargo: 'recepcionista', categorias: [] },
      { id: 'u-admin', role: 'admin' },
    );

    expect(resultado.id).toBe('func-novo');
    expect(criarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('role fora de admin/recep no create → 403 (negar por padrão)', async () => {
    await expect(
      criarFuncionario(
        { nome: 'X', email: 'x@email.com' },
        { id: 'u-barb', role: 'profissional' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(criarRepoMock).not.toHaveBeenCalled();
  });
});

describe('atualizarFuncionario (RBAC)', () => {
  beforeEach(() => {
    resetAll();
    seedRepoBasico();
    atualizarRepoMock.mockResolvedValue(FUNCIONARIO_BARBEIRO);
  });

  it('recepcionista atualiza barbeiro ok', async () => {
    const resultado = await atualizarFuncionario(
      'func-b1',
      { nome: 'Barbeiro Atualizado' },
      { id: 'u-recep', role: 'recepcionista' },
    );

    expect(resultado.id).toBe('func-b1');
    expect(atualizarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('recepcionista update sobre existente cargo administrador → 403', async () => {
    await expect(
      atualizarFuncionario(
        'func-a1',
        { nome: 'Tentativa' },
        { id: 'u-recep', role: 'recepcionista' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista update sobre existente cargo recepcionista → 403', async () => {
    await expect(
      atualizarFuncionario(
        'func-r1',
        { nome: 'Tentativa' },
        { id: 'u-recep', role: 'recepcionista' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });
});

describe('alternarStatusFuncionario (RBAC)', () => {
  beforeEach(() => {
    resetAll();
    seedRepoBasico();
    trocarStatusRepoMock.mockResolvedValue(true);
  });

  it('recepcionista alternar sobre existente administrador → 403', async () => {
    await expect(
      alternarStatusFuncionario('func-a1', false, { id: 'u-recep', role: 'recepcionista' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista alternar sobre existente recepcionista → 403', async () => {
    await expect(
      alternarStatusFuncionario('func-r1', false, { id: 'u-recep', role: 'recepcionista' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista alternar sobre existente barbeiro → ok', async () => {
    const resultado = await alternarStatusFuncionario('func-b1', false, { id: 'u-recep', role: 'recepcionista' });

    expect(resultado).toBe(true);
    expect(trocarStatusRepoMock).toHaveBeenCalledTimes(1);
    expect(trocarStatusRepoMock).toHaveBeenCalledWith('func-b1', false);
  });

  it('admin alterna status de qualquer cargo → ok', async () => {
    const resultado = await alternarStatusFuncionario('func-a1', false, { id: 'u-admin', role: 'admin' });

    expect(resultado).toBe(true);
    expect(trocarStatusRepoMock).toHaveBeenCalledTimes(1);
    expect(trocarStatusRepoMock).toHaveBeenCalledWith('func-a1', false);
  });

  it('funcionário inexistente → 404 mesmo para recepcionista', async () => {
    await expect(
      alternarStatusFuncionario('func-x', false, { id: 'u-recep', role: 'recepcionista' }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(trocarStatusRepoMock).not.toHaveBeenCalled();
  });

  it('role fora de admin/recepcionista no alternar → 403 (negar por padrão)', async () => {
    await expect(
      alternarStatusFuncionario('func-b1', false, { id: 'u-barb', role: 'profissional' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(trocarStatusRepoMock).not.toHaveBeenCalled();
  });
});
