import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env', () => ({}));

const DEV_SECRET = 'dev-secret-nao-usar-em-producao';
const TEST_SECRET = 'segredo-de-teste-super-seguro-0123456789abcdef';

async function loadJwtConfig() {
  vi.resetModules();
  return import('../config/jwt');
}

describe('config/jwt — JWT_SECRET em produção', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('produção sem JWT_SECRET lança erro na inicialização', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.JWT_SECRET;

    await expect(loadJwtConfig()).rejects.toThrow(
      /JWT_SECRET é obrigatório em produção/,
    );
  });

  it('produção com JWT_SECRET vazio lança erro na inicialização', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');

    await expect(loadJwtConfig()).rejects.toThrow(
      /JWT_SECRET é obrigatório em produção/,
    );
  });

  it('produção com JWT_SECRET igual ao fallback de dev lança erro na inicialização', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', DEV_SECRET);

    await expect(loadJwtConfig()).rejects.toThrow(
      /JWT_SECRET é obrigatório em produção/,
    );
  });

  it('produção com JWT_SECRET válido não lança e usa o valor do ambiente', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', TEST_SECRET);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const jwtConfig = await loadJwtConfig();

    expect(jwtConfig.JWT_SECRET).toBe(TEST_SECRET);
    expect(warn).not.toHaveBeenCalled();
  });

  it('produção com JWT_SECRET válido mantém signToken/verifyToken funcionando', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', TEST_SECRET);

    const jwtConfig = await loadJwtConfig();
    const token = jwtConfig.signToken({
      sub: '1',
      id: '1',
      tipo: 'cliente',
      role: 'cliente',
    });

    expect(jwtConfig.verifyToken(token).id).toBe('1');
  });

  it('development sem JWT_SECRET usa fallback e emite warning sem expor o segredo', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.JWT_SECRET;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const jwtConfig = await loadJwtConfig();

    expect(jwtConfig.JWT_SECRET).toBe(DEV_SECRET);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('desenvolvimento');
    expect(message).not.toContain(DEV_SECRET);
  });
});
