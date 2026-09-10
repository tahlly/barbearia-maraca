import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import {
  temPermissao,
  exigirPermissao,
  atualizarPermissao,
  obterDetentoresEfetivos,
  listarUsuariosComPermissoes,
  obterPermissoesEfetivasUsuario,
} from '../services/permissao-service';

// ── Mocks ─────────────────────────────────────────────────────

const listarCatalogoPermissoesMock = vi.fn();
const listarPermissoesPorUsuariosMock = vi.fn();
const aplicarAlteracaoPermissaoMock = vi.fn();
const listarUsuariosInternosMock = vi.fn();
const listarIdsAdminsMock = vi.fn();
const listarIdsComPermissaoEfetivaMock = vi.fn();
const buscarFuncionarioPorUsuarioIdMock = vi.fn();

// Espelha o mapeamento real de cargo → role usado pelo serviço.
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
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) => buscarFuncionarioPorUsuarioIdMock(...args),
}));

vi.mock('../services/auth-service', () => ({
  mapearTipoParaRole: (...args: unknown[]) => mapearTipoParaRoleMock(...args),
}));

const CHAVES = [
  'ver_financeiro',
  'excluir_desativar_funcionario',
  'criar_admin',
  'gerenciar_permissoes',
  'editar_servicos_categorias',
  'agendar_para_cliente',
];

beforeEach(() => {
  vi.clearAllMocks();
});

function usuario(id: string, role: string) {
  return { id, role };
}

// ── Matriz default ─────────────────────────────────────────────

describe('temPermissao — matriz default por papel', () => {
  it('admin possui todas as 6 permissões quando não há override', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    for (const chave of CHAVES) {
      await expect(temPermissao(usuario('u1', 'admin'), chave)).resolves.toBe(true);
    }
  });

  it('recepcionista: excluir_desativar_funcionario, editar_servicos_categorias e agendar_para_cliente true; demais false', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    expect(await temPermissao(usuario('u2', 'recepcionista'), 'excluir_desativar_funcionario')).toBe(true);
    expect(await temPermissao(usuario('u2', 'recepcionista'), 'editar_servicos_categorias')).toBe(true);
    expect(await temPermissao(usuario('u2', 'recepcionista'), 'agendar_para_cliente')).toBe(true);
    expect(await temPermissao(usuario('u2', 'recepcionista'), 'ver_financeiro')).toBe(false);
    expect(await temPermissao(usuario('u2', 'recepcionista'), 'criar_admin')).toBe(false);
    expect(await temPermissao(usuario('u2', 'recepcionista'), 'gerenciar_permissoes')).toBe(false);
  });

  it('profissional: apenas agendar_para_cliente true; demais false', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    expect(await temPermissao(usuario('u3', 'profissional'), 'agendar_para_cliente')).toBe(true);
    for (const chave of CHAVES) {
      if (chave !== 'agendar_para_cliente') {
        expect(await temPermissao(usuario('u3', 'profissional'), chave)).toBe(false);
      }
    }
  });

  it('cliente: todas as 6 false', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    for (const chave of CHAVES) {
      expect(await temPermissao(usuario('u3', 'cliente'), chave)).toBe(false);
    }
  });

  it('override no banco tem precedência sobre a matriz (admin sem ver_financeiro)', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([
      { usuario_id: 'u1', permissao: 'ver_financeiro', concedida: false, criado_por: null, criado_em: '' },
    ]);

    expect(await temPermissao(usuario('u1', 'admin'), 'ver_financeiro')).toBe(false);
    expect(await temPermissao(usuario('u1', 'admin'), 'gerenciar_permissoes')).toBe(true);
  });

  it('usuário ausente/indefinido → false', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    expect(await temPermissao(undefined, 'ver_financeiro')).toBe(false);
    expect(await temPermissao({ id: 'u4', role: '' }, 'ver_financeiro')).toBe(false);
  });
});

