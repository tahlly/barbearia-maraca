import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  SENHA_REGEX,
  MENSAGEM_SENHA_FRACA,
  MENSAGEM_SENHA_MUITO_LONGA,
  senhaForteSchema,
  senhaForteOpcionalSchema,
  senhaForteFuncionarioOpcionalSchema,
} from '../utils/senha';
import { ValidationError } from '../errors/ValidationError';
import { criarClienteHandler } from '../controllers/cliente-controller';
import {
  registrarUsuario,
  atualizarPerfilHandler,
  resetPasswordHandler,
} from '../controllers/auth-controller';
import { criar as criarFuncionarioHandler, atualizar as atualizarFuncionarioHandler } from '../controllers/funcionario-controller';
import { criarClienteNovo } from '../services/cliente-service';
import {
  registrar as registrarService,
  atualizarPerfil as atualizarPerfilService,
  redefinirSenha as redefinirSenhaService,
} from '../services/auth-service';
import * as funcionarioService from '../services/funcionario-service';

vi.mock('../services/cliente-service', () => ({
  listarClientesService: vi.fn(),
  obterClienteParaUsuario: vi.fn(),
  buscarClientePorEmailService: vi.fn(),
  criarClienteNovo: vi.fn(),
  atualizarClienteParaUsuario: vi.fn(),
}));

vi.mock('../services/auth-service', () => ({
  autenticarComGoogle: vi.fn(),
  registrar: vi.fn(),
  login: vi.fn(),
  atualizarPerfil: vi.fn(),
  solicitarRecuperacaoSenha: vi.fn(),
  redefinirSenha: vi.fn(),
}));

vi.mock('../services/funcionario-service', () => ({
  listarFuncionariosPublicos: vi.fn(),
  listarFuncionarios: vi.fn(),
  buscarFuncionarioPorId: vi.fn(),
  buscarFuncionarioPorEmail: vi.fn(),
  criarFuncionario: vi.fn(),
  atualizarFuncionario: vi.fn(),
  alternarStatusFuncionario: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

interface FakeRes {
  statusCode: number;
  body: unknown;
  status(code: number): FakeRes;
  json(payload: unknown): FakeRes;
}

function criarFakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      // Emula o Express: res.json() sem status explícito responde 200.
      if (this.statusCode === 0) {
        this.statusCode = 200;
      }
      this.body = payload;
      return this;
    },
  };
  return res;
}

const SENHA_FORTE = 'SenhaForte!123';
const SENHA_FRACA = 'senha123';

// ── Testes da política ─────────────────────────────────────────

describe('SENHA_REGEX — política de senha forte (issue #55)', () => {
  it('aceita senha forte (8+, maiúscula e especial)', () => {
    expect(SENHA_REGEX.test(SENHA_FORTE)).toBe(true);
  });

  it('aceita exatamente 8 caracteres com complexidade', () => {
    expect(SENHA_REGEX.test('Abcdefg!')).toBe(true);
  });

  it('aceita senha sem números (maiúscula + especial bastam)', () => {
    expect(SENHA_REGEX.test('Password!')).toBe(true);
  });

  it('aceita letra maiúscula acentuada como maiúscula', () => {
    expect(SENHA_REGEX.test('SENHÀFORTE!123')).toBe(true);
  });

  it('rejeita letra minúscula acentuada como maiúscula', () => {
    expect(SENHA_REGEX.test('senhàforte!123')).toBe(false);
  });

  it('rejeita senha sem maiúscula', () => {
    expect(SENHA_REGEX.test('senha!123')).toBe(false);
  });

  it('rejeita senha sem caractere especial', () => {
    expect(SENHA_REGEX.test('Senha1234')).toBe(false);
  });

  it('rejeita senha curta (7 caracteres)', () => {
    expect(SENHA_REGEX.test('Ab!123')).toBe(false);
  });

  it('rejeita senha de 8+ caracteres sem complexidade (tipo seed)', () => {
    expect(SENHA_REGEX.test(SENHA_FRACA)).toBe(false);
  });
});

