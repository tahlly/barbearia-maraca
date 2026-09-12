import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  obterResumoDespesas,
  listarDespesasDoProjeto,
  criarDespesaManual,
  editarDespesaManual,
  excluirDespesaManual,
} from '../services/despesa-service';
import {
  somarDespesasPeriodo,
  listarDespesas,
  buscarDespesaPorId,
  criarDespesa,
  atualizarDespesa,
  excluirDespesa,
} from '../repositories/despesa-repository';
import { buscarPorId as buscarFuncionarioPorId } from '../repositories/funcionario-repository';
import { exigirPermissao } from '../services/permissao-service';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';

vi.mock('../repositories/despesa-repository', () => ({
  somarDespesasPeriodo: vi.fn(),
  listarDespesas: vi.fn(),
  buscarDespesaPorId: vi.fn(),
  criarDespesa: vi.fn(),
  atualizarDespesa: vi.fn(),
  excluirDespesa: vi.fn(),
}));

vi.mock('../repositories/funcionario-repository', () => ({
  buscarPorId: vi.fn(),
}));

// O serviço valida a permissão efetiva `ver_financeiro` antes de somar
// (defesa em profundidade, mesmo com o middleware da rota).
vi.mock('../services/permissao-service', () => ({
  exigirPermissao: vi.fn(),
}));

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

function despesaDto(overrides: Partial<ReturnType<typeof criarDespesaMockReturn>> = {}) {
  return {
    id: 'd-1',
    descricao: 'Aluguel',
    tipo_despesa: 'fixa',
    valor: '45.90',
    data: '2026-09-01',
    recorrente: true,
    funcionario_id: null,
    automatica: false,
    ...overrides,
  };
}