describe('exigirPermissao', () => {
  it('resolve quando o usuário possui a permissão', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    await expect(exigirPermissao(usuario('u1', 'admin'), 'gerenciar_permissoes')).resolves.toBeUndefined();
  });

  it('lança ForbiddenError quando não possui', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    await expect(exigirPermissao(usuario('u2', 'recepcionista'), 'gerenciar_permissoes')).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(exigirPermissao(undefined, 'gerenciar_permissoes')).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ── Gestão ─────────────────────────────────────────────────────

describe('atualizarPermissao — regras invariantes', () => {
  it('permissão desconhecida → ValidationError', async () => {
    await expect(
      atualizarPermissao(usuario('u1', 'admin'), 'u2', 'chave_inexistente', true),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(aplicarAlteracaoPermissaoMock).not.toHaveBeenCalled();
  });

  it('ator não pode alterar as próprias permissões', async () => {
    await expect(
      atualizarPermissao(usuario('u1', 'admin'), 'u1', 'ver_financeiro', false),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(aplicarAlteracaoPermissaoMock).not.toHaveBeenCalled();
  });

  it('alvo inexistente → NotFoundError', async () => {
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue(null);

    await expect(
      atualizarPermissao(usuario('u1', 'admin'), 'u-x', 'ver_financeiro', true),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(aplicarAlteracaoPermissaoMock).not.toHaveBeenCalled();
  });

  it('não permite revogar a última permissão de gerenciamento', async () => {
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({ usuario_id: 'u2', nome: 'Recep', cargo: 'recepcionista' });
    listarIdsAdminsMock.mockResolvedValue([]);
    listarIdsComPermissaoEfetivaMock.mockResolvedValue(['u2']);

    await expect(
      atualizarPermissao(usuario('u1', 'admin'), 'u2', 'gerenciar_permissoes', false),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(aplicarAlteracaoPermissaoMock).not.toHaveBeenCalled();
  });

  it('concede permissão com auditoria GRANT', async () => {
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({ usuario_id: 'u2', nome: 'Recep', cargo: 'recepcionista' });

    await atualizarPermissao(usuario('u1', 'admin'), 'u2', 'editar_servicos_categorias', true);

    expect(aplicarAlteracaoPermissaoMock).toHaveBeenCalledWith({
      usuarioId: 'u2',
      permissao: 'editar_servicos_categorias',
      concedida: true,
      criadoPor: 'u1',
      acao: 'GRANT',
    });
  });

  it('revoga permissão com auditoria REVOKE quando há outro detentor efetivo', async () => {
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue({ usuario_id: 'u2', nome: 'Recep', cargo: 'recepcionista' });
    listarIdsAdminsMock.mockResolvedValue(['u1']);
    listarIdsComPermissaoEfetivaMock.mockResolvedValue(['u2']);

    await atualizarPermissao(usuario('u1', 'admin'), 'u2', 'gerenciar_permissoes', false);

    expect(aplicarAlteracaoPermissaoMock).toHaveBeenCalledWith({
      usuarioId: 'u2',
      permissao: 'gerenciar_permissoes',
      concedida: false,
      criadoPor: 'u1',
      acao: 'REVOKE',
    });
  });
});

describe('obterDetentoresEfetivos', () => {
  it('une admins e concessões explícitas sem duplicar', async () => {
    listarIdsAdminsMock.mockResolvedValue(['u1', 'u2']);
    listarIdsComPermissaoEfetivaMock.mockResolvedValue(['u2', 'u3']);

    const detentores = await obterDetentoresEfetivos('gerenciar_permissoes');

    expect(detentores).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('listarUsuariosComPermissoes — permissões efetivas', () => {
  it('combina matriz do cargo com overrides', async () => {
    listarUsuariosInternosMock.mockResolvedValue([
      { usuario_id: 'u1', email: 'a@email.com', nome: 'Admin', cargo: 'administrador' },
      { usuario_id: 'u2', email: 'r@email.com', nome: 'Recep', cargo: 'recepcionista' },
    ]);
    listarPermissoesPorUsuariosMock.mockResolvedValue([
      { usuario_id: 'u2', permissao: 'ver_financeiro', concedida: true, criado_por: null, criado_em: '' },
    ]);

    const resultado = await listarUsuariosComPermissoes();

    expect(resultado).toHaveLength(2);
    const admin = resultado.find((item) => item.usuarioId === 'u1');
    const recep = resultado.find((item) => item.usuarioId === 'u2');

    expect(admin?.permissoes['ver_financeiro']).toBe(true);
    expect(admin?.permissoes['gerenciar_permissoes']).toBe(true);
    expect(admin?.permissoes['agendar_para_cliente']).toBe(true);
    // Override concedido à recepcionista vence a matriz default (false).
    expect(recep?.permissoes['ver_financeiro']).toBe(true);
    expect(recep?.permissoes['editar_servicos_categorias']).toBe(true);
    expect(recep?.permissoes['agendar_para_cliente']).toBe(true);
    expect(recep?.permissoes['criar_admin']).toBe(false);
    expect(recep?.permissoes['gerenciar_permissoes']).toBe(false);
  });
});

describe('obterPermissoesEfetivasUsuario — permissões do usuário logado', () => {
  it('aplica a matriz default quando não há override (recepcionista)', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    const permissoes = await obterPermissoesEfetivasUsuario(usuario('u1', 'recepcionista'));

    expect(permissoes['editar_servicos_categorias']).toBe(true);
    expect(permissoes['excluir_desativar_funcionario']).toBe(true);
    expect(permissoes['agendar_para_cliente']).toBe(true);
    expect(permissoes['ver_financeiro']).toBe(false);
    expect(permissoes['gerenciar_permissoes']).toBe(false);
  });

  it('override no banco vence a matriz', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([
      { usuario_id: 'u1', permissao: 'ver_financeiro', concedida: true },
    ]);

    const permissoes = await obterPermissoesEfetivasUsuario(usuario('u1', 'recepcionista'));

    expect(permissoes['ver_financeiro']).toBe(true);
    expect(permissoes['editar_servicos_categorias']).toBe(true);
  });

  it('papel desconhecido cai na matriz de cliente (tudo negado)', async () => {
    listarPermissoesPorUsuariosMock.mockResolvedValue([]);

    const permissoes = await obterPermissoesEfetivasUsuario(usuario('u1', 'desconhecido'));

    expect(permissoes['ver_financeiro']).toBe(false);
    expect(permissoes['editar_servicos_categorias']).toBe(false);
  });
});