describe('schemas compartilhados (utils/senha)', () => {
  it('senhaForteSchema aceita senha forte e rejeita fraca com a mensagem padrão', () => {
    expect(senhaForteSchema.parse(SENHA_FORTE)).toBe(SENHA_FORTE);

    const resultado = senhaForteSchema.safeParse(SENHA_FRACA);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(MENSAGEM_SENHA_FRACA);
    }
  });

  it('senhaForteOpcionalSchema aceita ausência e valida quando presente', () => {
    expect(senhaForteOpcionalSchema.parse(undefined)).toBeUndefined();
    expect(senhaForteOpcionalSchema.parse(SENHA_FORTE)).toBe(SENHA_FORTE);
    expect(senhaForteOpcionalSchema.safeParse(SENHA_FRACA).success).toBe(false);
  });

  it('senhaForteSchema rejeita senha com mais de 64 caracteres', () => {
    const longa = `S${'enhaForte!1'.repeat(7)}`;
    expect(longa.length).toBeGreaterThan(64);
    const resultado = senhaForteSchema.safeParse(longa);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(MENSAGEM_SENHA_MUITO_LONGA);
    }
  });

  it('senhaForteOpcionalSchema rejeita senha com mais de 64 caracteres', () => {
    const longa = `S${'enhaForte!1'.repeat(7)}`;
    expect(longa.length).toBeGreaterThan(64);
    const resultado = senhaForteOpcionalSchema.safeParse(longa);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(MENSAGEM_SENHA_MUITO_LONGA);
    }
  });

  it('senhaForteFuncionarioOpcionalSchema aceita ausência (senha padrão no service)', () => {
    expect(senhaForteFuncionarioOpcionalSchema.parse(undefined)).toBeUndefined();
    expect(senhaForteFuncionarioOpcionalSchema.safeParse(SENHA_FORTE).success).toBe(true);
    expect(senhaForteFuncionarioOpcionalSchema.safeParse(SENHA_FRACA).success).toBe(false);
  });

  it('senhaForteFuncionarioOpcionalSchema rejeita senha com mais de 64 caracteres', () => {
    const longa = `S${'enhaForte!1'.repeat(7)}`;
    expect(longa.length).toBeGreaterThan(64);
    const resultado = senhaForteFuncionarioOpcionalSchema.safeParse(longa);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(MENSAGEM_SENHA_MUITO_LONGA);
    }
  });
});

// ── Testes dos fluxos (senha fraca → erro 400; senha forte → sucesso) ──