// Retorno padrão dos mocks de repositório que devolvem DespesaDTO.
function criarDespesaMockReturn() {
  return {
    id: 'd-1',
    descricao: 'Aluguel',
    tipo_despesa: 'fixa' as const,
    valor: '45.90',
    data: '2026-09-01',
    recorrente: true,
    funcionario_id: null,
    automatica: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Padrão: usuário possui a permissão. Casos negativos ajustam o mock.
  vi.mocked(exigirPermissao).mockResolvedValue(undefined);
  vi.mocked(somarDespesasPeriodo).mockResolvedValue('57.5');
  vi.mocked(buscarFuncionarioPorId).mockResolvedValue(null);
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

describe('listarDespesasDoProjeto', () => {
  it('lista despesas repassando os filtros de período e tipo', async () => {
    vi.mocked(listarDespesas).mockResolvedValue([despesaDto()]);

    const resultado = await listarDespesasDoProjeto(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
      tipoDespesa: 'comissao',
    });

    expect(listarDespesas).toHaveBeenCalledWith({
      inicio: '2026-01-01',
      fim: '2026-12-31',
      tipoDespesa: 'comissao',
    });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].automatica).toBe(false);
  });

  it('lista sem filtros quando nenhum é informado', async () => {
    vi.mocked(listarDespesas).mockResolvedValue([]);

    await listarDespesasDoProjeto(usuario('admin'), 'admin', {});

    expect(listarDespesas).toHaveBeenCalledWith({});
  });

  it('exige inicio e fim juntos', async () => {
    await expect(
      listarDespesasDoProjeto(usuario('admin'), 'admin', { inicio: '2026-01-01' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(listarDespesas).not.toHaveBeenCalled();
  });

  it('rejeita intervalo inválido', async () => {
    await expect(
      listarDespesasDoProjeto(usuario('admin'), 'admin', {
        inicio: '2026-12-31',
        fim: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(listarDespesas).not.toHaveBeenCalled();
  });

  it('bloqueia quem não tem ver_financeiro', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      listarDespesasDoProjeto(usuario('cliente'), 'cliente', {}),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(listarDespesas).not.toHaveBeenCalled();
  });
});

describe('criarDespesaManual', () => {
  it('cria despesa manual e repassa os dados normalizados', async () => {
    vi.mocked(criarDespesa).mockResolvedValue(criarDespesaMockReturn());

    const resultado = await criarDespesaManual(usuario('admin'), 'admin', {
      descricao: 'Aluguel',
      tipo_despesa: 'fixa',
      valor: '45.90',
      data: '2026-09-01',
      recorrente: true,
    });

    expect(criarDespesa).toHaveBeenCalledWith({
      descricao: 'Aluguel',
      tipo_despesa: 'fixa',
      valor: '45.90',
      data: '2026-09-01',
      recorrente: true,
    });
    expect(resultado.automatica).toBe(false);
  });

  it('bloqueia criação de despesa com tipo comissao (regra de proteção)', async () => {
    await expect(
      criarDespesaManual(usuario('admin'), 'admin', {
        descricao: 'Comissão do João',
        tipo_despesa: 'comissao',
        valor: '10.00',
        data: '2026-09-01',
        recorrente: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(criarDespesa).not.toHaveBeenCalled();
  });

  it('rejeita descrição vazia', async () => {
    await expect(
      criarDespesaManual(usuario('admin'), 'admin', {
        descricao: '   ',
        tipo_despesa: 'fixa',
        valor: '10.00',
        data: '2026-09-01',
        recorrente: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(criarDespesa).not.toHaveBeenCalled();
  });

  it('rejeita valor negativo', async () => {
    await expect(
      criarDespesaManual(usuario('admin'), 'admin', {
        descricao: 'Aluguel',
        tipo_despesa: 'fixa',
        valor: '-5.00',
        data: '2026-09-01',
        recorrente: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(criarDespesa).not.toHaveBeenCalled();
  });

  it('rejeita data que não existe no calendário', async () => {
    await expect(
      criarDespesaManual(usuario('admin'), 'admin', {
        descricao: 'Aluguel',
        tipo_despesa: 'fixa',
        valor: '10.00',
        data: '2026-02-30',
        recorrente: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(criarDespesa).not.toHaveBeenCalled();
  });

  it('valida funcionario_id informado (inexistente → erro)', async () => {
    await expect(
      criarDespesaManual(usuario('admin'), 'admin', {
        descricao: 'Aluguel',
        tipo_despesa: 'fixa',
        valor: '10.00',
        data: '2026-09-01',
        recorrente: false,
        funcionarioId: 'func-inexistente',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(criarDespesa).not.toHaveBeenCalled();
  });

  it('aceita funcionario_id quando o funcionário existe', async () => {
    vi.mocked(buscarFuncionarioPorId).mockResolvedValue({ id: 'func-1' } as never);
    vi.mocked(criarDespesa).mockResolvedValue(criarDespesaMockReturn());

    await criarDespesaManual(usuario('admin'), 'admin', {
      descricao: 'Produto',
      tipo_despesa: 'variavel',
      valor: '20.00',
      data: '2026-09-01',
      recorrente: false,
      funcionarioId: 'func-1',
    });

    expect(criarDespesa).toHaveBeenCalledWith(
      expect.objectContaining({ funcionarioId: 'func-1' }),
    );
  });

  it('bloqueia quem não tem ver_financeiro', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      criarDespesaManual(usuario('cliente'), 'cliente', {
        descricao: 'Aluguel',
        tipo_despesa: 'fixa',
        valor: '10.00',
        data: '2026-09-01',
        recorrente: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(criarDespesa).not.toHaveBeenCalled();
  });
});

describe('editarDespesaManual', () => {
  it('edita despesa manual existente', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(despesaDto());
    vi.mocked(atualizarDespesa).mockResolvedValue(
      criarDespesaMockReturn(),
    );

    const resultado = await editarDespesaManual(usuario('admin'), 'admin', 'd-1', {
      descricao: 'Aluguel novo',
    });

    expect(atualizarDespesa).toHaveBeenCalledWith('d-1', { descricao: 'Aluguel novo' });
    expect(resultado.id).toBe('d-1');
  });

  it('bloqueia edição de despesa de comissão (automática)', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(
      despesaDto({ tipo_despesa: 'comissao', automatica: true }),
    );

    await expect(
      editarDespesaManual(usuario('admin'), 'admin', 'd-1', { descricao: 'X' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(atualizarDespesa).not.toHaveBeenCalled();
  });

  it('bloqueia tentativa de mudar o tipo para comissao', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(despesaDto());

    await expect(
      editarDespesaManual(usuario('admin'), 'admin', 'd-1', {
        tipo_despesa: 'comissao',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(atualizarDespesa).not.toHaveBeenCalled();
  });

  it('lança 404 quando a despesa não existe', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(null);

    await expect(
      editarDespesaManual(usuario('admin'), 'admin', 'nao-existe', {
        descricao: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(atualizarDespesa).not.toHaveBeenCalled();
  });

  it('bloqueia quem não tem ver_financeiro', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      editarDespesaManual(usuario('cliente'), 'cliente', 'd-1', {
        descricao: 'X',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(buscarDespesaPorId).not.toHaveBeenCalled();
  });
});

describe('excluirDespesaManual', () => {
  it('exclui despesa manual existente', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(despesaDto());
    vi.mocked(excluirDespesa).mockResolvedValue(true);

    await excluirDespesaManual(usuario('admin'), 'admin', 'd-1');

    expect(excluirDespesa).toHaveBeenCalledWith('d-1');
  });

  it('bloqueia exclusão de despesa de comissão (automática)', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(
      despesaDto({ tipo_despesa: 'comissao', automatica: true }),
    );

    await expect(
      excluirDespesaManual(usuario('admin'), 'admin', 'd-1'),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(excluirDespesa).not.toHaveBeenCalled();
  });

  it('lança 404 quando a despesa não existe', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(null);

    await expect(
      excluirDespesaManual(usuario('admin'), 'admin', 'nao-existe'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(excluirDespesa).not.toHaveBeenCalled();
  });

  it('lança 404 quando o repositório não removeu (sumiu entre leitura e del)', async () => {
    vi.mocked(buscarDespesaPorId).mockResolvedValue(despesaDto());
    vi.mocked(excluirDespesa).mockResolvedValue(false);

    await expect(
      excluirDespesaManual(usuario('admin'), 'admin', 'd-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('bloqueia quem não tem ver_financeiro', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      excluirDespesaManual(usuario('cliente'), 'cliente', 'd-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(buscarDespesaPorId).not.toHaveBeenCalled();
  });
});
