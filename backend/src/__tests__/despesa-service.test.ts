import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obterResumoDespesas } from '../services/despesa-service';
import { somarDespesasPeriodo } from '../repositories/despesa-repository';
import { exigirPermissao } from '../services/permissao-service';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';

vi.mock('../repositories/despesa-repository', () => ({
  somarDespesasPeriodo: vi.fn(),
}));

// O serviço valida a permissão efetiva `ver_financeiro` antes de somar
// (defesa em profundidade, mesmo com o middleware da rota).
vi.mock('../services/permissao-service', () => ({
  exigirPermissao: vi.fn(),
}));

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Padrão: usuário possui a permissão. Casos negativos ajustam o mock.
  vi.mocked(exigirPermissao).mockResolvedValue(undefined);
  vi.mocked(somarDespesasPeriodo).mockResolvedValue('57.5');
});

describe('obterResumoDespesas', () => {
  it('admin com ver_financeiro acessa o resumo e normaliza a soma para 2 casas', async () => {
    const resumo = await obterResumoDespesas(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(somarDespesasPeriodo).toHaveBeenCalledWith({
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });
    expect(resumo).toEqual({
      inicio: '2026-01-01',
      fim: '2026-12-31',
      despesaTotal: '57.50',
    });
  });

  it('retorna "0.00" quando não há despesas no período (repo retorna "0")', async () => {
    vi.mocked(somarDespesasPeriodo).mockResolvedValue('0');

    const resumo = await obterResumoDespesas(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumo.despesaTotal).toBe('0.00');
  });

  it('assume o intervalo do ano corrente quando inicio/fim não são informados', async () => {
    const anoAtual = new Date().getFullYear();

    const resumo = await obterResumoDespesas(usuario('admin'), 'admin', {});

    expect(somarDespesasPeriodo).toHaveBeenCalledWith({
      inicio: `${anoAtual}-01-01`,
      fim: `${anoAtual}-12-31`,
    });
    expect(resumo.inicio).toBe(`${anoAtual}-01-01`);
    expect(resumo.fim).toBe(`${anoAtual}-12-31`);
  });

  it('bloqueia quem não tem ver_financeiro (recepcionista por padrão)', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterResumoDespesas(usuario('recepcionista'), 'recepcionista', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(somarDespesasPeriodo).not.toHaveBeenCalled();
  });

  it('bloqueia profissional sem ver_financeiro (por padrão)', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterResumoDespesas(usuario('profissional'), 'profissional', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(somarDespesasPeriodo).not.toHaveBeenCalled();
  });

  it('bloqueia cliente (todas as permissões negadas por padrão)', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterResumoDespesas(usuario('cliente'), 'cliente', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(somarDespesasPeriodo).not.toHaveBeenCalled();
  });

  it('rejeita formato de data inválido', async () => {
    await expect(
      obterResumoDespesas(usuario('admin'), 'admin', { inicio: '01/01/2026' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(somarDespesasPeriodo).not.toHaveBeenCalled();
  });

  it('rejeita intervalo com inicio maior que fim', async () => {
    await expect(
      obterResumoDespesas(usuario('admin'), 'admin', {
        inicio: '2026-12-31',
        fim: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(somarDespesasPeriodo).not.toHaveBeenCalled();
  });
});