describe('POST /api/auth/register — registrarUsuario', () => {
  beforeEach(() => {
    vi.mocked(registrarService).mockReset();
  });

  it('rejeita senha fraca com 400 e não chama o service', async () => {
    const res = criarFakeRes();
    await registrarUsuario(
      { body: { email: 'cliente@email.com', senha: SENHA_FRACA, nome: 'Cliente Teste' } } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(400);
    expect((res.body as { mensagem: string }).mensagem).toBe(MENSAGEM_SENHA_FRACA);
    expect(registrarService).not.toHaveBeenCalled();
  });

  it('aceita senha forte e chama o service com sucesso', async () => {
    vi.mocked(registrarService).mockResolvedValue({
      token: 'token-de-teste',
      user: { id: 'u1', email: 'cliente@email.com', nome: 'Cliente Teste', tipo: 'cliente' },
    });
    const res = criarFakeRes();
    await registrarUsuario(
      { body: { email: 'cliente@email.com', senha: SENHA_FORTE, nome: 'Cliente Teste', telefone: '(11) 99999-9999' } } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(201);
    expect(registrarService).toHaveBeenCalledWith({
      email: 'cliente@email.com',
      senha: SENHA_FORTE,
      nome: 'Cliente Teste',
      telefone: '(11) 99999-9999',
    });
  });
});

describe('POST /api/clientes — criarClienteHandler', () => {
  beforeEach(() => {
    vi.mocked(criarClienteNovo).mockReset();
  });

  it('rejeita senha fraca com erro de validação (→ 400) e não chama o service', async () => {
    const res = criarFakeRes();
    const promise = criarClienteHandler(
      { body: { nome: 'Cliente Teste', email: 'cliente@email.com', senha: SENHA_FRACA } } as unknown as Request,
      res as unknown as Response,
    );

    await expect(promise).rejects.toBeInstanceOf(ZodError);
    await promise.catch((error: unknown) => {
      expect((error as ZodError).issues[0]?.message).toBe(MENSAGEM_SENHA_FRACA);
    });
    expect(criarClienteNovo).not.toHaveBeenCalled();
  });

  it('aceita senha forte e retorna 201', async () => {
    const dto = { id: 'c1', nome: 'Cliente Teste', email: 'cliente@email.com', telefone: '11999999999' };
    vi.mocked(criarClienteNovo).mockResolvedValue(dto);
    const res = criarFakeRes();
    await criarClienteHandler(
      { body: { nome: 'Cliente Teste', email: 'cliente@email.com', senha: SENHA_FORTE } } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(dto);
    expect(criarClienteNovo).toHaveBeenCalledWith(
      expect.objectContaining({ senha: SENHA_FORTE }),
    );
  });
});

describe('POST /api/auth/reset-password — resetPasswordHandler', () => {
  beforeEach(() => {
    vi.mocked(redefinirSenhaService).mockReset();
  });

  it('rejeita senha fraca com erro de validação (→ 400) sem revelar detalhes do token', async () => {
    const promise = resetPasswordHandler(
      { body: { token: 'token-valido-em-formato', novaSenha: SENHA_FRACA } } as unknown as Request,
      criarFakeRes() as unknown as Response,
    );

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await promise.catch((error: unknown) => {
      expect((error as ValidationError).status).toBe(400);
      expect((error as ValidationError).message).toBe(MENSAGEM_SENHA_FRACA);
    });
    expect(redefinirSenhaService).not.toHaveBeenCalled();
  });

  it('aceita senha forte e redefine com sucesso', async () => {
    vi.mocked(redefinirSenhaService).mockResolvedValue(undefined);
    const res = criarFakeRes();
    await resetPasswordHandler(
      { body: { token: 'token-valido-em-formato', novaSenha: SENHA_FORTE } } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(200);
    expect(redefinirSenhaService).toHaveBeenCalledWith('token-valido-em-formato', SENHA_FORTE);
  });
});

describe('PATCH /api/auth/me — atualizarPerfilHandler (nova senha)', () => {
  beforeEach(() => {
    vi.mocked(atualizarPerfilService).mockReset();
  });

  it('rejeita senha fraca com erro de validação (→ 400) e não chama o service', async () => {
    const promise = atualizarPerfilHandler(
      {
        body: { novaSenha: SENHA_FRACA },
        user: { id: 'u1', role: 'cliente' },
      } as unknown as Request,
      criarFakeRes() as unknown as Response,
    );

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await promise.catch((error: unknown) => {
      expect((error as ValidationError).status).toBe(400);
      expect((error as ValidationError).message).toBe(MENSAGEM_SENHA_FRACA);
    });
    expect(atualizarPerfilService).not.toHaveBeenCalled();
  });

  it('aceita nova senha forte e atualiza o perfil', async () => {
    vi.mocked(atualizarPerfilService).mockResolvedValue({
      id: 'u1',
      email: 'cliente@email.com',
      nome: 'Cliente Teste',
      tipo: 'cliente',
    });
    const res = criarFakeRes();
    await atualizarPerfilHandler(
      {
        body: { senhaAtual: 'SenhaAntiga!123', novaSenha: SENHA_FORTE },
        user: { id: 'u1', role: 'cliente' },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.body).toEqual({
      success: true,
      user: { id: 'u1', email: 'cliente@email.com', nome: 'Cliente Teste', tipo: 'cliente' },
    });
    expect(atualizarPerfilService).toHaveBeenCalledWith('u1', {
      senhaAtual: 'SenhaAntiga!123',
      novaSenha: SENHA_FORTE,
    });
  });

  it('primeiro acesso: aceita novaSenha sem senhaAtual e delega ao service', async () => {
    // O service (testado em auth-service.test.ts) não exige senhaAtual quando
    // primeiro_acesso = true. Aqui validamos que o controller repassa o payload
    // como recebido, sem exigir senhaAtual.
    const resultadoMock = { id: 'u1', email: 'barbeiro@email.com', nome: 'Barbeiro', tipo: 'funcionario' };
    vi.mocked(atualizarPerfilService).mockResolvedValue(resultadoMock);
    const res = criarFakeRes();
    await atualizarPerfilHandler(
      {
        body: { novaSenha: SENHA_FORTE },
        user: { id: 'u1', role: 'profissional' },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(200);
    expect(atualizarPerfilService).toHaveBeenCalledWith('u1', { novaSenha: SENHA_FORTE });
  });

  it('primeiro acesso: novaSenha acima de 64 caracteres é rejeitada (→ 400)', async () => {
    const longa = `S${'enhaForte!1'.repeat(7)}`;
    const promise = atualizarPerfilHandler(
      {
        body: { novaSenha: longa },
        user: { id: 'u1', role: 'cliente' },
      } as unknown as Request,
      criarFakeRes() as unknown as Response,
    );

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await promise.catch((error: unknown) => {
      expect((error as ValidationError).status).toBe(400);
      expect((error as ValidationError).message).toBe(MENSAGEM_SENHA_MUITO_LONGA);
    });
    expect(atualizarPerfilService).not.toHaveBeenCalled();
  });
});

describe('POST /api/funcionarios — criar funcionário', () => {
  beforeEach(() => {
    vi.mocked(funcionarioService.criarFuncionario).mockReset();
  });

  it('rejeita senha fraca com erro de validação (→ 400) e não chama o service', async () => {
    const promise = criarFuncionarioHandler(
      {
        body: { nome: 'Barbeiro Teste', email: 'barbeiro@email.com', senha: SENHA_FRACA },
        user: { id: 'u-admin', role: 'admin' },
      } as unknown as Request,
      criarFakeRes() as unknown as Response,
    );

    await expect(promise).rejects.toBeInstanceOf(ZodError);
    await promise.catch((error: unknown) => {
      expect((error as ZodError).issues[0]?.message).toBe(MENSAGEM_SENHA_FRACA);
    });
    expect(funcionarioService.criarFuncionario).not.toHaveBeenCalled();
  });

  it('preserva fluxo sem senha (padrão definido no service)', async () => {
    vi.mocked(funcionarioService.criarFuncionario).mockResolvedValue({
      id: 'f1',
      nome: 'Barbeiro Teste',
      email: 'barbeiro@email.com',
      cargo: 'barbeiro',
      ativo: true,
    });
    const res = criarFakeRes();
    await criarFuncionarioHandler(
      {
        body: { nome: 'Barbeiro Teste', email: 'barbeiro@email.com' },
        user: { id: 'u-admin', role: 'admin' },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(201);
    const chamada = vi.mocked(funcionarioService.criarFuncionario).mock.calls[0]?.[0];
    expect(chamada).toBeDefined();
    expect(chamada?.senha).toBeUndefined();
  });

  it('aceita senha forte e cria com sucesso', async () => {
    vi.mocked(funcionarioService.criarFuncionario).mockResolvedValue({
      id: 'f1',
      nome: 'Barbeiro Teste',
      email: 'barbeiro@email.com',
      cargo: 'barbeiro',
      ativo: true,
    });
    const res = criarFakeRes();
    await criarFuncionarioHandler(
      {
        body: { nome: 'Barbeiro Teste', email: 'barbeiro@email.com', senha: SENHA_FORTE },
        user: { id: 'u-admin', role: 'admin' },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(201);
    expect(funcionarioService.criarFuncionario).toHaveBeenCalledWith(
      expect.objectContaining({ senha: SENHA_FORTE }),
      { id: 'u-admin', role: 'admin' },
    );
  });
});

describe('PUT /api/funcionarios/:id — atualizar funcionário', () => {
  beforeEach(() => {
    vi.mocked(funcionarioService.atualizarFuncionario).mockReset();
  });

  it('rejeita senha fraca com erro de validação (→ 400) e não chama o service', async () => {
    const promise = atualizarFuncionarioHandler(
      { params: { id: 'f1' }, body: { senha: SENHA_FRACA }, user: { id: 'u-admin', role: 'admin' } } as unknown as Request,
      criarFakeRes() as unknown as Response,
    );

    await expect(promise).rejects.toBeInstanceOf(ZodError);
    await promise.catch((error: unknown) => {
      expect((error as ZodError).issues[0]?.message).toBe(MENSAGEM_SENHA_FRACA);
    });
    expect(funcionarioService.atualizarFuncionario).not.toHaveBeenCalled();
  });

  it('aceita senha forte e atualiza com sucesso', async () => {
    vi.mocked(funcionarioService.atualizarFuncionario).mockResolvedValue({
      id: 'f1',
      nome: 'Barbeiro Teste',
      email: 'barbeiro@email.com',
      cargo: 'barbeiro',
      ativo: true,
    });
    const res = criarFakeRes();
    await atualizarFuncionarioHandler(
      { params: { id: 'f1' }, body: { senha: SENHA_FORTE }, user: { id: 'u-admin', role: 'admin' } } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(200);
    expect(funcionarioService.atualizarFuncionario).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({ senha: SENHA_FORTE }),
      { id: 'u-admin', role: 'admin' },
    );
  });
});